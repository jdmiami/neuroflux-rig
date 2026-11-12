import stages from '../../lib/layer-stages.cjs';

export const comparable=item=>!!item&&(stages.post.some(s=>s.id===item.id)||['effect','group'].includes(item.kind));
export function sourceLabel(item){
 if(item.kind==='mix')return 'Final output';
 if(item.kind==='audio')return 'Audio spectrum';
 if(item.kind==='words')return 'Text only';
 if(item.kind==='tracking')return 'Tracking data';
 return item.source==='camera'?'Camera only':item.source==='space'?'3D only':'Visuals only';
}

export function mountInspection(layers){
 const root=layers.rootElement,deck=layers.deck,stage=root.querySelector('.nfx-layer-stage');
 layers.sceneZoom=1;layers.previewMode='compare';
 const footer=document.createElement('nav');footer.className='nfx-scene-footer';footer.setAttribute('aria-label','Layer view controls');
 footer.innerHTML='<div class="nfx-scene-zoom" role="group" aria-label="Card zoom"><button data-layer-action="zoomOut" aria-label="Zoom cards out">−</button><button data-layer-action="zoomFit" aria-label="Fit cards to screen"><output data-scene-zoom>Fit</output></button><button data-layer-action="zoomIn" aria-label="Zoom cards in">+</button></div><button data-layer-action="previewMode" aria-label="Preview: before and after. Change preview mode">Compare</button>';
 footer.append(root.querySelector('.nfx-layer-browse'));root.append(footer);
 const context=document.createElement('p');context.className='nfx-scene-context';context.setAttribute('aria-live','off');root.querySelector('h2').after(context);layers.sceneContext=context;
 const close=root.querySelector('[data-layer-action=close]');root.querySelector('.nfx-layer-header').append(close);
 layers.setZoom=function(value){
  this.sceneZoom=Math.max(.7,Math.min(1.25,value));root.style.setProperty('--scene-zoom',this.sceneZoom);
  root.querySelector('[data-scene-zoom]').textContent=Math.abs(this.sceneZoom-1)<.005?'Fit':Math.round(this.sceneZoom*100)+'%';
  root.querySelector('[data-layer-action=zoomOut]').disabled=this.sceneZoom<=.701;
  root.querySelector('[data-layer-action=zoomIn]').disabled=this.sceneZoom>=1.249;
 };
 layers.fitScene=function(){
  const aspect=Math.max(.85,Math.min(1.8,Number(root.style.getPropertyValue('--scene-aspect'))||1.6));
  // Reserve room for the selected card even at maximum zoom and perspective.
  const width=Math.max(32,Math.min(deck.clientWidth*.65,Math.max(32,deck.clientHeight-24)*aspect/1.3));
  root.style.setProperty('--card-width',width+'px');root.style.setProperty('--card-aspect',aspect);
  root.style.setProperty('--stack-x',Math.min(deck.clientWidth*.23,170)+'px');
  root.style.setProperty('--stack-y',Math.min(deck.clientHeight*.19,72)+'px');
 };
 layers.paintInspection=function(item){
  const enabled=comparable(item),button=root.querySelector('[data-layer-action=previewMode]');button.disabled=!enabled;
  button.textContent=enabled?{compare:'Compare',difference:'Change',result:'Result'}[this.previewMode]:'Source';
  button.setAttribute('aria-label',enabled?'Preview: '+{compare:'before and after',difference:'pixel difference, black means unchanged',result:'stage result'}[this.previewMode]+'. Change preview mode':'Source preview');
  context.textContent=sourceLabel(item)+(enabled?' · '+{compare:'Before → After',difference:'Change · black = unchanged',result:'Result at this stage'}[this.previewMode]:item.kind==='controls'&&item.source==='visuals'?' · Shared generator controls':' · Live');
  root.dataset.previewMode=this.previewMode;this.fitScene();
 };
 const observer=new ResizeObserver(()=>{if(layers.opened)layers.fitScene();});observer.observe(stage);observer.observe(root);
 // Pinch affects only the card scene. Cancel the one-finger Rolodex/reorder
 // before it can commit, and consume both lifts so it cannot become a click.
 const points=new Map();let pinch=null,consume=false;
 const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
 const distance=()=>{const [a,b]=[...points.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
 const clearDrag=()=>{layers.deckMotion?.cancel();layers.drag=null;deck.classList.remove('is-dragging');};
 deck.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size>=2){clearDrag();consume=true;root.classList.add('nfx-scene-pinching');if(points.size===2)pinch={distance:Math.max(1,distance()),zoom:layers.sceneZoom};else pinch=null;stop(e);}},true);
 deck.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(consume){stop(e);if(pinch&&points.size===2)layers.setZoom(pinch.zoom*distance()/pinch.distance);}},true);
 const end=e=>{points.delete(e.pointerId);if(consume){e.preventDefault();clearDrag();pinch=null;layers.blockCardClick=true;setTimeout(()=>layers.blockCardClick=false,400);if(!points.size){consume=false;root.classList.remove('nfx-scene-pinching');}}};
 layers.clearInspectionTouches=()=>{points.clear();pinch=null;consume=false;root.classList.remove('nfx-scene-pinching');clearDrag();};
 document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
 deck.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;stop(e);layers.setZoom(layers.sceneZoom*Math.exp(-e.deltaY*.003));},{capture:true,passive:false});
 root.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;if(['+','=','-','0'].includes(e.key)){e.preventDefault();layers.setZoom(e.key==='0'?1:layers.sceneZoom+(e.key==='-'?-.1:.1));}});
 layers.setZoom(1);
}

// Use real frame pixels, with the same crop/mirroring on both sides. No
// illustrative substitute and no adjustment to the program/recording image.
export function drawComparison(layers,canvas,after,before,mirror=false){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const draw=source=>{const sw=source.videoWidth||source.width,sh=source.videoHeight||source.height,scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale;ctx.save();if(mirror){ctx.translate(w,0);ctx.scale(-1,1);}ctx.drawImage(source,(w-dw)/2,(h-dh)/2,dw,dh);ctx.restore();};
 draw(after);const mode=layers.previewMode;
 if(before&&mode==='compare'){ctx.save();ctx.beginPath();ctx.rect(0,0,w/2,h);ctx.clip();draw(before);ctx.restore();ctx.fillStyle='#c0faff';ctx.fillRect(w/2-1,0,2,h);}
 if(before&&mode==='difference'){ctx.save();ctx.globalCompositeOperation='difference';draw(before);ctx.restore();}
 const card=canvas.parentElement,labels=card.querySelector('.nfx-scene-comparison');labels.hidden=!before;
 if(before&&labels.dataset.mode!==mode){labels.dataset.mode=mode;labels.replaceChildren();for(const text of mode==='compare'?['Before','After']:mode==='difference'?['Change · black = unchanged']:['Stage result']){const span=document.createElement('span');span.textContent=text;labels.append(span);}}
}
