import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

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
/// 이 셸은 웹뷰를 띄우고, 네이티브 기능(푸시 등)이 필요할 때만 JS 채널로 연결한다.
class WebShell extends StatefulWidget {
  const WebShell({super.key});

  @override
  State<WebShell> createState() => _WebShellState();
}

class _WebShellState extends State<WebShell> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFFFFDF5))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => setState(() => _loading = false),
        ),
      )
      // 웹 → 네이티브 브릿지. 웹에서 window.TapToHome.postMessage(json) 으로 호출.
      ..addJavaScriptChannel(
        'TapToHome',
        onMessageReceived: (message) {
          // TODO: 푸시 토큰 전달, 햅틱 등 네이티브 액션 분기
          debugPrint('bridge: ${message.message}');
        },
      )
      ..loadRequest(Uri.parse(kWebUrl));
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
