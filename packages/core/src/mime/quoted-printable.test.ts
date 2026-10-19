import { describe, expect, it } from "vitest";
import { encodeQuotedPrintable } from "./quoted-printable.js";

describe("encodeQuotedPrintable", () => {
  it.each([
    ["ordinary ASCII", "Hello from Postwire.", "Hello from Postwire."],
    ["UTF-8 and equals", "café = tea", "caf=C3=A9 =3D tea"],
    ["trailing whitespace", "hello \t", "hello =09"],
    ["line endings", "a\nb\rc\r\nd", "a\r\nb\r\nc\r\nd"],
    ["empty input", "", ""],
  ])("encodes %s", (_label, input, expected) => {
    expect(encodeQuotedPrintable(input)).toBe(expected);
  });

  it("wraps long lines using a soft break", () => {
    expect(encodeQuotedPrintable("a".repeat(76))).toBe(
      `${"a".repeat(75)}=\r\na`,
    );
  });

  it("keeps an encoded byte together when wrapping", () => {
    expect(encodeQuotedPrintable(`${"a".repeat(74)}=`)).toBe(
      `${"a".repeat(74)}=\r\n=3D`,
    );
  });

  it("encodes a trailing space", () => {
    expect(encodeQuotedPrintable("hello ")).toBe("hello=20");
  });
});
