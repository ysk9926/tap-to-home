import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'push.dart';

/// 웹 앱 URL. 빌드/실행 시 --dart-define=WEB_URL=... 로 주입한다.
/// 예) flutter run --dart-define=WEB_URL=http://localhost:3000
const String kWebUrl = String.fromEnvironment(
  'WEB_URL',
  defaultValue: 'https://taptohome.site',
);
const Duration _webLoadTimeout = Duration(seconds: 15);
const Duration _resumeSignalTimeout = Duration(seconds: 2);
const String _nativeResumeEvent = 'tap-to-home:resume';

enum _WebShellStatus { loading, ready, failed }

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TapToHomeApp());
}

class TapToHomeApp extends StatelessWidget {
  const TapToHomeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Tap to Home',
      debugShowCheckedModeBanner: false,
      home: WebShell(),
    );
  }
}

/// 모든 기능과 액션은 웹(app/web)에서 구현한다.
/// 이 셸은 웹뷰를 띄우고, 네이티브 기능(푸시·햅틱)이 필요할 때만 JS 채널로 연결한다.
class WebShell extends StatefulWidget {
  const WebShell({super.key});

  @override
  State<WebShell> createState() => _WebShellState();
}

class _WebShellState extends State<WebShell> {
  late final WebViewController _controller;
  late final PushBridge _push;
  late final AppLifecycleListener _lifecycleListener;
  _WebShellStatus _status = _WebShellStatus.loading;
  Timer? _loadTimer;
  DateTime? _backgroundedAt;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController();
    _push = PushBridge(_controller);
    _controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFFFFDF5))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: _onPageStarted,
          onPageFinished: _onPageFinished,
          onWebResourceError: _onWebResourceError,
          onHttpError: _onHttpError,
        ),
      )
      // 웹 → 네이티브 브릿지. 웹에서 window.TapToHome.postMessage(json) 으로 호출.
      // 메시지 형식은 app/web 의 src/features/push/bridge.ts 와 맞춘다.
      ..addJavaScriptChannel(
        'TapToHome',
        onMessageReceived: (message) => _handleBridgeMessage(message.message),
      )
      ..loadRequest(Uri.parse(kWebUrl));

    _lifecycleListener = AppLifecycleListener(
      onHide: _markBackgrounded,
      onPause: _markBackgrounded,
      onResume: _onResume,
    );
    _armLoadTimeout();
    unawaited(_push.initialize());
  }

  void _onPageStarted(String _) {
    _push.onWebLoading();
    _armLoadTimeout();
    if (mounted) setState(() => _status = _WebShellStatus.loading);
  }

  void _onPageFinished(String _) {
    if (_status == _WebShellStatus.failed) return;
    _loadTimer?.cancel();
    if (mounted) setState(() => _status = _WebShellStatus.ready);
    _push.onWebReady();
  }

  void _onWebResourceError(WebResourceError error) {
    if (error.isForMainFrame != true) return;
    _showLoadFailure();
  }

  void _onHttpError(HttpResponseError error) {
    final statusCode = error.response?.statusCode;
    if (statusCode == null || statusCode < 500) return;
    unawaited(_failIfCurrentDocument(error.request?.uri));
  }

  Future<void> _failIfCurrentDocument(Uri? requestUri) async {
    if (requestUri == null) return;
    final currentUrl = await _controller.currentUrl();
    if (currentUrl == requestUri.toString()) _showLoadFailure();
  }

  void _armLoadTimeout() {
    _loadTimer?.cancel();
    _loadTimer = Timer(_webLoadTimeout, _showLoadFailure);
  }

  void _showLoadFailure() {
    _loadTimer?.cancel();
    _push.onWebLoading();
    if (mounted) setState(() => _status = _WebShellStatus.failed);
  }

  void _markBackgrounded() {
    _backgroundedAt ??= DateTime.now();
  }

  void _onResume() {
    final backgroundedFor = _backgroundedAt == null
        ? Duration.zero
        : DateTime.now().difference(_backgroundedAt!);
    _backgroundedAt = null;
    unawaited(_wakeWebContent(backgroundedFor));
  }

  Future<void> _wakeWebContent(Duration backgroundedFor) async {
    if (_status == _WebShellStatus.failed) {
      await _reloadCurrentPage();
      return;
    }
    if (_status != _WebShellStatus.ready) return;

    final detail = jsonEncode({
      'source': 'native',
      'backgroundedForMs': backgroundedFor.inMilliseconds,
    });
    final eventName = jsonEncode(_nativeResumeEvent);
    try {
      await _controller
          .runJavaScript(
            'window.dispatchEvent(new CustomEvent($eventName, {detail: $detail}));',
          )
          .timeout(_resumeSignalTimeout);
    } catch (_) {
      await _reloadCurrentPage();
    }
  }

  Future<void> _reloadCurrentPage() async {
    if (mounted) setState(() => _status = _WebShellStatus.loading);
    _push.onWebLoading();
    _armLoadTimeout();
    try {
      final currentUrl = await _controller.currentUrl();
      if (currentUrl == null) {
        await _controller.loadRequest(Uri.parse(kWebUrl));
      } else {
        await _controller.reload();
      }
    } catch (_) {
      _showLoadFailure();
    }
  }

  void _retry() {
    unawaited(_reloadCurrentPage());
  }

  @override
  void dispose() {
    _loadTimer?.cancel();
    _lifecycleListener.dispose();
    super.dispose();
  }

  void _handleBridgeMessage(String raw) {
    final Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      debugPrint('[bridge] not JSON: $raw');
      return;
    }
    if (decoded is! Map<String, dynamic>) return;

    switch (decoded['type']) {
      case 'push:request':
        unawaited(_push.requestPermissionAndRegister());
      case 'push:logout':
        unawaited(_push.deleteToken());
      case 'haptic':
        _haptic(decoded['style'] as String?);
      default:
        debugPrint('[bridge] unknown type: ${decoded['type']}');
    }
  }

  /// 연타 피드백. 웹뷰가 줄 수 없는 감각이라 셸이 맡는다
  void _haptic(String? style) {
    switch (style) {
      case 'heavy':
        HapticFeedback.heavyImpact();
      case 'medium':
        HapticFeedback.mediumImpact();
      default:
        HapticFeedback.lightImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_status == _WebShellStatus.loading)
              ColoredBox(
                color: const Color(0xFFFFFDF5),
                child: Image.asset(
                  'assets/images/splash.png',
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                  semanticLabel: '회사를 나와 집으로 달리는 졸라맨',
                ),
              ),
            if (_status == _WebShellStatus.failed)
              ColoredBox(
                color: const Color(0xFFFFFDF5),
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          '페이지를 불러오지 못했어요',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Color(0xFF302B27),
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          '인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Color(0xFF6E625B),
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 24),
                        OutlinedButton(
                          onPressed: _retry,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF302B27),
                            side: const BorderSide(
                              color: Color(0xFF302B27),
                              width: 1.5,
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 12,
                            ),
                          ),
                          child: const Text('다시 시도'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
