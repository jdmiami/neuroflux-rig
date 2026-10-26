'use strict';
const fx=require('./camera-fx.cjs');
const audioRules={music:[0,2],mic:[0,2],musicMonitor:[0,1],micMonitor:[0,1],offset:[-500,500]};
const clone=value=>JSON.parse(JSON.stringify(value));
function rejectKeys(value){if(value&&typeof value==='object')for(const key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe key in setup file.');rejectKeys(value[key]);}}
function validate(input,controls){
 rejectKeys(input);if(!input||input.format!=='neuroflux-setup'||input.version!==1)throw Error('This is not a supported Neuroflux version 1 setup.');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)throw Error('Use a setup name of 1–80 characters.');
 const numeric=raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid rig settings.');const out={};for(const [key,value]of Object.entries(raw)){const c=controls.find(c=>c.id===key);if(!c||!Number.isFinite(value)||value<c.min||value>c.max||c.step&& !Number.isInteger(value))throw Error('Unsupported rig control: '+key);out[key]=value;}return out;};
 const out={format:input.format,version:1,appVersion:String(input.appVersion||'1').slice(0,60),name:input.name.trim(),rig:numeric(input.rig),camera:fx.validate(input.camera),motion:{},slots:[],pins:[],studio:{profiles:[],settings:{},audio:{}},preferences:{}};
 for(const [key,range]of Object.entries({threshold:[-80,-12],hold:[0,2000]})){const v=input.motion?.[key];if(!Number.isFinite(v)||v<range[0]||v>range[1])throw Error('Invalid silence setting.');out.motion[key]=v;}
 if(typeof input.motion?.silenceStop!=='boolean')throw Error('Invalid Silence Stop setting.');out.motion.silenceStop=input.motion.silenceStop;
 if(!Array.isArray(input.slots)||input.slots.length>4)throw Error('Invalid scene slots.');out.slots=input.slots.map(slot=>slot?{n:String(slot.n||'Scene').slice(0,80),v:numeric(slot.v)}:null);
 if(!Array.isArray(input.pins)||input.pins.length>30||input.pins.some(id=>!controls.some(c=>c.id===id)))throw Error('Invalid pinned controls.');out.pins=[...new Set(input.pins)];
 const studio=input.studio;if(!studio||!Array.isArray(studio.profiles)||studio.profiles.length!==2)throw Error('A setup needs outputs A and B.');
 out.studio.profiles=studio.profiles.map((p,index)=>{const row={id:index?'b':'a'};
  for(const k of ['width','height']){if(!Number.isInteger(p[k])||p[k]<128||p[k]>3840||p[k]%2)throw Error('Invalid recording dimensions.');row[k]=p[k];}if(p.width*p.height>3840*2160)throw Error('Output exceeds 4K pixel count.');
  for(const [k,values]of Object.entries({fps:[24,30,60],rotation:[0,90,180,270],mode:['clean','minimal','full'],fit:['render','fit','crop'],audio:['mix','music','mic','silent'],preset:['youtube','tiktok','reels','shorts','stories','square','feed','custom'],guide:['wide','vertical','feed',true,false,'story']})){if(!values.includes(p[k]))throw Error('Invalid output setting: '+k);row[k]=p[k];}
  for(const [k,range]of Object.entries({zoom:[1,2],panX:[-1,1],panY:[-1,1]})){if(!Number.isFinite(p[k])||p[k]<range[0]||p[k]>range[1])throw Error('Invalid output framing.');row[k]=p[k];}
  for(const k of ['scene','bpm','palette','meter','lyrics','hands']){if(typeof p[k]!=='boolean')throw Error('Invalid overlay setting.');row[k]=p[k];}
  for(const k of ['title','branding']){if(typeof p[k]!=='string'||p[k].length>200)throw Error('Invalid output text.');row[k]=p[k];}
  if(!/^#[0-9a-f]{6}$/i.test(p.background))throw Error('Invalid output background.');row.background=p.background;return row;
 });
 for(const [key,values]of Object.entries({kind:['video','audio'],dual:[true,false],stems:[true,false],mixed:[true,false]})){if(!values.includes(studio.settings?.[key]))throw Error('Invalid capture setting.');out.studio.settings[key]=studio.settings[key];}
 const limit=studio.settings.limit;if(!Number.isInteger(limit)||limit<0||limit>14400)throw Error('Invalid recording limit.');out.studio.settings.limit=limit;out.studio.settings.countdown=3;
 for(const [key,range]of Object.entries(audioRules)){const v=studio.audio?.[key];if(!Number.isFinite(v)||v<range[0]||v>range[1])throw Error('Invalid mixer setting.');out.studio.audio[key]=v;}
 for(const key of ['muted','musicMuted','micMuted']){if(typeof studio.audio?.[key]!=='boolean')throw Error('Invalid mixer mute.');out.studio.audio[key]=studio.audio[key];}
 // Input/model activation and microphone speaker monitoring never activate from a file.
 out.studio.audio.micMonitor=0;
 if(['sim','demo','file','mic','sys'].includes(input.preferences?.source))out.preferences.source=input.preferences.source;
 if(input.preferences?.byos!==undefined){const ids=input.preferences.byos;if(!Array.isArray(ids)||ids.length>110||ids.some(id=>typeof id!=='string'||!controls.some(c=>c.id===id)))throw Error('Invalid custom studio menu.');out.preferences.byos=[...new Set(ids)];}else out.preferences.byos=[];
 out.preferences.byosSource=['studio','blank','camera','synth'].includes(input.preferences?.byosSource)?input.preferences.byosSource:'studio';
 out.preferences.byosTabs=require('./byos.cjs').tabs(input.preferences?.byosTabs);out.preferences.byosEnabled=input.preferences?.byosEnabled===true;
 return out;
}
function parse(text,controls){if(typeof text!=='string'||new TextEncoder().encode(text).length>1048576)throw Error('Setup files must be smaller than 1 MiB.');let raw;try{raw=JSON.parse(text);}catch{throw Error('The setup file is not valid JSON.');}return validate(raw,controls);}
module.exports={validate,parse,clone};
