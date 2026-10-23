import {vertex,fragment} from './shader.js';
import {CameraVision} from './vision.js';
import catalog from '../../lib/camera-fx.cjs';
export class CameraRenderer {
 constructor(){
  this.canvas=document.createElement('canvas');this.gl=this.canvas.getContext('webgl2',{alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:false,antialias:false});if(!this.gl)throw Error('Camera FX needs WebGL 2.');
  const gl=this.gl;this.programs=new Map();this.useProgram(-2);
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  this.source=this.texture();this.featuresTexture=this.texture();this.background=this.texture();this.backgroundReady=false;this.targets=[];this.histories=new Map();this.vision=new CameraVision();this.level=matchMedia('(pointer:coarse)').matches?360:720;this.last=0;this.sample=[];this.status='Camera FX ready';this.restoreIds=new Set();
  this.fallbackHistory=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.fallbackHistory);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,1,1,30,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.set('uImage',0,true);this.set('uFeatures',1,true);this.set('uHistory',2,true);this.set('uBackground',3,true);this.set('uFeatureHistory',4,true);
 }
 useProgram(code){
  const gl=this.gl;let item=this.programs.get(code);
  if(!item){
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
   // A constant mode lets the GPU remove the other 128 effects from each pass.
   const source=fragment.replace('uniform int uCode,','uniform int ').replace('precision highp float;','#define uCode '+code+'\nprecision highp float;');
   const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,source),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.bindAttribLocation(program,0,'aP');gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   const uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(program,i);uniforms[u.name]=gl.getUniformLocation(program,u.name);}item={program,uniforms};
  }
  this.programs.delete(code);this.programs.set(code,item);if(this.programs.size>16){const oldest=this.programs.keys().next().value;gl.deleteProgram(this.programs.get(oldest).program);this.programs.delete(oldest);}
  this.program=item.program;this.uniforms=item.uniforms;gl.useProgram(this.program);
  this.set('uImage',0,true);this.set('uFeatures',1,true);this.set('uHistory',2,true);this.set('uBackground',3,true);this.set('uFeatureHistory',4,true);this.set('uSize',[this.canvas.width,this.canvas.height]);this.set('uFace',this.vision?.face||[.5,.5,0,0]);this.set('uBody',this.vision?.body||[.5,.5,0,0]);
 }
 texture(){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.LINEAR);for(const p of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,p,g.CLAMP_TO_EDGE);return t;}
 set(key,value,int=false){const l=this.uniforms[key],g=this.gl;if(l==null)return;if(Array.isArray(value)){if(value.length===4)g.uniform4fv(l,value);else if(value.length===3)g.uniform3fv(l,value);else g.uniform2fv(l,value);}else if(int)g.uniform1i(l,value);else g.uniform1f(l,value);}
 bind(unit,texture){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);}
 upload(unit,texture,source){this.bind(unit,texture);if(source?.data&&source.width)this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,source.width,source.height,0,this.gl.RGBA,this.gl.UNSIGNED_BYTE,source.data);else this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,source);}
 target(w,h){const g=this.gl,colors=[this.texture(),this.texture()],f=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,f);colors.forEach((t,i)=>{g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,t,0);});g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Camera effect buffers are unavailable.');return {f,colors};}
 resize(w,h){if(this.canvas.width===w&&this.canvas.height===h)return;const g=this.gl;for(const t of this.targets){t.colors.forEach(v=>g.deleteTexture(v));g.deleteFramebuffer(t.f);}this.targets=[this.target(w,h),this.target(w,h)];this.canvas.width=w;this.canvas.height=h;this.clearHistory();}
 clearHistory(){for(const t of this.histories.values()){this.gl.deleteTexture(t.texture);this.gl.deleteTexture(t.maskTexture);this.gl.deleteFramebuffer(t.f);}this.histories.clear();}
 history(id,w,h){if(this.histories.has(id))return this.histories.get(id);const g=this.gl,short=matchMedia('(pointer:coarse)').matches?96:160,ratio=w/h,hw=ratio>1?Math.round(short*ratio):short,hh=ratio>1?short:Math.round(short/ratio);const texture=g.createTexture();g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D_ARRAY,texture);g.texImage3D(g.TEXTURE_2D_ARRAY,0,g.RGBA8,hw,hh,30,0,g.RGBA,g.UNSIGNED_BYTE,null);for(const k of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D_ARRAY,k,g.LINEAR);for(const k of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D_ARRAY,k,g.CLAMP_TO_EDGE);const maskTexture=g.createTexture();g.activeTexture(g.TEXTURE4);g.bindTexture(g.TEXTURE_2D_ARRAY,maskTexture);g.texImage3D(g.TEXTURE_2D_ARRAY,0,g.RGBA8,hw,hh,30,0,g.RGBA,g.UNSIGNED_BYTE,null);for(const k of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D_ARRAY,k,g.LINEAR);for(const k of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D_ARRAY,k,g.CLAMP_TO_EDGE);const t={texture,maskTexture,f:g.createFramebuffer(),w:hw,h:hh,head:0,count:0,last:-1};this.histories.set(id,t);return t;}
 async setBackground(file){if(file.size>32*1024*1024)throw Error('Choose an image smaller than 32 MB.');const bitmap=await createImageBitmap(file);this.upload(3,this.background,bitmap);bitmap.close();this.backgroundReady=true;}
 render(video,state,{clock,held,bpm=120,level=0,now=performance.now(),depth,depthKey=false}={}){
  if(video.readyState<2)return null;const start=performance.now(),g=this.gl,active=state.enabled?state.nodes.filter(n=>!n.bypass&&n.wet>0):[];
  const required=active.flatMap(n=>[...catalog.byId[n.effect].requirements,...(n.params.target==='person'||n.params.target==='background'?['segment']:n.params.target==='face'?['face']:n.params.target==='body'?['pose']:[])]);
  const short=Math.min(this.level,video.videoWidth,video.videoHeight),ratio=video.videoWidth/video.videoHeight,w=2*Math.round((ratio>1?short*ratio:short)/2),h=2*Math.round((ratio>1?short:short/ratio)/2);
  this.resize(Math.max(2,w),Math.max(2,h));this.useProgram(-1);g.bindVertexArray(this.vao);g.disable(g.BLEND);
  this.vision.request(video,required,depth,now,this.level<=270?140:60);
  this.upload(0,this.source,video);this.upload(1,this.featuresTexture,this.vision.features(w,h,depth));this.bind(3,this.background);
  g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);g.activeTexture(g.TEXTURE4);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);
  this.set('uSize',[w,h]);this.set('uCenter',[.5,.5]);this.set('uFace',this.vision.face||[.5,.5,0,0]);this.set('uBody',this.vision.body||[.5,.5,0,0]);this.set('uScale',1);this.set('uAngle',0);this.set('uWet',1);this.set('uTarget',0,true);this.set('uAvailable',1);this.set('uCode',-1,true);
  let current=0;g.bindFramebuffer(g.FRAMEBUFFER,this.targets[current].f);g.viewport(0,0,w,h);g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1]);g.drawArrays(g.TRIANGLES,0,3);
  const used=new Set();
  for(const node of active){
   const effect=catalog.byId[node.effect],p=node.params;const needs=[...effect.requirements,...(p.target==='person'||p.target==='background'?['segment']:p.target==='face'?['face']:p.target==='body'?['pose']:[])];const available=needs.every(k=>k==='depth'?!!depth?.data:!!this.vision.results[k]&&!this.vision.failed.has(k)&&performance.now()-this.vision.results[k].at<2000&&(k!=='face'||this.vision.results[k].faces?.length>0)&&(k!=='pose'||this.vision.results[k].poses?.length>0))&& (node.effect!=='background-image'||this.backgroundReady);
   const input=this.targets[current],output=this.targets[1-current];this.bind(0,input.colors[0]);this.bind(1,input.colors[1]);
   if(effect.temporal){used.add(node.id);const history=this.history(node.id,w,h);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);g.activeTexture(g.TEXTURE4);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);
    if(history.count===0||!held&&clock-history.last>=1/15){history.head=(history.head+1)%30;g.bindFramebuffer(g.FRAMEBUFFER,history.f);g.framebufferTextureLayer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,history.texture,0,history.head);g.framebufferTextureLayer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT1,history.maskTexture,0,history.head);g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1]);g.viewport(0,0,history.w,history.h);this.useProgram(-2);this.set('uAvailable',1);this.set('uAngle',0);this.set('uScale',1);this.set('uCenter',[.5,.5]);this.set('uTarget',0,true);this.set('uWet',1);g.drawArrays(g.TRIANGLES,0,3);history.count=Math.min(30,history.count+1);history.last=clock;}
    g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D_ARRAY,history.texture);g.activeTexture(g.TEXTURE4);g.bindTexture(g.TEXTURE_2D_ARRAY,history.maskTexture);this.set('uHead',history.head,true);this.set('uFrames',history.count,true);
   }else{g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);g.activeTexture(g.TEXTURE4);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);this.set('uFrames',0,true);}
   g.bindFramebuffer(g.FRAMEBUFFER,output.f);g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1]);g.viewport(0,0,w,h);
   this.useProgram(effect.code);const historyState=this.histories.get(node.id);this.set('uHead',historyState?.head||0,true);this.set('uFrames',historyState?.count||0,true);
   const phase=p.autoplay?clock*p.speed*6.2831853:0,beat=level*p.beat;
   this.set('uCode',effect.code,true);this.set('uCount',p.count,true);this.set('uCenter',[p.centerX,p.centerY]);this.set('uAmount',Math.max(-1,Math.min(1,p.amount+beat*.5)));this.set('uAngle',p.angle*Math.PI/180);this.set('uScale',p.scale);this.set('uPhase',phase+(p.beat?clock*bpm/60/p.division*6.2831853*p.beat:0));this.set('uClock',clock);this.set('uWet',node.wet);this.set('uSeed',p.seed);this.set('uDelay',p.delay);this.set('uAutoplay',p.autoplay?1:0);this.set('uAvailable',available?1:0);this.set('uRestored',this.restoreIds.has(node.id)?1:0,true);this.set('uBorder',['clamp','mirror','repeat','transparent'].indexOf(p.border),true);this.set('uTarget',['all','person','background','face','body'].indexOf(p.target),true);this.set('uTint',[1,3,5].map(i=>parseInt(p.tint.slice(i,i+2),16)/255));
   g.drawArrays(g.TRIANGLES,0,3);current=1-current;
  }
  for(const [id,hist]of this.histories)if(!used.has(id)){g.deleteTexture(hist.texture);g.deleteTexture(hist.maskTexture);g.deleteFramebuffer(hist.f);this.histories.delete(id);}
  this.bind(0,this.targets[current].colors[0]);this.bind(1,this.targets[current].colors[1]);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);g.activeTexture(g.TEXTURE4);g.bindTexture(g.TEXTURE_2D_ARRAY,this.fallbackHistory);g.bindFramebuffer(g.FRAMEBUFFER,null);g.drawBuffers([g.BACK]);g.viewport(0,0,w,h);this.useProgram(-2);this.set('uAvailable',1);this.set('uCenter',[.5,.5]);this.set('uAngle',0);this.set('uScale',1);this.set('uWet',1);this.set('uTarget',0,true);g.drawArrays(g.TRIANGLES,0,3);
  this.processedDepth=null;
  if(depthKey&&depth?.data){
   const pixels=new Uint8Array(w*h*4);g.bindFramebuffer(g.READ_FRAMEBUFFER,this.targets[current].f);g.readBuffer(g.COLOR_ATTACHMENT1);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,pixels);g.bindFramebuffer(g.READ_FRAMEBUFFER,null);
   this.depthCanvas??=document.createElement('canvas');this.depthCanvas.width=w;this.depthCanvas.height=h;const ctx=this.depthCanvas.getContext('2d'),image=ctx.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const source=((h-y-1)*w+x)*4+1,d=(y*w+x)*4;image.data[d]=image.data[d+1]=image.data[d+2]=pixels[source];image.data[d+3]=255;}ctx.putImageData(image,0,0);this.processedDepth=this.depthCanvas;
  }
  const error=g.getError();if(error!==g.NO_ERROR)throw Error('Camera FX GPU error '+error);
  const frameMs=this.last&&now>this.last&&now-this.last<200?now-this.last:0;this.last=now;this.sample.push({cpu:performance.now()-start,frame:frameMs});if(this.sample.length>=90){const ms=this.sample.reduce((a,b)=>a+b.cpu,0)/this.sample.length,frames=this.sample.filter(s=>s.frame>0),interval=frames.length?frames.reduce((a,b)=>a+b.frame,0)/frames.length:0;this.sample=[];const levels=[180,270,360,540,720],i=levels.indexOf(this.level);if((ms>24||interval>44)&&i>0)this.level=levels[i-1];else if(ms<9&&interval<25&&i<levels.length-1)this.level=levels[i+1];}
  this.status=required.includes('depth')&&!depth?.data?'Depth FX waiting: enable local depth analysis in the effect card.':active.some(n=>n.effect==='background-image')&&!this.backgroundReady?'Choose a background image in the effect card.':required.some(k=>k!=='depth')?this.vision.status:'Camera FX ready';this.status+=` · ${w}×${h} internal · adaptive detail`;
  return this.canvas;
 }
 release(){this.vision.release();this.clearHistory();}
}
