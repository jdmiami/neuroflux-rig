'use strict';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function metrics({width,height,viewportWidth,viewportHeight,zoom=1,stackX,stackY,reduced=false}){
 const w=width*zoom,h=height*zoom;stackX=Math.max(stackX,w*.62);
 const middleScale=clamp(Math.min(.62,(viewportWidth-32)/(2*w),(viewportHeight-24)/(h*1.75)),.25,.62);
 const laneX=Math.max(0,Math.min((viewportWidth-w*middleScale-20)/2,Math.max(stackX*.65,w*middleScale*.65+20)));
 const laneY=Math.max(0,Math.min(viewportHeight*.22,(viewportHeight-h*middleScale-24)/2));
 return {width,height,zoom,stackX,stackY,middleScale,laneX,laneY,depth:Math.max(180,w*.95+h*.25),reduced};
}
function pose(offset,m){
 const d=Math.abs(offset),sign=Math.sign(offset),near=Math.min(d,1),arc=Math.sin(Math.PI*near)**2,bank=m.reduced?0:arc;
 const focus=Math.max(0,1-d),depth=near*near*(2-near)+Math.max(0,d-1);
 return {x:-offset*m.stackX-sign*arc*Math.max(0,m.laneX-m.stackX*.5),
  y:offset*m.stackY+sign*arc*Math.max(0,m.laneY-m.stackY*.5),z:-depth*m.depth,
  rx:3+near*7+bank*4,ry:-5+sign*(near*20+bank*12),rz:-near*5-sign*bank*6,
  scale:m.zoom*(1-(1-m.middleScale)*arc),distance:d,focus};
}
module.exports={metrics,pose};
