import { describe, expect, it } from "vitest";
import { buildAttachmentPart } from "./attachment.js";

describe("buildAttachmentPart", () => {
  const attachment = {
    filename: "sample.bin",
    contentType: "application/octet-stream",
    contentBase64: "AP+A",
  };

  it("builds a complete binary attachment part", () => {
    expect(buildAttachmentPart(attachment)).toEqual({
      headers: [
        "Content-Type: application/octet-stream",
        "Content-Transfer-Encoding: base64",
        'Content-Disposition: attachment;\r\n filename="sample.bin"',
      ],
      body: "AP+A",
    });
  });

  it("normalizes media type casing", () => {
    const result = buildAttachmentPart({
      ...attachment,
      contentType: "Application/Octet-Stream",
    });

    expect(result.headers[0]).toBe("Content-Type: application/octet-stream");
  });

  it.each([
    "application/pdf",
    "application/vnd.api+json",
    "image/svg+xml",
    "font/woff2",
  ])("accepts media type %s", (contentType) => {
    const result = buildAttachmentPart({
      ...attachment,
      contentType,
    });

    expect(result.headers[0]).toBe(`Content-Type: ${contentType}`);
  });

  it("folds a long content-type header before its value", () => {
    const contentType = `application/${"a".repeat(100)}`;

    const result = buildAttachmentPart({
      ...attachment,
      contentType,
    });

    expect(result.headers[0]).toBe(`Content-Type:\r\n ${contentType}`);
  });

  it("includes an encoded Unicode filename", () => {
    const result = buildAttachmentPart({
      ...attachment,
      filename: "caf\u00E9.bin",
    });

    expect(result.headers).toContain(
      "Content-Disposition: attachment;\r\n" +
        " filename*=UTF-8''%63%61%66%C3%A9%2E%62%69%6E",
    );
  });

  it("wraps the attachment body at 76 characters", () => {
    const result = buildAttachmentPart({
      ...attachment,
      contentBase64: `${"YWFh".repeat(19)}YQ==`,
    });

    expect(result.body).toBe(`${"YWFh".repeat(19)}\r\nYQ==`);
  });

  it("supports an empty file", () => {
    const result = buildAttachmentPart({
      ...attachment,
      contentBase64: "",
    });

    expect(result.body).toBe("");
  });

  it.each([
    "",
    "application",
    "application/",
    "/pdf",
    "application/pdf/extra",
    "application/pdf; charset=UTF-8",
    "text/plain\r\nBcc: attacker@example.com",
    "text/plain\n",
    " application/pdf",
    "application/*",
    "*/pdf",
    `application/${"a".repeat(128)}`,
  ])("rejects invalid content type %j", (contentType) => {
    expect(() =>
      buildAttachmentPart({
        ...attachment,
        contentType,
      }),
    ).toThrow("Invalid attachment content type.");
  });

  it.each(["multipart/mixed", "message/rfc822", "MESSAGE/RFC822"])(
    "rejects unsupported composite type %s",
    (contentType) => {
      expect(() =>
        buildAttachmentPart({
          ...attachment,
          contentType,
        }),
      ).toThrow("Unsupported attachment content type.");
    },
  );

  it("rejects malformed Base64", () => {
    expect(() =>
      buildAttachmentPart({
        ...attachment,
        contentBase64: "Zh==",
      }),
    ).toThrow("Invalid attachment Base64.");
  });

  it("rejects filename header injection", () => {
    expect(() =>
      buildAttachmentPart({
        ...attachment,
        filename: "report\r\nBcc: attacker@example.com",
      }),
    ).toThrow("Invalid attachment filename.");
  });
});
