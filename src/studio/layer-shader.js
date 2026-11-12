// Injected into the native rig closure, alongside rig-render.js.
let rigLayerProgram=null;
const rigLayerSource=`#version 300 es
precision highp float;in vec2 vUv;out vec4 o;
uniform sampler2D uVisual,uSpace,uCamera,uDepth;
uniform vec4 uOrder,uOpacity,uModes,uVisible;
uniform vec2 uCamScale,uRes;uniform float uCamMirror,uCamOn,uSpaceOn,uSolo,uKey,uDepthOn,uCamEdge;
vec2 cameraUV(vec2 p){p=(p-.5)*uCamScale+.5;if(uCamMirror>.5)p.x=1.-p.x;return vec2(p.x,1.-p.y);}
vec4 source(int id){if(id==0)return texture(uVisual,vUv);if(id==1){vec4 p=texture(uSpace,vUv);return uSpaceOn>.5?vec4(clamp(p.rgb/max(p.a,.0001),0.,1.),clamp(p.a,0.,1.)):vec4(0.);}if(uCamOn<.5)return vec4(0.);vec4 p=texture(uCamera,cameraUV(vUv));if(uCamEdge>0.){vec2 px=1.5/uRes;float edge=length(vec2(dot(texture(uCamera,cameraUV(vUv+vec2(px.x,0))).rgb-texture(uCamera,cameraUV(vUv-vec2(px.x,0))).rgb,vec3(.299,.587,.114)),dot(texture(uCamera,cameraUV(vUv+vec2(0,px.y))).rgb-texture(uCamera,cameraUV(vUv-vec2(0,px.y))).rgb,vec3(.299,.587,.114))));p.rgb+=vec3(.27,.94,1.)*edge*uCamEdge;}return p;}
vec3 blend(vec3 b,vec3 s,int m){if(m==1)return 1.-(1.-b)*(1.-s);if(m==2)return min(vec3(1.),b+s);if(m==3)return b*s;if(m==4)return abs(b-s);if(m==5)return mix(2.*b*s,1.-2.*(1.-b)*(1.-s),step(vec3(.5),b));return s;}
void main(){if(uSolo>-.5){vec4 p=source(int(uSolo+.5));o=vec4(p.rgb*p.a,1);return;}vec3 col=vec3(0.);for(int i=0;i<3;i++){int id=int(uOrder[i]+.5);vec4 p=source(id);int mode=int(uModes[id]+.5);float a=clamp(p.a*uOpacity[id]*uVisible[id],0.,1.);if(id==2&&mode>=6){float mask=mode==7&&uDepthOn>.5?texture(uDepth,cameraUV(vUv)).r:dot(p.rgb,vec3(.299,.587,.114));a*=smoothstep(uKey-.06,uKey+.06,mask);}col=mix(col,blend(col,clamp(p.rgb,0.,1.),mode),a);}o=vec4(clamp(col,0.,1.),1);}`;
function drawRigPoints(pts){
 if(!pts||!pts.cloud&&!pts.splat)return;
 h.enable(h.BLEND);h.blendFunc(h.ONE,h.ONE);
 if(pts.cloud&&u.cloudN){const p=u.progCloud;h.useProgram(p.p);N(p,'uSpec',0);N(p,'uCam',2);N(p,'uDepth',3);for(const key in pts.common)C(p,key,pts.common[key]);for(const key in pts.cloud)C(p,key,pts.cloud[key]);h.bindVertexArray(u.cloudVao);h.drawArrays(h.POINTS,0,u.cloudN);}
 if(pts.splat&&u.splatN){const p=u.progSplat;h.useProgram(p.p);N(p,'uSpec',0);for(const key in pts.common)C(p,key,pts.common[key]);for(const key in pts.splat)C(p,key,pts.splat[key]);h.bindVertexArray(u.splatVao);h.drawArrays(h.POINTS,0,Math.max(1,Math.min(u.splatN,0|pts.splatCount)));}
 h.disable(h.BLEND);h.bindVertexArray(y);
}
function drawRigLayers(e,target,layerUI){
 rigLayerProgram??=R(rigLayerSource);const p=rigLayerProgram,state=layerUI.state,ids=['visuals','space','camera'],modes=['normal','screen','add','multiply','difference','overlay','luma','depth'],performance=window.NFXPerformance;
 h.useProgram(p.p);h.activeTexture(h.TEXTURE0);h.bindTexture(h.TEXTURE_2D,target.post.t);N(p,'uVisual',0);h.activeTexture(h.TEXTURE6);h.bindTexture(h.TEXTURE_2D,target.space.t);N(p,'uSpace',6);N(p,'uCamera',performance?.cameraFrame?4:2);N(p,'uDepth',performance?.renderer?.processedDepth?5:3);
 C(p,'uOrder',[...state.order.map(id=>ids.indexOf(id)),0]);C(p,'uOpacity',[...ids.map(id=>state.layers[id].opacity),0]);C(p,'uVisible',[...ids.map(id=>state.layers[id].visible?1:0),0]);C(p,'uModes',[...ids.map(id=>modes.indexOf(state.layers[id].blend)),0]);
 C(p,'uSolo',e.layerSolo!==undefined?ids.indexOf(e.layerSolo):!e.studio&&layerUI.opened&&layerUI.previewSolo?ids.indexOf(layerUI.previewSolo):-1);C(p,'uCamOn',e.post.uCamOn||0);C(p,'uSpaceOn',e.pts&&(e.pts.cloud||e.pts.splat)?1:0);C(p,'uCamScale',e.post.uCamScale||[1,1]);C(p,'uCamMirror',e.post.uCamMirror||0);C(p,'uDepthOn',e.post.uDepthOn||0);C(p,'uKey',e.post.uCamKey??.5);C(p,'uRes',[L,A]);C(p,'uCamEdge',e.post.uCamEdge||0);
}
