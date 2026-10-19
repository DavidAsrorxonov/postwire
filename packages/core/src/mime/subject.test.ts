import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { formatSubject } from "./subject.js";

describe("formatSubject", () => {
  it("preserves a short ASCII subject", () => {
    expect(formatSubject("Hello")).toBe("Subject: Hello");
  });

  it("supports an empty subject", () => {
    expect(formatSubject("")).toBe("Subject: ");
  });

  it("encodes a Unicode subject", () => {
    expect(formatSubject("café")).toBe("Subject: =?UTF-8?B?Y2Fmw6k=?=");
  });

  it.each([
    ["long ASCII", "a".repeat(100)],
    ["Unicode and emoji", "通知 📬 ".repeat(20)],
    ["literal encoded-word syntax", "=?UTF-8?B?SGVsbG8=?="],
    ["surrounding spaces", "  Hello  "],
  ])("preserves %s through encoding", (_label, original) => {
    const result = formatSubject(original);

    for (const line of result.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(76);
    }

    const words = result.slice("Subject: ".length).split("\r\n ");

    const decoded = words
      .map((word) => {
        expect(word.length).toBeLessThanOrEqual(75);

        const match = /^=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=$/.exec(word);

        if (match === null) {
          throw new Error(`Invalid encoded word: ${word}`);
        }

        return Buffer.from(match[1]!, "base64").toString("utf8");
      })
      .join("");

    expect(decoded).toBe(original);
  });

  it.each([
    "Hello\r\nBcc: attacker@example.com",
    "Hello\nInjected",
    "Hello\rInjected",
    "Hello\u0000",
  ])("rejects control characters in %j", (subject) => {
    expect(() => formatSubject(subject)).toThrow(
      "Subject must not contain control characters.",
    );
  });

  it("rejects malformed Unicode", () => {
    expect(() => formatSubject("\uD800")).toThrow(
      "Subject contains an unpaired surrogate.",
    );
  });
});
