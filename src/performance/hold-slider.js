// Touch gestures land on a scrollable shield, never on the native range track.
// Mouse and keyboard continue to use the accessible native input.
export function holdSliders(){
 const media=matchMedia('(pointer: coarse)'),bound=new WeakSet();let current=null;
 function cancel(commit=true){if(!current)return;const s=current;current=null;clearTimeout(s.timer);s.overlay.classList.remove('holding','armed');s.input.classList.remove('touch-armed');if(commit&&s.changed)s.input.dispatchEvent(new Event('change',{bubbles:true}));}
 function scan(){for(const input of document.querySelectorAll('input[type=range]')){
  if(bound.has(input))continue;bound.add(input);
  const parent=input.parentElement;if(getComputedStyle(parent).position==='static')parent.style.position='relative';
  const overlay=document.createElement('span');overlay.className='nfx-range-shield';overlay.setAttribute('aria-hidden','true');overlay.innerHTML='<i></i>';parent.append(overlay);
  const position=()=>{overlay.style.left=input.offsetLeft+'px';overlay.style.top=input.offsetTop+'px';overlay.style.width=input.offsetWidth+'px';overlay.style.height=Math.max(input.offsetHeight,44)+'px';overlay.hidden=input.hidden||input.disabled||!input.offsetWidth;};
  new ResizeObserver(position).observe(input);position();
  overlay.addEventListener('pointerdown',e=>{if(!media.matches||e.pointerType!=='touch'||input.disabled)return;cancel();const s=current={input,overlay,pointer:e.pointerId,x:e.clientX,y:e.clientY,value:Number(input.value),changed:false,armed:false};overlay.classList.add('holding');overlay.setPointerCapture(e.pointerId);s.timer=setTimeout(()=>{if(current!==s||!input.isConnected)return;s.armed=true;overlay.classList.add('armed');input.classList.add('touch-armed');window.NFXRig?.feedback?.('tick');navigator.vibrate?.(8);},450);});
  overlay.addEventListener('pointermove',e=>{const s=current;if(!s||s.pointer!==e.pointerId)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(!s.armed){if(Math.hypot(dx,dy)>8)cancel(false);return;}
   const min=Number(input.min||0),max=Number(input.max||100),step=input.step==='any'?0:Number(input.step||1);let value=s.value+dx/Math.max(40,input.clientWidth-24)*(max-min);if(step)value=min+Math.round((value-min)/step)*step;value=Math.min(max,Math.max(min,value));if(Number(input.value)!==value){input.value=String(value);s.changed=true;input.dispatchEvent(new Event('input',{bubbles:true}));input.style.setProperty('--fill',((Number(input.value)-min)/(max-min)*100)+'%');}
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])overlay.addEventListener(type,e=>{if(current?.pointer===e.pointerId)cancel();});
 }}
 new MutationObserver(()=>{if(current&&!current.input.isConnected)cancel(false);scan();}).observe(document.body,{childList:true,subtree:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});media.addEventListener('change',()=>cancel());scan();
}
