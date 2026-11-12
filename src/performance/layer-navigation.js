// Card motion is independent from selection/inspector painting. Pointer moves
// update at most once per animation frame; a swipe commits one selection.
export function mountLayerNavigation(layers){
 const deck=layers.deck,root=layers.rootElement;
 const motion=layers.deckMotion={position:0,busy:false};
 let cards=[],items=[],scope=null,frame=0,finishTimer=0,drag=null,shift=0,pending=0;
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
   card.style.setProperty('--offset',offset.toFixed(4));card.style.setProperty('--distance',d.toFixed(4));card.style.setProperty('--focus',Math.max(0,1-d).toFixed(4));card.style.zIndex=String(100-Math.round(d*10));
  }
 }
 const flush=()=>{frame=0;draw(pending);};
 const schedule=value=>{pending=value;if(!frame)frame=requestAnimationFrame(flush);};
 const stopFrame=()=>{cancelAnimationFrame(frame);frame=0;};
 function visualPosition(){
  const card=cards[index()];if(!card)return index();const style=getComputedStyle(card),x=parseFloat(getComputedStyle(root).getPropertyValue('--stack-x'))||100;
  return index()+(new DOMMatrixReadOnly(style.transform).m41+parseFloat(style.width)/2)/x;
 }
 function rest(){clearTimeout(finishTimer);motion.busy=false;deck.classList.remove('is-settling','is-dragging');}
 function settle(){
  deck.classList.remove('is-dragging');deck.classList.add('is-settling');motion.busy=true;
  // Commit the measured drag position before changing its destination.
  // Style reads happen at grab/release, never inside pointermove.
  if(cards[0])getComputedStyle(cards[0]).transform;
  draw(0);clearTimeout(finishTimer);finishTimer=setTimeout(rest,reduced()?0:300);
 }
 motion.sync=function(){
  const next=layers.items(),changed=scope!==layers.scope||items.map(i=>i.id).join('|')!==next.map(i=>i.id).join('|');
  const oldPosition=motion.position;items=next;cards=[...deck.querySelectorAll('[data-layer-card]')];scope=layers.scope;
  if(changed||!layers.opened){stopFrame();drag=layers.drag=null;rest();draw(0);return;}
  // Reused cards keep their transforms when selection changes. Moving all
  // cards by the old/new index difference lets CSS interpolate one glide.
  if(!drag&&Math.abs(oldPosition-index())>.001){draw(oldPosition-index());settle();}else draw(shift);
 };
 motion.cancel=function(){
  stopFrame();drag=layers.drag=null;pending=0;rest();if(layers.opened&&Math.abs(shift)>.001)settle();else draw(0);
 };
 const cancelGesture=()=>{if(drag?.moved)blockClick();motion.cancel();};
 function down(e){
  if(!layers.opened||e.button>0||drag||e.isPrimary===false)return;
  // A new grab can interrupt a previous glide without waiting for a timer.
  const position=visualPosition();rest();deck.classList.add('is-dragging');draw(position-index());
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
 document.addEventListener('visibilitychange',()=>{if(document.hidden)motion.cancel();});
 window.addEventListener('blur',cancelGesture);window.addEventListener('resize',cancelGesture);
 motion.sync();
}
