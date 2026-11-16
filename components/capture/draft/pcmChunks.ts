/**
 * The phone's microphone stream arrives as raw 16-bit PCM. For the live words it is cut into
 * short WAV clips that overlap a little, so a word spoken across a cut is heard whole in one of
 * them (joinTranscripts drops the repeat). Pure, so the cutting is tested without a microphone.
 */

/** How much new audio each live clip carries. */
export const LIVE_CLIP_MS = 1_000;

/** Audio repeated from the previous clip at the start of the next one. */
export const CLIP_OVERLAP_MS = 200;

/** 16-bit mono PCM wrapped in a WAV header, which the transcription endpoint reads directly. */
export function wavFromPcm16(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const wav = new Uint8Array(44 + dataBytes);
  const view = new DataView(wav.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return wav;
}

/** Loudness of a buffer from 0 to 1, for the waveform: root mean square against full scale, lifted so speech reads clearly. */
export function pcmLevel(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.min(1, (Math.sqrt(sum / samples.length) / 32768) * 4);
}

/**
 * Collects PCM and hands back a clip each time LIVE_CLIP_MS of new audio has arrived, each clip
 * starting CLIP_OVERLAP_MS before the new audio. flush() returns what is left at the end.
 */
export function createClipper(sampleRate: number, clipMs = LIVE_CLIP_MS, overlapMs = CLIP_OVERLAP_MS) {
  const clipSamples = Math.round((sampleRate * clipMs) / 1000);
  const overlapSamples = Math.round((sampleRate * overlapMs) / 1000);
  let pending: number[] = [];
  let tail = new Int16Array(0);

  const cut = (count: number) => {
    const fresh = Int16Array.from(pending.slice(0, count));
    pending = pending.slice(count);
    const clip = new Int16Array(tail.length + fresh.length);
    clip.set(tail);
    clip.set(fresh, tail.length);
    tail = clip.slice(Math.max(0, clip.length - overlapSamples));
    return clip;
  };

  return {
    push(samples: Int16Array): Int16Array[] {
      for (const sample of samples) pending.push(sample);
      const clips: Int16Array[] = [];
      while (pending.length >= clipSamples) clips.push(cut(clipSamples));
      return clips;
    },
    flush(): Int16Array | null {
      // Under a fifth of a second is too short to hold a word worth showing.
      return pending.length >= sampleRate / 5 ? cut(pending.length) : null;
    },
  };
}
