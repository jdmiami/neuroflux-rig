import model from '../../lib/layers.cjs';
import cameraCatalog from '../../lib/camera-fx.cjs';
import {artwork,formatValue} from './camera-ui.js';
import {immersiveLayers} from './immersive-layers.js';

const copy=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyphs={hand:'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',save:'M4 3h13l4 4v14H3V3h1Zm3 0v6h9V3M7 21v-8h10v8',layers:'m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',camera:'M3 7h4l2-3h6l2 3h4v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',visuals:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',space:'m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10L3 7m9 5 9-5m-9 5v10',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',solo:'M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5M9 12h6',lock:'M6 10h12v12H6zM8 10V6a4 4 0 0 1 8 0v4',folder:'M2 6h8l2 3h10v12H2V6Z',close:'m6 6 12 12M18 6 6 18',up:'m5 15 7-7 7 7',down:'m5 9 7 7 7-7',undo:'M9 4 3 10l6 6M3 10h11a7 7 0 0 1 0 14',redo:'m15 4 6 6-6 6m6-6H10a7 7 0 0 0 0 14',plus:'M12 4v16M4 12h16',grip:'M8 4v16M16 4v16',edit:'m4 16 12-12 4 4L8 20H4v-4Z'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphs[name]||glyphs.layers}"/></svg>`;
const button=(action,label,glyph,extra='')=>`<button type="button" data-layer-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(glyph)}<span>${esc(label)}</span></button>`;
const folders=[['geometry','Geometry','form'],['color','Color','color'],['motion','Motion','motion'],['effects','Effects','fx'],['feedback','Feedback','fx']];
const hardware=new Set(['cam','depth','cloud','hands','motion','lyrics','aiDir']);

export class LayerWorkspace {
 constructor(workspace){
  this.workspace=workspace;this.rig=workspace.rig;this.state=model.fromLegacy(this.rig.guideState().controls);
  try{const saved=JSON.parse(localStorage.getItem('nfx.layers.v1'));if(saved)this.state=model.validate(saved);}catch{}
  this.opened=false;this.scope='root';this.selected='camera';this.hand=workspace.take.hand;this.previewSolo=null;this.undo=[];this.redo=[];this.groupSelection=new Set();this.lastPreview=0;
  this.mount();this.cleanGroups();immersiveLayers(this);
 }
 cameraState(state){return model.effectiveCamera(state,this.state);}
 persist(){try{localStorage.setItem('nfx.layers.v1',JSON.stringify(this.state));}catch{this.message('Could not save layer settings. Use SAVE to keep a setup.');}}
 snapshot(){return {layers:copy(this.state),camera:copy(this.workspace.state),rig:copy(this.rig.guideState().controls),source:this.workspace.byos.source};}
 begin(){this.before??=this.snapshot();}
 end(){if(!this.before)return;const before=this.before;this.before=null;if(JSON.stringify(before)!==JSON.stringify(this.snapshot())){this.undo.push(before);this.undo=this.undo.slice(-32);this.redo=[];}this.persist();this.paintHistory();}
 transact(fn){this.begin();try{fn();this.state=model.validate(this.state);this.persist();}catch(error){const before=this.before;this.before=null;if(before)this.restore(before);throw error;}finally{this.end();}this.paint();}
 restore(snapshot){
  this.restoring=true;
  try{for(const [id,value]of Object.entries(snapshot.rig))if(!hardware.has(id)&&this.rig.guideState().controls[id]!==value)this.rig.setParam(id,value,'silent');this.state=model.validate(snapshot.layers);this.workspace.byos.source=snapshot.source||'studio';this.workspace.commit(copy(snapshot.camera),false);this.persist();}
  finally{this.restoring=false;}this.paint();
 }
 history(direction){this.end();const from=direction==='undo'?this.undo:this.redo,to=direction==='undo'?this.redo:this.undo;if(!from.length)return;to.push(this.snapshot());this.restore(from.pop());this.paintHistory();}
 setState(value){this.state=model.validate(value);this.cleanGroups();this.persist();this.undo=[];this.redo=[];this.before=null;this.paint();}
 cleanGroups(){const ids=new Set(this.workspace.state.nodes.map(n=>n.id));this.state.groups=this.state.groups.map(g=>({...g,nodes:g.nodes.filter(id=>ids.has(id))})).filter(g=>g.nodes.length);if(this.scope?.startsWith('group:')&&!this.state.groups.some(g=>'group:'+g.id===this.scope))this.scope='camera';}
 cameraChanged(){this.cleanGroups();if(this.opened&&!this.before)this.paint();}
 legacyParameterChanged(key,value,origin){
  if(this.restoring||origin!=='user'||!['camMix','camBlend'].includes(key))return;
  if(key==='camMix'){this.state.layers.camera.opacity=Math.min(1,value*2);this.state.layers.visuals.opacity=this.state.layers.space.opacity=this.rig.guideState().controls.cam===0?1:Math.min(1,2-value*2);}
  if(key==='camBlend')this.state.layers.camera.blend=['screen','add','difference','multiply','luma','depth'][value]||'screen';
  this.persist();if(!this.before)this.paint();
 }
 updateLayer(id,patch){const layer=this.state.layers[id];if(layer.locked&&!('locked'in patch))throw Error('Unlock this layer to edit it.');Object.assign(layer,patch);this.state.enabled=true;}
 root(){return this.scope==='root'?this.selected:this.scope==='camera'||this.scope.startsWith('group:')?'camera':this.scope==='space'?'space':'visuals';}
 groupFor(id){return this.state.groups.find(g=>g.nodes.includes(id));}
 items(){
  if(this.scope==='root')return [...this.state.order].reverse().map(id=>({id,name:this.state.layers[id].name,kind:'source',source:id}));
  if(this.scope==='visuals')return folders.map(([id,name,page])=>({id,name,kind:'controls',page,source:'visuals'}));
  if(this.scope==='space')return [{id:'cloud',name:'Point cloud',kind:'controls',page:'d3',source:'space'},{id:'splat',name:'3D splat',kind:'controls',page:'d3',source:'space'}];
  const group=this.scope.startsWith('group:')?this.state.groups.find(g=>g.id===this.scope.slice(6)):null;
  const shown=new Set();return this.workspace.state.nodes.flatMap(n=>{
   const parent=this.groupFor(n.id);
   if(group)return group.nodes.includes(n.id)?[{id:n.id,name:cameraCatalog.byId[n.effect].name,kind:'effect',node:n,source:'camera'}]:[];
   if(parent){if(shown.has(parent.id))return [];shown.add(parent.id);return [{id:parent.id,name:parent.name,kind:'group',group:parent,source:'camera'}];}
   return [{id:n.id,name:cameraCatalog.byId[n.effect].name,kind:'effect',node:n,source:'camera'}];
  });
 }
 current(){return this.items().find(i=>i.id===this.selected);}
 open(value=true){
  if(value===this.opened)return;
  this.end();this.opened=value;this.previewSolo=null;
  if(value){this.returnFocus=document.activeElement;if(!this.state.enabled){const defaults=model.fromLegacy(this.rig.guideState().controls);for(const id of model.ids)Object.assign(this.state.layers[id],{opacity:defaults.layers[id].opacity,blend:defaults.layers[id].blend});}this.scope='root';this.library=this.grouping=this.renaming=false;this.selected=this.state.order.at(-1);this.hand=this.workspace.take.hand;this.paint();this.inspector.scrollTop=0;}
  clearTimeout(this.closeTimer);this.rootElement.classList.remove('nfx-layer-closing');if(value){this.rootElement.hidden=false;this.rootElement.classList.add('nfx-layer-opening');requestAnimationFrame(()=>requestAnimationFrame(()=>this.rootElement.classList.remove('nfx-layer-opening')));}else{this.rootElement.classList.add('nfx-layer-closing');this.closeTimer=setTimeout(()=>{if(!this.opened)this.rootElement.hidden=true;},matchMedia('(prefers-reduced-motion: reduce)').matches?0:220);}this.trigger.setAttribute('aria-expanded',String(value));document.body.classList.toggle('nfx-layers-open',value);this.rootElement.classList.toggle('nfx-layer-left',this.hand==='left');
  if(value){this.rootElement.querySelector('[data-layer-action=close]').focus();this.inertBefore=new Map(['sheet','top','nfxTakeBar','nfxTakeCategories'].map(id=>{const el=document.getElementById(id);const old=el?.inert;if(el)el.inert=true;return [el,old];}));}
  else{for(const [el,old]of this.inertBefore||[])if(el)el.inert=old;this.inertBefore=null;for(const id of model.ids)this.rig.release('layers-preview-'+id);this.returnFocus?.focus?.();}
 }
 select(id){this.end();this.selected=id;this.grouping=this.library=false;this.renaming=false;this.nativePage=0;this.paint();this.inspector.scrollTop=0;this.rig.feedback?.('tick');}
 enter(){const item=this.current();if(!item)return;this.end();if(item.kind==='source')this.scope=item.id;else if(item.kind==='group')this.scope='group:'+item.id;else return;this.selected=this.items()[0]?.id;this.nativePage=0;this.paint();this.inspector.scrollTop=0;}
 back(){this.end();const parent=this.scope.startsWith('group:')?'camera':'root';this.scope=parent;this.library=this.grouping=this.renaming=false;this.selected=this.items()[0]?.id;this.nativePage=0;this.paint();this.inspector.scrollTop=0;}
 mount(){
  this.trigger=document.createElement('button');this.trigger.id='btnLayers';this.trigger.className='dk';this.trigger.type='button';this.trigger.setAttribute('aria-label','Open layers');this.trigger.setAttribute('aria-expanded','false');this.trigger.setAttribute('aria-controls','nfxLayerWorkspace');this.trigger.innerHTML=icon('layers')+'<span>LAYERS</span>';
  document.getElementById('dock').classList.add('nfx-has-layers');document.getElementById('dock').insertBefore(this.trigger,document.getElementById('btnQuickSave'));this.trigger.onclick=e=>{e.stopPropagation();this.open(!this.opened);};
  for(const type of ['pointerdown','pointerup'])this.trigger.addEventListener(type,e=>e.stopPropagation());
  this.rootElement=document.createElement('section');this.rootElement.id='nfxLayerWorkspace';this.rootElement.hidden=true;this.rootElement.setAttribute('aria-label','Live layer workspace');
  this.rootElement.innerHTML=`<header class="nfx-layer-header"><div><span class="nfx-layer-kicker">LIVE COMPOSITION</span><h2>Layers</h2></div><div class="nfx-layer-header-tools">${button('hand','Switch control side','hand')}${button('undo','Undo','undo')}${button('redo','Redo','redo')}${button('save','Save setup','save')}${button('close','Close layers','close')}</div></header><div class="nfx-layer-layout"><div class="nfx-layer-stage"><nav class="nfx-layer-breadcrumb" aria-label="Layer location"></nav><span class="nfx-layer-solo" hidden>SOLO · PREVIEW ONLY</span><div class="nfx-layer-deck" role="listbox" aria-label="Layer cards" tabindex="0"></div><div class="nfx-layer-browse">${button('previous','Previous card','up')}<output></output>${button('next','Next card','down')}</div></div><aside class="nfx-layer-inspector" aria-label="Selected layer controls"></aside></div><p class="nfx-layer-status" role="status" aria-live="polite"></p>`;
  document.body.append(this.rootElement);this.deck=this.rootElement.querySelector('.nfx-layer-deck');this.inspector=this.rootElement.querySelector('aside');
  this.rootElement.onclick=event=>{const card=event.target.closest('[data-layer-card]');if(card){this.select(card.dataset.layerCard);return;}const button=event.target.closest('[data-layer-action]');if(button)this.guard(()=>this.action(button.dataset.layerAction,button));};
  this.inspector.addEventListener('pointerdown',()=>this.begin(),true);
  this.inspector.addEventListener('keydown',e=>{if(e.target.matches('input,select'))this.begin();},true);
  this.inspector.addEventListener('input',e=>this.guard(()=>this.input(e.target)));
  this.inspector.addEventListener('change',event=>{this.end();if(!event.target.matches('[data-layer-search],[data-scene-text],.nfx-layer-rename input'))this.paint();});
  this.inspector.addEventListener('focusout',()=>{this.end();});
  this.rootElement.addEventListener('keydown',event=>{
   event.stopPropagation();if(event.key==='Escape'){event.preventDefault();this.open(false);return;}
   if(event.target===this.deck&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const items=this.items(),index=items.findIndex(i=>i.id===this.selected);this.select(items[event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowDown'?1:-1)))]?.id);}
  });
  for(const type of ['pointerdown','pointerup','dblclick'])this.rootElement.addEventListener(type,e=>e.stopPropagation());
  this.deck.addEventListener('wheel',event=>{event.preventDefault();if(performance.now()-(this.wheelAt||0)<160)return;this.wheelAt=performance.now();this.browse(event.deltaY>0?1:-1);},{passive:false});
  this.deck.addEventListener('pointerdown',event=>{if(event.button>0||this.drag)return;this.drag={id:event.pointerId,y:event.clientY,card:event.target.closest('[data-layer-card]')?.dataset.layerCard,reorder:!!event.target.closest('[data-layer-grip]')};this.deck.classList.add('is-dragging');this.deck.setPointerCapture(event.pointerId);});
  this.deck.addEventListener('pointermove',event=>{if(this.drag?.id===event.pointerId&&!this.drag.reorder)this.deck.style.setProperty('--deck-drag',Math.max(-45,Math.min(45,(event.clientY-this.drag.y)*.35))+'px');});
  this.deck.addEventListener('pointerup',event=>{const drag=this.drag;this.drag=null;this.deck.classList.remove('is-dragging');this.deck.style.setProperty('--deck-drag','0px');if(!drag||drag.id!==event.pointerId)return;const distance=event.clientY-drag.y;if(Math.abs(distance)>30){event.preventDefault();if(drag.reorder)this.guard(()=>this.move((distance>0?1:-1)*(this.scope==='root'&&['effect','group'].includes(this.current()?.kind)?-1:1)));else this.browse((distance<0?1:-1)*Math.max(1,Math.min(5,Math.floor(Math.abs(distance)/65))));this.blockCardClick=true;setTimeout(()=>this.blockCardClick=false,0);}else if(drag.card&&!drag.reorder){this.select(drag.card);}});
  this.deck.addEventListener('click',event=>{if(this.blockCardClick){event.preventDefault();event.stopImmediatePropagation();}},true);
  this.deck.addEventListener('pointercancel',()=>{this.drag=null;this.deck.classList.remove('is-dragging');this.deck.style.setProperty('--deck-drag','0px');});
 }
 guard(fn){try{fn();}catch(error){this.message(error.message);}}
 message(text){this.rootElement.querySelector('.nfx-layer-status').textContent=text;}
 browse(delta){const items=this.items(),index=items.findIndex(i=>i.id===this.selected);if(items.length)this.select(items[Math.max(0,Math.min(items.length-1,index+delta))]?.id);}
 paintHistory(){for(const id of ['undo','redo'])this.rootElement.querySelector(`[data-layer-action=${id}]`).disabled=!this[id].length;}
 renderCards(markup){
  const template=document.createElement('template');template.innerHTML=markup;
  const incoming=[...template.content.children],old=new Map([...this.deck.querySelectorAll('[data-layer-card]')].map(card=>[card.dataset.layerCard,card]));
  if(!incoming.some(card=>card.hasAttribute('data-layer-card'))){this.deck.innerHTML=markup;return;}
  this.deck.querySelector('.nfx-layer-empty-stack')?.remove();
  incoming.forEach((fresh,index)=>{
   const id=fresh.dataset.layerCard,card=old.get(id)||fresh;old.delete(id);
   if(card!==fresh){for(const key of ['class','style','aria-selected'])card.setAttribute(key,fresh.getAttribute(key));const head=card.querySelector('.nfx-layer-card-top'),newHead=fresh.querySelector('.nfx-layer-card-top');if(head.innerHTML!==newHead.innerHTML)head.innerHTML=newHead.innerHTML;
    const art=card.querySelector('.nfx-fx-art'),newArt=fresh.querySelector('.nfx-fx-art');if(art&&newArt&&art.outerHTML!==newArt.outerHTML)art.replaceWith(newArt);
    card.querySelector('[data-layer-grip]')?.remove();const grip=fresh.querySelector('[data-layer-grip]');if(grip)card.append(grip);
   }
   if(this.deck.children[index]!==card)this.deck.insertBefore(card,this.deck.children[index]||null);
  });
  for(const card of old.values())card.remove();
 }
 paint(){
  if(!this.opened)return;
  let items=this.items();if(!items.some(i=>i.id===this.selected))this.selected=items[0]?.id;
  const current=this.current(),index=items.findIndex(i=>i.id===this.selected);
  this.rootElement.querySelector('.nfx-layer-breadcrumb').innerHTML=this.scope==='root'?'<span>FINAL MIX</span>':`<button data-layer-action="back">‹ ${this.scope.startsWith('group:')?'Camera FX':'All layers'}</button><span>${esc(this.scope.startsWith('group:')?this.state.groups.find(g=>g.id===this.scope.slice(6))?.name:this.state.layers[this.scope]?.name||'')}</span>`;
  const cardMarkup=items.length?items.map((item,i)=>{
   const source=this.state.layers[item.source],distance=i-index;
   return `<div role="option" id="layer-card-${item.id}" aria-selected="${i===index}" data-layer-card="${item.id}" class="nfx-layer-card ${item.kind==='source'&&!source.visible?'is-hidden':''}" style="--offset:${distance};--distance:${Math.abs(distance)};--card-index:${items.length-Math.abs(distance)}"><div class="nfx-layer-card-top"><span>${icon(item.kind==='source'?item.id:item.kind==='group'||item.kind==='controls'?'folder':'layers')}${esc(item.name)}</span><small>${item.kind==='source'?Math.round(source.opacity*100)+'%':item.kind==='group'?item.group.nodes.length+' FX':item.kind==='effect'?Math.round(item.node.wet*100)+'% FX':'CONTROLS'}</small></div>${item.kind==='source'?`<canvas width="240" height="150" data-layer-preview="${item.id}" aria-label="${esc(item.name)} live preview"></canvas><span class="nfx-layer-empty" data-layer-empty="${item.id}" hidden></span>`:item.kind==='effect'?artwork(cameraCatalog.byId[item.node.effect]):`<div class="nfx-layer-folder-art">${icon('folder')}<span>${item.kind==='group'?item.group.nodes.length+' effects':'Open & shape'}</span></div>`}${i===index&&['source','effect','group'].includes(item.kind)?`<span data-layer-grip aria-hidden="true" title="Drag to reorder">${icon('grip')}</span>`:''}</div>`;
  }).join(''):'<div class="nfx-layer-empty-stack">An empty camera stack.<br>Add an effect to start.</div>';
  this.renderCards(cardMarkup);
  this.deck.setAttribute('aria-activedescendant',current?'layer-card-'+current.id:'');this.rootElement.querySelector('.nfx-layer-browse output').textContent=items.length?`${index+1} / ${items.length}`:'0 FX';
  this.rootElement.querySelector('[data-layer-action=previous]').disabled=index<=0;this.rootElement.querySelector('[data-layer-action=next]').disabled=index>=items.length-1;
  this.rootElement.querySelector('.nfx-layer-solo').hidden=!this.previewSolo;this.paintHistory();this.paintInspector(current);this.lastPreview=0;
 }
 slider(key,label,value,min=0,max=1,step=.01){return `<label class="nfx-layer-slider"><span>${label}<output>${Math.round(value*100)}%</output></span><input type="range" data-layer-value="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}"></label>`;}
 paintInspector(item){
  const root=this.state.layers[this.root()],locked=root.locked||item?.group?.locked||!!this.groupFor(item?.id)?.locked;
  let content='';
  if(this.grouping){content=`<h3>Group camera effects</h3><div class="nfx-layer-group-picker">${this.workspace.state.nodes.map(n=>`<button data-layer-action="chooseGroup" data-node-id="${n.id}" aria-pressed="${this.groupSelection.has(n.id)}" ${this.groupFor(n.id)?'disabled':''}>${artwork(cameraCatalog.byId[n.effect])}<span>${esc(cameraCatalog.byId[n.effect].name)}</span></button>`).join('')}</div><button data-layer-action="createGroup" class="nfx-layer-primary" ${!this.groupSelection.size?'disabled':''}>Create folder</button>`;}
  else if(this.library){content=`<h3>Add a camera effect</h3><input type="search" data-layer-search aria-label="Search camera effects" placeholder="Find an effect…"><div class="nfx-layer-library">${cameraCatalog.effects.map(e=>`<button data-layer-action="addFx" data-effect="${e.id}" data-search="${esc((e.name+' '+e.family).toLowerCase())}" ${this.workspace.state.nodes.length>=cameraCatalog.MAX_NODES?'disabled':''}>${artwork(e)}<span>${esc(e.name)}</span></button>`).join('')}</div>`;}
  else if(!item){content=`<h3>Camera effects</h3><button data-layer-action="library" class="nfx-layer-primary">＋ Add effect</button>`;}
  else if(item.kind==='source'){
   const layer=this.state.layers[item.id],status=this.rig.layerStatus(),available=item.id==='visuals'?!['blank','camera'].includes(this.workspace.byos.source):status[item.id]&&this.workspace.byos.source!=='blank';
   content=`<div class="nfx-layer-inspector-title"><small>SOURCE LAYER</small><h3>${esc(layer.name)}</h3></div><div class="nfx-layer-actions">${button('visible',layer.visible?'Hide':'Show','eye',`aria-pressed="${layer.visible}" ${locked?'disabled':''}`)}${button('solo',this.previewSolo===item.id?'End solo':'Solo preview','solo',`aria-pressed="${this.previewSolo===item.id}"`)}${button('lock',layer.locked?'Unlock':'Lock','lock',`aria-pressed="${layer.locked}"`)}</div><fieldset ${locked?'disabled':''}>${this.slider('opacity','Opacity',layer.opacity)}<label class="nfx-layer-select">Blend<select data-layer-value="blend" aria-label="Layer blend mode">${model.blends.filter(b=>item.id==='camera'||!['luma','depth'].includes(b)).map(b=>`<option value="${b}" ${b===layer.blend?'selected':''}>${{normal:'Normal',screen:'Screen',add:'Add light',multiply:'Multiply',difference:'Difference',overlay:'Overlay',luma:'Luma key',depth:'Depth key'}[b]}</option>`).join('')}</select></label><div class="nfx-layer-actions">${button('raise','Bring forward','up')}${button('lower','Send backward','down')}${button('rename','Rename','edit')}${button('reset','Reset layer','undo')}</div><button data-layer-action="enter" class="nfx-layer-primary">${item.id==='camera'?'Camera FX':item.id==='visuals'?'Visual folders':'3D controls'} →</button></fieldset>${!available?`<button data-layer-action="activate" class="nfx-layer-primary">${item.id==='camera'?'Enable camera':item.id==='visuals'?'Add visuals':'Load / enable 3D'}</button>`:''}<button data-layer-action="source">${item.id==='camera'?'Camera source & framing':item.id==='space'?'Open 3D source':'Choose visual scene'} ↗</button>`;
  }else if(item.kind==='effect'){
   const n=item.node,keys=this.workspace.ui.mainKeys(cameraCatalog.byId[n.effect]).slice(0,3);
   content=`<small>CAMERA ONLY</small><h3>${esc(item.name)}</h3><fieldset ${locked?'disabled':''}><div class="nfx-layer-actions">${button('bypass',n.bypass?'Enable FX':'Bypass FX','eye',`aria-pressed="${!n.bypass}"`)}${button('duplicate','Duplicate','layers')}${button('remove','Remove','close')}</div>${keys.map(key=>{const value=key==='wet'?n.wet:n.params[key],r=key==='wet'?[0,1,.01]:cameraCatalog.rules[key];return `<label class="nfx-layer-slider"><span>${{count:'Splits / count',wet:'Effect strength',angle:'Rotation',amount:'Amount',scale:'Size'}[key]||key}<output>${formatValue(key,value)}</output></span><input type="range" data-layer-fx="${key}" min="${r[0]}" max="${r[1]}" step="${r.length===3?r[2]:.01}" value="${value}" aria-label="${esc(item.name+' '+key)}"></label>`;}).join('')}<div class="nfx-layer-actions">${button('raise','Earlier effect','up')}${button('lower','Later effect','down')}${button('reset','Reset effect','undo')}</div><button data-layer-action="details" class="nfx-layer-primary">All effect controls ↗</button></fieldset>`;
  }else if(item.kind==='group'){
   const g=item.group;content=`<small>CAMERA FX FOLDER</small><h3>${esc(g.name)}</h3><div class="nfx-layer-actions">${button('groupLock',g.locked?'Unlock':'Lock','lock',`aria-pressed="${g.locked}"`)}</div><fieldset ${locked?'disabled':''}>${this.slider('groupStrength','Folder strength',g.strength)}<div class="nfx-layer-actions">${button('groupBypass',g.bypass?'Enable folder':'Bypass folder','eye',`aria-pressed="${!g.bypass}"`)}${button('rename','Rename','edit')}${button('ungroup','Ungroup','folder')}${button('raise','Earlier folder','up')}${button('lower','Later folder','down')}</div></fieldset><button data-layer-action="enter" class="nfx-layer-primary">Open ${g.nodes.length} effects →</button>`;
  }else content=`<div class="nfx-layer-native-header"><h3>${esc(item.name)}</h3><div class="nfx-layer-actions">${button('nativePrevious','Previous controls','up')}${button('nativeNext','More controls','down')}</div></div><fieldset ${locked?'disabled':''}><div class="nfx-layer-native"></div></fieldset>`;
  const cameraScope=this.scope==='camera'||this.scope.startsWith('group:');
  this.inspector.innerHTML=content+(cameraScope&&!this.library&&!this.grouping?`<div class="nfx-layer-actions">${button('library','Add effect','plus',locked?'disabled':'')}${this.scope==='camera'?button('group','Group FX','folder',locked||!this.workspace.state.nodes.some(n=>!this.groupFor(n.id))?'disabled':''):''}</div>`:'')+(this.renaming?`<form class="nfx-layer-rename"><label>Name<input maxlength="40" value="${esc(item?.name)}" aria-label="Layer or folder name"></label><button type="submit">Save name</button></form>`:'');
  if(item?.kind==='controls')this.mountNative(item);
  const form=this.inspector.querySelector('form');if(form){form.onsubmit=event=>{event.preventDefault();this.guard(()=>{const name=form.querySelector('input').value.trim();this.transact(()=>{if(item.kind==='source')this.updateLayer(item.id,{name});else item.group.name=name;});this.renaming=false;this.paint();});};form.querySelector('input').focus();}
 }
 mountNative(item){
  const page=item.page,all=this.rig.layerCatalog().filter(c=>c.page===page&&['knob','dial','switch'].includes(c.type));
  let controls=all;if(item.id==='feedback')controls=all.filter(c=>c.id.startsWith('fb'));else if(item.id==='effects')controls=all.filter(c=>!c.id.startsWith('fb'));else if(item.id==='cloud')controls=all.filter(c=>!c.id.startsWith('splat'));else if(item.id==='splat')controls=all.filter(c=>c.id.startsWith('splat')||['orbit','explode','ptSize'].includes(c.id));
  const pages=Math.max(1,Math.ceil(controls.length/4));this.nativePage=Math.max(0,Math.min(pages-1,this.nativePage||0));
  const host=this.inspector.querySelector('.nfx-layer-native');for(const c of controls.slice(this.nativePage*4,this.nativePage*4+4)){const control=this.rig.createBYOSControl(c.id);if(control)host.append(control);}
  this.inspector.querySelector('[data-layer-action=nativePrevious]').disabled=!this.nativePage;this.inspector.querySelector('[data-layer-action=nativeNext]').disabled=this.nativePage>=pages-1;
 }
 input(el){
  if(el.hasAttribute('data-layer-search')){for(const b of this.inspector.querySelectorAll('[data-search]'))b.hidden=!b.dataset.search.includes(el.value.toLowerCase().trim());return;}
  const item=this.current();if(!item)return;
  if(el.matches(':disabled')||this.state.layers[this.root()].locked||item.group?.locked||this.groupFor(item.id)?.locked)return;
  if(el.dataset.layerFx){this.begin();this.workspace.change(item.id,el.dataset.layerFx,Number(el.value));el.previousElementSibling.querySelector('output').textContent=formatValue(el.dataset.layerFx,Number(el.value));}
  if(el.dataset.layerValue){this.begin();if(el.dataset.layerValue==='groupStrength')item.group.strength=Number(el.value);else this.updateLayer(item.id,{[el.dataset.layerValue]:el.type==='range'?Number(el.value):el.value});this.state=model.validate(this.state);this.persist();const output=el.previousElementSibling?.querySelector('output');if(output)output.textContent=Math.round(Number(el.value)*100)+'%';}
 }
 move(delta){
  const item=this.current();if(!item)return;
  this.transact(()=>{
   if(item.kind==='source'){if(this.state.layers[item.id].locked)throw Error('Unlock this layer to move it.');const order=this.state.order,i=order.indexOf(item.id),j=i-delta;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];this.state.enabled=true;return;}
   if(!['group','effect'].includes(item.kind))return;
   if(this.state.layers.camera.locked||item.group?.locked||this.groupFor(item.id)?.locked)throw Error('Unlock the camera layer or folder to move this effect.');
   const items=this.items(),index=items.findIndex(i=>i.id===item.id),other=items[index+delta];if(!other)return;
   const moving=new Set(item.kind==='group'?item.group.nodes:[item.id]),anchor=new Set(other.kind==='group'?other.group.nodes:[other.id]),next=copy(this.workspace.state),block=next.nodes.filter(n=>moving.has(n.id));next.nodes=next.nodes.filter(n=>!moving.has(n.id));const positions=next.nodes.flatMap((n,i)=>anchor.has(n.id)?[i]:[]);next.nodes.splice(delta>0?Math.max(...positions)+1:Math.min(...positions),0,...block);this.workspace.commit(next);
  });
 }
 action(action,element){
  if(action==='close'){this.open(false);return;}if(action==='hand'){this.hand=this.hand==='right'?'left':'right';this.workspace.take.hand=this.hand;try{localStorage.setItem('nfx.take.hand',this.hand);}catch{}this.workspace.take.layout();this.rootElement.classList.toggle('nfx-layer-left',this.hand==='left');return;}
  if(action==='save'){this.workspace.quickSaveControl.save();this.message('Saving the current setup, including layers.');return;}
  if(['undo','redo'].includes(action)){this.history(action);return;}if(action==='previous'||action==='next'){this.browse(action==='next'?1:-1);return;}
  if(action==='back'){if(this.library||this.grouping){this.library=this.grouping=false;this.end();this.paint();}else this.back();return;}if(action==='enter'){this.enter();return;}
  if(action==='nativePrevious'||action==='nativeNext'){this.end();this.nativePage+=(action==='nativeNext'?1:-1);this.paintInspector(this.current());return;}
  if(action==='library'){this.library=!this.library;this.paint();return;}if(action==='group'){this.grouping=true;this.groupSelection.clear();this.paint();return;}
  if(action==='chooseGroup'){const id=element.dataset.nodeId;this.groupSelection.has(id)?this.groupSelection.delete(id):this.groupSelection.add(id);this.paint();return;}
  if(action==='createGroup'){this.transact(()=>{this.state.groups.push({id:'group-'+crypto.randomUUID().slice(0,8),name:'FX folder '+(this.state.groups.length+1),nodes:[...this.groupSelection],strength:1,bypass:false,locked:false});});this.grouping=false;this.paint();return;}
  if(action==='addFx'){const groupId=this.scope.startsWith('group:')?this.scope.slice(6):null;let added;this.transact(()=>{added=this.workspace.add(element.dataset.effect);const group=this.state.groups.find(g=>g.id===groupId);if(group)group.nodes.push(added.id);});this.library=false;if(!groupId)this.scope='camera';this.selected=added.id;this.paint();return;}
  const item=this.current();if(!item)return;
  if(action==='activate'&&item.id==='space'&&this.workspace.byos.source==='blank')this.transact(()=>{this.workspace.byos.source='studio';for(const id of model.ids)this.updateLayer(id,{visible:id==='space'});});
  if(action==='source'||action==='details'||action==='activate'&&item.id==='space'){
   const page=item.source==='camera'?'cam':item.source==='space'?'d3':'scenes';this.open(false);this.rig.guideOpen(page);if(page==='cam'&&action==='details'){this.workspace.openId=item.id;this.workspace.catalogOpen=false;this.workspace.selectTab('effects');this.workspace.renderStack();}else if(page==='cam')this.workspace.selectTab('source');return;
  }
  if(action==='activate'){
   this.transact(()=>{const blank=this.workspace.byos.source==='blank';this.workspace.byos.source='studio';if(blank)for(const id of model.ids)this.updateLayer(id,{visible:id===item.id});this.updateLayer(item.id,{visible:true,opacity:1});});
   if(item.id==='camera')this.rig.setParam('cam',1,'user');this.end();this.message(item.id==='camera'?'Camera permission is requested by your browser.':'Visual source added.');return;
  }
  if(action==='solo'){this.previewSolo=this.previewSolo===item.source?null:item.source;this.paint();return;}
  if(action==='rename'){this.renaming=!this.renaming;this.paint();return;}
  if(action==='raise'||action==='lower'){this.move(action==='raise'?-1:1);return;}
  this.transact(()=>{
   if(action==='visible')this.updateLayer(item.id,{visible:!this.state.layers[item.id].visible});
   if(action==='lock')this.updateLayer(item.id,{locked:!this.state.layers[item.id].locked});
   if(action==='groupLock')item.group.locked=!item.group.locked;
   if(action==='groupBypass')item.group.bypass=!item.group.bypass;
   if(action==='ungroup'){const next=copy(this.workspace.state);for(const n of next.nodes)if(item.group.nodes.includes(n.id)){n.wet*=item.group.strength;n.bypass||=item.group.bypass;}this.state.groups=this.state.groups.filter(g=>g.id!==item.id);this.workspace.commit(next);}
   if(action==='bypass')this.workspace.change(item.id,'bypass',!item.node.bypass);
   if(action==='duplicate'){const groupId=this.groupFor(item.id)?.id,before=new Set(this.workspace.state.nodes.map(n=>n.id));this.workspace.command(action,item.id);const node=this.workspace.state.nodes.find(n=>!before.has(n.id)),group=this.state.groups.find(g=>g.id===groupId);if(group&&node)group.nodes.push(node.id);if(node)this.selected=node.id;}
   if(action==='remove'||action==='reset'&&item.kind==='effect')this.workspace.command(action,item.id);
   if(action==='reset'&&item.kind==='source')this.updateLayer(item.id,{...model.defaults().layers[item.id],name:this.state.layers[item.id].name});
  });
 }
 frame(now){
  if(!this.opened||document.hidden||window.NFXStudio?.simple?.engaged||now-this.lastPreview<200)return;this.lastPreview=now;
  try{
   const status=this.rig.layerStatus();const statusKey=JSON.stringify([status,this.workspace.byos.source]);if(statusKey!==this.sourceStatus&&!this.before){this.sourceStatus=statusKey;if(this.current()?.kind==='source')this.paintInspector(this.current());}for(const canvas of this.deck.querySelectorAll('[data-layer-preview]')){
    const id=canvas.dataset.layerPreview,empty=this.deck.querySelector(`[data-layer-empty=${id}]`),available=id==='visuals'?!['blank','camera'].includes(this.workspace.byos.source):status[id]&&this.workspace.byos.source!=='blank';empty.hidden=available;if(!available){empty.textContent=id==='camera'?'Camera off':id==='visuals'?'No visual source':'No 3D source';continue;}
    const source=this.rig.render('layers-preview-'+id,240,150,{solo:id});canvas.getContext('2d').drawImage(source,0,0,240,150);
   }
  }catch(error){this.message(error.message);}
 }
}
