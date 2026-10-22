"""Pixel regression for the production camera GLSL in both trail modes.
Uses synthetic textures; no physical camera or camera permission is required.
"""
import json
import pathlib
import re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
QUOTED = r'("(?:\\.|[^"\\])*")'
source = (ROOT / 'src/app.html').read_text()
prefix = json.loads(re.search(r'const e=' + QUOTED, source).group(1))
camera = json.loads(re.search(r',t=' + QUOTED + r',n="\\nuniform vec4 uTouch', source).group(1))
post = prefix + camera + json.loads(re.search(r',i=e\+t\+' + QUOTED + r',s=', source).group(1))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page()
    result = page.evaluate('''({prefix,camera,post})=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
      const gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL 2 unavailable');
      const vertex=`#version 300 es\nin vec2 aP;out vec2 vUv;void main(){vUv=aP*.5+.5;gl_Position=vec4(aP,0.,1.);}`;
      function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
      function program(fragment){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));
        gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.bindAttribLocation(p,0,'aP');gl.linkProgram(p);
        if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
      const first=program(prefix+camera+`uniform vec2 uRes;void main(){vec3 col=vec3(64.,96.,128.)/255.;
        if(uCamOn>.5&&uCamPost<.5)col=camBlend(col,vUv,1./uRes,0.,vec3(.27,.94,1.));o=vec4(col,1.);}`);
      const last=program(post);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
      function texture(unit,data){gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,16,16,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);return t;}
      const data=new Uint8Array(16*16*4);
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)data.set(x<8?[180,40,80,255]:[30,170,100,255],(y*16+x)*4);
      texture(2,data);texture(3,data);const scene=texture(0,null);const fb=gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,scene,0);
      function uniforms(p,values){gl.useProgram(p);for(const [k,v] of Object.entries(values)){
        const l=gl.getUniformLocation(p,k);if(l===null)continue;
        if(Array.isArray(v))gl.uniform2fv(l,v);else if(['uTex','uCam','uDepth'].includes(k))gl.uniform1i(l,v);else gl.uniform1f(l,v);}}
      function render(mix,mode,trails,{edge=0,effects=false,on=1}={}){
        const values={uCam:2,uDepth:3,uCamOn:on,uCamMix:mix,uCamBlend:mode,uCamKey:.5,uCamEdge:edge,uCamScale:[1,1],
          uCamPost:trails?0:1,uRes:[16,16],uTex:0,uBright:1,uContrast:1,uSat:1};
        gl.bindFramebuffer(gl.FRAMEBUFFER,fb);uniforms(first,values);gl.drawArrays(gl.TRIANGLES,0,3);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,scene);gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        uniforms(last,{...values,...(effects?{uBright:.3,uContrast:1.8,uSat:0,uBloom:1,uInvert:1,uPoster:.8,
          uGrain:1,uVig:1,uScan:1,uGlitch:1,uFish:1,uMirror:3,uPixel:1,uChroma:1,uFlash:.5}: {})});
        gl.drawArrays(gl.TRIANGLES,0,3);if(gl.getError()!==gl.NO_ERROR)throw Error('Camera pipeline GL error');const pixels=new Uint8Array(16*16*4);gl.readPixels(0,0,16,16,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        // Reset all post effects between renders.
        uniforms(last,Object.fromEntries(['uBloom','uInvert','uPoster','uGrain','uVig','uScan','uGlitch','uFish','uMirror','uPixel','uChroma','uFlash'].map(k=>[k,0])));
        return pixels;}
      function near(a,b,context,tolerance=2){for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>tolerance)
        throw Error(`${context}: byte ${i}, got ${a[i]}, expected ${b[i]}`);}
      let cases=0;
      for(const trails of [false,true])for(let mode=0;mode<6;mode++){
        const zero=render(0,mode,trails,{edge:1}),noCamera=render(0,mode,trails,{on:0});
        near(zero,noCamera,`0% mode ${mode} trails ${trails}`);
        const middle=render(.5,mode,trails),raw=render(1,mode,trails);
        for(const amount of (mode===0?[.25,.51,.75]:[.51,.75])){
          const expected=middle.map((value,i)=>amount<=.5?zero[i]+(value-zero[i])*amount*2:value+(raw[i]-value)*(amount*2-1));
          near(render(amount,mode,trails),expected,`${amount*100}% mode ${mode} trails ${trails}`);cases++;
        }
        near(render(1,mode,trails,{edge:1,effects:true}),raw,`100% ignores effects mode ${mode} trails ${trails}`);
        // Far from the texture seam, pure camera preserves the source colors.
        near(raw.slice((8*16+3)*4,(8*16+3)*4+4),[180,40,80,255],'100% left camera color');
        near(raw.slice((8*16+12)*4,(8*16+12)*4+4),[30,170,100,255],'100% right camera color');
      }
      // At the midpoint SCREEN must contain both sources, rather than a raw camera or visual-only frame.
      const middle=render(.5,0,false),offset=(8*16+3)*4;
      near(middle.slice(offset,offset+3),[199,121,168],'50% selected SCREEN blend');
      return {cases};
    }''', {'prefix':prefix, 'camera':camera, 'post':post})
    print(f'PASS camera pixels: {result["cases"]} fade steps across all six blends and both trail modes; 0% visuals, 50% selected blend, 100% raw camera even with effects', flush=True)
    browser.close()
