import orbit from '../../lib/layer-orbit.cjs';

// Card motion is independent from selection/inspector painting. Pointer moves
// update at most once per animation frame; a swipe commits one selection.
export function mountLayerNavigation(layers){
 const deck=layers.deck,root=layers.rootElement;
 const motion=layers.deckMotion={position:0,busy:false};
 let cards=[],items=[],scope=null,frame=0,animation=0,target=null,drag=null,shift=0,pending=0,geometry;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const index=()=>Math.max(0,items.findIndex(i=>i.id===layers.selected));
 const limit=n=>Math.max(0,Math.min(items.length-1,n));
 const distance=()=>Math.max(64,Math.min(115,deck.clientHeight*.28));
 const blockClick=()=>{layers.blockCardClick=true;clearTimeout(motion.clickTimer);motion.clickTimer=setTimeout(()=>layers.blockCardClick=false,400);};
 function draw(value){
  shift=value;motion.position=index()+value;
  for(let n=0;n<cards.length;n++){
   const card=cards[n],offset=n-motion.position,d=Math.abs(offset),near=d<=4;
   if(card.dataset.near!==String(near))card.dataset.near=String(near);const visibility=near?'visible':'hidden';if(card.style.visibility!==visibility){card.style.visibility=visibility;card.style.pointerEvents=near?'auto':'none';}
   if(!near)continue;
   const p=orbit.pose(offset,geometry);card.style.setProperty('--distance',d.toFixed(4));card.style.zIndex=String(100-Math.round(d*10));
   card.style.transform=`translate(-50%,-50%) translate3d(${p.x.toFixed(3)}px,${p.y.toFixed(3)}px,${p.z.toFixed(3)}px) rotateX(${p.rx.toFixed(3)}deg) rotateY(${p.ry.toFixed(3)}deg) rotateZ(${p.rz.toFixed(3)}deg) scale(${p.scale.toFixed(5)})`;
  }
 }
 const flush=()=>{frame=0;draw(pending);};
 const schedule=value=>{pending=value;if(!frame)frame=requestAnimationFrame(flush);};
 const stopFrame=()=>{cancelAnimationFrame(frame);frame=0;};
 const stopAnimation=()=>{cancelAnimationFrame(animation);animation=0;target=null;};
 function rest(){motion.busy=false;deck.classList.remove('is-settling','is-dragging');}
 function settle(){
  stopAnimation();deck.classList.remove('is-dragging');
  const from=motion.position,to=index(),travel=Math.abs(to-from);
  if(reduced()||travel<.001){draw(0);rest();return;}
  target=to;deck.classList.add('is-settling');motion.busy=true;
  const start=performance.now(),duration=Math.min(640,320+travel*85);
  const tick=now=>{const t=Math.min(1,(now-start)/duration),ease=1-(1-t)**3;draw(from+(to-from)*ease-index());if(t<1)animation=requestAnimationFrame(tick);else{animation=0;target=null;draw(0);rest();}};
  animation=requestAnimationFrame(tick);
 }
 motion.resize=function(){
  const position=motion.position;
  const width=parseFloat(root.style.getPropertyValue('--card-width'))||280,aspect=parseFloat(root.style.getPropertyValue('--card-aspect'))||1.6;
  geometry=orbit.metrics({width,height:width/aspect,viewportWidth:deck.clientWidth||390,viewportHeight:deck.clientHeight||300,zoom:layers.sceneZoom||1,stackX:parseFloat(root.style.getPropertyValue('--stack-x'))||100,stackY:parseFloat(root.style.getPropertyValue('--stack-y'))||45,reduced:reduced()});
  if(cards.length)draw(position-index());
 };
 motion.sync=function(){
  const next=layers.items(),changed=scope!==layers.scope||items.map(i=>i.id).join('|')!==next.map(i=>i.id).join('|');
  const oldPosition=motion.position;items=next;cards=[...deck.querySelectorAll('[data-layer-card]')];scope=layers.scope;
  if(changed||!layers.opened){stopFrame();stopAnimation();drag=layers.drag=null;rest();draw(0);return;}
  // Tween the position through the curved path, never a straight chord
  // between two transform matrices. Repainting controls cannot restart it.
  if(!drag&&Math.abs(oldPosition-index())>.001){draw(oldPosition-index());if(!animation||target!==index())settle();}else draw(shift);
 };
 motion.cancel=function(immediate=false){
  stopFrame();stopAnimation();drag=layers.drag=null;pending=0;rest();if(!immediate&&layers.opened&&Math.abs(shift)>.001)settle();else draw(0);
 };
 const cancelGesture=()=>{if(drag?.moved)blockClick();motion.cancel();};
 function down(e){
  if(!layers.opened||e.button>0||drag||e.isPrimary===false)return;
  // A new grab can interrupt a previous glide without waiting for a timer.
  const position=motion.position;stopAnimation();rest();deck.classList.add('is-dragging');draw(position-index());
  drag=layers.drag={id:e.pointerId,base:shift,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,lastTime:e.timeStamp,velocity:0,axis:null,moved:false,card:e.target.closest('[data-layer-card]')?.dataset.layerCard,reorder:!!e.target.closest('[data-layer-grip]')};
  deck.setPointerCapture(e.pointerId);
 }
 function move(e){
  if(!drag||e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.axis&&Math.hypot(dx,dy)>7){drag.axis=Math.abs(dy)>=Math.abs(dx)*.8?'y':'x';drag.moved=true;motion.busy=true;deck.classList.add('is-dragging');}
  if(!drag.moved)return;
  e.preventDefault();
  const step=drag.axis==='y'?distance():Math.max(80,Math.min(180,deck.clientWidth*.23)),delta=drag.axis==='y'?-dy:dx;
  const dt=e.timeStamp-drag.lastTime,change=drag.axis==='y'?drag.lastY-e.clientY:e.clientX-drag.lastX;
  if(dt>0){const speed=Math.max(-.025,Math.min(.025,change/step/dt));drag.velocity=drag.velocity*.3+speed*.7;}
  drag.lastX=e.clientX;drag.lastY=e.clientY;drag.lastTime=e.timeStamp;
  if(drag.reorder)return;
  const wanted=drag.base+delta/step,clamped=limit(index()+wanted)-index(),rubber=(wanted-clamped)*.15;
  schedule(clamped+Math.max(-.22,Math.min(.22,rubber)));
 }
 function up(e){
  if(!drag||drag.id!==e.pointerId)return;const ended=drag;
  if(frame){stopFrame();draw(pending);}drag=layers.drag=null;
  if(!ended.moved){deck.classList.remove('is-dragging');if(ended.card&&!ended.reorder){blockClick();layers.select(ended.card);}else settle();return;}
  e.preventDefault();blockClick();
  if(ended.reorder){deck.classList.remove('is-dragging');const dy=e.clientY-ended.y;if(Math.abs(dy)>30)layers.guard(()=>layers.move((dy>0?1:-1)*(layers.scope==='root'&&['effect','group'].includes(layers.current()?.kind)?-1:1)));rest();draw(0);return;}
  // Only recent velocity contributes to momentum; pausing/reversing before
  // lift must not reuse an old flick. Bound travel to three extra cards.
  const velocity=e.timeStamp-ended.lastTime<100?ended.velocity:0,coast=Math.max(-2.5,Math.min(2.5,velocity*130));
  let target=limit(Math.round(index()+shift+coast));
  if(target===index()&&Math.abs(shift)>.28)target=limit(index()+Math.sign(shift));
  deck.classList.remove('is-dragging');
  if(target!==index())layers.select(items[target].id);else settle();
 }
 deck.addEventListener('pointerdown',down);
 deck.addEventListener('pointermove',move,{passive:false});
 deck.addEventListener('pointerup',up);
 deck.addEventListener('pointercancel',cancelGesture);deck.addEventListener('lostpointercapture',()=>{if(drag)cancelGesture();});
 deck.addEventListener('click',event=>{if(layers.blockCardClick){event.preventDefault();event.stopImmediatePropagation();}},true);
 deck.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey)return;event.preventDefault();if(performance.now()-(motion.wheelAt||0)<130)return;motion.wheelAt=performance.now();layers.browse(event.deltaY>0?1:-1);},{passive:false});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)motion.cancel(true);});
 window.addEventListener('blur',cancelGesture);window.addEventListener('resize',cancelGesture);
 motion.resize();motion.sync();
}
