import { describe, expect, it, vi } from "vitest";

import type { Verdict } from "@/components/capture/backend";

import { contentTypeFor, stillTimes, submitProof, type ProofBackend } from "./submitProof";

const verdict: Verdict = {
  pass: true,
  confidence: 0.9,
  reason: "Clear shot of the finished run.",
  highlight: 0,
  caption: "Morning run",
  points: 40,
  closeCall: false,
};

function fakeBackend(overrides: Partial<ProofBackend> = {}): ProofBackend {
  let uploads = 0;
  return {
    generateUploadUrl: vi.fn(async () => "https://upload.test/url"),
    uploadMedia: vi.fn(async () => `storage-${++uploads}`),
    captureStill: vi.fn(async (_uri: string, timeMs: number) => `file:///still-${timeMs}.jpg`),
    verifyMedia: vi.fn(async () => verdict),
    verifyCanvas: vi.fn(async () => verdict),
    ...overrides,
  };
}

describe("submitProof", () => {
  it("uploads a photo as jpeg and verifies it by storage id", async () => {
    const backend = fakeBackend();
    const result = await submitProof(backend, "task-1", { mediaType: "photo", uri: "file:///a.jpg" });

    expect(result).toBe(verdict);
    expect(backend.uploadMedia).toHaveBeenCalledWith("https://upload.test/url", "file:///a.jpg", "image/jpeg");
    expect(backend.verifyMedia).toHaveBeenCalledWith({
      taskId: "task-1",
      storageId: "storage-1",
      mediaType: "photo",
      lat: undefined,
      lng: undefined,
    });
    expect(backend.captureStill).not.toHaveBeenCalled();
    expect(backend.verifyCanvas).not.toHaveBeenCalled();
  });

  it("passes coordinates through", async () => {
    const backend = fakeBackend();
    await submitProof(backend, "task-1", { mediaType: "photo", uri: "file:///a.jpg", lat: 37.77, lng: -122.42 });

    expect(backend.verifyMedia).toHaveBeenCalledWith(expect.objectContaining({ lat: 37.77, lng: -122.42 }));
  });

  it("uploads a video and three stills sampled across the clip", async () => {
    const backend = fakeBackend();
    await submitProof(backend, "task-1", {
      mediaType: "video",
      uri: "file:///clip.mov",
      durationMs: 10000,
      lat: 1,
      lng: 2,
    });

    expect(backend.captureStill).toHaveBeenCalledTimes(3);
    expect(backend.captureStill).toHaveBeenNthCalledWith(1, "file:///clip.mov", 1500);
    expect(backend.captureStill).toHaveBeenNthCalledWith(2, "file:///clip.mov", 5000);
    expect(backend.captureStill).toHaveBeenNthCalledWith(3, "file:///clip.mov", 8500);
    expect(backend.generateUploadUrl).toHaveBeenCalledTimes(4);
    expect(backend.uploadMedia).toHaveBeenCalledWith("https://upload.test/url", "file:///clip.mov", "video/quicktime");
    expect(backend.uploadMedia).toHaveBeenCalledWith("https://upload.test/url", "file:///still-1500.jpg", "image/jpeg");
    expect(backend.verifyMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "video",
        lat: 1,
        lng: 2,
        frameStorageIds: [expect.any(String), expect.any(String), expect.any(String)],
      }),
    );
  });

  it("keeps the video and its stills apart in the verify call", async () => {
    const backend = fakeBackend();
    await submitProof(backend, "task-1", { mediaType: "video", uri: "file:///clip.mp4", durationMs: 4000 });

    const args = vi.mocked(backend.verifyMedia).mock.calls[0][0];
    expect(args.storageId).toBe("storage-1");
    expect(args.frameStorageIds).toEqual(["storage-2", "storage-3", "storage-4"]);
  });

  it("assumes a three second clip when the camera sent no length", async () => {
    const backend = fakeBackend();
    await submitProof(backend, "task-1", { mediaType: "video", uri: "file:///clip.mp4" });

    expect(vi.mocked(backend.captureStill).mock.calls.map((call) => call[1])).toEqual([450, 1500, 2550]);
  });

  it("verifies a canvas capture without uploading", async () => {
    const backend = fakeBackend();
    const result = await submitProof(backend, "task-1", { mediaType: "canvas" });

    expect(result).toBe(verdict);
    expect(backend.verifyCanvas).toHaveBeenCalledWith({ taskId: "task-1" });
    expect(backend.generateUploadUrl).not.toHaveBeenCalled();
    expect(backend.verifyMedia).not.toHaveBeenCalled();
  });

  it("surfaces an upload failure without asking the referee", async () => {
    const backend = fakeBackend({
      uploadMedia: vi.fn(async () => {
        throw new Error("Upload failed (500)");
      }),
    });

    await expect(submitProof(backend, "task-1", { mediaType: "photo", uri: "file:///a.jpg" })).rejects.toThrow(
      "Upload failed (500)",
    );
    expect(backend.verifyMedia).not.toHaveBeenCalled();
  });

  it("surfaces a still that cannot be sampled", async () => {
    const backend = fakeBackend({
      captureStill: vi.fn(async () => {
        throw new Error("No frame");
      }),
    });

    await expect(submitProof(backend, "task-1", { mediaType: "video", uri: "file:///clip.mp4" })).rejects.toThrow(
      "No frame",
    );
    expect(backend.verifyMedia).not.toHaveBeenCalled();
  });
});

describe("contentTypeFor", () => {
  it("picks the container from the video extension", () => {
    expect(contentTypeFor("video", "file:///clip.MOV")).toBe("video/quicktime");
    expect(contentTypeFor("video", "file:///clip.mov?x=1")).toBe("video/quicktime");
    expect(contentTypeFor("video", "file:///clip.mp4")).toBe("video/mp4");
  });
});

describe("stillTimes", () => {
  it("samples at 15, 50 and 85 percent", () => {
    expect(stillTimes(2000)).toEqual([300, 1000, 1700]);
  });
});
