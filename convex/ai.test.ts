import { APIError } from "openai";
import { describe, expect, it } from "vitest";

import { isUnreadableImage } from "./ai";

/** An error as the SDK raises it, from the body OpenAI sent. Each body below is one the API really returned. */
const apiError = (status: number, body: { message: string; code: string | null; param: string | null }) =>
  APIError.generate(status, { error: { ...body, type: "invalid_request_error" } }, undefined, new Headers());

describe("isUnreadableImage", () => {
  it("is true for a 400 about the photo", () => {
    const aboutThePhoto = [
      { code: null, param: null, message: "input_image image_url unsupported image format: unknown" },
      { code: "invalid_value", param: "input", message: "The image data you provided does not represent a valid image." },
      {
        code: "invalid_value",
        param: "input[0].content[1].image_url",
        message: "Invalid 'input[0].content[1].image_url'. Expected a base64-encoded data URL with an image MIME type.",
      },
      { code: "invalid_value", param: "url", message: "Error while downloading file. Upstream status code: 404." },
    ];
    for (const body of aboutThePhoto) {
      expect(isUnreadableImage(apiError(400, body)), body.message).toBe(true);
    }
  });

  it("is false for a 400 about our own request, so it is never blamed on the player", () => {
    const aboutOurRequest = [
      {
        code: "invalid_json_schema",
        param: "text.format.schema",
        message: "Invalid schema for response_format 'proof_judgement': 'additionalProperties' is required to be supplied and to be false.",
      },
      { code: "invalid_value", param: "reasoning.effort", message: "Invalid value: 'enormous'. Supported values are: 'none', 'minimal', 'low'." },
    ];
    for (const body of aboutOurRequest) {
      expect(isUnreadableImage(apiError(400, body)), body.message).toBe(false);
    }
  });

  it("is false for anything that is not a 400 from the API", () => {
    const missingModel = { code: "model_not_found", param: null, message: "The model `gpt-6-nope` does not exist." };
    expect(isUnreadableImage(apiError(404, missingModel))).toBe(false);
    expect(isUnreadableImage(apiError(429, { code: "rate_limit_exceeded", param: null, message: "Rate limit reached for images." }))).toBe(false);
    expect(isUnreadableImage(new Error("fetch failed"))).toBe(false);
  });
});
