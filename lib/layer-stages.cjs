'use strict';
// The order is the native post shader's evaluation order. Each preview shows
// the real image at that point, with later adjustments neutralized.
const post=[
 ['fish','Fisheye','uFish',0],['swirl','Swirl','uSwirl',0],['ripple','Ripple','uRipple',0],['wave','Waves','uWave',0],
 ['mirror','Mirrors','uMirror',0],['pixel','Pixelation','uPixel',0],['glitch','Glitch','uGlitch',0],['chroma','Color separation','uChroma',0],
 ['bloom','Bloom','uBloom',0],['bright','Brightness','uBright',1],['contrast','Contrast','uContrast',1],['sat','Saturation','uSat',1],
 ['poster','Posterize','uPoster',0],['invert','Invert','uInvert',0],['strobe','Flash','uFlash',0],['scan','Scanlines','uScan',0],['grain','Grain','uGrain',0],['vig','Vignette','uVig',0]
].map(([control,name,uniform,neutral],index)=>({id:'visual-'+control,control,name,uniform,neutral,index,source:'visuals',kind:'adjustment'}));
function postPreview(values,through){
 const index=post.findIndex(p=>p.id===through),out={...values};
 for(const p of post)if(through==='visual-base'||p.index>index&&index>=0)out[p.uniform]=p.neutral;
 return out;
}
module.exports={post,postPreview};
