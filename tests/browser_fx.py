"""Compile the production post shader and verify radial symmetry and warp pixels."""
import json,pathlib,re
from playwright.sync_api import sync_playwright
source=(pathlib.Path(__file__).resolve().parents[1]/'src/app.html').read_text()
quoted=r'("(?:\\.|[^"\\])*")'
prefix=json.loads(re.search(r'const e='+quoted,source).group(1))
camera=json.loads(re.search(r',t='+quoted+r',n="\\nuniform vec4 uTouch',source).group(1))
post=prefix+camera+json.loads(re.search(r',i=e\+t\+'+quoted+r',s=',source).group(1))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page()
 result=page.evaluate('''post=>{
 const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
 function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'#version 300 es\\nin vec2 aP;out vec2 vUv;void main(){vUv=aP*.5+.5;gl_Position=vec4(aP,0.,1.);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,post));gl.bindAttribLocation(program,0,'aP');gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 const data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++)data.set([x,y,Math.round((x+y)/2),255],(y*size+x)*4);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
 for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);gl.generateMipmap(gl.TEXTURE_2D);
 gl.uniform1i(gl.getUniformLocation(program,'uTex'),0);gl.uniform2f(gl.getUniformLocation(program,'uRes'),size,size);
 function render(values={}){const all={uMirror:0,uSwirl:0,uRipple:0,uWave:0,uBright:1,uSat:1,uContrast:1,uTime:1.25,...values};for(const [key,value] of Object.entries(all))gl.uniform1f(gl.getUniformLocation(program,key),value);gl.drawArrays(gl.TRIANGLES,0,3);if(gl.getError())throw Error('GL error');const out=new Uint8Array(data.length);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,out);return out;}
 function pixel(frame,r,a){const x=Math.floor(size/2+Math.cos(a)*r),y=Math.floor(size/2+Math.sin(a)*r);return frame.slice((y*size+x)*4,(y*size+x)*4+3);}
 const base=render();let identity=0;for(let i=0;i<data.length;i++)identity=Math.max(identity,Math.abs(data[i]-base[i]));if(identity>2)throw Error('Zero effects changed picture: '+identity);
 let maxError=0;for(let n=5;n<=16;n++){const frame=render({uMirror:n-1});for(const radius of [35,70,100])for(let j=0;j<9;j++){const angle=j*.47,a=pixel(frame,radius,angle),b=pixel(frame,radius,angle+Math.PI*2/n);for(let k=0;k<3;k++)maxError=Math.max(maxError,Math.abs(a[k]-b[k]));}}if(maxError>5)throw Error('Radial split periodicity failed: '+maxError);
 const changes={};for(const key of ['uSwirl','uRipple','uWave']){const frame=render({[key]:.8});let diff=0;for(let i=0;i<frame.length;i+=4)diff+=Math.abs(frame[i]-base[i])+Math.abs(frame[i+1]-base[i+1]);changes[key]=diff/(size*size);if(changes[key]<1)throw Error(key+' did not warp the image');}
 return {splits:'5–16',maxSymmetryError:maxError,warpPixelChanges:changes};
 }''',post)
 print('PASS production FX shader:',json.dumps(result),flush=True);browser.close()
