'use strict';
const fs=require('node:fs'),path=require('node:path');
function allowed(file){return typeof file==='string'&&path.posix.normalize(file)===file&&!file.includes('\0')&&!file.includes('..')&&!file.includes('\\')&&!file.startsWith('/')&&/^(src\/|lib\/|docs\/|public\/showcase\/)/.test(file)&&/\.(js|cjs|css|html|md|json)$/.test(file)&&!/^src\/owner\//.test(file)&&!/^lib\/owner\//.test(file);}
function applyPlan(plan,root=process.cwd()){
 if(!plan||!Array.isArray(plan.edits)||!Array.isArray(plan.creates)||plan.edits.length+plan.creates.length>16)throw Error('Invalid change plan.');
 const pending=new Map();
 for(const edit of plan.edits){if(!allowed(edit.path)||typeof edit.find!=='string'||!edit.find||typeof edit.replace!=='string'||edit.find.length+edit.replace.length>80000)throw Error('Unsupported edit.');const file=path.join(root,edit.path);if(fs.realpathSync(file)!==file)throw Error('Symlinks are not allowed.');const text=pending.get(file)??fs.readFileSync(file,'utf8');if(text.split(edit.find).length!==2)throw Error('Edit anchor must match exactly once: '+edit.path);pending.set(file,text.replace(edit.find,()=>edit.replace));}
 for(const row of plan.creates){if(!allowed(row.path)||typeof row.content!=='string'||row.content.length>80000)throw Error('Unsupported new file.');const file=path.join(root,row.path);if(fs.existsSync(file)||pending.has(file))throw Error('New file already exists.');let ancestor=path.dirname(file);while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);if(fs.realpathSync(ancestor)!==ancestor)throw Error('Symlinks are not allowed.');pending.set(file,row.content);}
 if(!pending.size)throw Error('No changes were proposed.');for(const [file,content]of pending){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}return [...pending.keys()].map(file=>path.relative(root,file));
}
module.exports={allowed,applyPlan};
