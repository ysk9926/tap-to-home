// HyperFrames: one paused timeline per composition. All drawing is a function of time.
// Atomic rules: waterfall-entry, css-marker-patterns, press-release-spring.
const motion = {
  time: 0,
  first: { y: MODE === 'outro' ? 40 : 48 }, second: { y: 48 }, third: { y: 48 },
  marker: { scaleX: 0 }, endMarker: { scaleX: 0 },
  button: { scale: 1 }, cursor: { x: 925, y: 1560 },
  brand: { y: 36 }, cta: { y: 30 },
};
const tl = gsap.timeline({ paused: true, onUpdate: () => drawFrame(motion.time) });

function arrive(target, at, distance = 48, duration = .18) {
  tl.fromTo(target, { y: distance }, { y: 0, duration, ease: 'power4.out', immediateRender: false }, at);
}

if (MODE === 'intro') {
  // Hard scene boundaries prevent the office and the runner, or two titles, overlapping.
  arrive(motion.first, 0, 48, .2);
  arrive(motion.second, 2, 48, .18);
  arrive(motion.third, 2.16, 60, .16);
  tl.fromTo(motion.marker, { scaleX: 0 }, { scaleX: 1, duration: .4, ease: 'power2.out' }, 2.26);
  arrive(motion.brand, 4.5, 48, .2);
  arrive(motion.cta, 4.67, 60, .18);
  tl.fromTo(motion.cursor, { x: 925, y: 1560 }, { x: 730, y: 1305, duration: .8, ease: 'power3.out' }, 6.05);
  // First pressed output frame is 210 (7.0s); release starts at 7.1s.
  tl.fromTo(motion.button, { scale: 1 }, { scale: .92, duration: .12, ease: 'none', immediateRender: false }, 6.98);
  tl.fromTo(motion.button, { scale: .92 }, { scale: 1, duration: .48, ease: 'back.out(1.4)', immediateRender: false }, 7.1);
} else {
  arrive(motion.first, 0, 40, .18);
  arrive(motion.second, .16, 48, .18);
  tl.fromTo(motion.endMarker, { scaleX: 0 }, { scaleX: 1, duration: .4, ease: 'power2.out' }, .26);
  arrive(motion.brand, .38, 36, .2);
  arrive(motion.cta, .55, 30, .18);
}

function marker(x, y, width, height, scale) {
  withState(() => {
    ctx.translate(x, y);
    ctx.scale(scale, 1);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(0, 0, width, height);
  });
}

function deskScene(t) {
  path('M285 1260 Q550 1254 910 1260', 3);
  path('M364 1040 L365 1115 Q408 1118 468 1115 M365 1115 L360 1255 M459 1115 L466 1255', 5);
  person('sit', 302, 900, 6.2, t);
  path('M520 1103 Q697 1099 860 1103 M556 1106 L552 1255 M824 1106 L830 1255', 6);
  path('M624 870 Q711 866 811 872 L810 1030 Q726 1034 624 1030 Z M715 1033 L716 1080 M671 1082 Q716 1079 755 1082', 5);
  path('M646 898 H723 M646 922 H780 M646 946 H762 M646 970 H710', 3, C.soft);
  path('M532 1090 L592 1090 M555 1081 H590', 3);
  ctx.strokeStyle = C.pencil;
  oval(784, 675, 73, 75, 4);
  path('M784 674 L735 674 M784 674 L788 615', 5);
  text('09:01', 784, 793, 44);
}

function thought(t) {
  // The office is absent in this shot. Runner and destination share the same ground.
  path('M250 1260 Q585 1256 977 1260', 3, C.soft);
  withState(() => {
    ctx.translate(680, 906);
    ctx.scale(12, 12);
    path(housePath, .65, C.pencil);
  });
  const progress = ease(range(t, 2.12, 4.32));
  const x = 235 + 280 * progress;
  const y = 950 - Math.abs(Math.sin((t - 2) * Math.PI * 3.5)) * 5;
  person('run', x, y, 5.6, t);
  text('마음', x + 128, y - 25, 46);
  text('집', 858, 885, 50, 1, 'center', C.soft);
}

function introButton(t) {
  withState(() => {
    ctx.translate(540, 1100);
    ctx.scale(2.6 * motion.button.scale, 2.6 * motion.button.scale);
    ctx.translate(-112, -112);
    ctx.fillStyle = t >= 6.98 ? C.yellow : C.paper;
    ctx.fill(buttonPath);
    path(buttonPath, 3.4, C.ink);
    withState(() => { ctx.globalAlpha = .55; path(buttonSecond, 1.7, C.ink); });
    text('퇴근하고', 112, 104, 41);
    text('싶다!', 112, 145, 41);
  });
  if (t >= 6.05) withState(() => {
    ctx.translate(motion.cursor.x, motion.cursor.y);
    ctx.rotate(-.25);
    ctx.fillStyle = C.paper;
    ctx.fill(cursorPath);
    path(cursorPath, 5);
  });
  if (t >= 7.1 && t < 7.65) withState(() => {
    ctx.globalAlpha = 1 - range(t, 7.1, 7.65);
    ctx.strokeStyle = C.pencil;
    const r = 30 + 100 * range(t, 7.1, 7.65);
    oval(730, 1305, r, r, 4);
  });
}

function intro(t) {
  text('퇴근 관찰 일지', 150, 247, 38, 1, 'left', C.soft);
  text('01', 938, 247, 36, 1, 'right', C.soft);
  if (t < 2) {
    text('출근은 했는데.', 540, 475 + motion.first.y, 115);
    deskScene(t);
  } else if (t < 4.5) {
    text('마음은 벌써', 540, 438 + motion.second.y, 113);
    marker(355, 551, 384, 38, motion.marker.scaleX);
    if (t >= 2.16) text('집에.', 540, 593 + motion.third.y, 131);
    thought(t);
  } else {
    text('그 마음,', 540, 465 + motion.brand.y, 123);
    if (t >= 4.67) text('눌러보자.', 540, 620 + motion.cta.y, 137);
    introButton(t);
    text('Tap to Home', 540, 1620, 93);
    text('내 마음의 퇴근 버튼', 540, 1705, 46, 1, 'center', C.soft);
  }
  if (t < 4.5) {
    text('몸은 회사에.', 540, 1505, 53);
    text('아직 퇴근까지 한참 남았다.', 540, 1580, 45, 1, 'center', C.soft);
  }
}

function restingPerson(t) {
  withState(() => {
    ctx.translate(352, 950);
    ctx.scale(6.5, 6.5);
    // Radius 7, head center (12, 47): neck starts at its right edge (19, 47).
    // Both arms attach at the shoulder and stay to the right of the head.
    path('M19 47 L35 47 M35 47 L45 43 L52 47 M35 47 L44 53 L54 53', 1.7);
    const breath = .45 * Math.sin(t * Math.PI * 2 / 3);
    path(`M23 47 L28 ${42 - breath} L33 45 M23 47 L28 51 L33 49`, 1.7);
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.arc(12, 47, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Rotate the closed eyes with the reclining body, around the head's center.
    withState(() => {
      ctx.translate(12, 47);
      ctx.rotate(-Math.PI / 2);
      path('M-3.5 -1 Q-2 0 -.5 -1 M1.5 -1 Q3 0 4.5 -1', 1.3);
    });
  });
}

function outro(t) {
  text('퇴근 관찰 일지', 540, 245, 38, 1, 'center', C.soft);
  text('몸은 회사에,', 540, 435 + motion.first.y, 116);
  marker(212, 566, 658, 44, motion.endMarker.scaleX);
  if (t >= .16) text('마음은 집에.', 540, 612 + motion.second.y, 126);
  path('M228 1110 Q390 945 540 812 Q692 950 855 1107 M289 1053 L291 1330 M798 1052 L802 1330 M248 1335 Q546 1328 846 1335', 7);
  // Mattress supports the head and feet; posts sit outside the character silhouette.
  path('M360 1308 Q558 1304 741 1308 M360 1242 V1344 M741 1242 V1344', 6);
  restingPerson(t);
  // Sleep marks stay above the pillow, comfortably inside the roof outline.
  text('z', 431, 1124 - Math.sin(t * 2) * 6, 54, 1, 'center', C.soft);
  text('z', 476, 1074 - Math.sin(t * 2) * 6, 39, 1, 'center', C.soft);
  if (t >= .38) text('Tap to Home', 540, 1485 + motion.brand.y, 122);
  if (t >= .55) {
    text('친구와 퇴근 레이스 시작', 540, 1630 + motion.cta.y, 66);
    text('tap-to-home-web.vercel.app', 540, 1720 + motion.cta.y, 40, 1, 'center', C.soft);
  }
}

function drawFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  paper();
  if (MODE === 'intro') intro(t); else outro(t);
}

// The proxy keeps procedural motion deterministic, including reverse/random seeks.
tl.fromTo(motion, { time: 0 }, { time: DURATION, duration: DURATION, ease: 'none' }, 0);
window.__timelines = window.__timelines || {};
window.__timelines[MODE] = tl;
const render = seconds => {
  const t = clamp(Number(seconds) || 0, 0, DURATION);
  tl.totalTime(t, false);
  drawFrame(t);
  return t;
};
const ready = document.fonts.load('700 120px ReelGaegu', '퇴근 관찰 일지 출근은 했는데 마음은 벌써 집에 몸은 회사에 아직 퇴근까지 한참 남았다 그 마음 눌러보자 퇴근하고 싶다 내 마음의 퇴근 버튼 친구와 레이스 시작 Tap to Home 09:01 01 z').then(() => { drawFrame(motion.time); });
window.tapToHomeMotion = { render, ready, duration: DURATION };
drawFrame(0);
