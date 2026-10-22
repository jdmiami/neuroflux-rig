import { dimensions, validateProfile } from './profiles.js';

export function recordingMime(audio = true) {
  const choices = audio ? ['video/mp4;codecs=avc1.42001E,mp4a.40.2', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.42001E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return choices.find(type => globalThis.MediaRecorder?.isTypeSupported(type)) || '';
}

class SavedRecorder {
  constructor(store, asset, fail) { this.store = store; this.asset = asset; this.fail = fail; this.pending = Promise.resolve(); this.failed = false; }
  save(blob) {
    this.pending = this.pending.then(() => {
      this.asset.duration = this.asset.pcm ? (this.asset.bytes + blob.size) / (this.asset.sampleRate * this.asset.channels * 2) : this.clock?.() || 0;
      this.asset.markers = this.marks?.() || [];
      return this.store.append(this.asset, blob);
    }).catch(error => {
      if (!this.failed) { this.failed = true; this.fail(error); }
    });
  }
  async finish(duration, markers) {
    await this.pending;
    this.asset.duration = this.asset.pcm ? this.asset.bytes / (this.asset.sampleRate * this.asset.channels * 2) : duration;
    this.asset.markers = markers;
    this.asset.status = this.failed ? 'interrupted' : 'complete';
    if (!this.asset.bytes) { await this.store.remove(this.asset.id); return null; }
    await this.store.put(this.asset); return this.asset;
  }
}

class VideoRecorder extends SavedRecorder {
  async prepare(output, mixer, group, name) {
    const p = output.profile, hasAudio = p.audio !== 'silent';
    const mime = recordingMime(hasAudio);
    if (!mime) throw new Error('This browser cannot record canvas video. Try current Chrome or Safari.');
    this.stream = output.canvas.captureStream(p.fps);
    this.ownTracks = [...this.stream.getTracks()];
    if (hasAudio) for (const track of mixer.stream(p.audio).getAudioTracks()) this.stream.addTrack(track.clone());
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime,
      videoBitsPerSecond: Math.round(p.width * p.height * p.fps * 0.12), audioBitsPerSecond: 192000 });
    this.asset = await this.store.create({ group, name, kind: 'video', mime: this.recorder.mimeType,
      profile: structuredClone(p), ...dimensions(p), fps: p.fps });
    this.recorder.ondataavailable = event => { if (event.data.size) this.save(event.data); };
    this.recorder.onerror = event => { this.failed = true; this.fail(event.error || new Error('Video recorder failed.')); };
  }
  start() { this.recorder.start(1000); }
  pause() { if (this.recorder.state === 'recording') this.recorder.pause(); }
  resume() { if (this.recorder.state === 'paused') this.recorder.resume(); }
  async stop() {
    try {
      if (this.recorder.state !== 'inactive') await new Promise(resolve => {
        this.recorder.addEventListener('stop', resolve, { once: true }); this.recorder.stop();
      });
    } finally { this.stream?.getTracks().forEach(t => t.stop()); }
    await this.pending;
  }
}

class PCMRecorder extends SavedRecorder {
  async prepare(context, source, group, name, sourceName) {
    this.context = context; this.source = source;
    this.asset = await this.store.create({ group, name, kind: 'audio', mime: 'audio/wav',
      pcm: true, sampleRate: context.sampleRate, channels: 2, source: sourceName });
    this.node = new AudioWorkletNode(context, 'neuroflux-pcm', { numberOfInputs: 1,
      numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
    this.silent = context.createGain(); this.silent.gain.value = 0;
    source.connect(this.node); this.node.connect(this.silent); this.silent.connect(context.destination);
    this.node.port.onmessage = ({ data }) => {
      if (data.samples) {
        if (this.asset.bytes > 0xffffffff - 1048576) this.fail(new Error('WAV is approaching its 4 GB limit.'));
        else this.save(new Blob([data.samples]));
      }
      if (data.stopped) this.resolveStop?.();
    };
  }
  start() { this.node.port.postMessage({ type: 'start', time: this.context.currentTime }); }
  pause() { this.node.port.postMessage({ type: 'pause' }); }
  resume() { this.node.port.postMessage({ type: 'resume' }); }
  async stop() {
    await new Promise(resolve => {
      const timer = setTimeout(() => { this.failed = true; resolve(); }, 3000);
      this.resolveStop = () => { clearTimeout(timer); resolve(); }; this.node.port.postMessage({ type: 'stop' });
    });
    try { this.source.disconnect(this.node); } catch {}
    this.node.disconnect(); this.silent.disconnect(); this.node.port.close(); await this.pending;
  }
}

export class CaptureSession {
  constructor(store, mixer, onError) { this.store = store; this.mixer = mixer; this.onError = onError; this.recorders = []; this.markers = []; this.status = 'preparing'; }
  async prepare(outputs, settings) {
    const space = await this.store.space();
    if (space.free < 64 * 1024 * 1024) throw new Error('Less than 64 MB of device storage remains. Delete recordings or free some space.');
    if (space.free !== Infinity && settings.limit > 0) {
      const estimated = outputs.reduce((n, o) => n + o.profile.width * o.profile.height * o.profile.fps * 0.12 / 8, 0) * settings.limit;
      if (estimated > space.free * 0.8) throw new Error('The selected duration may exceed available storage. Shorten the limit or choose a smaller output.');
    }
    await this.mixer.init();
    const group = crypto.randomUUID(), stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const fail = error => { this.error = error; this.onError(error); };
    this.settings = settings;
    try {
      if (settings.kind !== 'audio') for (const output of outputs) {
        validateProfile(output.profile);
        const recorder = new VideoRecorder(this.store, null, fail); this.recorders.push(recorder);
        recorder.clock = () => this.seconds; recorder.marks = () => this.markers;
        await recorder.prepare(output, this.mixer, group, `Neuroflux ${stamp} · ${output.profile.id.toUpperCase()}`);
      }
      const stems = settings.kind === 'audio' ? ['mix'] : [];
      if (settings.mixed && !stems.includes('mix')) stems.push('mix');
      if (settings.stems) stems.push('music', 'mic');
      if (stems.length) {
        if (!this.mixer.context.audioWorklet) throw new Error('Separate WAV capture needs AudioWorklet on HTTPS or localhost.');
        if (!this.mixer.workletReady) {
          await this.mixer.context.audioWorklet.addModule('/pcm.worklet.js'); this.mixer.workletReady = true;
        }
        for (const name of stems) {
          const recorder = new PCMRecorder(this.store, null, fail); this.recorders.push(recorder);
          recorder.marks = () => this.markers;
          await recorder.prepare(this.mixer.context, this.mixer.stem(name), group, `Neuroflux ${stamp} · ${name.toUpperCase()}`, name);
        }
      }
      this.group = group;
    } catch (error) { await this.abort(); throw error; }
  }
  start() {
    this.started = performance.now(); this.pausedMs = 0; this.status = 'recording';
    try { for (const r of this.recorders) r.start(); }
    catch (error) { this.error = error; this.onError(error); throw error; }
  }
  get seconds() {
    if (!this.started) return 0;
    return Math.max(0, ((this.pausedAt || this.ended || performance.now()) - this.started - this.pausedMs) / 1000);
  }
  pause() {
    if (this.status !== 'recording') return;
    this.pausedAt = performance.now(); this.status = 'paused'; this.recorders.forEach(r => r.pause());
  }
  resume() {
    if (this.status !== 'paused') return;
    this.pausedMs += performance.now() - this.pausedAt; this.pausedAt = 0;
    this.recorders.forEach(r => r.resume()); this.status = 'recording';
  }
  mark() { this.markers.push({ time: this.seconds, label: `Marker ${this.markers.length + 1}` }); }
  async stop() {
    if (this.stopping) return this.stopping;
    this.ended = performance.now(); const duration = this.seconds; this.status = 'saving';
    this.stopping = (async () => {
      await Promise.all(this.recorders.map(async r => { try { await r.stop(); } catch (error) { r.failed = true; this.error ||= error; } }));
      const assets = [];
      for (const r of this.recorders) if (r.asset) {
        if (this.error) r.failed = true;
        const asset = await r.finish(duration, this.markers); if (asset) assets.push(asset);
      }
      this.status = 'stopped'; return assets;
    })();
    return this.stopping;
  }
  async abort() {
    if (this.aborted) return;
    this.aborted = true;
    await Promise.allSettled(this.recorders.map(async r => {
      if (r.node) await r.stop();
      r.stream?.getTracks().forEach(t => t.stop());
      if (r.asset) await this.store.remove(r.asset.id);
    }));
  }
}
