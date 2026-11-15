/** What a phone records with RecordingPresets.HIGH_QUALITY: AAC in an .m4a. */
const PHONE_RECORDING_TYPE = "audio/m4a";

/**
 * The content type a recording is uploaded under. The backend picks the transcriber's decoder
 * from it, so it has to name the real container. A browser records whatever its MediaRecorder
 * supports (webm/opus in Chrome) and says which on the blob; a phone's file carries no type and
 * is always the preset's .m4a.
 */
export function recordingContentType(blobType: string): string {
  const type = blobType.split(";")[0].trim().toLowerCase();
  return type.startsWith("audio/") ? type : PHONE_RECORDING_TYPE;
}
