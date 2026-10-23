import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MotionController} from '../src/performance/motion.js';
const require=createRequire(import.meta.url),fx=require('../lib/camera-fx.cjs'),contract=require('../lib/guide-contract.cjs'),setups=require('../lib/setups.cjs'),knowledge=require('../lib/guide-index.json');
test('129 camera modes have unique identities, bounded values, pinned-source order and eight slots',()=>{
 assert.equal(fx.effects.length,129);assert.equal(new Set(fx.effects.map(e=>e.id)).size,129);assert.equal(new Set(fx.effects.map(e=>e.code)).size,129);
 for(const effect of fx.effects)assert.equal(fx.validate({version:1,enabled:true,nodes:[fx.node(effect.id)]}).nodes[0].effect,effect.id);
 assert.throws(()=>fx.validate({version:1,enabled:true,nodes:Array.from({length:9},()=>fx.node('swirl'))}));
 const n=fx.node('kaleidoscope');n.params.count=17;assert.throws(()=>fx.validate({version:1,enabled:true,nodes:[n]}));
 assert.throws(()=>fx.validate({version:1,enabled:true,nodes:[fx.node('swirl'),fx.node('face-bulge')]}));
});
test('silence holds motion, explicit simulation is playable, and resume never jumps through silent time',()=>{
 const m=new MotionController();assert(m.held&&!m.simPlaying&&m.settings.silenceStop);
 const input={dt:.02,source:'file',playing:true,rms:.3,volume:1};for(let i=0;i<4;i++)m.update(input);assert(!m.held);const start=m.clock;
 for(let i=0;i<25;i++)m.update({...input,rms:0});assert(m.held);const held=m.clock;
 for(let i=0;i<100;i++)m.update({...input,rms:0});assert.equal(m.clock,held);
 for(let i=0;i<4;i++)m.update(input);assert(!m.held);assert(m.clock-held<.1&&m.clock>=start);
 m.update({...input,volume:0});assert(m.held);m.update({...input,playing:false});assert(m.held);
 m.update({...input,source:'sim'});assert(m.held);m.simPlaying=true;m.update({...input,source:'sim'});assert(!m.held);m.simPlaying=false;m.update({...input,source:'sim'});assert(m.held);
});
test('camera guide tools reject arbitrary effects, slot paths, code and values',()=>{
 for(const action of [{type:'camera_add',key:'kaleidoscope'},{type:'camera_set',key:'0.count',value:16},{type:'set_motion',key:'silenceStop',value:true}])assert(contract.normalizeAction(action,knowledge.controls));
 for(const action of [{type:'camera_add',key:'eval'},{type:'camera_set',key:'8.count',value:3},{type:'camera_set',key:'0.count',value:17},{type:'camera_set',key:'0.javascript',value:'alert(1)'},{type:'set_motion',key:'threshold',value:-200}])assert.throws(()=>contract.normalizeAction(action,knowledge.controls));
 const state=contract.sanitizeState({cameraFx:{version:1,enabled:true,nodes:[fx.node('swirl')]},motionSettings:{silenceStop:true,secret:'private'}},knowledge.controls);assert(state.cameraFx);assert(!JSON.stringify(state).includes('private'));
});
test('setup parser rejects oversized, future, malicious and incomplete files before application',()=>{
 for(const text of ['not-json','x'.repeat(1048577),'{"format":"neuroflux-setup","version":2}','{"__proto__":{"polluted":true}}'])assert.throws(()=>setups.parse(text,knowledge.controls));
 assert.equal({}.polluted,undefined);
});
