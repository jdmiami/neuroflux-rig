// Three still fingers, for 520ms. Two-finger scene swipes and ordinary touch
// effects keep their existing behavior. The initial hold is consumed until lift.
export function layerGesture(layers){
 const points=new Map();let timer=null,armed=false,claimed=false,start=[],generation=0;
 const eligible=target=>target instanceof Element&&(target.id==='gl'||!!target.closest('.nfx-layer-deck'));
 const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
 const cancel=()=>{generation++;clearTimeout(timer);timer=null;};
 document.addEventListener('pointerdown',event=>{
  if(!event.isTrusted||event.pointerType!=='touch'||!eligible(event.target))return;
  points.set(event.pointerId,{id:event.pointerId,x:event.clientX,y:event.clientY});
  if(points.size!==3){cancel();return;}stop(event);cancel();claimed=true;start=[...points.values()].map(p=>({...p}));layers.rig.cancelLayerTouches(start);layers.drag=null;layers.deck.classList.remove('is-dragging');layers.deck.style.setProperty('--deck-drag','0px');
  const token=generation;timer=setTimeout(()=>requestAnimationFrame(()=>{
   if(token!==generation||points.size!==3)return;armed=true;layers.rig.cancelLayerTouches(start);layers.drag=null;layers.deck.classList.remove('is-dragging');layers.deck.style.setProperty('--deck-drag','0px');layers.open(!layers.opened);layers.rig.feedback?.('tick');navigator.vibrate?.(12);layers.gestureQuietUntil=performance.now()+650;
  }),520);
 },true);
 document.addEventListener('pointermove',event=>{
  if(!event.isTrusted||!points.has(event.pointerId))return;const p=points.get(event.pointerId);p.x=event.clientX;p.y=event.clientY;
  if(claimed){stop(event);if(!armed&&start.some(s=>{const p=points.get(s.id);return !p||Math.hypot(p.x-s.x,p.y-s.y)>12;}))cancel();}
 },true);
 const end=event=>{if(!event.isTrusted||!points.has(event.pointerId))return;if(claimed)stop(event);points.delete(event.pointerId);cancel();if(!points.size){claimed=armed=false;layers.gestureQuietUntil=performance.now()+350;}};
 document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
 document.addEventListener('click',event=>{if(performance.now()<(layers.gestureQuietUntil||0)&&eligible(event.target))stop(event);},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();points.clear();claimed=armed=false;}});
}
