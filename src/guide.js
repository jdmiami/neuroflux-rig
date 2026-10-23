import contract from '../lib/guide-contract.cjs';
import { validateProfile } from './studio/profiles.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=selector=>document.querySelector(selector);
const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<.005:a===b;

class WalkthroughGuide {
  constructor(rig,knowledge){
    this.rig=rig;this.controls=knowledge.controls;this.cameraEffects=knowledge.cameraEffects||[];this.knowledgeVersion=knowledge.version;
    this.enabled=false;this.requestId=0;
    try{this.enabled=localStorage.getItem('nfx.guide.enabled')==='true';}catch{}
    this.index=0;this.done=[];this.mount();
    if(this.enabled)try{const saved=JSON.parse(sessionStorage.getItem('nfx.guide.v1'));if(saved?.plan&&saved.goal){this.saved=saved;this.message('Your previous walkthrough is ready to resume.');this.resume.hidden=false;}}catch{}
    this.timer=setInterval(()=>this.tick(),200);
  }
  mount(){
    const panel=document.createElement('section');panel.id='nfxGuidePanel';panel.className='card';
    panel.setAttribute('aria-label','AI guided walkthrough');
    panel.innerHTML=`<div class="c-hd"><span>GUIDED WALKTHROUGH</span><a href="/manual.html" target="_blank" rel="noopener">FULL MANUAL ↗</a></div>
      <label class="nfx-guide-toggle" for="nfxGuideEnabled"><span>WALKTHROUGH MODE <b id="nfxGuideEnabledLabel">OFF</b></span><input id="nfxGuideEnabled" type="checkbox" role="switch" aria-controls="nfxGuideHome"></label>
      <p class="nfx-guide-toggle-note">Optional and off by default. Turn it off any time to dismiss all guide overlays.</p>
      <div class="nfx-guide-home" id="nfxGuideHome" hidden><p>Tell me what you want to make. I’ll find the right controls and walk you through it.</p>
      <form id="nfxGuideForm"><label for="nfxGuideGoal">What would you like to do?</label><textarea id="nfxGuideGoal" maxlength="1200" rows="3" placeholder="Record a vertical camera mix with clean video and separate voice audio…" required></textarea>
      <button type="submit" id="nfxGuideBuild">BUILD MY WALKTHROUGH</button><button type="button" id="nfxGuideCancel" hidden>CANCEL REQUEST</button></form>
      <div class="nfx-guide-examples"><button type="button" data-goal="Help me mix my camera with the visuals and fade to camera only.">MIX MY CAMERA</button><button type="button" data-goal="Help me create a 6-split kaleidoscope with gentle swirl and ripple.">MIRROR + WARP</button><button type="button" data-goal="Help me record a clean portrait video with music and separate microphone audio.">RECORD A TAKE</button></div>
      <p id="nfxGuideStatus" role="status" aria-live="polite">Uses the manual and your current settings. You choose when to apply a change.</p>
      <button id="nfxGuideResume" hidden>RESUME WALKTHROUGH</button><div id="nfxGuidePlan"></div></div>`;
    this.panel=panel;this.rig.mountGuide(panel);this.resume=panel.querySelector('#nfxGuideResume');
    this.toggle=panel.querySelector('#nfxGuideEnabled');this.toggle.checked=this.enabled;
    panel.querySelector('#nfxGuideHome').hidden=!this.enabled;
    panel.querySelector('#nfxGuideEnabledLabel').textContent=this.enabled?'ON':'OFF';
    this.toggle.onchange=()=>this.setEnabled(this.toggle.checked);
    const banner=document.createElement('aside');banner.id='nfxGuideStep';banner.hidden=true;banner.setAttribute('aria-label','Current walkthrough step');
    banner.innerHTML=`<div class="nfx-guide-step-head"><button data-guide="expand" class="nfx-guide-progress" aria-expanded="true"></button><button data-guide="minimize" aria-label="Minimize walkthrough">−</button><button data-guide="end" aria-label="Turn off walkthrough mode" title="Turn off walkthrough mode">×</button></div>
      <div class="nfx-guide-step-body"><h3 id="nfxGuideTitle"></h3><p id="nfxGuideInstruction"></p><p id="nfxGuideExpected"></p><p id="nfxGuideObserved" role="status" aria-live="polite"></p>
      <div class="nfx-guide-actions"><button data-guide="show">SHOW CONTROL</button><button data-guide="apply">APPLY THIS STEP</button><button data-guide="undo" hidden>UNDO CHANGE</button><button data-guide="next">NEXT</button><button data-guide="skip">SKIP</button></div>
      <details><summary>Manual sources</summary><div id="nfxGuideSources"></div></details>
      <details><summary>Change the plan / I’m stuck</summary><label for="nfxGuideFeedback">What should we adjust?</label><input id="nfxGuideFeedback" maxlength="600" placeholder="That camera option is unavailable on this phone"><button data-guide="replan">REBUILD REMAINING STEPS</button></details></div>`;
    this.banner=banner;document.body.appendChild(banner);
    const spotlight=document.createElement('div');spotlight.id='nfxGuideSpotlight';spotlight.hidden=true;spotlight.setAttribute('aria-hidden','true');document.body.appendChild(spotlight);this.spotlight=spotlight;
    panel.querySelector('form').addEventListener('submit',event=>{event.preventDefault();this.generate().catch(error=>this.error(error));});
    panel.querySelector('#nfxGuideCancel').onclick=()=>this.request?.abort();
    panel.querySelectorAll('[data-goal]').forEach(button=>button.onclick=()=>{this.goalInput.value=button.dataset.goal;this.goalInput.focus();});
    this.resume.onclick=()=>{if(this.saved){try{this.accept(this.saved.plan,this.saved.goal);this.index=Math.min(this.saved.index||0,this.plan.steps.length-1);this.done=this.saved.done||[];this.begin();}catch(error){this.error(error);}}};
    panel.addEventListener('click',event=>{if(event.target.closest('[data-guide=begin]'))this.begin();});
    banner.addEventListener('click',event=>{const action=event.target.closest('[data-guide]')?.dataset.guide;if(action)this.handle(action).catch(error=>this.error(error));});
    for(const element of [panel,banner]){
      element.addEventListener('pointerdown',event=>event.stopPropagation());element.addEventListener('pointerup',event=>event.stopPropagation());
      element.addEventListener('keydown',event=>event.stopPropagation());
    }
    const shortcut=document.createElement('button');shortcut.type='button';shortcut.className='nfx-guide-shortcut';shortcut.textContent='GUIDE ME STEP BY STEP';
    shortcut.onclick=()=>{this.goalInput.value=$('#aiQ')?.value||this.goalInput.value;this.rig.guideOpen('ai');(this.enabled?this.goalInput:this.toggle).focus();};
    $('#aiSug')?.appendChild(shortcut);
  }
  setEnabled(enabled){
    this.enabled=!!enabled;this.toggle.checked=this.enabled;
    this.panel.querySelector('#nfxGuideHome').hidden=!this.enabled;
    this.panel.querySelector('#nfxGuideEnabledLabel').textContent=this.enabled?'ON':'OFF';
    try{localStorage.setItem('nfx.guide.enabled',String(this.enabled));}catch{}
    if(!this.enabled){
      this.requestId++;this.request?.abort();this.stopOverlay();this.plan=null;this.saved=null;this.done=[];
      this.resume.hidden=true;$('#nfxGuidePlan').replaceChildren();
      try{sessionStorage.removeItem('nfx.guide.v1');}catch{}
      this.message('Walkthrough mode is off. Your app settings stay as you left them.');
    }
  }
  get goalInput(){return this.panel.querySelector('#nfxGuideGoal');}
  get step(){return this.plan?.steps[this.index];}
  message(text){$('#nfxGuideStatus').textContent=text;}
  error(error){
    const message=error.name==='AbortError'?'Walkthrough request canceled. Your settings stayed as they were.':error.message||'The guide could not finish that step.';
    this.message(message);if(this.active)$('#nfxGuideObserved').textContent=message;
  }
  async generate(feedback=''){
    if(!this.enabled)throw new Error('Turn on WALKTHROUGH MODE to build a guide.');
    if(this.loading)return;
    const goal=(feedback?this.goal:this.goalInput.value).trim();if(!goal)throw new Error('Tell me what you would like to do first.');
    const requestId=++this.requestId;
    this.loading=true;this.request=new AbortController();this.message('Finding manual sections and building steps for your current setup…');
    $('#nfxGuideBuild').disabled=true;$('#nfxGuideCancel').hidden=false;
    try{
      const response=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'guide',goal,feedback,knowledgeVersion:this.knowledgeVersion,state:contract.sanitizeState(this.rig.guideState(),this.controls),completed:feedback?this.done:[]}),
        signal:AbortSignal.any([this.request.signal,AbortSignal.timeout(65000)])});
      const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'Gemini is unavailable. You can still open the full manual.');
      if(!this.enabled||requestId!==this.requestId)return;
      this.accept(result,goal);this.message(result.fallback?`Built with ${result.model}. ${result.requestedModel} was unavailable; a Flash fallback answered.`:`Built with ${result.model}, grounded in the manual.`);
      if(feedback)this.begin();
    }catch(error){if(error instanceof TypeError)throw new Error('The guide needs an internet connection. The cached manual is still available.');throw error;}
    finally{this.loading=false;this.request=null;$('#nfxGuideBuild').disabled=false;$('#nfxGuideCancel').hidden=true;}
  }
  accept(plan,goal){
    if(!Array.isArray(plan.steps)||!plan.steps.length||plan.steps.length>12||!Array.isArray(plan.sources))throw new Error('The guide returned an invalid walkthrough. Try describing your goal again.');
    const sources=new Set(plan.sources.map(s=>s.id));
    const steps=plan.steps.map(step=>{const action=contract.normalizeAction(step.action,this.controls);if(!step.sources?.some(id=>sources.has(id)))throw new Error('A guide step has no manual source. Please try again.');return {...step,action};});
    this.stopOverlay();this.plan={...plan,steps};this.goal=goal;this.index=0;this.done=[];this.saved=null;this.resume.hidden=true;
    $('#nfxGuidePlan').innerHTML=`<h3>${escape(plan.title)}</h3><p>${escape(plan.intro)}</p><p class="nfx-guide-model">${escape(plan.model)}${plan.fallback?` · Flash fallback for ${escape(plan.requestedModel)}`:''}</p><ol>${steps.map(s=>`<li>${escape(s.title)}</li>`).join('')}</ol><button data-guide="begin">BEGIN WALKTHROUGH</button>`;
    this.persist();
  }
  persist(){try{sessionStorage.setItem('nfx.guide.v1',JSON.stringify({plan:this.plan,goal:this.goal,index:this.index,done:this.done}));}catch{}}
  begin(){if(!this.enabled||!this.step)return;this.active=true;this.banner.hidden=false;this.banner.classList.remove('nfx-guide-collapsed');this.draw();this.reveal();}
  draw(){
    const step=this.step;if(!step)return;
    this.initialFx=this.rig.guideState().cameraFx?.nodes?.map(n=>n.id)||[];
    this.undo=null;this.manualApplied=false;this.applied=false;this.testPassed=false;this.observed=false;this.statusText='';
    $('#nfxGuideTitle').textContent=step.title;$('#nfxGuideInstruction').textContent=step.instruction;
    $('#nfxGuideExpected').textContent='Look for: '+step.expected;
    this.banner.querySelector('.nfx-guide-progress').textContent=`GUIDE · ${this.index+1} / ${this.plan.steps.length}`;
    this.banner.querySelector('[data-guide=apply]').hidden=step.action.type==='show';
    this.banner.querySelector('[data-guide=apply]').textContent=this.applyLabel(step.action);
    this.banner.querySelector('[data-guide=undo]').hidden=true;
    const selected=this.plan.sources.filter(s=>step.sources.includes(s.id));
    $('#nfxGuideSources').innerHTML=selected.map(source=>`<a href="/manual.html#${escape(/^[\w-]+$/.test(source.anchor)?source.anchor:'')}" target="_blank" rel="noopener">${escape(source.title)}</a><p>${escape(source.excerpt||'')}</p>`).join('');
    this.tick();
  }
  applyLabel(action){return {source:'CHOOSE SOURCE',enable_mic:'ENABLE MICROPHONE',test_output:'TEST OUTPUT',start_recording:'START TAKE · 3–2–1',stop_recording:'STOP & SAVE'}[action.type]||'APPLY THIS SETTING';}
  route(target){
    const parts=target.split('.');
    if(parts[0]==='camera'){
      const fx=window.NFXCameraFX,action=this.step.action;fx?.selectTab('effects');let selector='#nfxCameraWorkspace [data-tab=effects]';
      if(action.type==='camera_add'&&fx){fx.category=this.cameraEffects.find(e=>e.id===action.key)?.family||'all';fx.filter='';fx.catalogOpen=true;fx.renderStack();selector=`#nfxCameraEffects [data-add="${action.key}"]`;}
      else if(action.type==='camera_enabled')selector='#nfxCameraEffects .nfx-perf-switch';
      else if(action.type==='camera_set'&&fx){const [index,key]=action.key.split('.'),node=fx.state.nodes[+index];if(node){fx.openId=node.id;fx.renderStack();selector=`#nfxCameraEffects [data-node="${node.id}"] [data-param="${key}"]`;let parent=$(selector)?.closest('details');while(parent){parent.open=true;parent=parent.parentElement?.closest('details');}}}
      else if(['camera_remove','camera_move'].includes(action.type)&&fx){const node=fx.state.nodes[+action.key];if(node)selector=`#nfxCameraEffects [data-node="${node.id}"]>summary`;}
      return {page:'cam',selector};
    }
    if(parts[0]==='motion'){const id={silenceStop:'nfxSilenceStop',threshold:'nfxSilenceThreshold',hold:'nfxSilenceHold'}[this.step.action.key];return {page:'react',selector:id?'#'+id:'#nfxMotionPanel .c-hd'};}
    if(parts[0]==='setups')return {page:'scenes',selector:'#nfxSetupPanel .c-hd'};
    if(parts[0]==='control'){const control=this.controls.find(c=>c.id===parts[1]);return {page:control.page,selector:`#pages [data-id="${control.id}"]`};}
    if(parts[0]==='menu')return {page:parts[1],selector:`#tabs [data-p="${parts[1]}"]`};
    if(parts[0]==='source')return {page:'input',selector:parts[1]==='sim'?'#btnSrc':`#pages .srcb[data-s="${parts[1]}"]`};
    if(parts[0]==='output')return {page:'recording',tab:'output',output:parts[1]==='b'?1:0,selector:`#nfxStudioPanel [data-field="output.${parts[2]}"]`};
    if(parts[0]==='settings')return {page:'recording',tab:'record',selector:`#nfxStudioPanel [data-field="settings.${parts[1]}"]`};
    if(parts[0]==='audio')return {page:'recording',tab:'audio',selector:parts[1]==='enableMic'?'#nfxStudioPanel [data-action=micOn]':`#nfxStudioPanel [data-field="audio.${parts[1]}"]`};
    const selectors={start:'#btnRecord',stop:'#btnRecord',pause:'#nfxRecordControls [data-action=pause]',test:'#nfxStudioPanel [data-action=test]',snapshot:'#nfxStudioPanel [data-action=snapshot]'};
    return {page:'recording',tab:['record','output','audio','library'].includes(parts[1])?parts[1]:'record',selector:selectors[parts[1]]||'#nfxStudioBody'};
  }
  reveal(){
    if(!this.step)return;const route=this.route(this.step.action.target),studio=window.NFXStudio;
    if(route.page==='recording'&&studio){studio.tab=route.tab||'record';if(route.output!==undefined)studio.current=route.output;}
    this.rig.guideOpen(route.page);if(route.page==='recording')studio?.render();
    this.rig.placeGuideBanner(this.banner);
    this.target=$(route.selector);this.selector=route.selector;
    requestAnimationFrame(()=>{this.target?.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});this.position();});
  }
  currentValue(action,state){
    if(action.type==='set_control')return state.controls[action.key];
    if(action.type==='set_output'){
      const profile=state.outputs[action.output==='b'?1:0];if(!profile)return undefined;
      if(action.key==='orientation')return profile.width===profile.height?'square':profile.width>profile.height?'landscape':'portrait';
      if(action.key==='resolution')return Math.min(profile.width,profile.height);
      return profile[action.key];
    }
    if(action.type==='set_audio')return state.audio[action.key];
    if(action.type==='set_recording')return state.recording[action.key];
  }
  fulfilled(action,state){
    if(action.type==='show')return false;
    const nodes=state.cameraFx?.nodes||[];
    if(action.type==='camera_enabled')return state.cameraFx?.enabled===action.value;
    if(action.type==='camera_add')return nodes.some(n=>n.effect===action.key&&!this.initialFx.includes(n.id));
    if(action.type==='camera_set'){const [i,key]=action.key.split('.'),n=nodes[+i];return !!n&&same(['wet','bypass'].includes(key)?n[key]:n.params[key],action.value);}
    if(action.type==='camera_remove')return !nodes.some(n=>n.id===this.initialFx[+action.key]);
    if(action.type==='camera_move')return !!nodes[action.value]&&nodes[action.value].id===this.initialFx[+action.key];
    if(action.type==='set_motion')return same(state.motionSettings?.[action.key],action.value);
    if(action.type==='set_control'&&['cam','hands','depth','motion','lyrics'].includes(action.key)&&action.value===1){
      const key={cam:'camera',hands:'hands',depth:'depth',motion:'motion',lyrics:'lyrics'}[action.key];if(key&&!state.services[key])return false;
    }
    if(['set_control','set_output','set_audio','set_recording'].includes(action.type))return same(this.currentValue(action,state),action.value);
    if(action.type==='source')return action.key==='file'?this.manualApplied:state.source===action.key;
    if(action.type==='enable_mic')return state.services.extraMic;
    if(action.type==='test_output')return this.testPassed===true;
    if(action.type==='start_recording')return ['recording','paused'].includes(state.capture);
    if(action.type==='stop_recording')return this.applied&&state.capture==='idle';
    return false;
  }
  async perform(action){
    const studio=window.NFXStudio,state=this.rig.guideState();
    if(action.type.startsWith('camera_')){
      const fx=window.NFXCameraFX;if(!fx)throw new Error('Camera tools are loading.');const previous=structuredClone(fx.state);
      if(action.type==='camera_add')fx.add(action.key);
      else if(action.type==='camera_enabled')fx.commit({...structuredClone(fx.state),enabled:action.value});
      else if(action.type==='camera_set'){const [i,key]=action.key.split('.'),n=fx.state.nodes[+i];if(!n)throw new Error('That stack slot is empty. Rebuild this guide for your current stack.');fx.change(n.id,key,action.value);}
      else if(action.type==='camera_remove'){const n=fx.state.nodes[+action.key];if(!n)throw new Error('That stack slot is empty.');fx.command('remove',n.id);}
      else if(action.type==='camera_move'){const next=structuredClone(fx.state);const [n]=next.nodes.splice(+action.key,1);if(!n||action.value>=next.nodes.length+1)throw new Error('That stack position is unavailable.');next.nodes.splice(action.value,0,n);fx.commit(next);}
      this.undo=()=>fx.commit(previous);
    }else if(action.type==='set_motion'){
      const previous=window.NFXMotion.settings[action.key];window.NFXMotion.configure({[action.key]:action.value});this.undo=()=>window.NFXMotion.configure({[action.key]:previous});
    }else if(action.type==='set_control'){
      const previous=state.controls[action.key];this.rig.setParam(action.key,action.value,'user');
      if(!['cam','hands','depth','motion','lyrics'].includes(action.key))this.undo=()=>this.rig.setParam(action.key,previous,'user');
    }else if(['set_output','set_audio','set_recording'].includes(action.type)){
      if(!studio)throw new Error('Recording controls are still loading.');
      const scope={set_output:'output',set_audio:'audio',set_recording:'settings'}[action.type];
      const locked=studio.active||studio.busy||studio.starting||studio.exporting;
      if(locked&&scope!=='audio')throw new Error('Finish the current recording/export before changing recording settings.');
      const oldProfile=structuredClone(studio.profiles[action.output==='b'?1:0]);
      const previous=this.currentValue(action,state);if(scope==='output')studio.current=action.output==='b'?1:0;
      try{await studio.change({target:{dataset:{field:scope+'.'+action.key},type:typeof action.value==='boolean'?'checkbox':typeof action.value==='number'?'number':'select-one',value:action.value,checked:action.value}});
        if(scope==='output')validateProfile(studio.profiles[studio.current]);
      }catch(error){if(scope==='output'){Object.assign(studio.profiles[studio.current],oldProfile);studio.persist();studio.render();}throw error;}
      if(scope==='output')this.undo=()=>{if(studio.active)throw new Error('Stop and save before undoing output settings.');Object.assign(studio.profiles[action.output==='b'?1:0],oldProfile);studio.persist();studio.render();};
      else this.undo=()=>studio.change({target:{dataset:{field:scope+'.'+action.key},type:typeof previous==='boolean'?'checkbox':typeof previous==='number'?'number':'select-one',value:previous,checked:previous}});
      studio.render();
    }else if(action.type==='source'){
      if(action.key==='sys'&&!state.capabilities.systemAudio)throw new Error('System audio sharing is not available on this device. Ask the guide for a file or live-input alternative.');
      if(action.key==='file'||state.source!==action.key)this.rig.selectSource(action.key);
      if(action.key==='file')this.manualApplied=true;
    }else if(action.type==='enable_mic')await studio.mixer.enableMicrophone($('#nfxMicDevice')?.value);
    else if(action.type==='test_output'){this.testPassed=await studio.testOutputs();if(!this.testPassed)throw new Error('The output test did not pass. Lower quality or ask the guide for a lighter setup.');}
    else if(action.type==='start_recording')await studio.start();
    else if(action.type==='stop_recording'){if(!studio.session)throw new Error('There is no active take to stop.');await studio.stop();}
  }
  async handle(action){
    if((this.applying||this.loading)&&['apply','next','skip','replan','undo'].includes(action))return;
    if(action==='end'){this.setEnabled(false);return;}
    if(action==='minimize'){this.banner.classList.add('nfx-guide-collapsed');this.banner.querySelector('[data-guide=expand]').setAttribute('aria-expanded','false');return;}
    if(action==='expand'){this.banner.classList.remove('nfx-guide-collapsed');this.banner.querySelector('[data-guide=expand]').setAttribute('aria-expanded','true');return;}
    if(action==='show'){this.reveal();return;}
    if(action==='replan'){const feedback=$('#nfxGuideFeedback').value.trim();if(!feedback)throw new Error('Tell me what needs adjusting.');await this.generate(feedback);return;}
    if(action==='undo'){if(this.undo){await this.undo();this.undo=null;this.banner.querySelector('[data-guide=undo]').hidden=true;this.tick();}return;}
    if(action==='next'||action==='skip'){
      if(action==='next'&&this.step.action.type!=='show'&&!this.fulfilled(this.step.action,this.rig.guideState()))throw new Error('This setting is not ready yet. Apply it, make the change yourself, or skip this step.');
      this.done.push((action==='skip'?'Skipped: ':'Completed: ')+this.step.title);
      this.index++;this.applied=false;this.testPassed=false;
      if(this.index>=this.plan.steps.length){this.stopOverlay();this.resume.hidden=true;sessionStorage.removeItem('nfx.guide.v1');this.message('Walkthrough complete. Review a short take before keeping a full performance.');$('#nfxGuidePlan').innerHTML='<h3>WALKTHROUGH COMPLETE</h3><p>You can describe another goal to make a fresh plan from your current settings.</p>';return;}
      this.draw();this.persist();this.reveal();return;
    }
    if(action==='apply'&&!this.applying&&!this.loading){
      this.applying=true;this.reveal();$('#nfxGuideObserved').textContent='Waiting for the result…';
      try{await this.perform(this.step.action);this.applied=true;if(this.undo)this.banner.querySelector('[data-guide=undo]').hidden=false;}
      finally{this.applying=false;this.tick();}
    }
  }
  tick(){
    if(!this.active||!this.step)return;
    this.rig.placeGuideBanner(this.banner);
    const state=this.rig.guideState(),done=this.fulfilled(this.step.action,state),manual=this.step.action.type==='show'||this.step.action.type==='source'&&this.step.action.key==='file';
    const next=this.banner.querySelector('[data-guide=next]');next.disabled=!manual&&!done;next.textContent=manual?'I CHECKED THIS · NEXT':done?'VERIFIED · NEXT':'WAITING FOR THIS STEP';
    const apply=this.banner.querySelector('[data-guide=apply]');apply.disabled=this.applying||this.loading;
    const text=manual?'Review this step yourself; the guide cannot verify what you hear or see.':done?'Verified from the app’s current state.':this.applying?'Applying / waiting for permission or countdown…':'Make the change yourself, or apply this step.';
    if(text!==this.statusText){$('#nfxGuideObserved').textContent=text;this.statusText=text;}
    if(!state.ui.menuOpen&&['recording','paused'].includes(state.capture)){
      if(!this.autoCollapsed){this.banner.classList.add('nfx-guide-collapsed');this.autoCollapsed=true;}
    }else this.autoCollapsed=false;
    this.position();
  }
  position(){
    if(!this.active)return;this.target=$(this.selector);const rect=this.target?.getBoundingClientRect();
    const visible=rect&&rect.width&&rect.height&&rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth;
    this.spotlight.hidden=!visible;if(visible)Object.assign(this.spotlight.style,{left:rect.left-3+'px',top:rect.top-3+'px',width:rect.width+6+'px',height:rect.height+6+'px'});
  }
  stopOverlay(){this.active=false;this.banner.hidden=true;this.spotlight.hidden=true;}
}
async function init(){
  if(!window.NFXRig?.mountGuide)return;
  try{const response=await fetch('/guide-index.json');if(!response.ok)throw new Error('Guide catalog unavailable.');const data=await response.json();window.NFXGuide=new WalkthroughGuide(window.NFXRig,data);}
  catch{ /* The visual rig remains usable even if guide assets cannot load. */ }
}
init();
