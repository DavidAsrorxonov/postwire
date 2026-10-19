import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { validateAttachmentSizes } from "./attachment-limits.js";
import { buildMessage } from "./build-message.js";

describe("attachment size limits", () => {
  const oneMiB = Buffer.alloc(1024 * 1024).toString("base64");

  const atLimit = Array.from({ length: 5 }, (_, index) => ({
    filename: `part-${index}.bin`,
    contentType: "application/octet-stream",
    contentBase64: oneMiB,
  }));

  const oneByte = {
    filename: "extra.bin",
    contentType: "application/octet-stream",
    contentBase64: "AA==",
  };

  it("accepts an empty attachment list", () => {
    expect(() => validateAttachmentSizes([])).not.toThrow();
  });

  it("accepts exactly 5 MiB of decoded data", () => {
    expect(() => validateAttachmentSizes(atLimit)).not.toThrow();
  });

  it("rejects a combined total one byte above the limit", () => {
    expect(() => validateAttachmentSizes([...atLimit, oneByte])).toThrow(
      "Combined attachment size must not exceed 5 MiB.",
    );
  });

  it("rejects one oversized attachment", () => {
    const contentBase64 = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");

    expect(() =>
      validateAttachmentSizes([
        {
          ...oneByte,
          contentBase64,
        },
      ]),
    ).toThrow("Combined attachment size must not exceed 5 MiB.");
  });

  it("rejects malformed Base64 while measuring", () => {
    expect(() =>
      validateAttachmentSizes([
        {
          ...oneByte,
          contentBase64: "Zh==",
        },
      ]),
    ).toThrow("Invalid attachment Base64.");
  });

  it("enforces the limit through buildMessage", () => {
    expect(() =>
      buildMessage(
        {
          from: "sender@example.com",
          to: ["recipient@example.com"],
          subject: "Attachment limit",
          text: "Hello.",
          attachments: [...atLimit, oneByte],
        },
        {
          messageId: "limit-001@example.com",
          date: new Date("2026-01-01T00:00:00.000Z"),
          boundarySeed: "test-boundary",
        },
      ),
    ).toThrow("Combined attachment size must not exceed 5 MiB.");
  });
});
