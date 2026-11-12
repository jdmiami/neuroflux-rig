export function drawLayerWords(ctx,words,width,height,text=words.text){
 if(!text?.trim()||!words.visible||words.opacity<=0)return;
 ctx.save();ctx.globalAlpha*=words.opacity;ctx.fillStyle=words.color;ctx.font=`600 ${Math.round(Math.min(width,height)*words.size)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#000b';ctx.shadowBlur=Math.min(width,height)*.012;
 const limit=width*.8,size=Math.min(width,height)*words.size,lines=[];let line='';
 for(const word of text.trim().split(/\s+/)){if(ctx.measureText(line+' '+word).width>limit&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
 const visible=lines.slice(0,6),start=height*.7-(visible.length-1)*size*.62;visible.forEach((line,i)=>ctx.fillText(line,width/2,start+i*size*1.24,limit));ctx.restore();
}
