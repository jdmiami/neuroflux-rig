/** Browser-only data contracts. No server or publishing API is introduced. */
export interface OutputProfile {
  id: 'a' | 'b'; preset: string; width: number; height: number; fps: 24 | 30 | 60;
  rotation: 0 | 90 | 180 | 270; mode: 'clean' | 'minimal' | 'full';
  fit: 'render' | 'fit' | 'crop'; zoom: number; panX: number; panY: number;
  background: string; sourceAspect?: number; guide: boolean;
  scene: boolean; bpm: boolean; palette: boolean; meter: boolean;
  lyrics: boolean; hands: boolean; title: string; branding: string;
  audio: 'mix' | 'music' | 'mic' | 'silent';
}
export interface AudioMix {
  music: number; mic: number; muted: boolean; musicMuted: boolean; micMuted: boolean;
  musicMonitor: number; micMonitor: number; offset: number;
}
export interface RecordingAsset {
  id: string; group?: string; name: string; created: number;
  kind: 'video' | 'audio' | 'image'; mime: string;
  status: 'recording' | 'complete' | 'interrupted'; storage: 'opfs' | 'idb';
  count: number; bytes: number; duration: number; width?: number; height?: number; fps?: number;
  profile?: OutputProfile; markers: { time: number; label: string }[];
  pcm?: boolean; sampleRate?: number; channels?: number; source?: 'music' | 'mic' | 'mix';
  thumbnail?: Blob; thumbnailTime?: number; derivedFrom?: string; warning?: string;
}
export interface CaptureSettings {
  kind: 'video' | 'audio'; countdown: number; limit: number;
  dual: boolean; stems: boolean; mixed: boolean;
}
export interface ExportJob {
  start: number; end: number; duration: number; volume: number;
  format: 'mp4' | 'silent' | 'wav'; width?: number; height?: number;
  fit: 'fit' | 'crop'; remix: boolean; musicGain: number; micGain: number;
  micOffset: number; memoryLimit: number;
}
export type ExportEvent = { type: 'progress'; progress: number; message?: string }
  | { type: 'complete'; blob: Blob } | { type: 'error'; message: string };
