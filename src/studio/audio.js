export class OutputMixer {
  constructor(rig) {
    this.rig = rig;
    this.settings = { music: 1, mic: 1, muted: false, musicMuted: false, micMuted: false,
      musicMonitor: 0.9, micMonitor: 0, offset: 0 };
  }
  async init() {
    const audio = this.rig.audio();
    if (!audio.context) throw new Error('Web Audio is unavailable in this browser.');
    if (this.context) { await this.context.resume(); this.sync(); return; }
    const ctx = this.context = audio.context;
    this.musicRaw = ctx.createGain(); this.micRaw = ctx.createGain();
    this.music = ctx.createGain(); this.mic = ctx.createGain(); this.mix = ctx.createGain();
    this.musicDelay = ctx.createDelay(1); this.micDelay = ctx.createDelay(1);
    this.micMonitor = ctx.createGain(); this.micMonitor.gain.value = 0;
    this.musicRaw.connect(this.music); this.micRaw.connect(this.mic);
    this.music.connect(this.musicDelay); this.mic.connect(this.micDelay);
    this.musicDelay.connect(this.mix); this.micDelay.connect(this.mix);
    this.micRaw.connect(this.micMonitor); this.micMonitor.connect(ctx.destination);
    this.destinations = {};
    for (const name of ['mix', 'music', 'mic']) {
      const dest = ctx.createMediaStreamDestination();
      (name === 'music' ? this.musicDelay : name === 'mic' ? this.micDelay : this.mix).connect(dest);
      this.destinations[name] = dest;
    }
    this.analysers = {};
    for (const name of ['music', 'mic', 'mix']) {
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      this[name].connect(analyser); this.analysers[name] = analyser;
    }
    this.sync(); this.apply(); await ctx.resume();
  }
  sync() {
    if (!this.context) return;
    const audio = this.rig.audio();
    const signature = `${audio.kind}:${this.ownedMic ? 'extra' : 'none'}`;
    if (this.signature === signature) return;
    for (const [source, destination] of this.connections || []) { try { source.disconnect(destination); } catch {} }
    this.connections = [];
    const connect = (source, destination) => { if (source) { source.connect(destination); this.connections.push([source, destination]); } };
    connect(audio.music, this.musicRaw);
    if (audio.kind === 'sys') connect(audio.live, this.musicRaw);
    if (audio.kind === 'mic') connect(audio.live, this.micRaw);
    else if (this.ownedMic) connect(this.ownedMic, this.micRaw);
    this.signature = signature;
  }
  async enableMicrophone(deviceId) {
    await this.init();
    if (this.rig.audio().kind === 'mic' && !deviceId) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is unavailable.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId
      ? { deviceId: { exact: deviceId }, echoCancellation: true } : { echoCancellation: true } });
    this.disableMicrophone(); this.micStream = stream;
    this.ownedMic = this.context.createMediaStreamSource(stream);
    for (const track of stream.getAudioTracks()) track.onended = () => this.onInputEnded?.();
    this.signature = ''; this.sync();
  }
  disableMicrophone() {
    if (this.ownedMic) { try { this.ownedMic.disconnect(); } catch {} }
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micStream = null; this.ownedMic = null; this.signature = ''; if (this.context) this.sync();
  }
  apply() {
    if (!this.context) return;
    const s = this.settings, now = this.context.currentTime;
    this.music.gain.setTargetAtTime(s.musicMuted ? 0 : s.music, now, 0.01);
    this.mic.gain.setTargetAtTime(s.micMuted ? 0 : s.mic, now, 0.01);
    this.mix.gain.setTargetAtTime(s.muted ? 0 : 1, now, 0.01);
    this.musicDelay.delayTime.value = Math.max(0, s.offset / 1000);
    this.micDelay.delayTime.value = Math.max(0, -s.offset / 1000);
    this.micMonitor.gain.setTargetAtTime(s.micMonitor, now, 0.01);
    this.rig.monitor(s.musicMonitor);
  }
  levels() {
    const result = {};
    for (const [name, analyser] of Object.entries(this.analysers || {})) {
      const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
      result[name] = Math.max(...data.map(Math.abs));
    }
    return result;
  }
  stream(name) { return this.destinations[name]?.stream; }
  stem(name) { return name === 'music' ? this.musicRaw : name === 'mic' ? this.micRaw : this.mix; }
}
