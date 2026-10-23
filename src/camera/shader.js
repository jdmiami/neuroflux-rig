export const vertex=`#version 300 es
in vec2 aP;out vec2 vUv;void main(){vUv=aP*.5+.5;gl_Position=vec4(aP,0.,1.);}`;
export const fragment=`#version 300 es
precision highp float;precision highp sampler2DArray;
in vec2 vUv;layout(location=0)out vec4 o;layout(location=1)out vec4 semantic;
uniform sampler2D uImage,uFeatures,uBackground;uniform sampler2DArray uHistory,uFeatureHistory;
uniform int uCode,uCount,uBorder,uTarget,uHead,uFrames,uRestored;
uniform vec2 uSize,uCenter,uHistorySize;
uniform vec4 uFace,uBody;
uniform vec3 uTint;
uniform float uAmount,uAngle,uScale,uPhase,uWet,uSeed,uDelay,uClock,uAutoplay,uAvailable;
const float PI=3.14159265359,TAU=6.28318530718,PHI=1.61803398875;
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7))+uSeed*11.77)*43758.5453);}
vec2 bounded(vec2 p){if(uBorder==1)return 1.-abs(mod(p,2.)-1.);if(uBorder==2)return fract(p);return clamp(p,0.,1.);}
vec4 readAt(vec2 p){if(uBorder==3&&(any(lessThan(p,vec2(0)))||any(greaterThan(p,vec2(1)))))return vec4(0);return texture(uImage,bounded(p));}
vec4 hist(vec2 p,float age){float layer=mod(float(uHead)-min(age,float(max(0,uFrames-1)))+30.,30.);return texture(uHistory,vec3(clamp(p,0.,1.),floor(layer)));}
vec4 histFeatures(vec2 p,float age){float layer=mod(float(uHead)-min(age,float(max(0,uFrames-1)))+30.,30.);return texture(uFeatureHistory,vec3(clamp(p,0.,1.),floor(layer)));}
float lumin(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-8)),d/(q.x+1e-8),q.x);}
vec3 rgb(vec3 c){return c.z*mix(vec3(1),clamp(abs(fract(c.x+vec3(0,2./3.,1./3.))*6.-3.)-1.,0.,1.),c.y);}
vec2 hexLocal(vec2 p){vec2 s=vec2(1.,1.7320508);vec2 a=mod(p,s)-s*.5,b=mod(p-s*.5,s)-s*.5;return dot(a,a)<dot(b,b)?a:b;}
vec2 goldenLocal(vec2 uv){vec2 q=uv*vec2(PHI,1.),origin=vec2(0),size=vec2(PHI,1.);for(int j=0;j<10;j++){float side=min(size.x,size.y);int direction=j%4;bool horizontal=size.x>size.y;
 vec2 square=origin;if(direction==2)square.x+=size.x-side;if(direction==3)square.y+=size.y-side;
 if(all(greaterThanEqual(q,square))&&all(lessThanEqual(q,square+side)))return (q-square)/max(.001,side)-.5;
 if(horizontal){if(direction!=2)origin.x+=side;size.x=max(.001,size.x-side);}else{if(direction!=3)origin.y+=side;size.y=max(.001,size.y-side);}}
 return fract((q-origin)/max(size,vec2(.001)))-.5;}
vec2 ringCell(vec2 cell,vec2 grid,float shift){float layer=min(min(cell.x,cell.y),min(grid.x-1.-cell.x,grid.y-1.-cell.y));vec2 size=grid-2.*layer,c=cell-layer;
 if(size.x<2.)return vec2(layer,layer+mod(c.y+shift,size.y));if(size.y<2.)return vec2(layer+mod(c.x+shift,size.x),layer);
 float w=size.x-1.,h=size.y-1.,index=c.y<.5?c.x:c.x>w-.5?w+c.y:c.y>h-.5?w+h+(w-c.x):2.*w+h+(h-c.y);
 index=mod(index+shift,2.*(w+h));if(index<w)return vec2(index,0)+layer;index-=w;if(index<h)return vec2(w,index)+layer;index-=h;if(index<w)return vec2(w-index,h)+layer;index-=w;return vec2(0,h-index)+layer;}
vec2 mapUV(vec2 uv){
 int c=uCode;float a=uAmount,n=float(uCount),asp=uSize.x/uSize.y;
 vec2 p=(uv-uCenter)*vec2(asp,1.);p=rot(uAngle)*p/max(.2,uScale);
 float r=length(p),ang=atan(p.y,p.x),phase=uPhase;
 if(c==0||c==5||c==6||c==7||c==8){if(uCount>1){float sector=TAU/n;float t=mod(ang+(c==6?phase:0.)+sector*.5,sector)-sector*.5;
  if(c!=8)t=abs(t);if(c==5)t*=mod(floor((ang+PI)/sector),2.)<1.?1.:-1.;p=r*vec2(cos(t),sin(t));}if(c==7)p+=vec2(a*.2,-a*.1);}
 else if(c==1)p.x=-abs(p.x);else if(c==2)p.y=-abs(p.y);else if(c==3){if(p.x>p.y)p=p.yx;}else if(c==4){p=-abs(p);if(p.x>p.y)p=p.yx;}
 else if(c==10)p=rot(a*5.*exp(-r*2.)+phase*.15)*p;
 else if(c==11)p=rot(a*5.*r+phase*.15)*p;
 else if(c==12)p*=1.+a*(r*r*2.-.5);
 else if(c==13)p*=1.+a*r*r*2.;
 else if(c==14)p/=max(.2,1.+a*r*r*2.);
 else if(c==15||c==16){float w=exp(-r*r*12.);p*=1.+a*w*(c==15?-1.:1.);}
 else if(c==17)p*=vec2(1.+a*.8,1.-a*.6);
 else if(c==18)p.x=(p.x+a*p.y)/max(.25,1.+a*p.y);
 else if(c==19)p+=a*.08*vec2(sin(p.y*12.+phase),sin(p.x*10.-phase*.7));
 else if(c==20)p+=normalize(p+vec2(.00001))*sin(r*35.-phase)*a*.06;
 else if(c==21)p+=a*.06*vec2(sin(p.y*9.+sin(p.x*6.+phase)),cos(p.x*8.+sin(p.y*5.-phase)));
 else if(c==22)p+=a*.04*vec2(sin(phase+p.y*5.),cos(phase*.8+p.x*4.));
 else if(c==23)p*=1.-a*exp(-r*r*25.)*.65;
 else if(c>=30&&c<=38){
  if(c==34||c==35){float sector=TAU/n;float t=mod(ang+sector*.5,sector)-sector*.5;p=r*vec2(cos(t),sin(t));if(c==35)p=rot(log(max(.01,r))*a*2.+phase*.2)*p;}
  else if(c==36)p+=vec2(sin(phase),cos(phase*.7))*a*.08;
  else if(c==37)p*=pow(1.2,floor(r*n)+a*2.);
  else{vec2 q=p*n;vec2 cell=floor(q+.5);if(c==31)q.x+=mod(cell.y,2.)*.5;
   if(c==32){p=hexLocal(q)*.9;return p/vec2(asp,1.)+uCenter;}
   q=fract(q+.5)-.5;if(c==33&&q.x+q.y>0.)q=-q.yx;
   if(c==38)q=rot(mod(cell.x+cell.y,4.)*PI*.5)*q;p=q;}
 }
 else if(c>=40&&c<=49){
  if(c==48||c==49){vec2 q=p*ceil(sqrt(n));q=fract(q+.5)-.5;p=q;r=length(p);ang=atan(p.y,p.x);}
  float d=r;if(c==41)d=max(abs(p.x),abs(p.y));if(c==42)d=max(abs(p.x)*.866+p.y*.5,-p.y);
  if(c==43){float sector=TAU/max(3.,n);d=r*cos(mod(ang+sector*.5,sector)-sector*.5);}
  float z=-log(max(.008,abs(d)))*(.8+abs(a)*3.)+phase;
  float ring=fract(z);float t=ang+(c==44?z*a:0.);if(c==46)t=abs(mod(t+PI*.25,PI*.5)-PI*.25);
  p=(c==41?normalize(p+vec2(.00001)):vec2(cos(t),sin(t)))*(.05+ring*.43);
  if(c==45)p=rot(floor(z)*a)*p;
 }
 else if(c>=50&&c<=61){
  // A bijection permutes tiles; pieces remain pieces of one source image.
  vec2 grid=vec2(n,max(1.,floor(n/asp+.5))),q=uv*grid,cell=floor(q),local=fract(q);
  float cols=grid.x,rows=grid.y,total=cols*rows,id=cell.y*cols+cell.x;
  float stepN=floor(phase),move=fract(phase),seed=floor(uSeed);
  float dest=id;
  if(uRestored==0){
   if(c==50)dest=mod(total-1.-id+seed+floor(phase),total);
   else if(c==51||c==52){float cursor=mod(stepN,total);if(id==cursor)local.x-=move;else if(id==mod(cursor+1.,total))local.x+=1.-move;dest=mod(id+stepN,total);}
   else if(c==53)cell.x=mod(cell.x+floor(phase+cell.y),cols);
   else if(c==54)cell.y=mod(cell.y+floor(phase+cell.x),rows);
   else if(c==55)local=rot(phase+hash(cell)*TAU)*(local-.5)+.5;
   else if(c==56)local.x=.5+(local.x-.5)*cos(phase+hash(cell)*PI);
   else if(c==57)cell.x=mod(cell.x+mod(cell.x+cell.y,2.)*floor(phase+1.),cols);
   else if(c==58)cell.x=mod(cell.x+mod(cell.y,2.)*floor(phase+1.),cols);
   else if(c==59)cell=ringCell(cell,grid,floor(phase)+seed);
   else if(c==60){float k=step(.5,fract(phase*.15+.5));dest=mix(id,mod(total-1.-id+seed,total),k);}
   else if(c==61)dest=mod(mod(id,cols)*rows+floor(id/cols)+seed,total);
  }
  if(c==50||c==51||c==52||c==60||c==61)cell=vec2(mod(dest,cols),floor(dest/cols));
  vec2 mapped=(cell+local)/grid;p=(mapped-uCenter)*vec2(asp,1.);
 }
 else if(c==65)p=rot(log(max(r,.005))*PHI*a+phase*.2)*p;
 else if(c==66)p=goldenLocal(p/vec2(asp,1.)+uCenter);
 else if(c==67){float k=fract(-log(max(.01,max(abs(p.x),abs(p.y))))/log(PHI)+phase*.2);p=normalize(p+vec2(.00001))*k*.5;}
 else if(c==68||c==69){float best=1e6;vec2 center=vec2(0);for(int j=0;j<16;j++){if(j>=uCount)break;float index=float(j)+.5;float radius=(c==69?sqrt(index/n):index/n)*.45;float t=index*TAU/(PHI*PHI)+phase*.1;vec2 candidate=radius*vec2(cos(t),sin(t));float distance=length(p-candidate);if(distance<best){best=distance;center=candidate;}}p=(p-center)*sqrt(n)*2.;}
 else if(c==70)p=vec2(ang/TAU,r*2.);
 else if(c==71)p=normalize(p+vec2(.00001))*fract(r*n+phase*.1)*.5;
 else if(c==72){p=fract(p*n+.5)-.5;if(p.x+p.y>0.)p=-p.yx;}
 else if(c==73)p=hexLocal(p*n)*.9;
 else if(c==74)p=rot(PI*.25)*(fract(rot(-PI*.25)*p*n+.5)-.5);
 else if(c==120||c==121){float cells=mix(240.,12.,abs(a));p=(floor((uv)*cells)+.5)/cells;p=(p-uCenter)*vec2(asp,1.);}
 else if(c==129)p.x+=step(.8,hash(vec2(floor(uv.y*32.),floor(phase*5.))))*a*.2;
 else if(c==130)p+=vec2(hash(floor(uv*12.)+floor(phase*3.)),hash(floor(uv*12.)+5.+floor(phase*3.)))*.1*a;
 else if(c>=155&&c<=157||c==163){vec4 box=c==163?uBody:uFace;vec2 center=(box.xy-uCenter)*vec2(asp,1.);vec2 d=p-center;float radius=max(.025,box.z*asp);float w=exp(-dot(d,d)/(radius*radius));p=center+d*(1.-a*w*(c==157?-1.:1.)*.7);}
 else if(c==174||c==175){float depth=texture(uFeatures,uv).g;p+=(depth-.5)*a*.12*(c==175?vec2(cos(uAngle),sin(uAngle)):normalize(p+vec2(.00001)));}
 return p/vec2(asp,1.)+uCenter;
}
void main(){
 vec2 uv=vUv;vec4 original=texture(uImage,uv);vec4 features=texture(uFeatures,uv);
 if(uCode==-1){o=texture(uImage,vec2(uv.x,1.-uv.y));semantic=texture(uFeatures,vec2(uv.x,1.-uv.y));return;}
 if(uAvailable<.5){o=original;semantic=features;return;}
 vec2 mapped=mapUV(uv);vec4 col=readAt(mapped);vec4 fm=texture(uFeatures,bounded(mapped));
 float a=uAmount,l=lumin(col.rgb),phase=uPhase;vec2 px=1./uSize;int c=uCode;
 if(c==52&&uRestored==0&&floor(uv.x*float(uCount))+floor(uv.y*float(uCount))*float(uCount)==mod(floor(phase),float(uCount*uCount)))col=vec4(0);
 if(c>=80&&c<=89||c==47||c==148||c==149||c==160||c==164){
  float frames=max(1.,min(float(uFrames-1),uDelay*15.));float age=frames;
  if(c==82)age=float(max(0,uFrames-1));
  if(c==83||c==84)age=mod(uClock*15.,max(1.,frames));
  if(c==85)age=uv.x*frames;if(c==86)age=hash(floor(uv*float(uCount)))*frames;if(c==87)age=uv.y*frames;
  if(c==88)age=mod(uClock*30.,frames);if(c==89)age=abs(mod(uClock*15.,frames*2.)-frames);
  vec4 echo=hist(mapped,age);vec4 oldFeatures=histFeatures(mapped,age);
  if(c==80||c==47||c>=148){col=mix(col,echo,min(.95,abs(a)));for(int j=1;j<=3;j++)col.rgb+=hist(mapped+vec2(float(j)*a*.012,0),min(float(uFrames-1),age*float(j+1))).rgb*abs(a)*.06;}
  else if(c==81){col.rgb=mix(col.rgb,max(col.rgb,echo.rgb),abs(a));}else col=mix(col,echo,abs(a));
  if(c>=148){float m=c==164?oldFeatures.a:c==160?oldFeatures.b:oldFeatures.r;col=mix(original,echo,m*abs(a));for(int j=1;j<=3;j++){float past=min(float(uFrames-1),age*float(j+1));vec4 oldMask=histFeatures(mapped,past);float mask=c==164?oldMask.a:c==160?oldMask.b:oldMask.r;col.rgb=mix(col.rgb,hist(mapped,past).rgb,mask*abs(a)*.25);}}
  fm=mix(features,oldFeatures,abs(a));
 }
 if(c==36)col=mix(col,readAt(mapped+vec2(a*.08,0)),.4);
 if(c>=100&&c<=116){
  if(c==100)col.rgb*=exp2(a*3.);if(c==101)col.rgb=(col.rgb-.5)*(1.+a*2.)+.5;
  if(c==102)col.rgb=mix(vec3(l),col.rgb,1.+a*2.);
  if(c==103){vec3 h=hsv(col.rgb);h.x=fract(h.x+a*.5);col.rgb=rgb(h);}
  if(c==104)col.rgb+=vec3(a*.2,-a*.06,-a*.2);
  if(c==105)col.rgb=mix(col.rgb,vec3(l),abs(a));
  if(c==106||c==107)col.rgb=mix(col.rgb,mix(uTint*.12,mix(uTint,vec3(1),.3),smoothstep(.05,.95,l)),abs(a));
  if(c==108)col.rgb=mix(col.rgb,clamp(vec3(1.5-abs(4.*l-3.),1.5-abs(4.*l-2.),1.5-abs(4.*l-1.)),0.,1.),abs(a));
  if(c==109)col.rgb=mix(col.rgb,1.-col.rgb,abs(a));
  if(c==110)col.rgb=mix(col.rgb,abs(col.rgb-.5)*2.,abs(a));
  if(c==111)col.rgb=floor(col.rgb*max(2.,float(uCount)))/max(2.,float(uCount));
  if(c==112)col.rgb=mix(col.rgb,vec3(step(abs(a),l)),abs(a));
  if(c==113){int ch=uCount%3;col.rgb=ch==0?vec3(col.r,0,0):ch==1?vec3(0,col.g,0):vec3(0,0,col.b);}
  if(c==114){col.r=readAt(mapped+vec2(a*.03,0)).r;col.b=readAt(mapped-vec2(a*.03,0)).b;}
  if(c==115){vec3 blur=(readAt(mapped+px*4.).rgb+readAt(mapped-px*4.).rgb+readAt(mapped+vec2(px.x,-px.y)*4.).rgb+readAt(mapped-vec2(px.x,-px.y)*4.).rgb)*.25;col.rgb+=max(blur-.4,0.)*abs(a)*2.;}
  if(c==116)col.rgb*=1.-abs(a)*dot(uv-.5,uv-.5)*2.;
 }
 if(c>=122&&c<=131){
  if(c==122){ivec2 q=ivec2(mod(floor(uv*uSize),4.));const int pattern[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);float threshold=(float(pattern[q.y*4+q.x])+.5)/16.;float levels=max(2.,float(uCount));col.rgb=floor(col.rgb*levels+threshold)/levels;}
  if(c==123){vec2 q=fract(uv*float(uCount)*12.)-.5;col.rgb=vec3(step(length(q),l*.65));}
  float gx=abs(lumin(readAt(mapped+vec2(px.x*2.,0)).rgb)-lumin(readAt(mapped-vec2(px.x*2.,0)).rgb));
  float gy=abs(lumin(readAt(mapped+vec2(0,px.y*2.)).rgb)-lumin(readAt(mapped-vec2(0,px.y*2.)).rgb));float edge=clamp((gx+gy)*4.,0.,1.);
  if(c==124)col.rgb=mix(col.rgb,vec3(edge),abs(a));if(c==125)col.rgb=mix(col.rgb,uTint*edge*2.,abs(a));
  if(c==126)col.rgb=floor(col.rgb*5.)/5.*(1.-edge*abs(a));
  if(c==127)col.rgb*=1.-abs(a)*.5*(.5+.5*sin(uv.y*uSize.y*PI));
  if(c==128)col.rgb+=(hash(floor(uv*uSize)+floor(phase*10.))-.5)*abs(a)*.3;
  if(c==131){col.r=readAt(mapped+vec2(sin(phase*8.)*a*.02,0)).r;col.b=readAt(mapped-vec2(sin(phase*7.)*a*.02,0)).b;}
 }
 if(c>=140&&c<=149){float person=smoothstep(.2,.8,features.r);vec3 bg=uTint;
  if(c==140)col.a*=person;
  if(c==141){bg=vec3(0);for(int j=0;j<8;j++){float t=float(j)*TAU/8.;bg+=readAt(uv+vec2(cos(t),sin(t))*abs(a)*.05).rgb/8.;}col.rgb=mix(bg,col.rgb,person);}
  if(c==142)col.rgb=mix(bg,col.rgb,person);
  if(c==143)col.rgb=mix(texture(uBackground,uv).rgb,col.rgb,person);
  if(c==144)col.rgb=mix(rgb(vec3(fract(hsv(col.rgb).x+a),1.,l)),col.rgb,person);
  if(c==145)col.rgb=mix(col.rgb,1.-col.rgb,person*abs(a));
  if(c==146)col.rgb=mix(vec3(0),uTint,person);
  if(c==147){float outline=0.;for(int j=0;j<8;j++){float t=float(j)*TAU/8.;outline=max(outline,texture(uFeatures,uv+vec2(cos(t),sin(t))*px*5.).r);}col.rgb+=uTint*max(0.,outline-person)*abs(a)*3.;}
 }
 if(c==158){vec2 q=(floor(uv*35.)+.5)/35.;col=mix(col,readAt(q),features.b);}
 if(c==159){vec3 h=hsv(col.rgb);h.x=fract(h.x+a);col.rgb=mix(col.rgb,rgb(h),features.b);}
 if(c==161)col.rgb=mix(col.rgb,uTint,features.a*abs(a));
 if(c==162)col.rgb+=uTint*features.a*abs(a)*2.;
 if(c>=170&&c<=173){float d=features.g;
  if(c==170)col.rgb=mix(col.rgb,rgb(vec3(d*.75,1.,1.)),abs(a));
  if(c==171)col.rgb=mix(col.rgb,uTint*step(.8,fract(d*float(uCount))),abs(a));
  if(c==172){vec3 blur=vec3(0);for(int j=0;j<8;j++){float t=float(j)*TAU/8.;blur+=readAt(uv+vec2(cos(t),sin(t))*(1.-d)*abs(a)*.04).rgb/8.;}col.rgb=blur;}
  if(c==173)col.rgb*=step(.5,fract(d*float(uCount)+phase*.1));
 }
 float target=uTarget==1?features.r:uTarget==2?1.-features.r:uTarget==3?features.b:uTarget==4?features.a:1.;
 float wet=uWet*clamp(target,0.,1.);o=mix(original,vec4(clamp(col.rgb,0.,1.),col.a),wet);semantic=mix(features,fm,wet);
}`;
