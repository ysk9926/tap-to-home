import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tap_to_home_mobile/main.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';

void main() {
  late FakeWebViewPlatform platform;

  setUp(() {
    platform = FakeWebViewPlatform();
    WebViewPlatform.instance = platform;
  });

  testWidgets('메인 문서 로드 실패 시 다시 시도 화면을 표시한다', (tester) async {
    await tester.pumpWidget(const TapToHomeApp());
    platform.navigationDelegate.onPageStarted?.call('https://taptohome.site');
    platform.navigationDelegate.onWebResourceError?.call(
      const WebResourceError(
        errorCode: -1009,
        description: 'offline',
        errorType: WebResourceErrorType.connect,
        isForMainFrame: true,
        url: 'https://taptohome.site',
      ),
    );
    await tester.pump();

    expect(find.text('페이지를 불러오지 못했어요'), findsOneWidget);
    expect(find.text('다시 시도'), findsOneWidget);
  });

  testWidgets('앱 복귀 시 웹에 네이티브 resume 이벤트를 보낸다', (tester) async {
    await tester.pumpWidget(const TapToHomeApp());
    platform.navigationDelegate.onPageFinished?.call('https://taptohome.site');
    await tester.pump();
    platform.controller.javaScriptCalls.clear();

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();

    expect(platform.controller.javaScriptCalls, hasLength(1));
    expect(platform.controller.javaScriptCalls.single, contains('tap-to-home:resume'));
  });

  testWidgets('메인 문서가 15초 동안 끝나지 않으면 재시도 화면을 표시한다', (tester) async {
    await tester.pumpWidget(const TapToHomeApp());
    platform.navigationDelegate.onPageStarted?.call('https://taptohome.site');

    await tester.pump(const Duration(seconds: 15));

    expect(find.text('페이지를 불러오지 못했어요'), findsOneWidget);
  });

  testWidgets('현재 문서가 5xx를 반환하면 재시도 화면을 표시한다', (tester) async {
    await tester.pumpWidget(const TapToHomeApp());
    platform.navigationDelegate.onHttpError?.call(
      HttpResponseError(
        request: WebResourceRequest(uri: Uri.parse('https://taptohome.site')),
        response: WebResourceResponse(
          uri: Uri.parse('https://taptohome.site'),
          statusCode: 503,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('페이지를 불러오지 못했어요'), findsOneWidget);
  });
}

class FakeWebViewPlatform extends WebViewPlatform {
  late final FakeWebViewController controller;
  late final FakeNavigationDelegate navigationDelegate;

  @override
  PlatformWebViewController createPlatformWebViewController(
    PlatformWebViewControllerCreationParams params,
  ) => controller = FakeWebViewController(params);

  @override
  PlatformWebViewWidget createPlatformWebViewWidget(
    PlatformWebViewWidgetCreationParams params,
  ) => FakeWebViewWidget(params);

  @override
  PlatformWebViewCookieManager createPlatformCookieManager(
    PlatformWebViewCookieManagerCreationParams params,
  ) => FakeCookieManager(params);

  @override
  PlatformNavigationDelegate createPlatformNavigationDelegate(
    PlatformNavigationDelegateCreationParams params,
  ) => navigationDelegate = FakeNavigationDelegate(params);
}

class FakeWebViewController extends PlatformWebViewController {
  FakeWebViewController(super.params) : super.implementation();

  final List<String> javaScriptCalls = [];
  int reloadCalls = 0;

  @override
  Future<void> setJavaScriptMode(JavaScriptMode javaScriptMode) async {}

  @override
  Future<void> setBackgroundColor(Color color) async {}

  @override
  Future<void> setPlatformNavigationDelegate(
    PlatformNavigationDelegate handler,
  ) async {}

  @override
  Future<void> addJavaScriptChannel(JavaScriptChannelParams params) async {}

  @override
  Future<void> loadRequest(LoadRequestParams params) async {}

  @override
  Future<String?> currentUrl() async => 'https://taptohome.site';

  @override
  Future<void> runJavaScript(String javaScript) async {
    javaScriptCalls.add(javaScript);
  }

  @override
  Future<void> reload() async {
    reloadCalls += 1;
  }
}

class FakeCookieManager extends PlatformWebViewCookieManager {
  FakeCookieManager(super.params) : super.implementation();
}

class FakeWebViewWidget extends PlatformWebViewWidget {
  FakeWebViewWidget(super.params) : super.implementation();

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class FakeNavigationDelegate extends PlatformNavigationDelegate {
  FakeNavigationDelegate(super.params) : super.implementation();

  PageEventCallback? onPageStarted;
  PageEventCallback? onPageFinished;
  WebResourceErrorCallback? onWebResourceError;
  HttpResponseErrorCallback? onHttpError;

  @override
  Future<void> setOnPageStarted(PageEventCallback callback) async {
    onPageStarted = callback;
  }

  @override
  Future<void> setOnPageFinished(PageEventCallback callback) async {
    onPageFinished = callback;
  }

  @override
  Future<void> setOnWebResourceError(
    WebResourceErrorCallback callback,
  ) async {
    onWebResourceError = callback;
  }

  @override
  Future<void> setOnHttpError(HttpResponseErrorCallback callback) async {
    onHttpError = callback;
  }
}
