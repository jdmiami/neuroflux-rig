const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/app.html'));
const output = path.join(root, 'public');
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
