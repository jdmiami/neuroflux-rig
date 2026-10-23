'use strict';
// Shared by renderer, controls, setup validation and the AI guide.
const families={mirror:'Mirrors & kaleidoscopes',warp:'Warp & lenses',clone:'Clones & repetition',tunnel:'Tunnels',puzzle:'Square puzzles',geometry:'Golden ratio & geometry',time:'Time & feedback',color:'Color & light',texture:'Texture & stylization',person:'Person & background',face:'Face & body',depth:'Depth'};
const rows=[
 ['mirror',0,'Kaleidoscope','Horizontal mirror','Vertical mirror','Diagonal mirror','Quadrant mirror','Alternating wedges','Rotating kaleidoscope','Offset kaleidoscope','Radial repeats'],
 ['warp',10,'Swirl','Twist','Fisheye','Barrel','Pincushion','Bulge','Pinch','Stretch','Perspective','Waves','Ripple','Liquid','Wobble','Local lens'],
 ['clone',30,'Square clones','Brick clones','Honeycomb clones','Triangle clones','Radial clones','Spiral clones','Ghost copies','Zoom copies','Alternating clones'],
 ['tunnel',40,'Circle tunnel','Square tunnel','Triangle tunnel','Polygon tunnel','Spiral tunnel','Recursive zoom','Mirrored tunnel','Feedback tunnel','Multiple tunnels','Tiled tunnels'],
 ['puzzle',50,'Scramble tiles','Sliding tiles','Empty-cell slide','Row shifts','Column shifts','Rotating tiles','Flipping tiles','Checker displacement','Staggered tiles','Tile rings','Reassembly','Square arrangements'],
 ['geometry',65,'Golden spiral','Fibonacci tiles','Golden frames','Golden-angle clones','Phyllotaxis','Polar wrap','Concentric rings','Triangle mosaic','Hexagon mosaic','Diamond tiles'],
 ['time',80,'Camera trails','Delayed echoes','Frame hold','Stutter','Frame stepping','Slit-scan','Time tiles','Temporal bands','Reverse loop','Boomerang'],
 ['color',100,'Exposure','Contrast','Saturation','Hue','Temperature & tint','Monochrome','Duotone','Gradient map','Thermal color','Invert','Solarize','Posterize','Threshold','Channel isolate','RGB separation','Bloom','Vignette'],
 ['texture',120,'Pixelate','Mosaic','Dither','Halftone','Edge outlines','Neon edges','Cartoon','Scanlines','Grain','Horizontal tear','Block displacement','Channel jitter'],
 ['person',140,'Person cutout','Background blur','Background color','Background image','Background FX','Person FX','Silhouette','Person glow','Subject echoes','Subject trails'],
 ['face',155,'Face lens','Face bulge','Face pinch','Face pixelate','Face color','Face echoes','Body silhouette','Pose outlines','Body distortion','Body trails'],
 ['depth',170,'Depth color','Depth contours','Depth blur','Depth slices','Depth displacement','Depth parallax']
];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
const defaults={amount:.35,count:6,centerX:.5,centerY:.5,scale:1,angle:0,speed:.25,seed:1,delay:.5,autoplay:false,beat:0,division:1,border:'mirror',target:'all',tint:'#45f0ff'};
const rules={amount:[-1,1],count:[1,16,1],centerX:[0,1],centerY:[0,1],scale:[.2,4],angle:[-180,180],speed:[-2,2],seed:[0,65535,1],delay:[.067,2],autoplay:[false,true],beat:[0,1],division:[.125,.25,.5,1,2,4,8],border:['clamp','mirror','repeat','transparent'],target:['all','person','background','face','body'],tint:'color'};
const effects=rows.flatMap(([family,start,...names])=>names.map((name,i)=>({id:slug(name),name,family,code:start+i,
 requirements:family==='person'?['segment']:family==='face'?[i<6?'face':'pose']:family==='depth'?['depth']:[],
 temporal:family==='time'||['feedback-tunnel','subject-echoes','subject-trails','face-echoes','body-trails'].includes(slug(name)),
 pinned:family==='face'&&[0,1,2,8].includes(i),
 description:family==='puzzle'?'Moves separate square pieces of the camera picture; Shuffle changes the arrangement and Restore puts it back.':family==='clone'?'Repeats the complete camera picture. Count controls the number or grid density.':family==='depth'?'Uses locally estimated camera depth; first use needs a model download.':family==='face'?'Follows a locally detected face or body. Tracking remains live during silence.':family==='person'?'Uses a local person mask to separate the subject from the background.':`Camera-only ${name.toLowerCase()}. Amount controls strength; autoplay and beat response are optional.`
})));
const byId=Object.fromEntries(effects.map(e=>[e.id,e]));
function valid(key,v){const r=rules[key];if(r==='color')return typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);if(!r)return false;if(typeof r[0]==='number'&&r.length===2||r.length===3&&r[2]===1)return typeof v==='number'&&Number.isFinite(v)&&v>=r[0]&&v<=r[1]&&(!r[2]||Number.isInteger(v));return r.includes(v);}
function node(effect,id){if(!byId[effect])throw Error('Unknown camera effect.');return {id:id||'fx-'+Math.random().toString(36).slice(2,10),effect,bypass:false,wet:1,params:{...defaults,...(effect==='exposure'?{amount:0}:effect==='contrast'||effect==='saturation'?{amount:0}:{} )}};}
function validate(raw){if(!raw||raw.version!==1||typeof raw.enabled!=='boolean'||!Array.isArray(raw.nodes)||raw.nodes.length>8)throw Error('Camera FX supports a version 1 stack with up to eight effects.');const ids=new Set();let ordinary=false;const nodes=raw.nodes.map(n=>{if(!n||!byId[n.effect]||!/^fx-[\w-]{1,40}$/.test(n.id)||ids.has(n.id)||typeof n.bypass!=='boolean'||!Number.isFinite(n.wet)||n.wet<0||n.wet>1)throw Error('Invalid camera effect node.');ids.add(n.id);if(byId[n.effect].pinned&&ordinary)throw Error('Face/body deformation belongs at the start, before image cloning and tiling.');if(!byId[n.effect].pinned)ordinary=true;const params={...defaults};for(const [key,value] of Object.entries(n.params||{})){if(!valid(key,value))throw Error('Invalid camera effect parameter: '+key);params[key]=value;}return {id:n.id,effect:n.effect,bypass:n.bypass,wet:n.wet,params};});return {version:1,enabled:raw.enabled,nodes};}
const empty=()=>({version:1,enabled:false,nodes:[]});
const looks=[['Liquid prism',['kaleidoscope','swirl','ripple']],['Infinite camera',['circle-tunnel','rgb-separation']],['Golden portrait',['golden-spiral','golden-frames']],['Sliding glass',['sliding-tiles','neon-edges']],['Honeycomb',['honeycomb-clones','duotone']],['Dream echoes',['delayed-echoes','bloom']],['Square portal',['square-tunnel','rotating-tiles']],['Spiral copies',['spiral-clones','vignette']],['Subject neon',['person-glow','background-color']],['Depth waves',['depth-contours','ripple']],['Face fun',['face-bulge','thermal-color']],['Fibonacci camera',['fibonacci-tiles','hue']]];
module.exports={families,effects,byId,defaults,rules,node,validate,valid,empty,looks};
