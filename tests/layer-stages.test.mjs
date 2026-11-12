import test from 'node:test';
import assert from 'node:assert/strict';
import stages from '../lib/layer-stages.cjs';
import layers from '../lib/layers.cjs';
import fx from '../lib/camera-fx.cjs';
import contract from '../lib/guide-contract.cjs';
import knowledge from '../lib/guide-index.json' with {type:'json'};

test('stage previews neutralize later visual operations without mutating the final output settings',()=>{
 const values={uFish:.6,uSwirl:.8,uMirror:12,uSat:1.6,uBright:1.2,uBloom:.7};
 const mirror=stages.postPreview(values,'visual-mirror');assert.equal(mirror.uFish,.6);assert.equal(mirror.uSwirl,.8);assert.equal(mirror.uMirror,12);assert.equal(mirror.uBloom,0);assert.equal(mirror.uSat,1);assert.equal(values.uSat,1.6);
 const base=stages.postPreview(values,'visual-base');for(const stage of stages.post)assert.equal(base[stage.uniform],stage.neutral);
});
test('portable words and sound links reject invalid content, ranges and unknown graphics controls',()=>{
 const state=layers.defaults();state.words.text='Live words';state.audioLinks.mirror={amount:.75,band:'bass'};state.audioLinks.sat={amount:-.5,band:'mid'};assert.deepEqual(layers.validate(state),state);
 for(const mutate of [s=>s.words.text='x'.repeat(401),s=>s.words.size=4,s=>s.words.color='url(elsewhere)',s=>s.audioLinks.cam={amount:1,band:'bass'},s=>s.audioLinks.mirror.amount=2,s=>s.audioLinks.sat.band='secret']){const bad=structuredClone(state);mutate(bad);assert.throws(()=>layers.validate(bad));}
});
test('all sixteen effect slots remain available to the validated guide tools',()=>{
 assert.equal(fx.MAX_NODES,16);assert(contract.normalizeAction({type:'camera_set',key:'15.count',value:16},knowledge.controls));
 assert(contract.normalizeAction({type:'camera_move',key:'15',value:0},knowledge.controls));
 assert.throws(()=>contract.normalizeAction({type:'camera_set',key:'16.count',value:6},knowledge.controls));
});
