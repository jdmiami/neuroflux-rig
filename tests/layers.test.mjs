import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../lib/layers.cjs';
import fx from '../lib/camera-fx.cjs';

test('layer files keep three unique sources, bounded opacity and a supported blend',()=>{
 const state=model.defaults();assert.deepEqual(model.validate(state),state);
 for(const mutate of [s=>s.order=['camera','camera','space'],s=>s.layers.visuals.opacity=NaN,s=>s.layers.camera.opacity=2,s=>s.layers.visuals.blend='depth',s=>s.layers.space.name='<'.repeat(41),s=>s.layers.camera.visible=1,s=>s.groups=[{id:'bad'}]]){
  const invalid=structuredClone(state);mutate(invalid);assert.throws(()=>model.validate(invalid));
 }
});
test('legacy mix migration preserves a full visual source while the camera is off',()=>{
 assert.equal(model.fromLegacy({cam:0,camMix:1}).layers.visuals.opacity,1);
 const mid=model.fromLegacy({cam:1,camMix:.5,camBlend:2});assert.equal(mid.enabled,false);assert.equal(mid.layers.camera.opacity,1);assert.equal(mid.layers.visuals.opacity,1);assert.equal(mid.layers.camera.blend,'difference');
 const full=model.fromLegacy({cam:1,camMix:1});assert.equal(full.layers.visuals.opacity,0);assert.equal(full.layers.camera.opacity,1);
});
test('effect folders multiply strength and bypass without mutating the saved camera chain',()=>{
 const node=fx.node('swirl'),camera={version:1,enabled:true,nodes:[node]},state=model.defaults();node.wet=.8;
 state.groups=[{id:'group-test',name:'Warp',nodes:[node.id],strength:.5,bypass:false,locked:false}];
 const effective=model.effectiveCamera(camera,model.validate(state));assert.equal(effective.nodes[0].wet,.4);assert.equal(node.wet,.8);
 state.groups[0].bypass=true;assert.equal(model.effectiveCamera(camera,state).nodes[0].bypass,true);assert.equal(node.bypass,false);
 const duplicate=structuredClone(state);duplicate.groups.push({...duplicate.groups[0],id:'group-other'});assert.throws(()=>model.validate(duplicate),/one folder/);
});
