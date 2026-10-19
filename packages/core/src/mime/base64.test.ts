import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  decodeAttachmentBase64,
  encodeMimeBase64,
  getAttachmentByteLength,
} from "./base64.js";

describe("decodeAttachmentBase64", () => {
  it.each([
    ["", ""],
    ["Zg==", "f"],
    ["Zm8=", "fo"],
    ["Zm9v", "foo"],
  ])("decodes %j", (encoded, expected) => {
    expect(decodeAttachmentBase64(encoded)).toEqual(
      Buffer.from(expected, "utf8"),
    );
  });

  it("preserves binary bytes", () => {
    expect([...decodeAttachmentBase64("AP+A")]).toEqual([0, 255, 128]);
  });

  it.each([
    "Z",
    "Zg",
    "Zg=",
    "Zg===",
    "Z=g=",
    "Zg==\n",
    "Z g==",
    "_w==",
    "Zh==",
    "Zm9=",
    "data:text/plain;base64,Zg==",
  ])("rejects malformed or noncanonical input %j", (value) => {
    expect(() => decodeAttachmentBase64(value)).toThrow(
      "Invalid attachment Base64.",
    );
  });
});

describe("encodeMimeBase64", () => {
  it("encodes an empty attachment", () => {
    expect(encodeMimeBase64(new Uint8Array())).toBe("");
  });

  it("encodes text bytes", () => {
    expect(encodeMimeBase64(Buffer.from("Hello", "utf8"))).toBe("SGVsbG8=");
  });

  it("encodes binary bytes", () => {
    expect(encodeMimeBase64(new Uint8Array([0, 255, 128]))).toBe("AP+A");
  });

  it("keeps exactly 76 characters on one line", () => {
    const bytes = Buffer.alloc(57, 0x61);

    expect(encodeMimeBase64(bytes)).toBe("YWFh".repeat(19));
  });

  it("wraps output after 76 characters", () => {
    const bytes = Buffer.alloc(58, 0x61);

    expect(encodeMimeBase64(bytes)).toBe(`${"YWFh".repeat(19)}\r\nYQ==`);
  });

  it("preserves every possible byte value through encoding", () => {
    const bytes = new Uint8Array(256);

    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index;
    }

    const encoded = encodeMimeBase64(bytes);

    for (const line of encoded.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(76);
    }

    const inputForm = encoded.replace(/\r\n/g, "");

    expect(decodeAttachmentBase64(inputForm)).toEqual(Buffer.from(bytes));
  });
});

describe("getAttachmentByteLength", () => {
  it.each([
    ["", 0],
    ["Zg==", 1],
    ["Zm8=", 2],
    ["Zm9v", 3],
    ["AP+A", 3],
  ])("measures %j as %i bytes", (encoded, expected) => {
    expect(getAttachmentByteLength(encoded)).toBe(expected);
  });
});
