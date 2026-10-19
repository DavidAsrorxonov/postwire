import { describe, expect, it } from "vitest";
import { formatMailboxHeader } from "./mailbox-header.js";

describe("formatMailboxHeader", () => {
  it.each(["To", "Cc"] as const)("formats a short %s header", (name) => {
    expect(
      formatMailboxHeader(name, ["first@example.com", "second@example.com"]),
    ).toBe(`${name}: first@example.com, second@example.com`);
  });

  it("keeps a 78-character line and folds the next address", () => {
    const first = `${"a".repeat(61)}@example.com`;
    const second = "second@example.com";

    const result = formatMailboxHeader("To", [first, second]);

    expect(result).toBe(`To: ${first},\r\n ${second}`);
    expect(result.split("\r\n")[0]!.length).toBe(78);
  });

  it("preserves commas inside a quoted local part", () => {
    const first = `${"a".repeat(61)}@example.com`;
    const quoted = '"first,last"@example.com';

    expect(formatMailboxHeader("To", [first, quoted])).toBe(
      `To: ${first},\r\n ${quoted}`,
    );
  });

  it("keeps a single long address intact", () => {
    const address = `${"a".repeat(64)}@subdomain.example.com`;

    const result = formatMailboxHeader("To", [address]);

    expect(result).toBe(`To:\r\n ${address}`);

    for (const line of result.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(998);
    }
  });

  it("rejects an empty address list", () => {
    expect(() => formatMailboxHeader("To", [])).toThrow(
      "To requires at least one address.",
    );
  });

  it("rejects header injection", () => {
    expect(() =>
      formatMailboxHeader("To", [
        "valid@example.com\r\nBcc: attacker@example.com",
      ]),
    ).toThrow("Invalid mailbox address.");
  });
});
