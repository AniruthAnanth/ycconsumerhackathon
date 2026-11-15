import { describe, expect, it } from "vitest";

import { recordingContentType } from "./recordingType";

describe("recordingContentType", () => {
  it("names the browser's own container without its codec parameters", () => {
    expect(recordingContentType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(recordingContentType("audio/ogg; codecs=opus")).toBe("audio/ogg");
    expect(recordingContentType("Audio/MP4")).toBe("audio/mp4");
  });

  it("is the phone's m4a when the file carries no audio type", () => {
    expect(recordingContentType("")).toBe("audio/m4a");
    expect(recordingContentType("application/octet-stream")).toBe("audio/m4a");
  });
});
