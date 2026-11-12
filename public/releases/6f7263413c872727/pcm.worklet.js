// 16-bit stereo WAV data in bounded batches. Uses the AudioContext clock.
class NeurofluxPCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.enabled = false; this.startAt = Infinity; this.offset = 0;
    this.buffer = new Int16Array(16384);
    this.port.onmessage = ({ data }) => {
      if (data.type === 'start') { this.enabled = true; this.startAt = data.time; }
      if (data.type === 'pause') this.enabled = false;
      if (data.type === 'resume') { this.enabled = true; this.startAt = 0; }
      if (data.type === 'stop') { this.enabled = false; this.flush(); this.port.postMessage({ stopped: true }); }
    };
  }
  flush() {
    if (!this.offset) return;
    const samples = this.buffer.slice(0, this.offset);
    this.port.postMessage({ samples: samples.buffer }, [samples.buffer]); this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!this.enabled || !input?.length) return true;
    const length = input[0].length;
    for (let i = 0; i < length; i++) {
      if (currentTime + i / sampleRate < this.startAt) continue;
      for (let c = 0; c < 2; c++) {
        const sample = Math.max(-1, Math.min(1, (input[c] || input[0])[i] || 0));
        this.buffer[this.offset++] = sample < 0 ? sample * 32768 : sample * 32767;
      }
      if (this.offset === this.buffer.length) this.flush();
    }
    return true;
  }
}
registerProcessor('neuroflux-pcm', NeurofluxPCM);
