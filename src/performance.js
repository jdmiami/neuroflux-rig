import {LandscapeTake} from './performance/landscape.js';
import {holdSliders} from './performance/hold-slider.js';
import {installPWA} from './performance/install.js';
import {BuildStudio} from './performance/byos.js';
import catalog from '../lib/camera-fx.cjs';
import setups from '../lib/setups.cjs';
import {MotionController} from './performance/motion.js';
import {SetupStore} from './performance/setup-store.js';
import {CameraRenderer} from './camera/renderer.js';
import {validateProfile} from './studio/profiles.js';
import {CameraFXControls} from './performance/camera-ui.js';
import {QuickSaveControl} from './performance/quick-save.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=o=>structuredClone(o);
installPWA();holdSliders();
const motion=window.NFXMotion=new MotionController();
class PerformanceWorkspace {
 constructor(rig){this.rig=rig;this.state=catalog.empty();this.undo=[];this.redo=[];this.store=new SetupStore();this.tab='source';this.filter='';this.category='featured';this.openId='';this.cameraFrame=null;this.status='';this.pending=null;
  try{this.state=catalog.validate(JSON.parse(localStorage.getItem('nfx.camera-fx.v1')));}catch{}
  this.catalogOpen=!this.state.nodes.length;this.ui=new CameraFXControls(this);this.syncLegacy();this.mount();this.quickSaveControl=new QuickSaveControl(this);this.renderStack();this.refreshSetups();this.byos=new BuildStudio(this);this.take=new LandscapeTake(this);this.timer=setInterval(()=>{this.quickSaveControl.sync();this.updateStatus();},500);
 }
 persist(){try{localStorage.setItem('nfx.camera-fx.v1',JSON.stringify(this.state));}catch{this.message('Settings could not be saved on this device. Download a setup file.');}}
 message(text){this.status=text;this.statusAt=Date.now();for(const e of document.querySelectorAll('.nfx-performance-status'))e.textContent=text;}
 commit(next,history=true){const value=catalog.validate(next);if(history){this.undo.push(copy(this.state));this.undo=this.undo.slice(-32);this.redo=[];}this.state=value;this.syncLegacy();this.persist();this.renderStack();return value;}
 syncLegacy(){this.syncing=true;const lens=this.state.nodes.find(n=>n.effect==='local-lens'&&!n.bypass),trails=this.state.nodes.find(n=>n.effect==='camera-trails'&&!n.bypass);this.rig.setParam('camWarp',lens?.params.amount||0,'silent');this.rig.setParam('camTrails',trails?1:0,'silent');this.syncing=false;}
 legacyParameterChanged(key,value,origin){if(this.syncing||origin!=='user'||!['camWarp','camTrails'].includes(key))return;const effect=key==='camWarp'?'local-lens':'camera-trails';let next=copy(this.state),n=next.nodes.find(n=>n.effect===effect);if(!n&&value>0){if(next.nodes.length>=8){this.rig.setParam(key,0,'silent');this.message('The camera stack is full. Remove an effect before adding this camera macro.');return;}n=catalog.node(effect);next.nodes.push(n);}if(n){n.bypass=value<=0;if(key==='camWarp')n.params.amount=value;next.enabled=value>0||next.enabled;this.commit(next);}}
 add(effect){if(this.state.nodes.length>=8)throw Error('Eight camera effects are already in the stack. Remove one before adding another.');const next=copy(this.state),node=catalog.node(effect);if(catalog.byId[effect].pinned)next.nodes.unshift(node);else next.nodes.push(node);next.enabled=true;this.openId=node.id;this.catalogOpen=false;this.commit(next);requestAnimationFrame(()=>this.panel.querySelector('[data-node="'+node.id+'"]')?.scrollIntoView({block:'nearest'}));return node;}
 change(id,key,value){const next=copy(this.state),n=next.nodes.find(n=>n.id===id);if(!n)throw Error('That camera effect is no longer in the stack.');if(key==='wet'||key==='bypass')n[key]=value;else n.params[key]=value;this.commit(next);}
 command(type,id){const next=copy(this.state),i=next.nodes.findIndex(n=>n.id===id);if(type==='remove')next.nodes.splice(i,1);if(type==='duplicate'){if(next.nodes.length>=8)throw Error('The stack has eight effects.');const n=copy(next.nodes[i]);n.id=catalog.node(n.effect).id;next.nodes.splice(i+1,0,n);}if(type==='up'&&i>0)[next.nodes[i-1],next.nodes[i]]=[next.nodes[i],next.nodes[i-1]];if(type==='down'&&i<next.nodes.length-1)[next.nodes[i+1],next.nodes[i]]=[next.nodes[i],next.nodes[i+1]];if(type==='reset'){const n=next.nodes[i];next.nodes[i]={...catalog.node(n.effect,n.id),wet:n.wet,bypass:n.bypass};}if(type==='shuffle'){next.nodes[i].params.seed=(next.nodes[i].params.seed+131)%65536;this.renderer?.restoreIds.delete(id);}if(type==='restore'){this.ensureRenderer().restoreIds.add(id);next.nodes[i].params.autoplay=false;}this.commit(next);}
 ensureRenderer(){return this.renderer??=new CameraRenderer();}
 frame(now){this.lastFrame=now;const info=this.rig.cameraSource();if(!info.video||info.video.readyState<2){if(this.hadCamera){this.renderer?.release();this.cameraFrame=null;this.hadCamera=false;}return null;}this.hadCamera=true;
  const active=this.state.enabled&&this.state.nodes.some(n=>!n.bypass&&n.wet>0);
  if(!active){this.error=null;this.renderer?.release();this.cameraFrame=info.video;return info.video;}
  if(!motion.held||this.effectLevel===undefined){this.effectLevel=info.level;this.effectBpm=info.bpm;}try{this.error=null;this.cameraFrame=this.ensureRenderer().render(info.video,this.state,{clock:motion.clock,held:motion.held,bpm:this.effectBpm,level:this.effectLevel,now,depth:info.depth,depthKey:info.depthKey});return this.cameraFrame;}catch(error){this.error=error.message;this.message('Camera FX unavailable: '+error.message);this.cameraFrame=info.video;return info.video;}
 }
 describeControls(){return this.state.nodes.map((n,i)=>({id:n.id,label:(i+1)+'. '+catalog.byId[n.effect].name.toUpperCase(),value:n.params.amount,min:-1,max:1,text:!this.state.enabled||n.bypass?'BYPASSED':n.params.count+' · '+Math.round(n.wet*100)+'% WET'+(n.params.autoplay?' · AUTO':'')}));}
 captureReady(){
  if(this.error)return this.error;if(!this.state.enabled||!this.rig.cameraSource().video)return null;
  for(const n of this.state.nodes.filter(n=>!n.bypass&&n.wet>0)){
    if(n.effect==='background-image'&&!this.renderer?.backgroundReady)return 'Choose a background picture before recording this camera stack.';
    const p=n.params,needs=[...catalog.byId[n.effect].requirements,...(p.target==='person'||p.target==='background'?['segment']:p.target==='face'?['face']:p.target==='body'?['pose']:[])];
    for(const k of needs){if(k==='depth'&&!this.rig.cameraSource().depth?.data)return 'Enable depth analysis and wait for its first result before recording.';
      if(k!=='depth'){const vision=this.renderer?.vision;if(vision?.failed.has(k))return 'The local '+k+' model is unavailable. Retry models or bypass that effect before recording.';if(!vision?.results[k]||performance.now()-vision.results[k].at>2000)return 'Wait for the local '+k+' model before recording, or explicitly bypass that effect.';}}
  }return null;
 }
 mount(){
  this.panel=document.createElement('section');this.panel.id='nfxCameraWorkspace';this.panel.className='card nfx-performance nfx-camera-workspace';
  this.panel.innerHTML=`<div class="c-hd"><span>CAMERA WORKSPACE</span></div><div class="nfx-perf-tabs" role="tablist"><button data-tab="source">SOURCE / MIX</button><button data-tab="effects">CAMERA FX</button><button data-tab="looks">LOOKS</button></div><p class="nfx-performance-status" role="status"></p><div id="nfxCameraEffects" hidden></div><div id="nfxCameraLooks" hidden>${this.ui.looksMarkup()}</div>`;
  this.motionPanel=document.createElement('section');this.motionPanel.id='nfxMotionPanel';this.motionPanel.className='card nfx-performance';
  this.motionPanel.innerHTML=`<div class="c-hd"><span>SILENCE & MOTION</span></div><label><input type="checkbox" id="nfxSilenceStop" checked> SILENCE STOP</label><p>Quiet, paused or muted input holds automatic motion. Your camera stays live.</p><label>Silence threshold · dBFS<input id="nfxSilenceThreshold" type="range" min="-80" max="-12" step="1" value="${motion.settings.threshold}"><output id="nfxSilenceThresholdValue">${motion.settings.threshold}</output></label><label>Quiet hold · milliseconds<input id="nfxSilenceHold" type="range" min="0" max="2000" step="50" value="${motion.settings.hold}"><output id="nfxSilenceHoldValue">${motion.settings.hold}</output></label><button id="nfxSimulation">PLAY SILENT SIMULATION</button><p id="nfxMotionStatus" role="status">SIMULATION PAUSED</p>`;
  this.setupPanel=document.createElement('section');this.setupPanel.id='nfxSetupPanel';this.setupPanel.className='card nfx-performance';this.setupPanel.innerHTML=`<div class="c-hd"><span>WHOLE-APP SETUPS</span></div><p>Save dials, Camera FX, motion, scene slots, audio and both recording layouts together.</p><label>Setup name<input id="nfxSetupName" maxlength="80" placeholder="My camera performance"></label><button data-setup="save">SAVE AS</button><label>Saved setups<select id="nfxSetupList"><option value="">Choose a setup</option></select></label><div class="nfx-perf-actions">${['load','rename','duplicate','delete','download','import'].map(k=>`<button data-setup="${k}">${k.toUpperCase()}</button>`).join('')}</div><input type="file" id="nfxSetupFile" accept="application/json,.json" hidden><div id="nfxSetupPreview" hidden></div><p class="nfx-performance-status" role="status"></p>`;
  this.rig.mountPerformance(this.panel,this.motionPanel,this.setupPanel);
  this.panel.onclick=e=>{const tab=e.target.closest('[data-tab]');if(tab)this.selectTab(tab.dataset.tab);const look=e.target.closest('[data-look]');if(look)this.guard(()=>{const nodes=catalog.looks[+look.dataset.look][1].map(id=>{const n=catalog.node(id);if(['puzzle','tunnel','time'].includes(catalog.byId[id].family))n.params.autoplay=true;return n;});this.openId=nodes[0]?.id||'';this.catalogOpen=false;this.commit({version:1,enabled:true,nodes});this.selectTab('effects');});};
  for(const p of [this.panel,this.motionPanel,this.setupPanel]){p.addEventListener('pointerdown',e=>e.stopPropagation());p.addEventListener('keydown',e=>e.stopPropagation());}
  this.motionPanel.onchange=e=>this.guard(()=>{if(e.target.id==='nfxSilenceStop')motion.configure({silenceStop:e.target.checked});if(e.target.id==='nfxSilenceThreshold')motion.configure({threshold:+e.target.value});if(e.target.id==='nfxSilenceHold')motion.configure({hold:+e.target.value});this.updateStatus();});
  this.motionPanel.querySelector('#nfxSimulation').onclick=()=>{const wanted=!motion.simPlaying;this.rig.selectSource('sim');motion.simPlaying=wanted;this.rig.refreshTransport();this.updateStatus();};
  this.setupPanel.onclick=e=>{const b=e.target.closest('[data-setup]');if(b)this.guard(()=>this.setupAction(b.dataset.setup));};
  this.setupPanel.querySelector('#nfxSetupFile').onchange=e=>this.guard(async()=>{const f=e.target.files[0];if(!f)return;if(f.size>1048576)throw Error('Choose a setup smaller than 1 MiB.');this.preview(setups.parse(await f.text(),this.rig.controlCatalog()));e.target.value='';});
  this.selectTab('source');
 }
 guard(fn){try{Promise.resolve(fn()).catch(e=>this.message(e.message));}catch(e){this.message(e.message);}}
 selectTab(tab){this.tab=tab;this.panel.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('on',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.setAttribute('role','tab');});this.panel.querySelector('#nfxCameraEffects').hidden=tab!=='effects';this.panel.querySelector('#nfxCameraLooks').hidden=tab!=='looks';this.rig.cameraTab(tab);}
 renderStack(){this.ui.render();this.byos?.cameraUI.render();this.byos?.syncVisibility();}
 updateStatus(){this.panel.querySelectorAll('[data-animation-label]').forEach(el=>{const n=this.state.nodes.find(n=>n.id===el.closest('[data-node]').dataset.node),held=n?.params.autoplay&&motion.held;el.textContent=held?'WAITING':'ANIMATE';el.parentElement.title=held?'Animation waits for sound. Play audio or explicitly play SIM.':'Animate this effect';});if(this.status&&Date.now()-this.statusAt>8000)this.status='';document.querySelector('#nfxMotionStatus').textContent=motion.status;document.querySelector('#nfxSilenceStop').checked=motion.settings.silenceStop;document.querySelector('#nfxSilenceThresholdValue').textContent=motion.settings.threshold;document.querySelector('#nfxSilenceHoldValue').textContent=motion.settings.hold;document.querySelector('#nfxSimulation').textContent=motion.simPlaying?'PAUSE SILENT SIMULATION':'PLAY SILENT SIMULATION';if(!this.status)this.panel.querySelector('.nfx-performance-status').textContent=!this.rig.cameraSource().video?'CAMERA OFF · ENABLE IN SOURCE / MIX':!this.state.enabled||!this.state.nodes.some(n=>!n.bypass&&n.wet>0)?'RAW CAMERA · FX BYPASSED':this.renderer?.status||'CAMERA LIVE · CAMERA FX ONLY';}
 snapshot(name){const base=this.rig.setupState(),studio=window.NFXStudio;if(!studio)throw Error('Recording settings are still loading.');return setups.validate({format:'neuroflux-setup',version:1,appVersion:'camera-fx-1',name,rig:base.rig,slots:base.slots,pins:base.pins,preferences:{source:base.source,byos:this.byos?.layout||[],byosSource:this.byos?.source||'studio',byosTabs:this.byos?.tabs||[],byosEnabled:!!this.byos?.enabled},camera:copy(this.state),motion:copy(motion.settings),studio:{profiles:copy(studio.profiles),settings:copy(studio.settings),audio:copy(studio.mixer.settings)}},this.rig.controlCatalog());}
 async quickSave(){
  if(this.savingSetup)return this.savingSetup;
  const stamp=new Date(),pad=(value,width=2)=>String(value).padStart(width,'0');
  const name=`Quick save ${stamp.getFullYear()}-${pad(stamp.getMonth()+1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}:${pad(stamp.getSeconds())}.${pad(stamp.getMilliseconds(),3)}`;
  // Capture synchronously at the tap, before waiting for storage or refreshing the library.
  const setup=this.snapshot(name);
  this.savingSetup=(async()=>{
   for(let attempt=0;attempt<3;attempt++){
    try{await this.store.create(setup);break;}
    catch(error){if(error?.name!=='ConstraintError'||attempt===2)throw error;setup.name=name+' · '+crypto.randomUUID().slice(0,8);}
   }
   await this.refreshSetups();this.setupPanel.querySelector('#nfxSetupList').value=setup.name;
   return setup;
  })();
  try{return await this.savingSetup;}finally{this.savingSetup=null;}
 }
 async refreshSetups(){try{this.saved=await this.store.list();const select=this.setupPanel.querySelector('#nfxSetupList'),value=select.value;select.innerHTML='<option value="">Choose a setup</option>'+this.saved.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');select.value=value;}catch(e){this.message('Local setup storage unavailable. Download/import files still work.');}}
 preview(setup){this.pending=setup;const preview=this.setupPanel.querySelector('#nfxSetupPreview');preview.hidden=false;preview.innerHTML=`<h3>${esc(setup.name)}</h3><p>${Object.keys(setup.rig).length} rig settings · ${setup.camera.nodes.length} Camera FX · two output layouts · Silence Stop ${setup.motion.silenceStop?'on':'off'}.</p><p>Reselect source audio, background pictures and 3D media. Camera/mic permissions, speaker mic monitoring and walkthrough activation are not restored.</p><button data-setup="apply">APPLY THIS SETUP</button><button data-setup="cancel">CANCEL</button>`;}
 async apply(setup){const studio=window.NFXStudio;if(studio.active||studio.busy||studio.starting||studio.exporting)throw Error('Finish recording/export before loading a whole-app setup.');const valid=setups.validate(setup,this.rig.controlCatalog());valid.studio.profiles.forEach(validateProfile);const before=this.snapshot('Rollback');try{this.rig.applySetup(valid);this.byos.restore(valid.preferences.byos,valid.preferences.byosSource,valid.preferences.byosTabs,valid.preferences.byosEnabled);this.commit(valid.camera);motion.configure(valid.motion);valid.studio.profiles.forEach((p,i)=>Object.assign(studio.profiles[i],p));studio.outputs.forEach((output,i)=>output.profile=studio.profiles[i]);studio.settings=copy(valid.studio.settings);Object.assign(studio.mixer.settings,valid.studio.audio);studio.mixer.apply();studio.persist();studio.render();this.updateStatus();this.pending=null;this.setupPanel.querySelector('#nfxSetupPreview').hidden=true;this.message('Setup loaded. Activate camera/audio inputs and reselect media when needed.');}catch(error){this.rig.applySetup(before);this.byos.restore(before.preferences.byos,before.preferences.byosSource,before.preferences.byosTabs,before.preferences.byosEnabled);this.commit(before.camera);motion.configure(before.motion);before.studio.profiles.forEach((p,i)=>Object.assign(studio.profiles[i],p));studio.outputs.forEach((output,i)=>output.profile=studio.profiles[i]);studio.settings=before.studio.settings;Object.assign(studio.mixer.settings,before.studio.audio);studio.mixer.apply();studio.persist();studio.render();throw error;}}
 async setupAction(action){const input=this.setupPanel.querySelector('#nfxSetupName'),selected=this.saved?.find(s=>s.name===this.setupPanel.querySelector('#nfxSetupList').value);
  if(action==='import'){this.setupPanel.querySelector('#nfxSetupFile').click();return;}
  if(action==='apply'){if(this.pending)await this.apply(this.pending);return;}
  if(action==='cancel'){this.pending=null;this.setupPanel.querySelector('#nfxSetupPreview').hidden=true;return;}
  if(action==='save'){const setup=this.snapshot(input.value.trim()||'My setup');if(this.saved?.some(s=>s.name===setup.name))throw Error('That name exists. Choose a new name or rename the saved setup.');await this.store.save(setup);this.message('Whole-app setup saved.');}
  if(action==='load'){if(!selected)throw Error('Choose a saved setup.');this.preview(selected);return;}
  if(action==='delete'){if(!selected)throw Error('Choose a saved setup.');await this.store.remove(selected.name);this.message('Saved settings removed. Recordings are unchanged.');}
  if(action==='rename'||action==='duplicate'){if(!selected)throw Error('Choose a saved setup.');const name=input.value.trim();if(!name||this.saved.some(s=>s.name===name))throw Error('Enter a new, unused setup name.');await this.store.save(setups.validate({...copy(selected),name},this.rig.controlCatalog()));if(action==='rename')await this.store.remove(selected.name);}
  if(action==='download'){const setup=selected||this.snapshot(input.value.trim()||'My setup'),blob=new Blob([JSON.stringify(setup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=setup.name.replace(/[^a-z0-9_-]/gi,'-')+'.neuroflux.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);this.message('Settings downloaded. Source media is not included.');return;}
  await this.refreshSetups();
 }
}
if(window.NFXRig?.mountPerformance){window.NFXCameraFX=window.NFXPerformance=new PerformanceWorkspace(window.NFXRig);}
