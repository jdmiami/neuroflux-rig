export const PRESETS = {
  youtube: { name: 'YouTube · landscape', width: 1920, height: 1080, guide: 'wide' },
  tiktok: { name: 'TikTok · vertical', width: 1080, height: 1920, guide: 'vertical' },
  reels: { name: 'Instagram Reels', width: 1080, height: 1920, guide: 'vertical' },
  shorts: { name: 'YouTube Shorts', width: 1080, height: 1920, guide: 'vertical' },
  stories: { name: 'Instagram Stories', width: 1080, height: 1920, guide: 'story' },
  square: { name: 'Instagram · square', width: 1080, height: 1080, guide: 'feed' },
  feed: { name: 'Instagram · portrait feed', width: 1080, height: 1350, guide: 'feed' },
  custom: { name: 'Custom', width: 1920, height: 1080, guide: 'wide' },
};
export function profile(id, preset = 'youtube') {
  return { id, preset, width: PRESETS[preset].width, height: PRESETS[preset].height,
    fps: 30, rotation: 0, mode: 'clean', fit: 'render', zoom: 1, panX: 0, panY: 0,
    background: '#04050b', guide: true, scene: true, bpm: true, palette: false,
    meter: true, lyrics: false, hands: false, title: '', branding: '', audio: 'mix' };
}
export function dimensions(p) {
  const sideways = p.rotation === 90 || p.rotation === 270;
  return { width: sideways ? p.height : p.width, height: sideways ? p.width : p.height };
}
export function validateProfile(p) {
  for (const key of ['width', 'height']) if (!Number.isInteger(p[key]) || p[key] < 128 || p[key] > 3840 || p[key] % 2)
    throw new Error('Use even dimensions between 128 and 3840 pixels.');
  if (p.width * p.height > 3840 * 2160) throw new Error('Output cannot exceed 4K pixel count.');
  if (![24, 30, 60].includes(p.fps)) throw new Error('Choose 24, 30, or 60 fps.');
  if (![0, 90, 180, 270].includes(p.rotation)) throw new Error('Invalid rotation.');
  if (!['clean', 'minimal', 'full'].includes(p.mode) || !['render', 'fit', 'crop'].includes(p.fit)) throw new Error('Invalid output composition.');
  if (!['mix', 'music', 'mic', 'silent'].includes(p.audio)) throw new Error('Choose an available output audio mix.');
  if (!Number.isFinite(p.zoom) || p.zoom < 1 || p.zoom > 2 || ![p.panX, p.panY].every(n => Number.isFinite(n) && Math.abs(n) <= 1))
    throw new Error('Choose supported zoom and framing values.');
  if (matchMedia('(pointer:coarse)').matches && p.width * p.height > 2560 * 1440)
    throw new Error('4K is a desktop option. Choose 1080p or 720p on this device.');
}
export const formatTime = seconds => {
  seconds = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
export const formatBytes = n => n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`;
