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
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(path.join(root, 'src/update.html'), path.join(output, 'update.html'));
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
const assets = ['/','/index.html','/studio.js','/studio.css','/guide.js','/guide.css','/guide-index.json','/manual.html','/export.worker.js','/pcm.worklet.js',
  ...chunks.map(p => '/' + path.basename(p)), '/THIRD-PARTY-NOTICES.txt'];
assets.push(...fs.readdirSync(path.join(output, 'vendor-licenses')).map(name => '/vendor-licenses/' + name));
assets.push(...fs.readdirSync(path.join(output, 'manual-assets')).map(name => '/manual-assets/' + name));
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(name);
    else if (/\.(js|wasm)$/.test(name)) assets.push('/' + path.relative(output, name).split(path.sep).join('/'));
  }
}
walk(path.join(output, 'vendor'));
const hash = crypto.createHash('sha256');
for (const asset of assets.filter(a => a !== '/')) hash.update(fs.readFileSync(path.join(output, asset)));
const worker = fs.readFileSync(path.join(root, 'src/studio/sw.js'), 'utf8')
  .replace('__NFX_CACHE_VERSION__', hash.digest('hex').slice(0,16))
  .replace('__NFX_ASSETS__', JSON.stringify(assets));
fs.writeFileSync(path.join(output, 'sw.js'), worker);
