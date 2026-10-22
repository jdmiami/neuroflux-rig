import { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, Mp4OutputFormat,
  WavOutputFormat, Conversion, AudioSample, AudioSampleSource } from 'mediabunny';
import { FFmpeg } from '@ffmpeg/ffmpeg';

function scaledAudio(sample, volume) {
  const data = new Float32Array(sample.numberOfFrames * sample.numberOfChannels);
  sample.copyTo(data, { planeIndex: 0, format: 'f32' });
  for (let i = 0; i < data.length; i++) data[i] = Math.max(-1, Math.min(1, data[i] * volume));
  return new AudioSample({ data, format: 'f32', numberOfChannels: sample.numberOfChannels,
    sampleRate: sample.sampleRate, timestamp: sample.timestamp });
}

async function mixStems(source, stems, job, duration) {
  const sampleRate = stems[0].sampleRate, channels = 2;
  const start = Math.round(job.start * sampleRate), end = Math.round((job.end || duration) * sampleRate);
  for (let frame = start; frame < end; frame += 4096) {
    const count = Math.min(4096, end - frame), data = new Float32Array(count * channels);
    for (const stem of stems) {
      const gain = (stem.source === 'music' ? job.musicGain : job.micGain) * job.volume;
      if (!gain) continue;
      const offset = Math.round((stem.source === 'mic' ? job.micOffset || 0 : 0) * sampleRate);
      const readAt = frame - offset, readStart = Math.max(0, readAt), readEnd = Math.max(0, readAt + count);
      const bytes = await stem.blob.slice(44 + readStart * 4, 44 + readEnd * 4).arrayBuffer();
      const samples = new Int16Array(bytes);
      const padding = Math.max(0, -readAt) * 2;
      for (let i = 0; i < samples.length && i + padding < data.length; i++) data[i + padding] += samples[i] / 32768 * gain;
    }
    for (let i = 0; i < data.length; i++) data[i] = Math.max(-1, Math.min(1, data[i]));
    const sample = new AudioSample({ data, format: 'f32', numberOfChannels: 2,
      sampleRate, timestamp: (frame - start) / sampleRate });
    await source.add(sample); sample.close();
  }
  source.close();
}

async function nativeExport(blob, job, stems) {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const target = new BufferTarget(), audioOnly = job.format === 'wav';
  const output = new Output({ target, format: audioOnly ? new WavOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }) });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioOnly && !videoTrack) throw new Error('Choose WAV for an audio-only take.');
    if (audioOnly && !audioTrack && !stems.length) throw new Error('This take has no audio. Choose a companion audio file.');
    const remix = stems.length > 0 && job.remix && job.format !== 'silent';
    const options = { input, output, tracks: 'primary',
      video: audioOnly ? { discard: true } : { codec: 'avc', width: job.width, height: job.height,
        fit: job.fit === 'crop' ? 'cover' : 'contain', allowTransformationMetadata: false },
      audio: job.format === 'silent' || remix ? { discard: true } : {
        codec: audioOnly ? 'pcm-s16' : 'aac',
        ...(job.volume !== 1 ? { process: sample => scaledAudio(sample, job.volume) } : {}),
      },
      trim: { ...(job.start > 0 ? { start: job.start } : {}), ...(job.end > 0 ? { end: job.end } : {}) },
      composable: remix,
    };
    const conversion = await Conversion.init(options);
    const essentialDiscard = conversion.discardedTracks.filter(t => !((t.track.type === 'audio' && (remix || job.format === 'silent')) || (t.track.type === 'video' && audioOnly)));
    if ((!conversion.isValid && !remix) || essentialDiscard.length)
      throw new Error('Hardware codecs unavailable for this export. Trying the local software converter.');
    conversion.onProgress = progress => self.postMessage({ type: 'progress', progress });
    if (remix) {
      if (stems.some(s => s.sampleRate !== stems[0].sampleRate)) throw new Error('Companion sample rates do not match.');
      const source = new AudioSampleSource({ codec: audioOnly ? 'pcm-s16' : 'aac', bitrate: 192000 });
      output.addAudioTrack(source);
      await output.start();
      await Promise.all([conversion.execute(), mixStems(source, stems, job, job.duration)]);
      await output.finalize();
    } else await conversion.execute();
    return new Blob([target.buffer], { type: audioOnly ? 'audio/wav' : 'video/mp4' });
  } finally { input.dispose(); }
}

async function softwareExport(blob, job, stems) {
  const total = blob.size + stems.reduce((sum, s) => sum + (job.remix ? s.blob.size : 0), 0);
  if (total > 64 * 1024 * 1024) throw new Error('Software conversion is limited to 64 MB of source files to protect device memory. Download the original or use a device with hardware codec support.');
  const ffmpeg = new FFmpeg();
  try {
    self.postMessage({ type: 'progress', progress: 0, message: 'Loading the local software converter…' });
    await ffmpeg.load({ classWorkerURL: new URL('/vendor/ffmpeg/worker.js', self.location.origin).href,
      coreURL: new URL('/vendor/ffmpeg-core/ffmpeg-core.js', self.location.origin).href,
      wasmURL: new URL('/vendor/ffmpeg-core/ffmpeg-core.wasm', self.location.origin).href });
    ffmpeg.on('progress', ({ progress }) => self.postMessage({ type: 'progress', progress: Math.max(0, Math.min(1, progress)) }));
    await ffmpeg.writeFile('input', new Uint8Array(await blob.arrayBuffer()));
    const args = ['-i', 'input'];
    const remix = job.remix && stems.length && job.format !== 'silent';
    if (remix) {
      for (let i = 0; i < stems.length; i++) {
        await ffmpeg.writeFile(`stem${i}.wav`, new Uint8Array(await stems[i].blob.arrayBuffer()));
        args.push('-i', `stem${i}.wav`);
      }
      const chains = stems.map((stem, i) => {
        const gain = (stem.source === 'music' ? job.musicGain : job.micGain) * job.volume;
        const delay = stem.source === 'mic' ? job.micOffset || 0 : 0;
        const timing = delay > 0 ? `,adelay=${Math.round(delay * 1000)}:all=1` : delay < 0 ? `,atrim=start=${-delay},asetpts=PTS-STARTPTS` : '';
        return `[${i + 1}:a]volume=${gain}${timing}[a${i}]`;
      });
      chains.push(`${stems.map((_, i) => `[a${i}]`).join('')}amix=inputs=${stems.length}:normalize=0:duration=longest,alimiter=level=false[mix]`);
      args.push('-filter_complex', chains.join(';'), '-map', '0:v?', '-map', '[mix]');
    } else args.push('-map', '0:v?', '-map', '0:a?');
    if (job.start > 0) args.push('-ss', String(job.start));
    if (job.end > 0) args.push('-t', String(job.end - job.start));
    if (job.format === 'wav') args.push('-vn', '-c:a', 'pcm_s16le');
    else {
      if (job.width && job.height) args.push('-vf', job.fit === 'crop'
        ? `scale=${job.width}:${job.height}:force_original_aspect_ratio=increase,crop=${job.width}:${job.height},setsar=1`
        : `scale=${job.width}:${job.height}:force_original_aspect_ratio=decrease,pad=${job.width}:${job.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`);
      args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
      if (job.format === 'silent') args.push('-an'); else args.push('-c:a', 'aac', '-b:a', '192k');
    }
    if (!remix && job.volume !== 1 && job.format !== 'silent') args.push('-af', `volume=${job.volume}`);
    const filename = job.format === 'wav' ? 'output.wav' : 'output.mp4';
    args.push('-y', filename);
    const code = await ffmpeg.exec(args, 300000);
    if (code !== 0) throw new Error('Software export failed or exceeded five minutes. The original recording is still saved.');
    const data = await ffmpeg.readFile(filename);
    return new Blob([data], { type: job.format === 'wav' ? 'audio/wav' : 'video/mp4' });
  } finally { ffmpeg.terminate(); }
}

self.onmessage = async ({ data: { blob, job, stems = [] } }) => {
  try {
    const total = blob.size + stems.reduce((n, s) => n + (job.remix ? s.blob.size : 0), 0);
    if (total > job.memoryLimit) throw new Error('This export exceeds the device memory safety limit. Download the original, or make a shorter recording.');
    let result;
    try { result = await nativeExport(blob, job, stems); }
    catch (error) {
      self.postMessage({ type: 'progress', progress: 0, message: `Using local software conversion. ${error.message}` });
      result = await softwareExport(blob, job, stems);
    }
    self.postMessage({ type: 'complete', blob: result });
  } catch (error) { self.postMessage({ type: 'error', message: error.message || String(error) }); }
};
