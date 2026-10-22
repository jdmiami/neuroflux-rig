const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const finished = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || new Error('Storage transaction failed.')); });

export function wavHeader(bytes, sampleRate = 48000, channels = 2) {
  if (bytes > 0xffffffff - 36) throw new Error('WAV exceeds its 4 GB format limit.');
  const buffer = new ArrayBuffer(44), view = new DataView(buffer);
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes + 36, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, bytes, true);
  return buffer;
}
export class RecordingStore {
  async open() {
    const opening = indexedDB.open('neuroflux-studio', 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore('assets', { keyPath: 'id' });
      opening.result.createObjectStore('chunks', { keyPath: ['id', 'index'] });
    };
    this.db = await request(opening);
    try { this.root = await (await navigator.storage.getDirectory()).getDirectoryHandle('neuroflux-recordings', { create: true }); } catch { this.root = null; }
    let locks;
    try { locks = await navigator.locks?.query?.(); } catch { /* Lock introspection is optional. */ }
    const captureInAnotherTab = locks?.held?.some(lock => lock.name === 'neuroflux-capture');
    for (const asset of await this.list()) if (asset.status === 'recording' && !captureInAnotherTab) {
      asset.status = 'interrupted'; asset.warning = 'Interrupted take: saved chunks may be playable. Keep the original before editing.';
      await this.put(asset);
    }
    return this;
  }
  async put(asset) { const tx = this.db.transaction('assets', 'readwrite'); tx.objectStore('assets').put(asset); await finished(tx); return asset; }
  async get(id) { return request(this.db.transaction('assets').objectStore('assets').get(id)); }
  async list() { return (await request(this.db.transaction('assets').objectStore('assets').getAll())).sort((a, b) => b.created - a.created); }
  async create(details) {
    const asset = { id: crypto.randomUUID(), created: Date.now(), count: 0, bytes: 0,
      duration: 0, status: 'recording', storage: this.root ? 'opfs' : 'idb', markers: [], ...details };
    return this.put(asset);
  }
  async append(asset, blob) {
    if (!blob.size) return;
    if (asset.storage === 'opfs') {
      const directory = await this.root.getDirectoryHandle(asset.id, { create: true });
      const handle = await directory.getFileHandle(String(asset.count), { create: true });
      const writer = await handle.createWritable();
      try { await writer.write(blob); await writer.close(); } catch (error) { await writer.abort().catch(() => {}); throw error; }
      asset.count++; asset.bytes += blob.size; await this.put(asset);
    } else {
      const tx = this.db.transaction(['assets', 'chunks'], 'readwrite');
      tx.objectStore('chunks').put({ id: asset.id, index: asset.count, blob });
      asset.count++; asset.bytes += blob.size; tx.objectStore('assets').put(asset); await finished(tx);
    }
  }
  async blob(asset) {
    const chunks = [];
    if (asset.storage === 'opfs') {
      if (!this.root) throw new Error('Device recording storage is unavailable.');
      const directory = await this.root.getDirectoryHandle(asset.id);
      for (let i = 0; i < asset.count; i++) chunks.push(await (await directory.getFileHandle(String(i))).getFile());
    } else {
      for (let i = 0; i < asset.count; i++) {
        const chunk = await request(this.db.transaction('chunks').objectStore('chunks').get([asset.id, i]));
        if (!chunk) throw new Error('A saved recording chunk is missing.');
        chunks.push(chunk.blob);
      }
    }
    if (asset.pcm) chunks.unshift(wavHeader(asset.bytes, asset.sampleRate, asset.channels));
    return new Blob(chunks, { type: asset.mime });
  }
  async remove(id) {
    const asset = await this.get(id);
    if (asset?.storage === 'opfs' && this.root) await this.root.removeEntry(id, { recursive: true }).catch(() => {});
    const tx = this.db.transaction(['assets', 'chunks'], 'readwrite');
    tx.objectStore('assets').delete(id);
    tx.objectStore('chunks').delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    await finished(tx);
  }
  async saveBlob(blob, details) {
    const asset = await this.create({ ...details, mime: blob.type });
    try {
      for (let i = 0; i < blob.size; i += 1024 * 1024) await this.append(asset, blob.slice(i, i + 1024 * 1024));
      asset.status = 'complete'; return await this.put(asset);
    } catch (error) { asset.status = 'interrupted'; await this.put(asset); throw error; }
  }
  async space() {
    let estimate;
    try { estimate = await navigator.storage?.estimate?.(); } catch { /* Some private contexts do not expose estimates. */ }
    const { quota = 0, usage = 0 } = estimate || {};
    return { quota, usage, free: quota ? Math.max(0, quota - usage) : Infinity };
  }
}
