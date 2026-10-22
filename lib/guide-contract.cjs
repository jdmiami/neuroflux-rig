'use strict';
const pages=['quick','ai','scenes','input','sense','cam','d3','form','motion','color','fx','react','sys'];
const tabs=['record','output','audio','library'];
const choice=(...values)=>({values});
const numeric=(min,max,integer=false)=>({min,max,integer});
const bool={boolean:true};
const outputFields={preset:choice('youtube','tiktok','reels','shorts','stories','square','feed','custom'),
  width:{...numeric(128,3840,true),even:true},height:{...numeric(128,3840,true),even:true},
  fps:choice(24,30,60),orientation:choice('portrait','landscape','square'),rotation:choice(0,90,180,270),
  resolution:choice(720,1080,2160),fit:choice('render','fit','crop'),mode:choice('clean','minimal','full'),
  zoom:numeric(1,2),panX:numeric(-1,1),panY:numeric(-1,1),scene:bool,bpm:bool,palette:bool,meter:bool,
  lyrics:bool,hands:bool,audio:choice('mix','music','mic','silent')};
const recordingFields={kind:choice('video','audio'),dual:bool,stems:bool,mixed:bool,limit:numeric(0,14400,true)};
const audioFields={music:numeric(0,2),mic:numeric(0,2),muted:bool,musicMuted:bool,micMuted:bool,
  musicMonitor:numeric(0,1),micMonitor:numeric(0,1),offset:numeric(-500,500)};
const showTargets=['recording.start','recording.stop','recording.pause','recording.test','recording.snapshot',
  'recording.library','audio.enableMic','source.file','source.mic','source.sys','source.demo','source.sim',
  ...pages.map(p=>'menu.'+p),...tabs.map(t=>'recording.'+t)];
const toolTypes=['show','set_control','set_output','set_audio','set_recording','enable_mic','source','test_output','start_recording','stop_recording'];
function valid(value,rule){
  if(!rule)return false;
  if(rule.values)return rule.values.includes(value);
  if(rule.boolean)return typeof value==='boolean';
  return typeof value==='number'&&Number.isFinite(value)&&value>=rule.min&&value<=rule.max&&(!rule.integer||Number.isInteger(value))&&(!rule.even||value%2===0);
}
function normalizeAction(action,controls){
  if(!action||!toolTypes.includes(action.type))throw new Error('Unknown guide tool.');
  const {type,key,value}=action;
  let target,rule;
  if(type==='set_control'){
    const control=controls.find(c=>c.id===key);if(!control)throw new Error('Unknown control.');
    rule={min:control.min,max:control.max,integer:!!control.step};target='control.'+key;
  }else if(type==='set_output'){
    if(!['a','b'].includes(action.output))throw new Error('Choose output A or B.');
    rule=outputFields[key];target=`output.${action.output}.${key}`;
  }else if(type==='set_recording'){rule=recordingFields[key];target='settings.'+key;
  }else if(type==='set_audio'){rule=audioFields[key];target='audio.'+key;
  }else if(type==='source'){
    if(!['demo','sim','file','mic','sys'].includes(key))throw new Error('Unknown audio source.');target='source.'+key;
  }else if(type==='show'){
    if(key?.startsWith('control.')&&controls.some(c=>key==='control.'+c.id))target=key;
    else if(showTargets.includes(key))target=key;
    else throw new Error('Unknown guide target.');
  }else target={enable_mic:'audio.enableMic',test_output:'recording.test',start_recording:'recording.start',stop_recording:'recording.stop'}[type];
  if(['set_control','set_output','set_audio','set_recording'].includes(type)&&!valid(value,rule))throw new Error('Guide value is outside the supported range.');
  return {type,key:typeof key==='string'?key:'',value:value??null,output:type==='set_output'?action.output:null,target};
}
function sanitizeState(raw,controls){
  const state={controls:{},outputs:[],recording:{},audio:{},capabilities:{},source:'sim',capture:'idle',services:{}};
  if(!raw||typeof raw!=='object')return state;
  for(const control of controls){const value=raw.controls?.[control.id];if(typeof value==='number'&&Number.isFinite(value))state.controls[control.id]=Math.max(control.min,Math.min(control.max,value));}
  for(const output of Array.isArray(raw.outputs)?raw.outputs.slice(0,2):[]){const row={};for(const [key,rule] of Object.entries(outputFields))if(valid(output[key],rule))row[key]=output[key];state.outputs.push(row);}
  for(const [scope,rules] of Object.entries({recording:recordingFields,audio:audioFields}))for(const [key,rule] of Object.entries(rules))if(valid(raw[scope]?.[key],rule))state[scope][key]=raw[scope][key];
  for(const key of ['camera','microphone','systemAudio','recorder','secure','mobile','webgl','audioWorklet','storage'])state.capabilities[key]=!!raw.capabilities?.[key];
  for(const key of ['camera','hands','depth','motion','lyrics','extraMic','outputTestPassed'])state.services[key]=!!raw.services?.[key];
  if(['sim','demo','file','mic','sys'].includes(raw.source))state.source=raw.source;
  if(['idle','preparing','recording','paused','saving','exporting'].includes(raw.capture))state.capture=raw.capture;
  return state;
}
module.exports={pages,tabs,outputFields,recordingFields,audioFields,showTargets,toolTypes,valid,normalizeAction,sanitizeState};
