import { describe, expect, it } from "vitest";
import { validateMailbox } from "./mailbox.js";

describe("validateMailbox", () => {
  it.each([
    "sender@example.com",
    "first.last+tag@example.com",
    "MixedCase@Example.COM",
    "user@mail.example.com",
    "user@xn--bcher-kva.example",
    '"first last"@example.com',
    '"first@last"@example.com',
    String.raw`"first\"last"@example.com`,
    "user@[127.0.0.1]",
    "user@[IPv6:2001:db8::1]",
  ])("accepts %s", (address) => {
    expect(() => validateMailbox(address)).not.toThrow();
  });

  it.each([
    "",
    "missing-domain",
    "@example.com",
    "user@",
    "user@@example.com",
    " user@example.com",
    "user@example.com ",
    "Alice <alice@example.com>",
    "first last@example.com",
    ".user@example.com",
    "user.@example.com",
    "first..last@example.com",
    '"unclosed@example.com',
    "user@-example.com",
    "user@example-.com",
    "user@exam_ple.com",
    "user@example..com",
    "user@example.com.",
    "user@[999.0.0.1]",
    "user@[IPv6:not-an-ip]",
    "user@[IPv6:fe80::1%eth0]",
    "café@example.com",
    "user@例え.com",
    "user@example.com\n",
    "user@example.com\r\nBcc: attacker@example.com",
  ])("rejects %j", (address) => {
    expect(() => validateMailbox(address)).toThrow("Invalid mailbox address.");
  });

  it("accepts a 64-character local part and rejects 65", () => {
    expect(() =>
      validateMailbox(`${"a".repeat(64)}@example.com`),
    ).not.toThrow();

    expect(() => validateMailbox(`${"a".repeat(65)}@example.com`)).toThrow(
      "Invalid mailbox address.",
    );
  });

  it("accepts a 63-character domain label and rejects 64", () => {
    expect(() => validateMailbox(`user@${"a".repeat(63)}.com`)).not.toThrow();

    expect(() => validateMailbox(`user@${"a".repeat(64)}.com`)).toThrow(
      "Invalid mailbox address.",
    );
  });

  it("accepts 254 characters overall and rejects 255", () => {
    const local = "a".repeat(64);
    const domain = ["b".repeat(63), "c".repeat(63), "d".repeat(61)].join(".");

    const address = `${local}@${domain}`;

    expect(address.length).toBe(254);
    expect(() => validateMailbox(address)).not.toThrow();

    expect(() => validateMailbox(`${address}d`)).toThrow(
      "Invalid mailbox address.",
    );
  });
});
