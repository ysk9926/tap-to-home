import 'dart:convert';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 퇴근 신호 백그라운드 푸시 (docs/decisions/0006-native-push-fcm.md).
///
/// 이 셸이 하는 일은 셋뿐이다.
///   1. 알림 권한을 묻는다
///   2. FCM 토큰을 받아 웹에 넘긴다
///   3. 알림을 눌러 앱이 열리면 해당 경로를 웹뷰에 띄운다
///
/// 토큰 저장·발송·중복 억제는 전부 웹 서버 몫이다. 셸에 기능 로직을 넣지 않는다.

/// 백그라운드에서 메시지가 도착했을 때. 최상위 함수여야 한다 (별도 isolate 에서 실행).
///
/// 알림 표시는 OS 가 `notification` 필드를 보고 알아서 한다. 여기서 할 일이 없지만,
/// 핸들러를 등록해 두지 않으면 일부 Android 기기에서 data 메시지가 버려진다.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class PushBridge {
  PushBridge(this._controller);

  final WebViewController _controller;

  /// 웹이 아직 준비되지 않았을 때 받은 토큰. 페이지 로드가 끝나면 흘려보낸다
  String? _pendingToken;
  bool _webReady = false;
  bool _initialized = false;

  String get _platform => Platform.isIOS ? 'ios' : 'android';

  /// 앱 시작 시 한 번. Firebase 설정 파일이 없으면 조용히 비활성으로 남는다
  Future<void> initialize() async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      _initialized = true;
    } catch (e) {
      // GoogleService-Info.plist / google-services.json 이 없는 빌드. 푸시 없이 동작한다
      debugPrint('[push] Firebase init failed, running without push: $e');
    }
  }

  /// 웹이 `{"type":"push:request"}` 를 보내오면 호출한다.
  /// 권한을 묻고, 승인되면 토큰을 받아 웹으로 돌려준다.
  Future<void> requestPermissionAndRegister() async {
    if (!_initialized) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus != AuthorizationStatus.authorized &&
          settings.authorizationStatus != AuthorizationStatus.provisional) {
        debugPrint('[push] permission denied: ${settings.authorizationStatus}');
        return;
      }

      // iOS 는 APNs 토큰이 먼저 붙어야 FCM 토큰이 나온다. 아직이면 이번 실행은 건너뛴다
      if (Platform.isIOS && await messaging.getAPNSToken() == null) {
        debugPrint('[push] APNs token not ready yet');
        return;
      }

      final token = await messaging.getToken();
      if (token != null) _sendTokenToWeb(token);

      // 토큰은 재발급될 수 있다. 바뀌면 다시 올린다
      messaging.onTokenRefresh.listen(_sendTokenToWeb);
    } catch (e) {
      debugPrint('[push] registration failed: $e');
    }
  }

  /// 웹이 로그아웃했다고 알려오면 토큰을 폐기한다.
  /// 서버 행 삭제는 웹이 `DELETE /api/push/tokens` 로 직접 한다.
  Future<void> deleteToken() async {
    if (!_initialized) return;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      debugPrint('[push] deleteToken failed: $e');
    }
  }

  /// 웹 페이지 로드가 끝났다. 밀어두었던 토큰이 있으면 지금 넘긴다
  void onWebReady() {
    _webReady = true;
    final pending = _pendingToken;
    if (pending != null) {
      _pendingToken = null;
      _sendTokenToWeb(pending);
    }
  }

  /// 페이지를 떠나면 다시 준비될 때까지 보류한다
  void onWebLoading() {
    _webReady = false;
  }

  void _sendTokenToWeb(String token) {
    if (!_webReady) {
      _pendingToken = token;
      return;
    }
    // 웹의 window.TapToHomeNative.registerPushToken(token, platform) 을 부른다
    final js =
        'window.TapToHomeNative && window.TapToHomeNative.registerPushToken('
        '${jsonEncode(token)}, ${jsonEncode(_platform)})';
    _controller.runJavaScript(js).catchError((Object e) {
      debugPrint('[push] failed to hand the token to the web: $e');
    });
  }
}
