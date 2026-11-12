'use strict';
const ids = ['visuals', 'space', 'camera'];
const names = {visuals:'Visuals', space:'3D', camera:'Camera'};
const blends = ['normal','screen','add','multiply','difference','overlay','luma','depth'];
const soundControls=require('./layer-stages.cjs').post.map(p=>p.control);
function defaults() {
 return {version:1,enabled:false,order:[...ids],layers:Object.fromEntries(ids.map(id=>[id,{name:names[id],visible:true,locked:false,opacity:1,blend:id==='space'?'add':id==='camera'?'screen':'normal'}])),groups:[],words:{text:'',visible:true,opacity:1,size:.075,color:'#edf8ff'},audioLinks:{}};
}
function validate(raw) {
 if(!raw||raw.version!==1||typeof raw.enabled!=='boolean'||!Array.isArray(raw.order)||raw.order.length!==3||new Set(raw.order).size!==3||raw.order.some(id=>!ids.includes(id)))throw Error('Invalid source layer order.');
 const out=defaults();out.enabled=raw.enabled;out.order=[...raw.order];
 for(const id of ids){const v=raw.layers?.[id];if(!v||typeof v.name!=='string'||!v.name.trim()||v.name.length>40||typeof v.visible!=='boolean'||typeof v.locked!=='boolean'||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>1||!blends.includes(v.blend)||id!=='camera'&&['luma','depth'].includes(v.blend))throw Error('Invalid '+names[id]+' layer.');out.layers[id]={name:v.name.trim(),visible:v.visible,locked:v.locked,opacity:v.opacity,blend:v.blend};}
 if(!Array.isArray(raw.groups)||raw.groups.length>16)throw Error('Invalid effect folders.');
 const used=new Set(),groups=new Set();out.groups=raw.groups.map(g=>{
  if(!g||!/^group-[\w-]{1,40}$/.test(g.id)||groups.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>40||typeof g.bypass!=='boolean'||typeof g.locked!=='boolean'||!Number.isFinite(g.strength)||g.strength<0||g.strength>1||!Array.isArray(g.nodes)||g.nodes.length<1||g.nodes.length>16)throw Error('Invalid effect folder.');
  groups.add(g.id);for(const id of g.nodes){if(!/^fx-[\w-]{1,40}$/.test(id)||used.has(id))throw Error('An effect can belong to only one folder.');used.add(id);}
  return {id:g.id,name:g.name.trim(),bypass:g.bypass,locked:g.locked,strength:g.strength,nodes:[...g.nodes]};
 });
 if(raw.words!==undefined){const v=raw.words;if(!v||typeof v.text!=='string'||v.text.length>400||typeof v.visible!=='boolean'||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>1||!Number.isFinite(v.size)||v.size<.025||v.size>.2||!/^#[0-9a-f]{6}$/i.test(v.color))throw Error('Invalid words layer.');out.words={text:v.text,visible:v.visible,opacity:v.opacity,size:v.size,color:v.color};}
 if(raw.audioLinks!==undefined){if(!raw.audioLinks||typeof raw.audioLinks!=='object'||Array.isArray(raw.audioLinks))throw Error('Invalid sound links.');for(const [key,value]of Object.entries(raw.audioLinks)){if(!soundControls.includes(key)||!value||!['bass','mid','high','level'].includes(value.band)||!Number.isFinite(value.amount)||Math.abs(value.amount)>1)throw Error('Invalid sound link.');out.audioLinks[key]={band:value.band,amount:value.amount};}}
 return out;
}
function fromLegacy(controls={}) {
 const out=defaults(),mix=Math.min(1,Math.max(0,Number(controls.camMix)||0));
 out.layers.camera.opacity=Math.min(1,mix*2);out.layers.visuals.opacity=out.layers.space.opacity=controls.cam===0?1:Math.min(1,2-mix*2);
 out.layers.camera.blend=['screen','add','difference','multiply','luma','depth'][controls.camBlend]||'screen';return out;
}
function effectiveCamera(state,layerState) {
 const grouped=new Map(layerState.groups.flatMap(g=>g.nodes.map(id=>[id,g])));
 return {...state,nodes:state.nodes.map(n=>{const g=grouped.get(n.id);return g?{...n,bypass:n.bypass||g.bypass,wet:n.wet*g.strength}:n;})};
}
module.exports={ids,names,blends,defaults,validate,fromLegacy,effectiveCamera};
