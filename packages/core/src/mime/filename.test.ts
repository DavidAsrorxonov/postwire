import { describe, expect, it } from "vitest";
import { formatAttachmentDisposition } from "./filename.js";

describe("formatAttachmentDisposition", () => {
  it("formats a short ASCII filename", () => {
    expect(formatAttachmentDisposition("invoice.pdf")).toBe(
      'Content-Disposition: attachment;\r\n filename="invoice.pdf"',
    );
  });

  it("escapes quotes and backslashes", () => {
    const filename = String.raw`report "final"\copy.pdf`;
    const parameter = String.raw` filename="report \"final\"\\copy.pdf"`;

    expect(formatAttachmentDisposition(filename)).toBe(
      `Content-Disposition: attachment;\r\n${parameter}`,
    );
  });

  it("encodes a Unicode filename", () => {
    expect(formatAttachmentDisposition("caf\u00E9.pdf")).toBe(
      "Content-Disposition: attachment;\r\n" +
        " filename*=UTF-8''%63%61%66%C3%A9%2E%70%64%66",
    );
  });

  it.each([
    {
      label: "long ASCII",
      filename: `${"a".repeat(100)}.pdf`,
    },
    {
      label: "long Unicode",
      filename: `${"📎".repeat(30)}.pdf`,
    },
  ])("preserves $label filenames across continuations", ({ filename }) => {
    const result = formatAttachmentDisposition(filename);
    const lines = result.split("\r\n");

    expect(lines[0]).toBe("Content-Disposition: attachment;");
    expect(lines.length).toBeGreaterThan(2);

    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(78);
    }

    const encodedChunks = lines.slice(1).map((line, index) => {
      const parameter = line.replace(/;$/, "");
      const match = /^ filename\*(\d+)\*=(.*)$/.exec(parameter);

      if (match === null) {
        throw new Error(`Invalid filename continuation: ${line}`);
      }

      expect(Number(match[1])).toBe(index);

      let value = match[2]!;

      if (index === 0) {
        expect(value.startsWith("UTF-8''")).toBe(true);
        value = value.slice("UTF-8''".length);
      }

      expect(value).toMatch(/^(?:%[0-9A-F]{2})+$/);

      return value;
    });

    expect(decodeURIComponent(encodedChunks.join(""))).toBe(filename);
  });

  it.each([
    "",
    "   ",
    "report\r\nBcc: attacker@example.com",
    "report\n.txt",
    "report\u0000.txt",
    "\uD800.txt",
    "\uDC00.txt",
  ])("rejects invalid filename %j", (filename) => {
    expect(() => formatAttachmentDisposition(filename)).toThrow(
      "Invalid attachment filename.",
    );
  });
});
