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
  defaultValue: 'http://localhost:3000',
);

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
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFFFFDF5))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => _push.onWebLoading(),
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
            _push.onWebReady();
          },
        ),
      )
      // 웹 → 네이티브 브릿지. 웹에서 window.TapToHome.postMessage(json) 으로 호출.
      // 메시지 형식은 app/web 의 src/features/push/bridge.ts 와 맞춘다.
      ..addJavaScriptChannel(
        'TapToHome',
        onMessageReceived: (message) => _handleBridgeMessage(message.message),
      )
      ..loadRequest(Uri.parse(kWebUrl));

    _push = PushBridge(_controller);
    unawaited(_push.initialize());
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
            if (_loading) const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}
