import { describe, expect, it } from "vitest";
import { buildMessage } from "./build-message.js";

const message = {
  from: "sender@example.com",
  to: ["recipient@example.com"],
  subject: "Date validation",
  text: "Hello.",
};

function buildWithDate(date: Date): string {
  return buildMessage(message, {
    messageId: "date-001@example.com",
    date,
    boundarySeed: "date-test",
  });
}

describe("message date range", () => {
  it.each([
    ["1900-01-01T00:00:00.000Z", "Mon, 01 Jan 1900 00:00:00 +0000"],
    ["1969-12-31T23:59:59.000Z", "Wed, 31 Dec 1969 23:59:59 +0000"],
    ["9999-12-31T23:59:59.999Z", "Fri, 31 Dec 9999 23:59:59 +0000"],
  ])("accepts %s and emits its UTC Date header", (input, expected) => {
    expect(buildWithDate(new Date(input)).split("\r\n")[0]).toBe(
      `Date: ${expected}`,
    );
  });

  it.each([
    ["before 1900", new Date("1899-12-31T23:59:59.999Z")],
    ["after 9999", new Date("+010000-01-01T00:00:00.000Z")],
    ["invalid", new Date(NaN)],
  ])("rejects a date that is %s", (_label, date) => {
    expect(() => buildWithDate(date)).toThrow(
      "Message date must be valid and within 1900-9999.",
    );
  });
});
