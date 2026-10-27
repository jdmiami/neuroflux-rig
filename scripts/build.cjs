const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const adapter = ['rig-render.js', 'rig-adapter.js'].map(name => fs.readFileSync(path.join(root, 'src/studio', name), 'utf8')).join('\n');
const template = fs.readFileSync(path.join(root, 'src/app.html'), 'utf8');
if (!template.includes('/* NFX_STUDIO_ADAPTER */')) throw new Error('Studio adapter insertion point missing.');
const source = Buffer.from(template.replace('/* NFX_STUDIO_ADAPTER */', adapter));
const output = path.join(root, 'public');
esbuild.buildSync({entryPoints:[path.join(root,'src/showcase/app.js')],bundle:true,outfile:path.join(output,'showcase/app.js'),format:'iife',target:'es2022',minify:true});
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(path.join(root, 'src/update.html'), path.join(output, 'update.html'));
esbuild.buildSync({entryPoints:[path.join(root,'src/performance.js')],bundle:true,outfile:path.join(output,'performance.js'),format:'iife',target:'es2022',minify:true});
esbuild.buildSync({entryPoints:[path.join(root,'src/camera/vision.worker.js')],bundle:true,outfile:path.join(output,'vision.worker.js'),format:'iife',target:'es2022',minify:true});
fs.copyFileSync(path.join(root,'src/performance/performance.css'),path.join(output,'performance.css'));
fs.cpSync(path.join(root,'node_modules/@mediapipe/tasks-vision/wasm'),path.join(output,'vendor/vision/wasm'),{recursive:true});
esbuild.buildSync({ entryPoints: [path.join(root, 'src/studio.js')], bundle: true,
  outfile: path.join(output, 'studio.js'), format: 'iife', target: 'es2022', minify: true });
esbuild.buildSync({ entryPoints: [path.join(root, 'src/guide.js')], bundle: true,
  outfile: path.join(output, 'guide.js'), format: 'iife', target: 'es2022', minify: true });
fs.copyFileSync(path.join(root, 'src/guide/guide.css'), path.join(output, 'guide.css'));
esbuild.buildSync({ entryPoints: [path.join(root, 'src/studio/export.worker.js')], bundle: true,
  outfile: path.join(output, 'export.worker.js'), format: 'esm', target: 'es2022', minify: true });
fs.copyFileSync(path.join(root, 'src/studio/studio.css'), path.join(output, 'studio.css'));
fs.copyFileSync(path.join(root, 'src/studio/pcm.worklet.js'), path.join(output, 'pcm.worklet.js'));
for (const [pkg, destination] of [['@ffmpeg/ffmpeg/dist/esm', 'ffmpeg'], ['@ffmpeg/core/dist/esm', 'ffmpeg-core']]) {
  fs.cpSync(path.join(root, 'node_modules', pkg), path.join(output, 'vendor', destination), { recursive: true });
}
fs.copyFileSync(path.join(root, 'src/studio/THIRD-PARTY-NOTICES.txt'), path.join(output, 'THIRD-PARTY-NOTICES.txt'));
fs.cpSync(path.join(root, 'src/studio/vendor-licenses'), path.join(output, 'vendor-licenses'), { recursive: true });
const chunks = Array.from({ length: 5 }, (_, i) => path.join(output, `c${i}.bin`));
let unchanged = false;
try {
  unchanged = zlib.gunzipSync(Buffer.concat(chunks.map(p => fs.readFileSync(p)))).equals(source);
} catch {}
if (!unchanged) {
  const payload = zlib.gzipSync(source, { level: 9 });
  const size = Math.ceil(payload.length / chunks.length);
  chunks.forEach((file, i) => fs.writeFileSync(file, payload.subarray(i * size, (i + 1) * size)));
}
const decoded = zlib.gunzipSync(Buffer.concat(chunks.map(p => fs.readFileSync(p))));
if (!decoded.equals(source)) throw new Error('Browser payload does not match src/app.html');
console.log(`Built Neuroflux: ${source.length} bytes; ${unchanged ? 'original payload preserved' : 'payload regenerated'}.`);
// The boot shell discovers one immutable release. Old workers do not recognize
// these paths, so /launch.html can recover even a device stuck on a legacy shell.
const files=['studio.js','studio.css','performance.js','performance.css','vision.worker.js','guide.js','guide.css','guide-index.json','export.worker.js','pcm.worklet.js'];
const hash=crypto.createHash('sha256').update(fs.readFileSync(__filename)).update(source).update(fs.readFileSync(path.join(root,'src/boot.html'))).update(fs.readFileSync(path.join(root,'src/studio/sw.js')));
for(const file of files)hash.update(fs.readFileSync(path.join(output,file)));
const version=hash.digest('hex').slice(0,16),prefix='/releases/'+version+'/';
fs.mkdirSync(path.join(output,prefix),{recursive:true});
function versionLinks(text){for(const file of files)text=text.split('/'+file).join(prefix+file);return text;}
for(const file of files)fs.writeFileSync(path.join(output,prefix,file),versionLinks(fs.readFileSync(path.join(output,file),'utf8')));
fs.writeFileSync(path.join(output,prefix,'app.html'),versionLinks(source.toString()).replace('<head>','<head><meta name="neuroflux-release" content="'+version+'">'));
for(const name of ['index.html','launch.html'])fs.copyFileSync(path.join(root,'src/boot.html'),path.join(output,name));
fs.writeFileSync(path.join(output,'release.json'),JSON.stringify({version,app:prefix+'app.html'}));
const assets=['/','/index.html','/launch.html','/release.json','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png',prefix+'app.html',...files.map(f=>prefix+f)];
const worker=fs.readFileSync(path.join(root,'src/studio/sw.js'),'utf8').replace('__NFX_CACHE_VERSION__',version).replace('__NFX_ASSETS__',JSON.stringify(assets));
fs.writeFileSync(path.join(output,'sw.js'),worker);
console.log('Immutable release '+version+'; optional WASM downloads are cached on demand.');
