import catalog from '../../lib/camera-fx.cjs';
import knowledge from '../../lib/guide-index.json';
import {CameraFXControls,artwork} from './camera-ui.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class BuildStudio {
 constructor(workspace){
  this.fx=workspace;this.layout=[];this.homes=[];this.query='';this.family='all';this.source='studio';
  try{this.layout=JSON.parse(localStorage.getItem('nfx.byos.v1'))||[];}catch{}
  this.layout=Array.isArray(this.layout)?[...new Set(this.layout)].filter(id=>knowledge.controls.some(c=>c.id===id)).slice(0,110):[];
  this.root=document.createElement('section');this.root.id='nfxBYOS';this.root.className='card nfx-performance';
  this.root.innerHTML=`<div class="c-hd">BUILD YOUR OWN STUDIO</div><button data-byos="focus" aria-pressed="false">FOCUS ON MY MENU</button><p>Your tools. Your layout. Add just what you need.</p><div class="nfx-perf-actions"><button data-byos="library">＋ ADD TO MY MENU</button><button data-byos="fresh">START FRESH</button><button data-byos="save">SAVE SETUP</button></div><p role="status" class="byos-status"></p><div class="byos-menu"></div><button data-byos="camera">CAMERA SOURCE / MIX</button><div class="byos-camera nfx-camera-workspace"></div>`;
  workspace.rig.mountBYOS(this.root);
  this.dialog=document.createElement('dialog');this.dialog.id='nfxBYOSLibrary';this.dialog.innerHTML=`<header><strong>YOUR TOOL LIBRARY</strong><button data-close aria-label="Close library">×</button></header><form><input aria-label="Find an effect or describe a look" maxlength="600" placeholder="Six mirrors, liquid edges, warm colors…"><button type="submit">ASK AI</button></form><select aria-label="Library category"><option value="all">ALL TOOLS</option><option value="source">VISUAL SOURCES</option><option value="synth">SYNTH CONTROLS</option>${Object.keys(catalog.families).map(f=>`<option value="${f}">${esc(f.toUpperCase())}</option>`).join('')}</select><p class="byos-search-status" role="status">Search names offline, or ask AI to find a look.</p><div class="byos-results"></div>`;document.body.append(this.dialog);
  this.dialog.querySelector('[data-close]').onclick=()=>this.dialog.close();
  this.dialog.querySelector('input').oninput=e=>{this.query=e.target.value;this.results=null;this.search();};
  this.dialog.querySelector('select').onchange=e=>{this.family=e.target.value;this.results=null;this.search();};
  this.dialog.querySelector('form').onsubmit=e=>{e.preventDefault();this.ask();};
  this.dialog.onclick=e=>{const b=e.target.closest('[data-add-tool]');if(b)this.fx.guard(()=>this.add(b.dataset.addTool));};
  this.root.addEventListener('click',e=>{const b=e.target.closest('[data-byos]');if(!b)return;this.fx.guard(async()=>{const a=b.dataset.byos;if(a==='focus'){this.focused=!this.focused;this.root.parentElement.classList.toggle('byos-focused',this.focused);b.textContent=this.focused?'SHOW FULL QUICK MENU':'FOCUS ON MY MENU';b.setAttribute('aria-pressed',String(this.focused));}if(a==='camera')this.fx.rig.guideOpen('cam');if(a==='library'){this.search();this.dialog.showModal();}if(a==='save'){await this.fx.quickSave();this.status('Setup and custom menu saved on this device.');}if(a==='fresh'){await this.fresh();}if(a==='remove'||a==='up'||a==='down'){let i=+b.dataset.index;if(a==='remove')this.layout.splice(i,1);else{let j=i+(a==='up'?-1:1);if(j>=0&&j<this.layout.length)[this.layout[i],this.layout[j]]=[this.layout[j],this.layout[i]];}this.persist();this.render();}});});
  for(const el of [this.root,this.dialog])for(const type of ['pointerdown','keydown'])el.addEventListener(type,e=>e.stopPropagation());
  const cameraRoot=this.root.querySelector('.byos-camera');
  const proxy=new Proxy(workspace,{get:(target,key)=>key==='panel'?{querySelector:()=>cameraRoot}:typeof target[key]==='function'?target[key].bind(target):target[key],set:(target,key,value)=>{target[key]=value;return true;}});
  this.cameraUI=new CameraFXControls(proxy);this.cameraUI.render();
  this.render();
  const launch=document.createElement('button');launch.id='startBYOS';launch.className='st-b';launch.innerHTML='<i>＋</i><span>BUILD YOUR OWN STUDIO<small>Blank canvas · No effects · Add your own tools</small></span>';
  document.querySelector('#stMenu')?.prepend(launch);
  launch.onclick=()=>this.fx.guard(async()=>{launch.disabled=true;try{await this.fresh();document.querySelector('#start [data-go=sim]')?.click();this.fx.rig.guideOpen('quick');}finally{launch.disabled=false;}});
  new MutationObserver(()=>{if(this.root.parentElement.classList.contains('on'))this.render();else{for(const [el,marker]of this.homes)marker.replaceWith(el);this.homes=[];}}).observe(this.root.parentElement,{attributes:true,attributeFilter:['class']});
 }
 async fresh(){
  const studio=window.NFXStudio;if(!studio?.storageReady)throw Error('Studio is loading. Try again in a moment.');
  if(studio.active||studio.busy||studio.starting||studio.exporting)throw Error('Finish recording or export before starting fresh.');
  await this.fx.quickSave();this.source='blank';this.layout=[];
  for(const c of knowledge.controls)if(Number.isFinite(c.default)&&!['cam','motion','depth','hands','lyrics','aiDir'].includes(c.id))this.fx.rig.setParam(c.id,c.default,'silent');
  for(const id of ['cam','motion','depth','hands','lyrics','aiDir'])this.fx.rig.setParam(id,0,'user');
  this.fx.commit(catalog.empty());this.persist();this.render();
  this.focused=true;this.root.parentElement.classList.add('byos-focused');const b=this.root.querySelector('[data-byos=focus]');b.textContent='SHOW FULL QUICK MENU';b.setAttribute('aria-pressed','true');
  this.status('Blank canvas. Add a visual source or camera from the library. Your previous setup is saved.');
 }
 status(s){this.root.querySelector('.byos-status').textContent=s;}
 persist(){localStorage.setItem('nfx.byos.v1',JSON.stringify(this.layout));}
 restore(layout=[],source='studio'){this.source=['studio','blank','camera','synth'].includes(source)?source:'studio';this.layout=layout.filter(id=>knowledge.controls.some(c=>c.id===id));this.persist();this.render();}
 syncVisibility(){this.root.querySelector('.byos-camera').hidden=!this.fx.state.nodes.length;this.root.querySelector('[data-byos=camera]').hidden=this.source!=='camera'&&!this.fx.state.nodes.length;}
 render(){
  this.syncVisibility();
  for(const [el,marker]of this.homes){marker.replaceWith(el);}this.homes=[];
  const menu=this.root.querySelector('.byos-menu');menu.replaceChildren();
  for(const [i,id]of this.layout.entries()){
   const c=knowledge.controls.find(c=>c.id===id);if(!c)continue;
   const card=document.createElement('details');card.open=true;card.className='byos-control';card.innerHTML=`<summary>${esc(c.label)}</summary><div class="byos-native"></div><div class="nfx-perf-actions"><button data-byos="up" data-index="${i}" aria-label="Move ${esc(c.label)} up" ${i===0?'disabled':''}>↑</button><button data-byos="down" data-index="${i}" aria-label="Move ${esc(c.label)} down" ${i===this.layout.length-1?'disabled':''}>↓</button><button data-byos="remove" data-index="${i}">REMOVE</button></div>`;
   const native=document.querySelector(`.hc[data-id="${id}"]`);if(native){const marker=document.createComment('BYOS control home');native.before(marker);this.homes.push([native,marker]);card.querySelector('.byos-native').append(native);}else{const b=document.createElement('button');b.textContent='OPEN '+c.label;b.onclick=()=>this.fx.rig.guideOpen(c.page);card.querySelector('.byos-native').append(b);}menu.append(card);
  }
  if(!this.layout.length&&!this.fx.state.nodes.length)menu.innerHTML='<p class="byos-empty">An empty rack. Add your first tool above.</p>';
 }
 add(id){if(id==='source:camera'){this.source='camera';this.fx.rig.setParam('camMix',1,'user');this.fx.rig.setParam('camEdge',0,'user');this.fx.rig.setParam('cam',1,'user');}else if(id==='source:synth'){this.source='synth';this.fx.rig.setParam('cam',0,'user');if(!this.layout.includes('mode'))this.layout.push('mode');this.persist();this.render();}else if(id.startsWith('camera:')){this.fx.add(id.slice(7));this.fx.catalogOpen=false;this.fx.renderStack();}else if(knowledge.controls.some(c=>c.id===id)&&!this.layout.includes(id)){this.layout.push(id);this.persist();this.render();}this.syncVisibility();this.dialog.close();this.status(this.source==='blank'?'Tool added. Add a camera or visual source to see its effect.':'Added to your menu. Turn a knob and make it yours.');}
 search(){
  const q=this.query.toLowerCase().trim(),terms=q.split(/\s+/).filter(Boolean);
  let items=[{id:'source:camera',label:'Camera source',description:'Start with your plain camera feed. Camera permission is requested only when you add it.',family:'source'},{id:'source:synth',label:'Visual synth source',description:'Add the visual generator and its scene selector to your blank canvas.',family:'source'},...catalog.effects.map(e=>({id:'camera:'+e.id,label:e.name,description:e.description,family:e.family,e})),...knowledge.controls.map(c=>({id:c.id,label:c.label,description:(knowledge.chunks.find(p=>p.title.toUpperCase().includes(c.label.toUpperCase()))?.text||`${c.page.toUpperCase()} · ${c.min} to ${c.max}. Default: ${c.defaultLabel}.`),family:'synth'}))];
  items=items.filter(e=>(this.results?this.results.includes(e.id):(this.family==='all'||e.family===this.family)&&terms.every(t=>(e.label+' '+e.description+' '+e.family).toLowerCase().includes(t))));
  if(this.results)items.sort((a,b)=>this.results.indexOf(a.id)-this.results.indexOf(b.id));
  this.dialog.querySelector('.byos-results').innerHTML=items.map(e=>`<article>${e.e?artwork(e.e):'<div class="byos-glyph">◉</div>'}<strong>${esc(e.label)}</strong><small>${e.e?'CAMERA ONLY':e.family==='source'?'SOURCE':'SYNTH CONTROL'}</small><details><summary>WHAT IT DOES</summary><p>${esc(e.description)}</p>${e.e?.requirements.length?`<p>Needs local ${esc(e.e.requirements.join(', '))} analysis.</p>`:''}</details><button data-add-tool="${esc(e.id)}" ${this.layout.includes(e.id)?'disabled':''}>${this.layout.includes(e.id)?'IN YOUR MENU':'＋ ADD'}</button></article>`).join('')||'<p>No matching tools. Try a shorter name or ASK AI.</p>';
 }
 async ask(){const status=this.dialog.querySelector('.byos-search-status'),button=this.dialog.querySelector('[type=submit]');if(!this.query.trim()||button.disabled)return;button.disabled=true;status.textContent='Finding tools for your look…';try{const response=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'library',query:this.query}),signal:AbortSignal.timeout(65000)});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.message||'AI search unavailable.');this.results=result.ids;this.search();status.textContent=result.explanation+' · '+result.model+(result.fallback?' (Flash fallback)':'');}catch(e){status.textContent='AI search unavailable. Name search still works. '+e.message;}finally{button.disabled=false;}}
}
