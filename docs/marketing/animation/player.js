// Preview controls are separate from the deterministic composition timeline.
(()=>{'use strict';
const canvas=document.getElementById('film');
const MODE=canvas.dataset.mode,DURATION=Number(canvas.dataset.duration),FPS=30;
const ui=Object.fromEntries(['seek','time','restart','play','export','loop','status','download'].map(id=>[id,document.getElementById(id)]));
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
let position=0,playing=false,ready=false,exporting=false,lastNow=null,recording=null,downloadURL=null;
function sync(){ui.seek.value=String(position);ui.time.value=`${position.toFixed(2)} / ${DURATION}초`;ui.play.textContent=playing?'일시정지':'재생';}
function setPlaying(next){if(!ready||exporting)return;if(next&&position>=DURATION)position=0;playing=next;lastNow=null;sync();}
function seek(value){if(exporting)return;position=clamp(Number(value)||0,0,DURATION);playing=false;lastNow=null;render(position);sync();}
function finishRecording(error){const current=recording;if(!current)return;recording=null;current.error=error;playing=false;if(current.recorder.state!=='inactive')current.recorder.stop();}
function tick(now){if(lastNow===null)lastNow=now;const delta=(now-lastNow)/1000;lastNow=now;if(playing){position=Math.min(position+Math.max(0,delta),DURATION);render(position);if(position>=DURATION){if(recording)finishRecording(null);else if(ui.loop.checked){position=0;}else playing=false;}sync();}requestAnimationFrame(tick);}
ui.restart.addEventListener('click',()=>{seek(0);setPlaying(true);});ui.play.addEventListener('click',()=>setPlaying(!playing));ui.seek.addEventListener('input',()=>seek(ui.seek.value));
function setLocked(value){exporting=value;for(const key of ['seek','restart','play','loop','export'])ui[key].disabled=value;}
function supportedMime(){if(typeof MediaRecorder==='undefined')return null;return ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type))||null;}
ui.export.addEventListener('click',()=>{const mime=supportedMime();if(!mime||typeof canvas.captureStream!=='function'){ui.status.textContent='이 브라우저에서는 영상 저장을 지원하지 않습니다. HTML을 최신 데스크톱 Chrome에서 열어주세요.';return;}if(document.hidden){ui.status.textContent='이 탭을 화면에 둔 상태에서 저장해주세요.';return;}let stream;try{setLocked(true);playing=false;position=0;render(0);sync();stream=canvas.captureStream(FPS);const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10_000_000});const state={recorder,chunks:[],error:null};recorder.addEventListener('dataavailable',event=>{if(event.data.size)state.chunks.push(event.data);});recorder.addEventListener('error',()=>finishRecording('영상 인코딩 중 오류가 발생했습니다. 다시 시도해주세요.'));recorder.addEventListener('stop',()=>{stream.getTracks().forEach(track=>track.stop());setLocked(false);if(state.error){ui.status.textContent=state.error;return;}const blob=new Blob(state.chunks,{type:recorder.mimeType||mime});if(!blob.size){ui.status.textContent='영상 데이터가 생성되지 않았습니다. 다시 시도해주세요.';return;}if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);ui.download.href=downloadURL;ui.download.download=`tap-to-home-${MODE}-${DURATION}s.${blob.type.includes('mp4')?'mp4':'webm'}`;ui.download.hidden=false;ui.status.textContent=`${DURATION}초 무음 영상이 준비됐습니다. 아래 링크로 저장하세요.`;});recording=state;recorder.start(250);lastNow=null;playing=true;ui.status.textContent=`${DURATION}초 영상을 만드는 중입니다. 이 탭을 화면에 두세요.`;}catch(error){stream?.getTracks().forEach(track=>track.stop());recording=null;setLocked(false);playing=false;ui.status.textContent='영상 저장을 시작할 수 없습니다. HTML을 내려받아 브라우저에서 다시 열어주세요.';}});
document.addEventListener('visibilitychange',()=>{lastNow=null;if(document.hidden&&recording)finishRecording('탭이 숨겨져 저장을 중단했습니다. 화면에 둔 상태에서 다시 저장해주세요.');else if(document.hidden){playing=false;sync();}});
window.addEventListener('pagehide',()=>{if(downloadURL)URL.revokeObjectURL(downloadURL);if(recording)finishRecording('페이지가 닫혔습니다.');});
const params=new URLSearchParams(location.search);if(params.get('clean')==='1')document.documentElement.classList.add('clean');
const initial=params.has('t')?clamp(Number(params.get('t'))||0,0,DURATION):0;
const api=window.tapToHomeMotion;
function render(t){api.render(t);}
api.ready.then(()=>{ready=true;render(initial);position=initial;sync();ui.export.disabled=false;ui.status.textContent='재생하거나 원하는 장면으로 이동할 수 있습니다.';requestAnimationFrame(tick);if(!params.has('t')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)setPlaying(true);}).catch(()=>{ui.status.textContent='손글씨 글꼴을 불러오지 못했습니다. 페이지를 다시 열어주세요.';});
})();
