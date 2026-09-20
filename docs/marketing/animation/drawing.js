// Shared notebook drawing primitives. Coordinates are authored at 1080 × 1920.
const C={paper:'#fffdf5',ink:'#2b2b2b',pencil:'#3a3a3a',soft:'#8a8a86',line:'#c9d6ea',margin:'#f4a3a3',yellow:'#fff3a3'};
const POSES={"sit": {"frames": ["M20 18 L17 34 M17 34 L29 35 L29 54 L34 56 M20 35 L25 39 L24 54 L28 55 M19 26 L28 30 L35 30", "M20 18 L17 34 M17 34 L29 35 L29 54 L34 56 M20 35 L25 39 L24 54 L28 55 M19 26 L29 28 L35 30"], "head": [20, 11]}, "run": {"frames": ["M23 18 L18 36 M18 36 L5 47 M18 36 L32 44 L30 54 M21 25 L32 16 M21 25 L9 29 M1 20 H7 M0 27 H5", "M23 18 L18 36 M18 36 L11 52 M18 36 L30 42 M21 25 L30 34 M21 25 L10 18 M1 20 H7 M0 27 H5"], "head": [24, 11]}};
const paths=Object.fromEntries(Object.entries(POSES).map(([key,v])=>[key,v.frames.map(d=>new Path2D(d))]));
const buttonPath=new Path2D('M112 14 C170 10 214 52 212 112 C210 172 166 212 110 212 C50 212 12 168 14 110 C16 50 56 18 112 14 Z');
const buttonSecond=new Path2D('M112 22 C160 20 204 58 204 112 C204 164 162 204 112 204');
const housePath=new Path2D('M2.8 18.4 Q9.4 12 15.2 6.4 Q21 12.2 27.6 18.1 M6.4 15 L6 29.2 M24.2 14.8 L24.6 29.2 M1.8 29.4 Q15 28.6 28.6 29.3 M11.6 29.2 L11.5 21.2 Q13.6 20.5 15.8 21.2 L15.9 29.2 M18.4 19.6 L22.4 19.5 L22.5 23.5 L18.5 23.6 Z');
const cursorPath=new Path2D('M0 0 L-9 74 L12 59 L31 91 L47 82 L29 51 L56 47 Z');
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const ease=p=>1-Math.pow(1-clamp(p),3);
const range=(t,a,b)=>clamp((t-a)/(b-a));
function withState(fn){ctx.save();try{fn();}finally{ctx.restore();}}
function path(d,width=4,color=C.pencil){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(typeof d==='string'?new Path2D(d):d);}
function text(s,x,y,size=70,alpha=1,align='center',color=C.ink){withState(()=>{ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.font=`700 ${size}px ReelGaegu, "Apple SD Gothic Neo", sans-serif`;ctx.fillText(s,x,y);});}
function oval(x,y,rx,ry,width=4){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.lineWidth=width;ctx.stroke();}
function paper(){ctx.fillStyle=C.paper;ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.strokeStyle=C.line;ctx.lineWidth=1.5;for(let y=160;y<HEIGHT;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}ctx.strokeStyle=C.margin;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(100,0);ctx.lineTo(100,HEIGHT);ctx.stroke();}
function person(pose,x,y,scale,t,alpha=1){withState(()=>{ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha*=alpha;const def=POSES[pose];ctx.strokeStyle=C.pencil;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(def.head[0],def.head[1],7,0,Math.PI*2);ctx.stroke();path(`M${def.head[0]-3} ${def.head[1]-1} v2 M${def.head[0]+3} ${def.head[1]-1} v2`,1.7);ctx.stroke(paths[pose][Math.floor(t*7)%2]);});}
