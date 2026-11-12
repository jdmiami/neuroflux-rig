import stages from '../../lib/layer-stages.cjs';
import catalog from '../../lib/camera-fx.cjs';
import model from '../../lib/layers.cjs';
import {layerGesture} from './layer-gesture.js';
import {drawLayerWords} from './layer-words.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const controls=(id,name,ids,source='visuals',preview={})=>({id,name,kind:'controls',controls:ids,source,preview});
function fullGraph(layers){
 const graph=[{id:'mix',name:'Final picture',kind:'mix',source:'visuals'}, {id:'words',name:'Words',kind:'words',source:'visuals'}];
 const status=layers.rig.layerStatus(),ordered=[...layers.state.order].reverse(),active=source=>source==='visuals'||source==='camera'&&(status.camera||layers.workspace.state.nodes.length)||source==='space'&&status.space;
 for(const source of [...ordered.filter(active),...ordered.filter(source=>!active(source))]){
  graph.push({id:source,name:layers.state.layers[source].name,kind:'source',source});
  if(source==='camera'){
   const grouped=new Set();for(const node of [...layers.workspace.state.nodes].reverse()){
    const group=layers.groupFor(node.id);if(group&&!grouped.has(group.id)){grouped.add(group.id);graph.push({id:group.id,name:group.name,kind:'group',group,source:'camera'});}
    graph.push({id:node.id,name:catalog.byId[node.effect].name,kind:'effect',node,source:'camera'});
   }
   graph.push({id:'camera-raw',name:'Camera source',kind:'cameraRaw',source:'camera'});
  }
  if(source==='space'&&status.space)graph.push(controls('cloud','Point cloud',['cloud','ptSize','explode','orbit'],'space',{spaceKind:'cloud'}),controls('splat','3D splat',['splatGain','splatDensity','splatSpin','splatFlip'],'space',{spaceKind:'splat'}));
  if(source==='visuals'){
   graph.push(...[...stages.post].reverse().map(stage=>controls(stage.id,stage.name,[stage.control],'visuals',{stage:stage.id})));
   graph.push(controls('visual-feedback','Feedback',['fb','fbZoom','fbRot','fbHue'],'visuals',{stage:'visual-feedback'}));
   graph.push(controls('visual-color','Palette & hue',['pal','hue','hueDrift'],'visuals',{stage:'visual-base'}));
   graph.push(controls('visual-motion','Motion',['speed','rotSpd','travel','wobble'],'visuals',{stage:'visual-base'}));
   graph.push(controls('visual-base','Geometry',['cx','scale','warp','twist'],'visuals',{stage:'visual-base'}));
   graph.push(controls('visual-generator','Visual generator',['mode'],'visuals',{stage:'visual-base'}));
   const covered=new Set([...stages.post.map(s=>s.control),'pal','hue','hueDrift','speed','rotSpd','travel','wobble','cx','scale','warp','twist']);for(const c of layers.rig.layerCatalog())if(['form','motion','color'].includes(c.page)&&!covered.has(c.id)&&['knob','dial','switch'].includes(c.type))graph.push(controls('control-'+c.id,c.label,[c.id],'visuals',{stage:'visual-base'}));
  }
 }
 if(layers.rig.guideState().services.hands)graph.push({id:'tracking',name:'Hand tracking',kind:'tracking',source:'camera'});
 graph.push({id:'sound',name:'Sound response',kind:'audio',source:'visuals',controls:['gain','rBass','rMid','rHigh']});return graph;
}
const svg=(path)=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const play=svg('m8 4 12 8-12 8V4Z');
const slider=(key,label,value,min=0,max=1,step=.01)=>`<label class="nfx-layer-slider"><span>${label}<output>${Number(value).toFixed(2)}</output></span><input type="range" data-scene-value="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"></label>`;

export function immersiveLayers(layers){
 const original={};for(const key of ['items','open','select','paintInspector','mountNative','input','action','snapshot','restore','move'])original[key]=layers[key].bind(layers);
 layers.previewTargets=new Set();layers.nativeCache=new Map();layers.focused=false;
 layers.items=function(){if(this.scope==='root')return fullGraph(this);return original.items().map(i=>({...i,preview:i.source==='space'?{spaceKind:i.id}:i.kind==='controls'?{stage:i.id==='geometry'?'visual-base':i.id==='feedback'?'visual-feedback':i.id==='color'?'visual-sat':undefined}:i.preview}));};
 layers.root=function(){return this.current()?.source||'visuals';};
 layers.snapshot=function(){return {...original.snapshot(),audio:structuredClone(window.NFXStudio?.mixer.settings||{})};};
 layers.restore=function(snapshot){original.restore(snapshot);if(snapshot.audio&&window.NFXStudio){Object.assign(window.NFXStudio.mixer.settings,snapshot.audio);window.NFXStudio.mixer.apply();}this.paint();};
 const root=layers.rootElement;root.classList.add('nfx-layer-universe');root.setAttribute('aria-label','Exploded live composition');
 root.querySelector('h2').setAttribute('data-scene-title','');root.querySelector('.nfx-layer-kicker').textContent='LIVE LAYERS';
 const transport=document.createElement('button');transport.type='button';transport.dataset.layerAction='scenePlay';transport.innerHTML=play;transport.setAttribute('aria-label','Play sound');root.querySelector('.nfx-layer-header-tools').prepend(transport);
 const add=document.createElement('button');add.type='button';add.dataset.layerAction='sceneAdd';add.innerHTML=svg('M12 4v16M4 12h16');add.setAttribute('aria-label','Add camera effect');transport.after(add);
 const frame=document.createElement('div');frame.className='nfx-scene-frame';layers.deck.before(frame);frame.append(layers.deck);
 const words=document.createElement('canvas');words.id='nfxWordsOverlay';words.setAttribute('aria-hidden','true');document.getElementById('hud').before(words);layers.wordsCanvas=words;
 layers.settle=function(delay=220){clearTimeout(this.settleTimer);this.focused=false;root.classList.remove('nfx-layer-focused');this.settleTimer=setTimeout(()=>{if(!this.opened)return;this.focused=true;root.classList.add('nfx-layer-focused');},matchMedia('(prefers-reduced-motion: reduce)').matches?0:delay);};
 layers.open=function(value=true){
  if(value===this.opened)return;original.open(value);if(value){this.scope='root';this.selected=this.rig.layerStatus().camera?'camera':'visuals';this.paint();this.settle(580);}else{clearTimeout(this.settleTimer);this.focused=false;root.classList.remove('nfx-layer-focused');for(const id of this.previewTargets)this.rig.release(id);this.previewTargets.clear();this.workspace.renderer?.clearPreviews();}
 };
 layers.select=function(id){original.select(id);this.settle();};
 layers.deck.addEventListener('pointerdown',()=>{if(layers.opened){clearTimeout(layers.settleTimer);layers.focused=false;root.classList.remove('nfx-layer-focused');}},true);
 layers.deck.addEventListener('pointerup',()=>layers.settle(),true);layers.deck.addEventListener('pointercancel',()=>layers.settle(),true);
 layers.mountNative=function(item){
  if(!item.controls){const all=this.rig.layerCatalog().filter(c=>c.page===item.page&&['knob','dial','switch'].includes(c.type));let values=all;if(item.id==='feedback')values=all.filter(c=>c.id.startsWith('fb'));else if(item.id==='effects')values=all.filter(c=>!c.id.startsWith('fb'));else if(item.id==='cloud')values=all.filter(c=>!c.id.startsWith('splat'));else if(item.id==='splat')values=all.filter(c=>c.id.startsWith('splat')||['orbit','explode','ptSize'].includes(c.id));return this.mountNative({...item,controls:values.map(c=>c.id)});}
  const catalog=this.rig.layerCatalog(),ids=item.controls.filter(id=>catalog.some(c=>c.id===id));
  const host=this.inspector.querySelector('.nfx-layer-native');if(!host)return;host.replaceChildren();for(const id of ids.slice((this.nativePage||0)*4,(this.nativePage||0)*4+4)){let control=this.nativeCache.get(id);if(!control){control=this.rig.createBYOSControl(id);if(control)this.nativeCache.set(id,control);}if(control)host.append(control);}
  const previous=this.inspector.querySelector('[data-layer-action=nativePrevious]'),next=this.inspector.querySelector('[data-layer-action=nativeNext]');if(previous)previous.disabled=!(this.nativePage||0);if(next)next.disabled=(this.nativePage||0)+1>=Math.ceil(ids.length/4);
 };
 layers.paintInspector=function(item){
  root.dataset.panel=this.library?'library':this.grouping?'group':this.renaming?'rename':'controls';
  if(this.library||this.grouping||this.renaming||!item)return original.paintInspector(item);
  if(item.kind==='words'){
   const w=this.state.words;this.inspector.innerHTML=`<div class="nfx-scene-word-editor"><input data-scene-text maxlength="400" aria-label="Words on the picture" placeholder="Write on the picture…" value="${esc(w.text)}"><input type="color" data-scene-color aria-label="Word color" value="${w.color}"></div><div class="nfx-scene-inline">${slider('wordOpacity','Opacity',w.opacity)}${slider('wordSize','Size',w.size,.025,.2,.005)}<button data-layer-action="wordsVisible" aria-pressed="${w.visible}">${w.visible?'Hide words':'Show words'}</button></div>`;return;
  }
  if(item.kind==='mix'){
   this.inspector.innerHTML=`<div class="nfx-layer-native"></div><div class="nfx-scene-quick"><button data-layer-action="sceneSources">Source layers</button><button data-layer-action="sceneSound">Sound response</button><button data-layer-action="sceneWords">Words</button><button data-layer-action="recording">Recording settings ↗</button></div>`;this.mountNative({controls:['camMix'],source:'camera'});return;
  }
  if(item.kind==='audio'){
   this.inspector.innerHTML=`<div class="nfx-layer-native"></div><div class="nfx-scene-inline">${slider('musicGain','Recorded music',window.NFXStudio?.mixer.settings.music??1,0,2)}<button data-layer-action="scenePlay">Play / pause</button></div>`;this.mountNative(item);return;
  }
  if(item.kind==='cameraRaw'){
   const keys=this.rig.layerCatalog().filter(c=>c.page==='cam'&&c.id!=='cam').map(c=>c.id);this.inspector.innerHTML=`<div class="nfx-layer-native"></div><button data-layer-action="cameraToggle">${this.rig.layerStatus().camera?'Turn camera off':'Enable camera'}</button>`;this.mountNative({controls:keys.slice(0,4)});return;
  }
  if(item.kind==='tracking'){
   this.inspector.innerHTML='<div class="nfx-layer-native"></div>';this.mountNative({controls:this.rig.layerCatalog().filter(c=>c.id.startsWith('hand')).map(c=>c.id)});return;
  }
  original.paintInspector(item);
  if(item.kind==='effect'){
   const value=item.node.params.beat,host=document.createElement('div');host.className='nfx-scene-sound-link';host.innerHTML=slider('cameraBeat','Sound response',value);this.inspector.querySelector('fieldset')?.append(host);
  }
  const stage=stages.post.find(s=>item.id===s.id);if(stage){const link=this.state.audioLinks[stage.control]||{band:'bass',amount:0};const host=document.createElement('div');host.className='nfx-scene-sound-link';host.innerHTML=`${slider('visualBeat','Sound response',link.amount,-1,1)}<label>Listen to<select data-scene-band aria-label="Sound band">${['bass','mid','high','level'].map(b=>`<option ${b===link.band?'selected':''}>${b}</option>`).join('')}</select></label>`;this.inspector.append(host);}
 };
 layers.input=function(el){
  if(el.dataset.sceneFx){const item=this.current();if(item?.kind==='effect'){this.begin();this.workspace.change(item.id,el.dataset.sceneFx,el.type==='checkbox'?el.checked:el.dataset.sceneFx==='division'?Number(el.value):el.value);}return;}
  if(el.hasAttribute('data-scene-text')||el.hasAttribute('data-scene-color')||el.hasAttribute('data-scene-band')||el.dataset.sceneValue){
   const item=this.current();if(!item||this.state.layers[this.root()]?.locked)return;this.begin();
   if(el.hasAttribute('data-scene-text'))this.state.words.text=el.value.slice(0,400);
   if(el.hasAttribute('data-scene-color'))this.state.words.color=el.value;
   const key=el.dataset.sceneValue,value=Number(el.value);
   if(key==='wordOpacity')this.state.words.opacity=value;if(key==='wordSize')this.state.words.size=value;
   if(key==='musicGain'&&window.NFXStudio){window.NFXStudio.mixer.settings.music=value;window.NFXStudio.mixer.apply();}
   if(key==='cameraBeat')this.workspace.change(item.id,'beat',value);
   if(key==='visualBeat'||el.hasAttribute('data-scene-band')){const stage=stages.post.find(s=>s.id===item.id);if(stage){const before=this.state.audioLinks[stage.control]||{band:'bass',amount:0};this.state.audioLinks[stage.control]={...before,...(key==='visualBeat'?{amount:value}:{band:el.value})};}}
   this.state=model.validate(this.state);this.persist();const output=el.previousElementSibling?.querySelector('output');if(output)output.textContent=value.toFixed(2);return;
  }original.input(el);
 };
 layers.move=function(delta){
  const item=this.current();if(!item)return;if(item.kind==='source')return original.move(delta);if(!['effect','group'].includes(item.kind))return;
  this.transact(()=>{
   const parent=item.kind==='effect'?this.groupFor(item.id):null;if(this.state.layers.camera.locked||parent?.locked||item.group?.locked)throw Error('Unlock this camera layer or folder to reorder.');
   const entries=[],seen=new Set();for(const node of this.workspace.state.nodes){const group=this.groupFor(node.id);if(parent){if(parent.nodes.includes(node.id))entries.push({id:node.id,nodes:[node.id]});}else if(group){if(!seen.has(group.id)){seen.add(group.id);entries.push(group);}}else entries.push({id:node.id,nodes:[node.id]});}
   const index=entries.findIndex(e=>e.id===item.id),other=entries[index+delta];if(!other)return;
   const moving=new Set(item.kind==='group'?item.group.nodes:[item.id]),next=structuredClone(this.workspace.state),block=next.nodes.filter(n=>moving.has(n.id));next.nodes=next.nodes.filter(n=>!moving.has(n.id));const anchor=next.nodes.flatMap((n,i)=>other.nodes.includes(n.id)?[i]:[]);if(!anchor.length)return;next.nodes.splice(delta>0?Math.max(...anchor)+1:Math.min(...anchor),0,...block);this.workspace.commit(next);
  });
 };
 layers.inspector.addEventListener('change',event=>{if(event.target.hasAttribute('data-scene-background')){const file=event.target.files[0];if(file)layers.workspace.ensureRenderer().setBackground(file).then(()=>layers.message('Background loaded.')).catch(error=>layers.message(error.message));}},true);
 layers.action=function(action,element){
  if(action==='sceneAdd'){this.end();this.scope='camera';this.library=true;this.paint();return;}
  if(action==='scenePlay'){document.getElementById('btnPlay')?.click();return;}
  if(action==='sceneSound'){this.scope='root';this.select('sound');return;}if(action==='sceneWords'){this.scope='root';this.select('words');return;}
  if(action==='sceneSources'){this.scope='root';this.select(this.state.order.at(-1));return;}
  if(action==='wordsVisible'){this.transact(()=>this.state.words.visible=!this.state.words.visible);return;}
  if(action==='cameraToggle'){this.rig.setParam('cam',this.rig.layerStatus().camera?0:1,'user');this.end();this.paint();return;}
  if(action==='recording'){this.open(false);this.rig.guideOpen('recording');return;}
  if(action==='source'&&this.current()?.source==='visuals'){this.scope='root';this.select('visual-generator');return;}
  if(action==='activate'&&this.current()?.id==='space'){if(this.workspace.byos.source==='blank')this.transact(()=>{this.workspace.byos.source='studio';for(const id of model.ids)this.updateLayer(id,{visible:id==='space'});});document.getElementById('splatFile')?.click();return;}
  if(action==='source'&&this.current()?.source==='space'){document.getElementById('splatFile')?.click();return;}
  if(action==='source'&&this.current()?.source==='camera'){this.scope='root';this.select('camera-raw');return;}
  if(action==='details'&&this.current()?.kind==='effect'){
   const item=this.current();this.detailPage=((this.detailPage||0)+1)%4;
   if(this.detailPage===3){this.inspector.innerHTML=`<div class="nfx-scene-fx-details">${['border','target','division'].map(key=>`<label>${key}<select data-scene-fx="${key}">${catalog.rules[key].map(value=>`<option value="${value}" ${item.node.params[key]===value?'selected':''}>${value}</option>`).join('')}</select></label>`).join('')}<label>Animate<input type="checkbox" data-scene-fx="autoplay" ${item.node.params.autoplay?'checked':''}></label><label>Tint<input type="color" data-scene-fx="tint" value="${item.node.params.tint}"></label>${item.node.effect==='background-image'?'<label>Background image<input type="file" data-scene-background accept="image/*"></label>':''}</div><button data-layer-action="details">Main controls →</button>`;return;}
   const keys=[['wet','amount','count','beat'],['angle','scale','centerX','centerY'],['speed','delay','seed','beat']][this.detailPage];
   this.inspector.innerHTML=`<div class="nfx-scene-fx-details">${keys.map(key=>{const range=key==='wet'?[0,1]:catalog.rules[key],value=key==='wet'?item.node.wet:item.node.params[key];return `<label class="nfx-layer-slider"><span>${esc(key)}<output>${value}</output></span><input type="range" data-layer-fx="${key}" min="${range[0]}" max="${range[1]}" step="${range[2]||.01}" value="${value}" aria-label="${esc(item.name+' '+key)}"></label>`;}).join('')}</div><button data-layer-action="details">More effect controls →</button>`;return;
  }
  original.action(action,element);
 };
 layers.paint=function(){
  if(!this.opened)return;const items=this.items();if(!items.some(i=>i.id===this.selected))this.selected=items[0]?.id;const index=items.findIndex(i=>i.id===this.selected),item=this.current();
  const aspect=Math.max(.4,Math.min(2.5,document.getElementById('gl').clientWidth/document.getElementById('gl').clientHeight));root.style.setProperty('--scene-aspect',aspect);root.dataset.selectedKind=item?.kind||'';root.dataset.soundLinked=String(stages.post.some(s=>s.id===item?.id));
  const cardMarkup=items.map((i,n)=>{const offset=n-index,distance=Math.abs(offset),source=this.state.layers[i.source],muted=i.kind==='source'&&!source.visible||i.kind==='effect'&&(i.node.bypass||!this.workspace.state.enabled);return `<div role="option" id="layer-card-${i.id}" aria-selected="${n===index}" data-layer-card="${i.id}" class="nfx-layer-card ${muted?'is-hidden':''}" style="--offset:${offset};--distance:${distance};--card-index:${items.length-distance};--direction:${Math.sign(offset)};visibility:${distance>4?'hidden':'visible'};pointer-events:${distance>4?'none':'auto'}"><canvas width="384" height="240" data-layer-preview="${i.id}" aria-label="${esc(i.name)} live stage"></canvas><div class="nfx-layer-card-top"><span>${esc(i.name)}</span><small>${i.kind==='effect'?'CAMERA FX':i.kind==='controls'?'ADJUSTMENT':i.kind==='words'?'TEXT':i.kind==='audio'?'AUDIO':i.kind==='mix'?'OUTPUT':'SOURCE'}</small></div><span class="nfx-layer-empty" data-layer-empty="${i.id}" hidden></span>${n===index&&['source','effect','group'].includes(i.kind)?'<span data-layer-grip aria-hidden="true" title="Drag to reorder">⋮⋮</span>':''}</div>`;}).join('');
  this.renderCards(cardMarkup);this.deck.setAttribute('aria-activedescendant',item?'layer-card-'+item.id:'');
  root.querySelector('h2').textContent=item?.name||'Layers';root.querySelector('.nfx-layer-kicker').textContent=`${index+1} / ${items.length} · LIVE LAYERS`;
  root.querySelector('.nfx-layer-browse output').textContent=`${index+1} / ${items.length}`;root.querySelector('[data-layer-action=previous]').disabled=index<=0;root.querySelector('[data-layer-action=next]').disabled=index>=items.length-1;
  root.querySelector('.nfx-layer-breadcrumb').innerHTML=this.scope==='root'?'<span>EXPLODED VIEW</span>':'<button data-layer-action="back">‹ All layers</button>';
  root.querySelector('.nfx-layer-solo').hidden=!this.previewSolo;this.paintHistory();this.paintInspector(item);this.lastPreview=0;
 };
 layers.hasCameraPreview=function(){return this.opened&&this.previewItems().some(i=>['effect','group','cameraRaw'].includes(i.kind));};
 layers.previewItems=function(){const items=this.items(),index=items.findIndex(i=>i.id===this.selected);return items.filter((item,n)=>Math.abs(n-index)<=3);};
 layers.cameraPreviewRequest=function(now){
  if(!this.opened||document.hidden||now-(this.lastCameraPreview||0)<80)return null;this.lastCameraPreview=now;
  const result=new Set();for(const item of this.previewItems()){if(item.kind==='effect')result.add(item.id);if(item.id==='camera-raw')result.add('camera-raw');if(item.kind==='group'){const node=this.workspace.state.nodes.filter(n=>item.group.nodes.includes(n.id)).at(-1);if(node)result.add(node.id);}}return result;
 };
 function spectrum(ctx,width,height){
  const data=layers.rig.audioSpectrum(),bands=data.bands;ctx.clearRect(0,0,width,height);ctx.fillStyle='#040b12';ctx.fillRect(0,0,width,height);
  const columns=48,gap=width/columns;for(let n=0;n<columns;n++){const value=(bands[Math.min(bands.length-1,Math.floor(n/columns*bands.length))]||0)/255;ctx.fillStyle=n<16?'#45f0ff':n<32?'#a993ff':'#ff74d0';ctx.globalAlpha=.85;ctx.fillRect(n*gap,height*.78-value*height*.58,Math.max(1,gap*.64),Math.max(1,value*height*.58));}
  ctx.globalAlpha=1;ctx.fillStyle='#9bd0e4';ctx.font=`${Math.max(10,width*.025)}px monospace`;ctx.fillText(`${String(data.source).toUpperCase()} · ${Math.round(data.bpm)} BPM`,width*.05,height*.15);return data;
 }
 layers.frame=function(now){
  // This hook runs before the native operator pass. Auxiliary renders can never
  // replace the visible drawing buffer or enter the recording's program output.
  const gl=document.getElementById('gl'),w=this.wordsCanvas,boxWidth=gl.clientWidth,boxHeight=gl.clientHeight;
  if(w.width!==boxWidth||w.height!==boxHeight){w.width=boxWidth;w.height=boxHeight;}w.style.left=gl.offsetLeft+'px';w.style.top=gl.offsetTop+'px';w.style.width=boxWidth+'px';w.style.height=boxHeight+'px';
  const wc=w.getContext('2d');wc.clearRect(0,0,w.width,w.height);drawLayerWords(wc,this.state.words,w.width,w.height);
  const lyric=document.getElementById('lyr');if(lyric)lyric.style.opacity=this.state.words.visible?String(this.state.words.opacity):'0';
  if(!this.opened||document.hidden||now-this.lastPreview<60)return;this.lastPreview=now;
  try{
   const visible=new Set(this.previewItems().map(i=>i.id)),items=this.items(),index=items.findIndex(i=>i.id===this.selected),status=this.rig.layerStatus();const statusKey=JSON.stringify([status,this.rig.guideState().services.hands]);if(statusKey!==this.sourceStatus&&!this.before){this.sourceStatus=statusKey;this.paint();}
   for(const item of items){if(!visible.has(item.id))continue;const canvas=this.deck.querySelector(`[data-layer-preview="${item.id}"]`);if(!canvas)continue;const selected=item.id===this.selected,interval=selected?60:150;if(now-(canvas.lastFrame||0)<interval)continue;canvas.lastFrame=now;
    const aspect=Number(root.style.getPropertyValue('--scene-aspect'))||1,width=selected?480:288,height=Math.max(2,2*Math.round(width/aspect/2));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const ctx=canvas.getContext('2d'),empty=this.deck.querySelector(`[data-layer-empty="${item.id}"]`);ctx.clearRect(0,0,width,height);empty.hidden=true;
    if(item.kind==='audio'){spectrum(ctx,width,height);continue;}
    if(item.kind==='words'){drawLayerWords(ctx,this.state.words,width,height,this.state.words.text||(this.rig.guideState().services.lyrics?this.rig.state().lyrics:''));if(!this.state.words.text&&!this.rig.guideState().services.lyrics){empty.hidden=false;empty.textContent='Add words';}continue;}
    if(item.kind==='tracking'){const state=this.rig.state();window.NFXStudio?.outputs[0].hands(ctx,state,width,height,Math.min(width,height)/720);continue;}
    if(item.kind==='effect'||item.kind==='group'||item.id==='camera-raw'){
     const node=item.kind==='group'?this.workspace.state.nodes.filter(n=>item.group.nodes.includes(n.id)).at(-1):null,id=node?.id||item.id,source=this.workspace.renderer?.previews.get(id)||(!this.workspace.state.nodes.some(n=>!n.bypass)&&item.kind==='effect'?this.rig.cameraSource().video:null);
     if(source){const sw=source.videoWidth||source.width,sh=source.videoHeight||source.height,scale=Math.max(width/sw,height/sh),dw=sw*scale,dh=sh*scale;ctx.save();if(this.rig.cameraSource().mirror){ctx.translate(width,0);ctx.scale(-1,1);}ctx.drawImage(source,(width-dw)/2,(height-dh)/2,dw,dh);ctx.restore();}else{empty.hidden=false;empty.textContent=status.camera?'Reading live stage…':'Camera off';}continue;
    }
    const sourceId=item.source;if(item.kind!=='mix'&&(sourceId==='camera'&&!status.camera||sourceId==='space'&&!status.space)){empty.hidden=false;empty.textContent=sourceId==='camera'?'Camera off':'No 3D source';continue;}
    const target='layers-stage-'+item.id,source=this.rig.render(target,width,height,{...(item.kind==='mix'?{}:{solo:sourceId}),...item.preview});this.previewTargets.add(target);ctx.drawImage(source,0,0,width,height);if(item.kind==='mix')drawLayerWords(ctx,this.state.words,width,height,this.state.words.text||(this.rig.guideState().services.lyrics?this.rig.state().lyrics:''));
   }
   const keep=new Set(this.previewItems().filter(i=>!['effect','group','words','audio','tracking','cameraRaw'].includes(i.kind)).map(i=>'layers-stage-'+i.id));for(const id of this.previewTargets)if(!keep.has(id)){this.rig.release(id);this.previewTargets.delete(id);}
  }catch(error){this.message(error.message);}
 };
 window.addEventListener('resize',()=>{if(layers.opened){layers.paint();layers.settle(120);}});
 layerGesture(layers);
}
