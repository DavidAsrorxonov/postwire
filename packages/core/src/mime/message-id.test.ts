import { describe, expect, it } from "vitest";
import { validateMessageId } from "./message-id.js";

describe("validateMessageId", () => {
  it.each([
    "example-001@example.com",
    "batch.001+retry@example.com",
    "MixedCase.001@Example.COM",
    "example-001@[127.0.0.1]",
    "example-001@[IPv6:2001:db8::1]",
  ])("accepts %s", (messageId) => {
    expect(() => validateMessageId(messageId)).not.toThrow();
  });

  it.each([
    "",
    "missing-domain",
    "@example.com",
    "example-001@",
    "example-001@example.com@another.com",
    "<example-001@example.com>",
    " example-001@example.com",
    "example-001@example.com ",
    "example 001@example.com",
    ".example@example.com",
    "example.@example.com",
    "example..001@example.com",
    "example@example..com",
    "example@example.com.",
    "example@[127.0.0.1",
    "example@[bad value]",
    "café@example.com",
    "example@example.com\n",
    "example@example.com\r\nBcc: attacker@example.com",
  ])("rejects %j", (messageId) => {
    expect(() => validateMessageId(messageId)).toThrow("Invalid Message-ID.");
  });
});
