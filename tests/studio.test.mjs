import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, profile, dimensions, validateProfile, formatTime, formatBytes } from '../src/studio/profiles.js';
import { wavHeader } from '../src/studio/storage.js';
import { recordingMime } from '../src/studio/capture.js';

globalThis.matchMedia = () => ({ matches: false });

test('platform presets keep even, valid dimensions and independent profiles', () => {
  for (const key of Object.keys(PRESETS)) validateProfile(profile('a', key));
  const a = profile('a'), b = profile('b', 'tiktok'); a.mode = 'full';
  assert.equal(b.mode, 'clean'); assert.equal(a.audio, 'mix');
  assert.deepEqual(dimensions(b), { width: 1080, height: 1920 });
});
test('rotation swaps encoded dimensions exactly once', () => {
  const p = profile('a');
  for (const rotation of [0,90,180,270]) {
    p.rotation = rotation;
    assert.deepEqual(dimensions(p), rotation % 180 ? { width:1080,height:1920 } : { width:1920,height:1080 });
  }
});
test('unsafe dimensions and invalid frame rates fail before allocation', () => {
  for (const change of [{ width: 1919 }, { height: 0 }, { width: 4000 }, { fps: 120 }, { rotation: 45 }, { width:3840,height:3840 }])
    assert.throws(() => validateProfile({ ...profile('a'), ...change }));
  globalThis.matchMedia = () => ({ matches: true });
  assert.throws(() => validateProfile({ ...profile('a'), width:3840,height:2160 }), /desktop/);
  globalThis.matchMedia = () => ({ matches: false });
});
test('WAV headers describe the actual saved PCM payload and reject overflow', () => {
  const header = wavHeader(192000, 48000, 2), view = new DataView(header);
  assert.equal(new TextDecoder().decode(header.slice(0,4)), 'RIFF');
  assert.equal(new TextDecoder().decode(header.slice(8,12)), 'WAVE');
  assert.equal(view.getUint32(4,true),192036);
  assert.equal(view.getUint16(22,true),2); assert.equal(view.getUint32(24,true),48000);
  assert.equal(view.getUint32(40,true),192000);
  assert.throws(() => wavHeader(0xffffffff), /4 GB/);
});
test('MIME negotiation never pretends a WebM recording is MP4', () => {
  globalThis.MediaRecorder = { isTypeSupported: type => type.startsWith('video/webm;codecs=vp8') };
  assert.equal(recordingMime(), 'video/webm;codecs=vp8,opus');
  globalThis.MediaRecorder = { isTypeSupported: () => false };
  assert.equal(recordingMime(), ''); delete globalThis.MediaRecorder;
});
test('recording status formatting handles zero and long takes', () => {
  assert.equal(formatTime(0), '0:00'); assert.equal(formatTime(3661), '61:01');
  assert.equal(formatBytes(1500000), '1.5 MB');
});
