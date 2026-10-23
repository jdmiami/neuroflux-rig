// Independent visual synthesis and camera compositing. Called for live and each output.
let rigComposite=null,rigProcessedCamera=null,rigCameraStamp=-1,rigProcessedDepth=null;
const rigVisualBuffers=new Map();
const rigCompositeSource=`#version 300 es
precision highp float;in vec2 vUv;out vec4 o;
uniform sampler2D uVisual,uCamera,uDepth;
uniform vec2 uCamScale,uRes;uniform float uOn,uMix,uBlend,uKey,uMirror,uEdge,uDepthOn;
vec2 cu(vec2 uv){vec2 p=(uv-.5)*uCamScale+.5;if(uMirror>.5)p.x=1.-p.x;p.y=1.-p.y;return p;}
vec4 camera(vec2 uv){return texture(uCamera,cu(uv));}
void main(){vec3 vis=texture(uVisual,vUv).rgb;if(uOn<.5){o=vec4(vis,1);return;}vec4 sampleCam=camera(vUv);vec3 cam=sampleCam.rgb*sampleCam.a;float l=dot(cam,vec3(.299,.587,.114));int mode=int(uBlend+.5);vec3 blended;
if(mode==0)blended=1.-(1.-vis)*(1.-cam);else if(mode==1)blended=vis+cam;else if(mode==2)blended=abs(vis-cam);else if(mode==3)blended=vis*cam*2.2;else{float mask=mode==4||uDepthOn<.5?l:texture(uDepth,cu(vUv)).r;blended=mix(vis,cam,smoothstep(uKey-.06,uKey+.06,mask)*sampleCam.a);}
vec3 col=mix(vis,blended,clamp(uMix*2.,0.,1.));if(uEdge>0.){vec2 px=1.5/uRes;float edge=length(vec2(dot(camera(vUv+vec2(px.x,0)).rgb-camera(vUv-vec2(px.x,0)).rgb,vec3(.299,.587,.114)),dot(camera(vUv+vec2(0,px.y)).rgb-camera(vUv-vec2(0,px.y)).rgb,vec3(.299,.587,.114))));col+=vec3(.27,.94,1)*edge*uEdge*clamp(uMix*2.,0.,1.);}
col=mix(clamp(col,0.,1.),cam,clamp(uMix*2.-1.,0.,1.));o=vec4(clamp(col,0.,1.),1);}`;
function releaseRigVisual(scene){const target=rigVisualBuffers.get(scene);if(target){P(target.post);rigVisualBuffers.delete(scene);}}
function renderRig(e){
 if(!T)return;
 if(e.camFrame){h.activeTexture(h.TEXTURE2);h.bindTexture(h.TEXTURE_2D,u.camTex);try{h.texImage2D(h.TEXTURE_2D,0,h.RGBA,h.RGBA,h.UNSIGNED_BYTE,e.camFrame);}catch{}e.camFrame=null;}
 if(e.depthFrame){const d=e.depthFrame;h.activeTexture(h.TEXTURE3);h.bindTexture(h.TEXTURE_2D,u.depthTex);h.texImage2D(h.TEXTURE_2D,0,h.R8,d.w,d.h,0,h.RED,h.UNSIGNED_BYTE,d.data);e.depthFrame=null;}
 h.bindVertexArray(y);
 let target=rigVisualBuffers.get(M);if(!target){h.activeTexture(h.TEXTURE0);target={post:D(L,A,false),signature:null};rigVisualBuffers.set(M,target);}
 const signature=JSON.stringify([Object.fromEntries(Object.entries(Be).filter(([key])=>!key.startsWith('cam'))),L,A,e.scene.uCenter]);
 const hold=window.NFXMotion?.held??true;
 if(!hold||target.signature!==signature){
  h.activeTexture(h.TEXTURE0);h.bindTexture(h.TEXTURE_2D,E);h.texSubImage2D(h.TEXTURE_2D,0,0,0,256,1,h.RED,h.UNSIGNED_BYTE,k);
  h.bindFramebuffer(h.FRAMEBUFFER,M.f);h.viewport(0,0,L,A);h.useProgram(v.p);h.activeTexture(h.TEXTURE0);h.bindTexture(h.TEXTURE_2D,E);N(v,'uSpec',0);N(v,'uCam',2);N(v,'uDepth',3);C(v,'uRes',[L,A]);
  for(const key in e.scene)C(v,key,e.scene[key]);C(v,'uCamOn',0);C(v,'uCamWarp',0);h.drawArrays(h.TRIANGLES,0,3);
  const pts=e.pts;
  if(pts&&(pts.cloud||pts.splat)){h.enable(h.BLEND);h.blendFunc(h.ONE,h.ONE);
   if(pts.cloud&&u.cloudN){const p=u.progCloud;h.useProgram(p.p);N(p,'uSpec',0);N(p,'uCam',2);N(p,'uDepth',3);for(const key in pts.common)C(p,key,pts.common[key]);for(const key in pts.cloud)C(p,key,pts.cloud[key]);h.bindVertexArray(u.cloudVao);h.drawArrays(h.POINTS,0,u.cloudN);}
   if(pts.splat&&u.splatN){const p=u.progSplat;h.useProgram(p.p);N(p,'uSpec',0);for(const key in pts.common)C(p,key,pts.common[key]);for(const key in pts.splat)C(p,key,pts.splat[key]);h.bindVertexArray(u.splatVao);h.drawArrays(h.POINTS,0,Math.max(1,Math.min(u.splatN,0|pts.splatCount)));}
   h.disable(h.BLEND);h.bindVertexArray(y);
  }
  const next=w[S],prev=w[1-S];h.bindFramebuffer(h.FRAMEBUFFER,next.f);h.useProgram(b.p);h.activeTexture(h.TEXTURE0);h.bindTexture(h.TEXTURE_2D,M.t);N(b,'uScene',0);h.activeTexture(h.TEXTURE1);h.bindTexture(h.TEXTURE_2D,prev.t);N(b,'uPrev',1);C(b,'uAspect',L/A);for(const key in e.fb)C(b,key,e.fb[key]);h.drawArrays(h.TRIANGLES,0,3);
  h.activeTexture(h.TEXTURE1);h.bindTexture(h.TEXTURE_2D,null);h.activeTexture(h.TEXTURE0);h.bindTexture(h.TEXTURE_2D,next.t);h.generateMipmap(h.TEXTURE_2D);
  h.bindFramebuffer(h.FRAMEBUFFER,target.post.f);h.useProgram(g.p);N(g,'uTex',0);N(g,'uCam',2);N(g,'uDepth',3);C(g,'uRes',[L,A]);for(const key in e.post)C(g,key,e.post[key]);C(g,'uCamOn',0);h.drawArrays(h.TRIANGLES,0,3);S=1-S;target.signature=signature;
 }
 if(!rigComposite){rigComposite=R(rigCompositeSource);rigProcessedCamera=h.createTexture();h.activeTexture(h.TEXTURE4);h.bindTexture(h.TEXTURE_2D,rigProcessedCamera);h.texImage2D(h.TEXTURE_2D,0,h.RGBA,1,1,0,h.RGBA,h.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));for(const p of [h.TEXTURE_MIN_FILTER,h.TEXTURE_MAG_FILTER])h.texParameteri(h.TEXTURE_2D,p,h.LINEAR);for(const p of [h.TEXTURE_WRAP_S,h.TEXTURE_WRAP_T])h.texParameteri(h.TEXTURE_2D,p,h.CLAMP_TO_EDGE);}
 const performance=window.NFXPerformance;
 if(Qn.on&&performance?.cameraFrame&&rigCameraStamp!==performance.lastFrame){h.activeTexture(h.TEXTURE4);h.bindTexture(h.TEXTURE_2D,rigProcessedCamera);h.texImage2D(h.TEXTURE_2D,0,h.RGBA,h.RGBA,h.UNSIGNED_BYTE,performance.cameraFrame);rigCameraStamp=performance.lastFrame;
  if(performance.renderer?.processedDepth){if(!rigProcessedDepth){rigProcessedDepth=h.createTexture();h.activeTexture(h.TEXTURE5);h.bindTexture(h.TEXTURE_2D,rigProcessedDepth);for(const p of [h.TEXTURE_MIN_FILTER,h.TEXTURE_MAG_FILTER])h.texParameteri(h.TEXTURE_2D,p,h.LINEAR);for(const p of [h.TEXTURE_WRAP_S,h.TEXTURE_WRAP_T])h.texParameteri(h.TEXTURE_2D,p,h.CLAMP_TO_EDGE);}h.activeTexture(h.TEXTURE5);h.bindTexture(h.TEXTURE_2D,rigProcessedDepth);h.texImage2D(h.TEXTURE_2D,0,h.RGBA,h.RGBA,h.UNSIGNED_BYTE,performance.renderer.processedDepth);}
 }

 h.bindFramebuffer(h.FRAMEBUFFER,null);h.viewport(0,0,e.studio?L:f.width,e.studio?A:f.height);h.useProgram(rigComposite.p);h.activeTexture(h.TEXTURE0);h.bindTexture(h.TEXTURE_2D,target.post.t);N(rigComposite,'uVisual',0);h.activeTexture(h.TEXTURE4);h.bindTexture(h.TEXTURE_2D,rigProcessedCamera);N(rigComposite,'uCamera',performance?.cameraFrame?4:2);N(rigComposite,'uDepth',performance?.renderer?.processedDepth?5:3);C(rigComposite,'uDepthOn',e.post.uDepthOn||0);C(rigComposite,'uRes',[L,A]);C(rigComposite,'uCamScale',e.post.uCamScale||[1,1]);C(rigComposite,'uOn',e.post.uCamOn||0);C(rigComposite,'uMix',e.post.uCamMix||0);C(rigComposite,'uBlend',e.post.uCamBlend||0);C(rigComposite,'uKey',e.post.uCamKey??.5);C(rigComposite,'uMirror',e.post.uCamMirror||0);C(rigComposite,'uEdge',e.post.uCamEdge||0);h.drawArrays(h.TRIANGLES,0,3);
}
