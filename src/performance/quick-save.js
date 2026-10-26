const disk = '<path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h9V3M7 21v-8h10v8"/>';
const check = '<path d="m5 12 4 4L19 6"/>';

export class QuickSaveControl {
 constructor(workspace) {
  this.workspace=workspace;
  this.button=document.createElement('button');
  this.button.id='btnQuickSave';this.button.type='button';this.button.className='dk dk-quick-save';
  this.button.setAttribute('aria-label','Quick save current setup');
  this.button.setAttribute('aria-keyshortcuts','Control+S Meta+S');
  this.button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${disk}</svg><span>SAVE</span>`;
  this.feedback=document.createElement('span');this.feedback.className='nfx-save-feedback';
  this.feedback.setAttribute('role','status');this.feedback.setAttribute('aria-live','polite');
  document.body.appendChild(this.feedback);
  for(const type of ['pointerdown','pointerup'])this.button.addEventListener(type,event=>event.stopPropagation());
  this.button.addEventListener('click',event=>{event.stopPropagation();this.save();});
  this.observer=new MutationObserver(()=>this.place());
  this.observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',event=>{
   if(!(event.ctrlKey||event.metaKey)||event.altKey||event.key.toLowerCase()!=='s'||document.getElementById('start'))return;
   event.preventDefault();event.stopPropagation();if(!event.repeat)this.save();
  },true);
  this.place();this.setState('ready');
 }
 place() {
  const clean=document.body.classList.contains('clean'),dock=document.getElementById('dock');
  if(!dock)return;dock.classList.add('nfx-has-quick-save');
  this.button.classList.toggle('nfx-quick-save-clean',clean);
  if(clean){if(this.button.parentElement!==document.body)document.body.appendChild(this.button);}
  else if(this.button.parentElement!==dock)dock.insertBefore(this.button,document.getElementById('nfxRecordControls')||document.getElementById('btnMenu'));
 }
 sync(){this.button.disabled=!!this.pending||!window.NFXStudio;}
 setState(state,name='') {
  this.button.dataset.state=state;this.button.setAttribute('aria-busy',state==='saving');
  this.button.querySelector('svg').innerHTML=state==='saved'?check:disk;
  this.button.querySelector('span').textContent={ready:'SAVE',saving:'…',saved:'SAVED',error:'RETRY'}[state];
  this.button.title=name?`Saved as ${name}. Find it in SCENES → Whole-app setups.`:'Quick save current setup · Ctrl/Cmd+S · Restore in SCENES';
  this.sync();
 }
 async save() {
  if(this.pending)return this.pending;
  clearTimeout(this.reset);this.setState('saving');
  this.pending=(async()=>{
   try {
    const setup=await this.workspace.quickSave();
    this.setState('saved',setup.name);
    this.workspace.message('Setup saved on this device.');
    this.feedback.textContent=`Setup saved as ${setup.name}. Restore it under Scenes, Whole-app setups.`;
    this.workspace.rig.notify?.('SETUP SAVED','SCENES → SETUPS');
   } catch(error) {
    const message='Could not save this setup. '+(error?.message||'Check device storage and try again.');
    this.setState('error');this.feedback.textContent=message;this.workspace.message(message);
    this.workspace.rig.notify?.('SAVE FAILED','TRY AGAIN');
   } finally {
    this.pending=null;this.sync();this.reset=setTimeout(()=>this.setState('ready'),2200);
   }
  })();
  this.sync();return this.pending;
 }
}
