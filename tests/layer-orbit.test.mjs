import test from 'node:test';
import assert from 'node:assert/strict';
import orbit from '../lib/layer-orbit.cjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function box(p,m){
 const [x,y,z]=[p.rx,p.ry,p.rz].map(v=>v*Math.PI/180),cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
 // CSS rotateX * rotateY * rotateZ: transformed local basis columns.
 const axes=[[cy*cz,cx*sz+sx*sy*cz,sx*sz-cx*sy*cz],[-cy*sz,cx*cz-sx*sy*sz,sx*cz+cx*sy*sz],[sy,-sx*cy,cx*cy]];
 return {center:[p.x,p.y,p.z],axes,half:[m.width*p.scale/2,m.height*p.scale/2,1]};
}
function intersects(a,b){
 const delta=b.center.map((v,i)=>v-a.center[i]),axes=[...a.axes,...b.axes,...a.axes.flatMap(x=>b.axes.map(y=>cross(x,y)))];
 for(const axis of axes){if(dot(axis,axis)<1e-10)continue;const radius=box=>box.axes.reduce((s,v,i)=>s+Math.abs(dot(axis,v))*box.half[i],0);if(Math.abs(dot(delta,axis))>radius(a)+radius(b)+.1)return false;}return true;
}
test('all visible orbital cards remain separated while exchanging focus',()=>{
 for(const [vw,vh]of [[304,210],[374,450],[414,500],[828,200],[651,170],[1008,420]])for(const aspect of [.85,1.2,1.8])for(const zoom of [.7,1,1.25])for(const reduced of [false,true]){
  const width=Math.max(32,Math.min(vw*.65,(vh-24)*aspect/1.3)),m=orbit.metrics({width,height:width/aspect,viewportWidth:vw,viewportHeight:vh,zoom,stackX:Math.min(vw*.23,170),stackY:Math.min(vh*.19,72),reduced});
  for(let step=0;step<=200;step++){const position=step/200;for(let n=-4;n<4;n++)for(let next=n+1;next<=4;next++){
   const a=box(orbit.pose(n-position,m),m),b=box(orbit.pose(next-position,m),m);
   assert.equal(intersects(a,b),false,JSON.stringify({vw,vh,aspect,zoom,position,n,next}));
  }}
 }
});
test('orbital path is continuous, centered at rest and opens two separate lanes',()=>{
 const m=orbit.metrics({width:240,height:300,viewportWidth:374,viewportHeight:450,zoom:1.25,stackX:86,stackY:72});
 const center=orbit.pose(0,m);assert.ok(Math.abs(center.x)<1e-9);assert.ok(Math.abs(center.y)<1e-9);assert.ok(Math.abs(center.z)<1e-9);assert.equal(center.scale,1.25);
 const a=orbit.pose(-.5,m),b=orbit.pose(.5,m);assert.ok(a.x>0&&b.x<0&&a.y<0&&b.y>0);assert.ok(a.x-b.x>m.width*a.scale);assert.ok(a.scale<center.scale);
 for(const boundary of [-1,0,1]){const a=orbit.pose(boundary-.00001,m),b=orbit.pose(boundary+.00001,m);for(const key of ['x','y','z','scale','rx','ry','rz'])assert.ok(Math.abs(a[key]-b[key])<.02,key);}
});
test('reduced motion removes extra banking while retaining safe clearance',()=>{
 const m=orbit.metrics({width:240,height:300,viewportWidth:374,viewportHeight:450,zoom:1,stackX:86,stackY:72,reduced:true});const reduced=orbit.pose(.5,m),normal=orbit.pose(.5,{...m,reduced:false});assert.equal(reduced.scale,normal.scale);assert.ok(reduced.rx<normal.rx);
});
