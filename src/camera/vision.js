export class CameraVision {
 constructor(){this.enabled=new Set();this.failed=new Set();this.results={};this.status='Person tools load only when you enable them.';this.cursor=0;this.last=0;this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});}
 async request(video,kinds,depth,now,interval=150){
  const wanted=[...new Set(kinds.filter(k=>k!=='depth'))];
  for(const key of Object.keys(this.results))if(!wanted.includes(key))delete this.results[key];
  if(!wanted.length){if(this.worker){this.worker.terminate();this.worker=null;this.busy=false;}return;}
  if(this.busy||now-this.last<interval||video.readyState<2)return;
  const available=wanted.filter(k=>!this.failed.has(k));if(!available.length)return;
  const kind=available[this.cursor++%available.length];
  if(!this.worker){this.worker=new Worker('/vision.worker.js');this.worker.onmessage=({data})=>{if(data.type==='idle')this.busy=false;if(data.type==='result'){this.results[data.kind]={...data,at:performance.now()};this.status=data.kind==='face'&&!data.faces?.length?'No face in view; face effects are waiting.':data.kind==='pose'&&!data.poses?.length?'No body in view; body effects are waiting.':data.kind+' tracking live';}if(data.type==='status')this.status=data.message;if(data.type==='error'){this.failed.add(data.kind);this.status=data.message;this.busy=false;}};this.worker.onerror=()=>{this.status='Person tracking unavailable. Other camera effects still work.';this.failed.add(kind);this.busy=false;this.worker?.terminate();this.worker=null;};}
  this.busy=true;this.last=now;
  try{const bitmap=await createImageBitmap(video,{resizeWidth:256,resizeHeight:Math.max(64,Math.round(256*video.videoHeight/video.videoWidth))});if(!this.worker){bitmap.close();this.busy=false;return;}this.worker.postMessage({kind,bitmap,stamp:now},[bitmap]);}catch(error){this.busy=false;this.status='Cannot read this camera frame.';}
 }
 features(width,height,depth){
  const w=160,h=Math.max(64,Math.round(w*height/width));this.canvas.width=w;this.canvas.height=h;
  const ctx=this.ctx,img=ctx.createImageData(w,h);const t=performance.now();
  const segment=this.results.segment&&t-this.results.segment.at<2000?this.results.segment:null;
  const faces=this.results.face&&t-this.results.face.at<1200?this.results.face.faces:[];
  const poses=this.results.pose&&t-this.results.pose.at<1600?this.results.pose.poses:[];
  const featureKey=[segment?.at||0,faces?.length?this.results.face.at:0,poses?.length?this.results.pose.at:0,w,h].join(':');
  if(this.featureKey===featureKey&&this.lastDepth===depth?.data)return this.cachedFeatures;
  this.featureKey=featureKey;this.lastDepth=depth?.data;
  const face=faces?.[0],pose=poses?.[0];
  const bounds=points=>{if(!points?.length)return [.5,.5,0,0];let x=1,y=1,r=0,b=0;for(const p of points){x=Math.min(x,p.x);y=Math.min(y,p.y);r=Math.max(r,p.x);b=Math.max(b,p.y);}return [(x+r)/2,1-(y+b)/2,r-x,b-y];};
  this.face=bounds(face);this.body=bounds(pose);
  const lines=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const u=x/w,v=y/h,k=(y*w+x)*4;
   if(segment){const sx=Math.min(segment.width-1,Math.floor(u*segment.width)),sy=Math.min(segment.height-1,Math.floor(v*segment.height));img.data[k]=segment.mask[sy*segment.width+sx]>0?255:0;}
   if(depth?.data&&depth.w&&depth.h)img.data[k+1]=depth.data[Math.min(depth.h-1,Math.floor(v*depth.h))*depth.w+Math.min(depth.w-1,Math.floor(u*depth.w))]||0;
   if(face){const [cx,cy,fw,fh]=this.face;const d=((u-cx)/Math.max(.01,fw*.55))**2+((v-(1-cy))/Math.max(.01,fh*.55))**2;img.data[k+2]=Math.max(0,Math.min(255,(1.1-d)*600));}
   if(pose){let distance=1;for(const [a,b] of lines){const p=pose[a],q=pose[b];if(!p||!q||(p.visibility??1)<.5||(q.visibility??1)<.5)continue;const dx=q.x-p.x,dy=q.y-p.y,t=Math.max(0,Math.min(1,((u-p.x)*dx+(v-p.y)*dy)/(dx*dx+dy*dy+1e-6)));distance=Math.min(distance,Math.hypot(u-p.x-t*dx,v-p.y-t*dy));}img.data[k+3]=Math.max(0,1-distance/.018)*255;}
  }
  return this.cachedFeatures={data:img.data,width:w,height:h};
 }
 retry(){this.failed.clear();this.results={};this.status='Retrying person tools…';}
 release(){this.worker?.terminate();this.worker=null;this.busy=false;this.results={};this.failed.clear();}
}
