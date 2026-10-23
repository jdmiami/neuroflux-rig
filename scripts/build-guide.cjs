const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
function slug(value) { return value.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g,'').trim().replace(/[\s_]+/g,'-'); }
module.exports = async function buildGuide() {
  const source = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');
  const start = source.indexOf('Pe({'), end = source.indexOf(';const Oe=', start);
  const catalog = [];
  const context = { Pe: p => catalog.push(p), Ae: false,
    ke: n => Math.round(n * 100) + '%', Ie: n => n.toFixed(2) + '×', Re: n => (n >= 0 ? '+' : '') + n.toFixed(3), Ce: n => n.toFixed(2),
    xe: JSON.parse(source.match(/xe=(\[.*?\]),Te=/)[1]), Me: JSON.parse(source.match(/Me=(\[.*?\]),we=/)[1]) };
  vm.runInNewContext(source.slice(start, end), context, { timeout: 1000 });
  const controls = catalog.map(p => {
    const result = { id:p.id, page:p.page, label:p.label, type:p.type, min:p.type==='switch'?0:p.min,
      max:p.type==='switch'?1:p.max, step:p.step || (p.type==='switch'?1:0), default:p.def };
    if (p.fmt) {
      result.defaultLabel=p.fmt(p.def);
      if (p.type==='dial'||p.type==='pads') result.options=Array.from({length:p.max-p.min+1},(_,i)=>({value:p.min+i,label:p.fmt(p.min+i)}));
    }
    return result;
  });
  const manual = fs.readFileSync(path.join(root,'docs/Neuroflux-User-Guide.md'),'utf8');
  const chunks=[];let section='Introduction', anchor='introduction', block=[], serial=0;
  const push=()=>{if(!block.length)return;const text=block.join('\n').replace(/<[^>]*>/g,'').trim();block=[];
    if(text.length>35)chunks.push({id:`manual-${++serial}`,title:section,anchor,text:text.slice(0,2200)});};
  for(const line of manual.split('\n')) {
    const heading=line.match(/^(#{1,3}) (.+)/);
    const control=line.match(/id="control-([^"]+)"/);
    if(heading){push();section=heading[2];anchor=slug(section);continue;}
    if(control){push();chunks.push({id:`control-${control[1]}`,title:section,anchor:`control-${control[1]}`,text:line.replace(/<[^>]*>/g,'').replace(/\*\*/g,''),control:control[1]});continue;}
    if(line.startsWith('<figure')){push();continue;}
    if(line.startsWith('<div>')||line.startsWith('</figure>'))continue;
    if(!line.trim()){if(block.join('\n').length>650)push();else block.push('');continue;}
    if(block.join('\n').length+line.length>1800)push();
    block.push(line);
  }
  push();
  const camera=require('../lib/camera-fx.cjs');
  for(const effect of camera.effects)chunks.push({id:'camera-effect-'+effect.id,title:'Camera FX: '+effect.name,anchor:'camera-effect-'+effect.id,text:effect.description+' Camera-only mode '+effect.name+'. '+(effect.family==='mirror'?'Count means 1–16 image divisions; one is undivided. ':'')+'Shared parameters: amount, count, centerX, centerY, scale, angle, wet/dry, speed, autoplay, beat, division, border and target. '+(effect.requirements.length?'Requires local '+effect.requirements.join(', ')+' analysis. ':''),cameraEffect:effect.id});
  const cameraEffects=camera.effects.map(({id,name,family,requirements,pinned})=>({id,name,family,requirements,pinned}));
  const version=crypto.createHash('sha256').update(manual).update(JSON.stringify(controls)).update(JSON.stringify(cameraEffects)).digest('hex').slice(0,16);
  const index={version,controls,chunks,cameraEffects};
  fs.writeFileSync(path.join(root,'lib/guide-index.json'),JSON.stringify(index));
  fs.mkdirSync(path.join(root,'public'),{recursive:true});
  fs.writeFileSync(path.join(root,'public/guide-index.json'),JSON.stringify({version,controls,cameraEffects}));
  const { marked }=await import('marked');
  const renderer=new marked.Renderer();
  renderer.heading=function({tokens,depth}){const text=this.parser.parseInline(tokens);const id=slug(text.replace(/<[^>]*>/g,''));return `<h${depth} id="${id}">${text}</h${depth}>`;};
  const body=marked.parse(manual,{renderer}).replaceAll('src="assets/','src="/manual-assets/');
  fs.cpSync(path.join(root,'docs/assets'),path.join(root,'public/manual-assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'public/manual.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neuroflux manual</title><style>body{margin:0;background:#080d19;color:#dcecff;font:16px/1.65 system-ui,sans-serif}main{max-width:1050px;margin:auto;padding:24px}a{color:#45f0ff}h2{border-top:1px solid #30485c;margin-top:48px;padding-top:24px}h1,h2,h3{line-height:1.3}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:12px;border:1px solid #30485c;text-align:left;vertical-align:top}th{background:#123543}td{overflow-wrap:anywhere}figure{display:flex;gap:10px;margin:20px 0}figure div{flex:1;min-width:0}img{width:100%}figcaption{font-size:12px}a[id]{scroll-margin-top:24px}button{padding:10px;background:#123543;color:#45f0ff;border:1px solid #45f0ff;font:inherit}@media(max-width:600px){main{padding:16px}figure{display:block}table{font-size:12px}td,th{padding:7px}}@media print{body{color:#152438;background:white}a{color:#087680}tr{break-inside:avoid}}</style><main><a href="/">← Back to Neuroflux</a><p>Find a control with your browser's Find command. The AI guide links directly to the sections it used.</p>${body}</main></html>`);
  console.log(`Guide knowledge: ${controls.length} controls, ${chunks.length} manual passages, revision ${version}.`);
  return index;
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
