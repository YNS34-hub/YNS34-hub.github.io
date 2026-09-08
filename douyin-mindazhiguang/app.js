const COVER_CHUNKS={post01:1,post02:1,post03:1,post04:1,post05:1};
async function loadCover(key,selector){try{const parts=await Promise.all(Array.from({length:COVER_CHUNKS[key]},(_,i)=>fetch(`assets/${key}_${i}.b64`).then(r=>{if(!r.ok)throw new Error(r.status);return r.text();})));const el=document.querySelector(selector);if(el)el.style.backgroundImage=`linear-gradient(180deg,rgba(3,8,10,.03),rgba(3,8,10,.28)),url("data:image/webp;base64,${parts.join('')}")`;}catch(e){console.warn('cover load failed',key,e);}}
[['post01','.w1 .fill'],['post02','.w2 .fill'],['post03','.w3 .fill'],['post04','.w4 .fill'],['post05','.w5 .fill']].forEach(([k,s])=>loadCover(k,s));

'use strict';
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE=matchMedia('(hover:hover) and (pointer:fine)').matches;
const canvas=document.getElementById('fluid');
const gl=canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'});
const FRAG=`
precision highp float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uScroll;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,r=0.;for(int i=0;i<4;i++){r+=a*noise(p);p*=2.02;a*=.5;}return r;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float map(vec3 p){float t=uTime*.22;vec3 q=p;q.xz*=rot(t*.6+uMouse.x*.9);q.xy*=rot(uMouse.y*.55);float base=length(q)-1.05;float n=fbm(q*1.7+vec3(0.,t*1.1,t*.7));float ripple=.05*sin(q.x*7.+t*4.)*sin(q.y*6.-t*3.);return (base+(n-.5)*.62+ripple)*.55;}
vec3 norm(vec3 p){vec2 e=vec2(.0018,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
vec3 pal(float t){return .5+.5*cos(6.28318*(t+vec3(0.,.33,.67)));}
void main(){vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);float s=uScroll;vec2 drift=vec2(sin(s*4.2)*1.05,cos(s*3.1)*.38-.05);float dist=3.2+1.1*sin(s*3.14159)-1.2*smoothstep(.85,1.,s);vec3 ro=vec3(drift.x,drift.y,dist);vec3 rd=normalize(vec3(uv,-1.6));float tt=0.,dmin=1e3,hit=-1.;for(int i=0;i<64;i++){vec3 p=ro+rd*tt;float d=map(p);dmin=min(dmin,d);if(d<.002){hit=tt;break;}tt+=d;if(tt>8.)break;}vec3 col=vec3(.039,.039,.043);col+=.025*pal(uv.y*.25+s*.6+.55)*(1.-length(uv)*.7);if(hit>0.){vec3 p=ro+rd*hit;vec3 n=norm(p);float fre=pow(1.-max(dot(n,-rd),0.),2.4);float m=fbm(p*1.4+uTime*.18);vec3 iri=pal(m*.85+n.y*.25+s*.5+.08);iri=mix(iri,mix(vec3(.145,.957,.933),vec3(.996,.173,.333),smoothstep(-.5,.75,n.x)),.26*smoothstep(.45,.9,fre));vec3 l=normalize(vec3(.6,.8,.5));float dif=max(dot(n,l),0.);float spec=pow(max(dot(reflect(-l,n),-rd),0.),40.);col=vec3(.02,.02,.025);col+=iri*(fre*1.15+.06);col+=mix(vec3(.145,.957,.933),vec3(.996,.173,.333),.22)*spec*.9;col+=iri*dif*.1;}else{col+=vec3(.145,.957,.933)*pow(max(0.,1.-dmin*1.2),6.)*.22;}col*=1.-.35*pow(length(uv*vec2(.8,1.)),2.2);gl_FragColor=vec4(col,1.);}`;
let glReady=false,LU={};
function initGL(){if(!gl)return;const mk=(t,src)=>{const sh=gl.createShader(t);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(sh));return null;}return sh;};const vs=mk(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');const fs=mk(gl.FRAGMENT_SHADER,FRAG);if(!vs||!fs)return;const pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);gl.useProgram(pr);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);['uRes','uTime','uMouse','uScroll'].forEach(n=>LU[n]=gl.getUniformLocation(pr,n));glReady=true;}
function sizeGL(){const d=Math.min(devicePixelRatio||1,1.75);canvas.width=innerWidth*d;canvas.height=innerHeight*d;if(gl)gl.viewport(0,0,canvas.width,canvas.height);}
function drawGL(t,mx,my,sp){if(!glReady)return;gl.uniform2f(LU.uRes,canvas.width,canvas.height);gl.uniform1f(LU.uTime,t);gl.uniform2f(LU.uMouse,mx,my);gl.uniform1f(LU.uScroll,sp);gl.drawArrays(gl.TRIANGLES,0,3);}
initGL();sizeGL();addEventListener('resize',sizeGL);
let tMX=0,tMY=0,mx=0,my=0,sp=0,cur=0,tgt=0,vel=0;
addEventListener('pointermove',e=>{tMX=(e.clientX/innerWidth)*2-1;tMY=-((e.clientY/innerHeight)*2-1);},{passive:true});
const shell=document.getElementById('shell');
const SMOOTH=FINE&&!REDUCED;
let shellH=0,pcur=0,cx=innerWidth/2,cy=innerHeight/2;
addEventListener('pointermove',e=>{cx=e.clientX;cy=e.clientY;},{passive:true});
if(SMOOTH){document.body.classList.remove('native-scroll');new ResizeObserver(()=>{shellH=shell.getBoundingClientRect().height;document.body.style.height=shellH+'px';}).observe(shell);}
function shuffled(n){const a=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;}
document.querySelectorAll('.line[data-text]').forEach(line=>{const txt=line.dataset.text,ord=shuffled(txt.length);line.innerHTML=[...txt].map((c,i)=>`<span class="char" style="--i:${ord[i]}">${c}</span>`).join('');});
const heroTitle=document.getElementById('heroTitle');
const showHero=()=>heroTitle.classList.add('is-in');
(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(showHero,150));setTimeout(showHero,900);
const mt=document.getElementById('manifestoText');
{const parts=[];mt.childNodes.forEach(nd=>{if(nd.nodeType===3)[...nd.textContent].forEach(c=>parts.push([c,false]));else [...nd.textContent].forEach(c=>parts.push([c,true]));});const ord=shuffled(parts.length);mt.innerHTML=parts.map(([c,hl],i)=>`<span class="w"><i class="${hl?'hl':''}" style="--i:${ord[i]}">${c===' '?'&nbsp;':c}</i></span>`).join('');}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}}),{threshold:.18});
document.querySelectorAll('[data-reveal], .work, #manifesto').forEach(el=>io.observe(el));
if(REDUCED)document.querySelectorAll('[data-reveal], .work, #manifesto, #heroTitle').forEach(el=>el.classList.add('is-in'));
const mq=document.getElementById('marquee');mq.innerHTML=mq.innerHTML.repeat(4);let mqX=0,mqP=1;const sizeMQ=()=>{mqP=mq.scrollWidth/4||1;};addEventListener('resize',sizeMQ);sizeMQ();
const dot=document.querySelector('.cursor-dot'),ring=document.querySelector('.cursor-ring');let rx=cx,ry=cy;
if(FINE){document.body.classList.add('has-cursor');document.addEventListener('pointerover',e=>{const t=e.target.closest('a,button,[data-work]');ring.classList.toggle('is-hover',!!t);ring.classList.toggle('is-play',!!e.target.closest('[data-work]'));});}
const mag=document.querySelector('[data-magnetic]');
document.querySelectorAll('[data-work]').forEach(card=>{card.tabIndex=0;card.setAttribute('role','link');card.setAttribute('aria-label','打开民大之光的抖音主页');const go=()=>window.open('https://www.douyin.com/search/mindazhiguan','_blank','noopener');card.addEventListener('click',go);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
const clock=document.getElementById('clock');
const tickClock=()=>clock.textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'});tickClock();setInterval(tickClock,1000);
const thumbs=[...document.querySelectorAll('.work .thumb')];let skew=0;const t0=performance.now();
function tick(now){const t=(now-t0)/1000;mx+=(tMX-mx)*.045;my+=(tMY-my)*.045;tgt=scrollY;if(SMOOTH){cur+=(tgt-cur)*.085;if(Math.abs(tgt-cur)<.05)cur=tgt;shell.style.transform=`translate3d(0,${-cur}px,0)`;}else cur=tgt;const nv=cur-pcur;vel+=(nv-vel)*.12;pcur=cur;const maxS=Math.max(1,(SMOOTH?shellH:document.documentElement.scrollHeight)-innerHeight);sp+=(Math.min(Math.max(cur/maxS,0),1)-sp)*.07;drawGL(t,mx,my,sp);mqX-=1.2+vel*.12;while(mqX<=-mqP)mqX+=mqP;while(mqX>0)mqX-=mqP;mq.style.transform=`translate3d(${mqX}px,0,0)`;const sk=Math.max(-5,Math.min(5,vel*.05));skew+=(sk-skew)*.1;if(Math.abs(skew)>.01)thumbs.forEach(th=>th.style.transform=`skewY(${skew}deg)`);if(FINE){dot.style.transform=`translate3d(${cx-3}px,${cy-3}px,0)`;rx+=(cx-rx)*.16;ry+=(cy-ry)*.16;const r=ring.offsetWidth/2;ring.style.transform=`translate3d(${rx-r}px,${ry-r}px,0)`;}if(FINE&&mag){const b=mag.getBoundingClientRect(),bx=b.left+b.width/2,by=b.top+b.height/2;const dx=cx-bx,dy=cy-by,d=Math.hypot(dx,dy);mag.style.transform=d<140?`translate(${dx*.28}px,${dy*.28}px)`:'';}requestAnimationFrame(tick);}
if(REDUCED){drawGL(0,0,0,0);}else requestAnimationFrame(tick);
