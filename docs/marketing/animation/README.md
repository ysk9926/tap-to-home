# 릴스 인트로·엔딩 제작

줄노트와 졸라맨은 Canvas, 움직임은 GSAP 3.14.2의 정지된 타임라인으로 만든다. `motion.js`가 인트로 8초와 엔딩 3초의 원본이다. `drawing.js`는 촬영 당시 앱의 앉기·달리기 포즈와 버튼 모양을 보관한다. 엔딩에서 개선한 누운 포즈와 눈 방향은 앱의 공용 `Stickman`에도 적용했다. 앱의 이후 수정은 이미 촬영한 영상에 자동 반영되지 않는다.

`hyperframes-animation`의 `waterfall-entry`, `css-marker-patterns`, `press-release-spring` 규칙을 Canvas 수치 프록시에 적용했다. UI 재생 시간은 `player.js`가 관리하며, 렌더용 문서에는 재생 UI를 포함하지 않는다. 타임라인은 동기적으로 구성하고, 그림은 타임라인 시간과 고정 좌표로 결정한다.

## 제작 순서

저장소 루트에서 실행한다. Python 3, Node.js, FFmpeg가 필요하다.

```sh
python3 docs/marketing/animation/build.py
npx --yes hyperframes@0.8.55 check output/hyperframes/intro
npx --yes hyperframes@0.8.55 check output/hyperframes/outro
npx --yes hyperframes@0.8.55 snapshot output/hyperframes/intro --at 1,2,3,4.5,7.1
npx --yes hyperframes@0.8.55 snapshot output/hyperframes/outro --at 0,1,2.967
npx --yes hyperframes@0.8.55 render output/hyperframes/intro -o output/reels/intro.mp4 --fps 30 --crf 19 --workers 2
npx --yes hyperframes@0.8.55 render output/hyperframes/outro -o output/reels/outro.mp4 --fps 30 --crf 19 --workers 2
python3 docs/marketing/animation/sound.py --output output/reels/effects-aligned.wav
python3 docs/marketing/animation/assemble.py --source /path/to/original-30s.mp4 --intro output/reels/intro.mp4 --outro output/reels/outro.mp4 --audio output/reels/effects-aligned.wav --output output/reels/tap-to-home-reel-30s.mp4
```

`build.py`가 갱신하는 미리보기:

- `../reel-intro-2026-09-20.html`: 8초 인트로, 재생·탐색·무음 영상 저장
- `../reel-outro-2026-09-20.html`: 3초 엔딩, 동일한 재생 기능
- 두 HTML 모두 글꼴·GSAP·그리기 코드를 내장해 로컬에서도 열린다. `?clean=1&t=3`으로 원하는 시점의 영상만 볼 수 있다.

`assemble.py`는 기존 30초 영상의 8–27초 앱 장면을 재사용하고 앞뒤 그림을 교체한다. `--audio`로 지정한 효과음을 AAC로 인코딩하며, 생략하면 원본 AAC를 복사한다. 출력 MP4·표지와 `../reel-video-2026-09-20.html`의 내장 영상을 함께 갱신한다. 원본과 출력 경로는 달라야 한다. 버전별 게시 페이지에도 새 MP4·표지를 반영해야 한다. 이 명령은 ERP·Google Drive에 게시하지 않는다.

`sound-cues.json`은 최종 영상의 30fps 프레임을 기준으로 한 효과음 목록이다. 브라우저 클릭 로그의 시간이 아니라 화면의 숫자·알림·버튼이 실제로 바뀌는 프레임에 맞춘다. `sound.py`는 고정 시드로 48kHz WAV와 큐 목록 JSON을 생성한다. 조용한 발소리·키보드 소리가 탭 소리만큼 커지지 않도록 고정 음량을 유지하고 피크를 −3dBFS 이하로 제한한다.

## 검증 범위

장면 경계는 2초·4.5초·8초·27초다. 책상·앉은 캐릭터와 달리는 캐릭터가 동시에 나오지 않고, 서로 다른 장면의 큰 자막도 겹치지 않는다. 엔딩 눈은 머리 중심을 기준으로 −90도 회전해 누운 몸의 방향에 맞췄다.

효과음 기준점은 인트로 버튼 첫 눌림 7.0초(210프레임), 순위 변경 14.9초(447), 신호 알림 17.6초(528), 퇴근 완료 20.9초(627)다. 랭킹 정지 화면에는 연타음을 넣지 않는다. 앱 탭 소리는 카운터 변경 프레임에 맞춘다. 최종 MP4에서 AAC를 디코딩해 WAV와의 시간차·피크·무음 구간을 확인한다. 앱 영상을 다시 촬영하거나 길이를 바꾸면 큐를 재검증해야 한다.

HyperFrames 검사와 animation-map은 시간·런타임을 검사한다. Canvas 내부 선의 충돌과 글자의 위치는 DOM 경계 검사로 알 수 없으므로 스냅샷을 직접 확인한다. 앞·뒤·임의 순서로 탐색한 프레임도 비교한다. 픽셀 비교 시 Canvas의 `willReadFrequently: true`를 사용해 브라우저가 중간에 GPU에서 CPU 래스터로 전환하며 생기는 가장자리 차이를 방지한다.

자체 포함 HTML은 생성물이므로 `drawing.js`, `motion.js`, `player.js`, `preview-template.html`을 수정한 뒤 다시 생성한다. GSAP의 라이선스 안내는 배포 파일 머리말에, Gaegu의 라이선스는 `assets/Gaegu-OFL.txt`에 보관한다.
