import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  SmtpResponseParseError,
  SmtpResponseParser,
} from "./response-parser.js";
import type { SmtpResponse } from "./types.js";

function drain(parser: SmtpResponseParser): SmtpResponse[] {
  const responses: SmtpResponse[] = [];

  while (true) {
    const response = parser.readResponse();

    if (response === null) {
      return responses;
    }

    responses.push(response);
  }
}

describe("SmtpResponseParser", () => {
  it("waits when no bytes are available", () => {
    const parser = new SmtpResponseParser();

    expect(parser.readResponse()).toBeNull();
    expect(() => parser.assertComplete()).not.toThrow();
  });

  it("parses a complete greeting", () => {
    const parser = new SmtpResponseParser();
    parser.push(Buffer.from("220 smtp.example.com ready\r\n"));

    expect(parser.readResponse()).toEqual({
      code: 220,
      lines: ["smtp.example.com ready"],
    });

    expect(parser.readResponse()).toBeNull();
    parser.assertComplete();
  });

  it("waits for the final line of a multiline reply", () => {
    const parser = new SmtpResponseParser();
    parser.push(Buffer.from("250-smtp.example.com\r\n250-STARTTLS\r\n"));

    expect(parser.readResponse()).toBeNull();

    parser.push(Buffer.from("250 AUTH PLAIN LOGIN\r\n"));

    expect(parser.readResponse()).toEqual({
      code: 250,
      lines: ["smtp.example.com", "STARTTLS", "AUTH PLAIN LOGIN"],
    });
  });

  it("handles every possible split in a multiline reply", () => {
    const bytes = Buffer.from(
      "250-smtp.example.com\r\n250-STARTTLS\r\n250 AUTH PLAIN\r\n",
    );

    for (let split = 0; split <= bytes.length; split += 1) {
      const parser = new SmtpResponseParser();

      parser.push(bytes.subarray(0, split));
      const responses = drain(parser);

      parser.push(bytes.subarray(split));
      responses.push(...drain(parser));

      expect(responses).toEqual([
        {
          code: 250,
          lines: ["smtp.example.com", "STARTTLS", "AUTH PLAIN"],
        },
      ]);

      parser.assertComplete();
    }
  });

  it("handles one byte at a time", () => {
    const parser = new SmtpResponseParser();
    const responses: SmtpResponse[] = [];

    for (const byte of Buffer.from("250-first\r\n250 done\r\n")) {
      parser.push(Uint8Array.of(byte));
      responses.push(...drain(parser));
    }

    expect(responses).toEqual([{ code: 250, lines: ["first", "done"] }]);

    parser.assertComplete();
  });

  it("preserves additional replies and a partial following reply", () => {
    const parser = new SmtpResponseParser();
    parser.push(Buffer.from("220 ready\r\n250 OK\r\n35"));

    expect(drain(parser)).toEqual([
      { code: 220, lines: ["ready"] },
      { code: 250, lines: ["OK"] },
    ]);

    parser.push(Buffer.from("4 Continue\r\n"));

    expect(parser.readResponse()).toEqual({
      code: 354,
      lines: ["Continue"],
    });

    parser.assertComplete();
  });

  it.each(["250\r\n", "250 \r\n"])(
    "accepts an empty final reply: %j",
    (input) => {
      const parser = new SmtpResponseParser();
      parser.push(Buffer.from(input));

      expect(parser.readResponse()).toEqual({
        code: 250,
        lines: [""],
      });
    },
  );

  it("accepts an empty continuation line", () => {
    const parser = new SmtpResponseParser();
    parser.push(Buffer.from("250-\r\n250 done\r\n"));

    expect(parser.readResponse()).toEqual({
      code: 250,
      lines: ["", "done"],
    });
  });

  it.each([
    "199 invalid\r\n",
    "260 invalid\r\n",
    "600 invalid\r\n",
    "OK\r\n",
    "250: invalid\r\n",
    "250 OK\n",
    "250 O\rK\r\n",
    "250 bad\u0000text\r\n",
    "250 café\r\n",
    "250-first\r\n550 different code\r\n",
  ])("rejects malformed input: %j", (input) => {
    const parser = new SmtpResponseParser();
    parser.push(Buffer.from(input));

    expect(() => parser.readResponse()).toThrow(SmtpResponseParseError);
  });

  it("accepts a line of exactly 512 bytes including CRLF", () => {
    const parser = new SmtpResponseParser();
    const text = "x".repeat(506);

    parser.push(Buffer.from(`250 ${text}\r\n`));

    expect(parser.readResponse()).toEqual({
      code: 250,
      lines: [text],
    });
  });

  it.each([`250 ${"x".repeat(507)}\r\n`, `250 ${"x".repeat(507)}`])(
    "rejects an oversized complete or partial line",
    (input) => {
      const parser = new SmtpResponseParser();
      parser.push(Buffer.from(input));

      expect(() => parser.readResponse()).toThrow(
        "SMTP reply line limit exceeded.",
      );
    },
  );

  it("bounds a multiline reply across repeated reads", () => {
    const parser = new SmtpResponseParser();
    const line = Buffer.from(`250-${"x".repeat(506)}\r\n`);

    // 128 lines of 512 bytes fill the 64 KiB response budget.
    for (let index = 0; index < 128; index += 1) {
      parser.push(line);
      expect(parser.readResponse()).toBeNull();
    }

    parser.push(Buffer.from("250 done\r\n"));

    expect(() => parser.readResponse()).toThrow(
      "SMTP response size limit exceeded.",
    );
  });

  it("bounds unread buffered bytes", () => {
    const parser = new SmtpResponseParser();

    expect(() => parser.push(Buffer.alloc(128 * 1024 + 1))).toThrow(
      "SMTP response buffer limit exceeded.",
    );
  });

  it.each(["250 unfinished", "250 unfinished\r", "250-continuation\r\n"])(
    "detects a truncated reply at EOF: %j",
    (input) => {
      const parser = new SmtpResponseParser();
      parser.push(Buffer.from(input));

      expect(parser.readResponse()).toBeNull();

      expect(() => parser.assertComplete()).toThrow(
        "SMTP stream ended with an incomplete reply.",
      );
    },
  );

  it("returns a valid reply before examining later malformed bytes", () => {
    const parser = new SmtpResponseParser();
    parser.push(Buffer.from("250 accepted\r\ninvalid\r\n"));

    expect(parser.readResponse()).toEqual({
      code: 250,
      lines: ["accepted"],
    });

    expect(() => parser.readResponse()).toThrow(SmtpResponseParseError);
  });

  it("copies incoming bytes", () => {
    const parser = new SmtpResponseParser();
    const input = Buffer.from("250 OK\r\n");

    parser.push(input);
    input.fill(0);

    expect(parser.readResponse()).toEqual({
      code: 250,
      lines: ["OK"],
    });
  });

  it("cannot be reused after a parsing failure", () => {
    const parser = new SmtpResponseParser();
    parser.push(Buffer.from("invalid\r\n"));

    expect(() => parser.readResponse()).toThrow(SmtpResponseParseError);
    expect(() => parser.push(Buffer.from("250 OK\r\n"))).toThrow(
      SmtpResponseParseError,
    );
    expect(() => parser.readResponse()).toThrow(SmtpResponseParseError);
  });
});
