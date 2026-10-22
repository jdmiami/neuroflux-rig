import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {retrieve,validatePlan,createWalkthrough}=require('../lib/guide.cjs');
const contract=require('../lib/guide-contract.cjs');
const knowledge=require('../lib/guide-index.json');
const plan=sources=>({title:'Try a kaleidoscope',intro:'Start from your current look.',steps:[
 {title:'Set six splits',instruction:'Choose 6-SPLIT in FX.',action:{type:'set_control',key:'mirror',value:5,output:null},expected:'Six repeated wedges.',sources:[sources[0].id]},
 {title:'Look at the result',instruction:'Check the picture before recording.',action:{type:'show',key:'menu.fx',value:null,output:null},expected:'A look you like.',sources:[sources[0].id]}]});

test('manual retrieval finds actual control facts and recording isolation',()=>{
 assert(retrieve('camera mix 100 percent').some(s=>s.control==='camMix'));
 assert(retrieve('six split mirror swirl ripple').some(s=>s.control==='mirror'));
 assert(retrieve('record vertical without menu separate audio').some(s=>/clean|stems|companion/i.test(s.text)));
 assert(retrieve('export audio sync microphone offset').some(s=>/offset/i.test(s.text)));
 assert.equal(knowledge.controls.length,110);
 for(const control of knowledge.controls)assert(knowledge.chunks.some(c=>c.control===control.id),control.id);
});
test('tool boundary rejects arbitrary actions, out-of-range values and unsupported fields',()=>{
 const normalize=a=>contract.normalizeAction(a,knowledge.controls);
 assert.equal(normalize({type:'set_control',key:'mirror',value:15}).target,'control.mirror');
 for(const action of [{type:'eval',key:'alert(1)'},{type:'set_control',key:'mirror',value:16},
 {type:'set_control',key:'camMix',value:50},{type:'set_output',key:'fps',value:120,output:'a'},
 {type:'set_output',key:'width',value:1919,output:'a'},{type:'set_output',key:'javascript',value:'alert(1)',output:'a'},
 {type:'show',key:'#password'},{type:'delete',key:'recordings'}])assert.throws(()=>normalize(action));
});
test('only retrieved citations and valid tool actions become executable steps',()=>{
 const sources=retrieve('mirror');const valid=plan(sources);assert.equal(validatePlan(valid,sources).steps.length,2);
 valid.steps[0].sources=['made-up'];assert.throws(()=>validatePlan(valid,sources),/grounded/);
});
test('state sent to the model contains settings and capability flags, not device media or keys',()=>{
 const state=contract.sanitizeState({controls:{camMix:.5,swirl:.3,secret:123},source:'file',fileName:'private.wav',apiKey:'secret',
 lyrics:'private words',audio:{music:1,secret:'secret'},outputs:[{title:'private name',width:1280,height:720}],capabilities:{camera:true},services:{camera:true}},knowledge.controls);
 const json=JSON.stringify(state);assert(!/private|secret|apiKey|fileName/.test(json));assert.equal(state.controls.swirl,.3);
});
test('real AI SDK pipeline validates structured output and reports the requested versus actual fallback model',async()=>{
 const sources=retrieve('six split mirror swirl');const requests=[];
 const server=http.createServer(async(req,res)=>{
  let data='';for await(const part of req)data+=part;requests.push({url:req.url,body:JSON.parse(data)});
  res.setHeader('content-type','application/json');
  if(req.url.includes('gemini-3.8-flash')){res.writeHead(404);res.end(JSON.stringify({error:{code:404,message:'Model unavailable'}}));return;}
  res.end(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(plan(sources))}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:100,totalTokenCount:200}}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const result=await createWalkthrough({goal:'six split mirror swirl',state:{controls:{mirror:0}},apiKey:'test-key-not-a-secret',baseURL:`http://127.0.0.1:${server.address().port}`,models:['gemini-3.8-flash','gemini-3.5-flash']});
  assert.equal(result.model,'gemini-3.5-flash');assert.equal(result.requestedModel,'gemini-3.8-flash');assert.equal(result.fallback,true);
  assert.equal(result.steps[0].action.target,'control.mirror');assert.equal(requests.length,2);
  assert(requests[1].body.generationConfig.responseJsonSchema||requests[1].body.generationConfig.responseSchema);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
