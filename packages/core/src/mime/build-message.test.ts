import { describe, expect, it } from "vitest";
import { buildMessage } from "./build-message";

describe("buildMessage", () => {
  it("builds a plain-text MIME message with CRLF line endings", () => {
    const actual = buildMessage(
      {
        from: "sender@example.com",
        to: ["recipient@example.com"],
        subject: "Hello",
        text: "Hello from Postwire.",
      },
      {
        messageId: "example-001@example.com",
        date: new Date("2026-01-01T00:00:00.000Z"),
        boundarySeed: "test-boundary",
      },
    );

    const expected = [
      "Date: Thu, 01 Jan 2026 00:00:00 +0000",
      "From: sender@example.com",
      "To: recipient@example.com",
      "Subject: Hello",
      "Message-ID: <example-001@example.com>",
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Hello from Postwire.",
      "",
    ].join("\r\n");

    expect(actual).toBe(expected);
  });

  it("includes an encoded Unicode subject.", () => {
    const result = buildMessage(
      {
        from: "sender@example.com",
        to: ["recipient@example.com"],
        subject: "café",
        text: "Hello",
      },
      {
        messageId: "unicode-001@example.com",
        date: new Date("2026-01-01T00:00:00.000Z"),
        boundarySeed: "test-boundary",
      },
    );

    expect(result).toContain("\r\nSubject: =?UTF-8?B?Y2Fmw6k=?=\r\n");
  });

  it("rejects a malformed Message-ID", () => {
    expect(() =>
      buildMessage(
        {
          from: "sender@example.com",
          to: ["recipient@example.com"],
          subject: "Hello",
          text: "Hello.",
        },
        {
          messageId: "missing-domain",
          date: new Date("2026-01-01T00:00:00.000Z"),
          boundarySeed: "test-boundary",
        },
      ),
    ).toThrow("Invalid Message-ID.");
  });

  it.each(["from", "to"] as const)("rejects an invalid %s address", (field) => {
    const message = {
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Hello",
      text: "Hello.",
    };

    if (field === "from") {
      message.from = "broken";
    } else {
      message.to.push("broken");
    }

    expect(() =>
      buildMessage(message, {
        messageId: "validation-001@example.com",
        date: new Date("2026-01-01T00:00:00.000Z"),
        boundarySeed: "test-boundary",
      }),
    ).toThrow("Invalid mailbox address.");
  });
});

describe("recipient headers", () => {
  const baseMessage = {
    from: "sender@example.com",
    to: ["recipient@example.com"],
    subject: "Hello",
    text: "Hello.",
  };

  const metadata = {
    messageId: "recipients-001@example.com",
    date: new Date("2026-01-01T00:00:00.000Z"),
    boundarySeed: "test-boundary",
  };

  it("includes Cc and hides Bcc without modifying the input", () => {
    const message = {
      ...baseMessage,
      cc: ["copy@example.com", "another@example.com"],
      bcc: ["hidden@example.com"],
    };

    const original = structuredClone(message);
    const result = buildMessage(message, metadata);
    const headerSection = result.split("\r\n\r\n")[0]!;

    expect(headerSection).toContain("\r\nTo: recipient@example.com\r\n");

    expect(headerSection).toContain(
      "\r\nCc: copy@example.com, another@example.com\r\n",
    );

    expect(headerSection).not.toMatch(/^Bcc:/im);
    expect(headerSection).not.toContain("hidden@example.com");

    expect(message).toEqual(original);
  });

  it("omits Cc and Bcc headers for empty optional arrays", () => {
    const result = buildMessage(
      {
        ...baseMessage,
        cc: [],
        bcc: [],
      },
      metadata,
    );

    const headerSection = result.split("\r\n\r\n")[0]!;

    expect(headerSection).not.toMatch(/^Cc:/im);
    expect(headerSection).not.toMatch(/^Bcc:/im);
  });

  it.each(["cc", "bcc"] as const)(
    "rejects an invalid address in %s",
    (field) => {
      const message = {
        ...baseMessage,
        [field]: ["valid@example.com", "broken"],
      };

      expect(() => buildMessage(message, metadata)).toThrow(
        "Invalid mailbox address.",
      );
    },
  );

  it.each(["to", "cc"] as const)(
    "folds the %s header in the generated message",
    (field) => {
      const first = `${"a".repeat(61)}@example.com`;
      const second = `second@example.com`;

      const message = {
        ...baseMessage,
        [field]: [first, second],
      };

      const result = buildMessage(message, metadata);
      const name = field === "to" ? "To" : "Cc";

      expect(result).toContain(`\r\n${name}: ${first},\r\n ${second}\r\n`);
    },
  );
});

describe("message body formats", () => {
  it.each([
    {
      body: { html: "<p>Hello.</p>" },
      contentType: 'text/html; charset="UTF-8"',
    },
    {
      body: {
        text: "Hello.",
        html: "<p>Hello.</p>",
      },
      contentType: "multipart/alternative;",
    },
  ])("supports $contentType", ({ body, contentType }) => {
    const result = buildMessage(
      {
        from: "sender@example.com",
        to: ["recipient@example.com"],
        subject: "Hello",
        ...body,
      },
      {
        messageId: "body-001@example.com",
        date: new Date("2026-01-01T00:00:00.000Z"),
        boundarySeed: "test-boundary",
      },
    );

    const headerSection = result.split("\r\n\r\n")[0]!;

    expect(headerSection).toContain(`Content-Type: ${contentType}`);
  });
});
