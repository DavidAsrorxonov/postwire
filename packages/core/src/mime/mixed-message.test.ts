import { describe, expect, it } from "vitest";
import { buildMessage } from "./build-message.js";

function splitEntity(raw: string) {
  const separator = raw.indexOf("\r\n\r\n");

  if (separator === -1) {
    throw new Error("Missing header/body separator.");
  }

  return {
    headers: raw.slice(0, separator),
    body: raw.slice(separator + 4),
  };
}

function readMultipart(raw: string) {
  const { headers, body } = splitEntity(raw);
  const boundary = headers.match(/boundary="([^"]+)"/)?.[1];

  if (boundary === undefined) {
    throw new Error("Missing multipart boundary.");
  }

  const opening = `--${boundary}\r\n`;
  const closing = `\r\n--${boundary}--\r\n`;

  expect(body.startsWith(opening)).toBe(true);
  expect(body.endsWith(closing)).toBe(true);

  const contents = body.slice(opening.length, -closing.length);

  return {
    headers,
    boundary,
    parts: contents.split(`\r\n--${boundary}\r\n`),
  };
}

describe("messages with attachments", () => {
  const baseMessage = {
    from: "sender@example.com",
    to: ["recipient@example.com"],
    subject: "Attachment example",
  };

  const metadata = {
    messageId: "attachment-001@example.com",
    date: new Date("2026-01-01T00:00:00.000Z"),
    boundarySeed: "test-boundary",
  };

  const attachment = {
    filename: "sample.bin",
    contentType: "application/octet-stream",
    contentBase64: "AP+A",
  };

  it.each([
    {
      label: "plain text",
      input: { text: "Hello." },
      contentType: "text/plain",
      expectedBody: "Hello.",
    },
    {
      label: "HTML",
      input: { html: "<p>Hello.</p>" },
      contentType: "text/html",
      expectedBody: "<p>Hello.</p>",
    },
  ])(
    "places $label before the attachment",
    ({ input, contentType, expectedBody }) => {
      const result = buildMessage(
        {
          ...baseMessage,
          ...input,
          attachments: [attachment],
        },
        metadata,
      );

      const outer = readMultipart(result);

      expect(outer.headers).toContain("Content-Type: multipart/mixed;");
      expect(outer.headers).not.toMatch(/^Content-Transfer-Encoding:/m);
      expect(outer.parts).toHaveLength(2);

      const body = splitEntity(outer.parts[0]!);
      const file = splitEntity(outer.parts[1]!);

      expect(body.headers).toContain(
        `Content-Type: ${contentType}; charset="UTF-8"`,
      );
      expect(body.body).toBe(expectedBody);

      expect(file.headers).toContain("Content-Type: application/octet-stream");
      expect(file.headers).toContain("Content-Transfer-Encoding: base64");
      expect(file.headers).toContain('filename="sample.bin"');
      expect(file.body).toBe("AP+A");
    },
  );

  it("nests text and HTML inside the mixed container", () => {
    const result = buildMessage(
      {
        ...baseMessage,
        text: "Hello.",
        html: "<p>Hello.</p>",
        attachments: [attachment],
      },
      metadata,
    );

    const outer = readMultipart(result);
    const inner = readMultipart(outer.parts[0]!);

    expect(outer.parts).toHaveLength(2);
    expect(inner.headers).toContain("Content-Type: multipart/alternative;");
    expect(inner.boundary).not.toBe(outer.boundary);
    expect(inner.parts).toHaveLength(2);

    const plain = splitEntity(inner.parts[0]!);
    const html = splitEntity(inner.parts[1]!);

    expect(plain.headers).toContain("Content-Type: text/plain;");
    expect(plain.body).toBe("Hello.");

    expect(html.headers).toContain("Content-Type: text/html;");
    expect(html.body).toBe("<p>Hello.</p>");
  });

  it("preserves attachment order", () => {
    const result = buildMessage(
      {
        ...baseMessage,
        text: "Hello.",
        attachments: [
          attachment,
          {
            ...attachment,
            filename: "second.bin",
            contentBase64: "SGVsbG8=",
          },
        ],
      },
      metadata,
    );

    const outer = readMultipart(result);

    expect(outer.parts).toHaveLength(3);
    expect(splitEntity(outer.parts[1]!).body).toBe("AP+A");

    const second = splitEntity(outer.parts[2]!);

    expect(second.headers).toContain('filename="second.bin"');
    expect(second.body).toBe("SGVsbG8=");
  });

  it("produces the same message for omitted and empty attachments", () => {
    const message = {
      ...baseMessage,
      text: "Hello.",
    };

    expect(buildMessage({ ...message, attachments: [] }, metadata)).toBe(
      buildMessage(message, metadata),
    );
  });

  it("rebuilds identically without modifying the input", () => {
    const message = {
      ...baseMessage,
      text: "Hello.",
      html: "<p>Hello.</p>",
      attachments: [attachment],
    };

    const original = structuredClone(message);
    const first = buildMessage(message, metadata);

    expect(buildMessage(message, metadata)).toBe(first);
    expect(message).toEqual(original);
  });

  it("rejects an invalid attachment through the message builder", () => {
    expect(() =>
      buildMessage(
        {
          ...baseMessage,
          text: "Hello.",
          attachments: [
            {
              ...attachment,
              contentBase64: "bad",
            },
          ],
        },
        metadata,
      ),
    ).toThrow("Invalid attachment Base64.");
  });
});
