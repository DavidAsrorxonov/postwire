import { Buffer } from "node:buffer";
import type { SmtpResponse } from "./types.js";

const MAX_LINE_BYTES = 512;

// Local defensive limits, not SMTP protocol limits.
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_BUFFERED_BYTES = 128 * 1024;

export class SmtpResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmtpResponseParseError";
  }
}

export class SmtpResponseParser {
  private buffer: Buffer = Buffer.alloc(0);
  private responseCode: number | null = null;
  private responseLines: string[] = [];
  private responseBytes = 0;
  private failure: SmtpResponseParseError | null = null;

  push(chunk: Uint8Array): void {
    this.ensureHealthy();

    if (chunk.byteLength > MAX_BUFFERED_BYTES - this.buffer.length) {
      this.fail("SMTP response buffer limit exceeded.");
    }

    // we copy the input so later caller mutations cannot change buffered bytes
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
  }

  readResponse(): SmtpResponse | null {
    this.ensureHealthy();

    while (true) {
      const lineEnd = this.buffer.indexOf("\r\n");

      if (lineEnd === -1) {
        const endsWithCr =
          this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === 13;

        const contentLength = this.buffer.length - (endsWithCr ? 1 : 0);

        if (contentLength > MAX_LINE_BYTES - 2) {
          this.fail("SMTP reply line limit exceeded.");
        }

        if (this.responseBytes + this.buffer.length > MAX_RESPONSE_BYTES) {
          this.fail("SMTP response size limit exceeded.");
        }

        const partial = this.buffer
          .subarray(0, contentLength)
          .toString("latin1");

        if (/[\r\n]/.test(partial)) {
          this.fail("SMTP replies must use CRLF line endings.");
        }

        return null;
      }

      const lineBytes = lineEnd + 2;

      if (lineBytes > MAX_LINE_BYTES) {
        this.fail("SMTP reply line limit exceeded.");
      }

      if (this.responseBytes + lineBytes > MAX_RESPONSE_BYTES) {
        this.fail("SMTP response size limit exceeded.");
      }

      // we are doing latin1 because it preserves byte values so non-ASCII bytes cannot be hidden
      // by decoding or replacement before validation
      const line = this.buffer.subarray(0, lineEnd).toString("latin1");

      const match = /^([2-5][0-5][0-9])(?:([ -])([\t\x20-\x7E]*))?$/.exec(line);

      if (!match) {
        this.fail("Malformed SMTP reply line.");
      }

      const code = Number(match[1]);
      const separator = match[2];
      const text = match[3] ?? "";

      if (this.responseCode !== null && code !== this.responseCode) {
        this.fail("SMTP multiline reply codes must match.");
      }

      this.responseCode = code;
      this.responseLines.push(text);
      this.responseBytes += lineBytes;
      this.buffer = this.buffer.subarray(lineBytes);

      if (separator === "-") {
        continue;
      }

      const response: SmtpResponse = {
        code,
        lines: this.responseLines,
      };

      this.responseCode = null;
      this.responseLines = [];
      this.responseBytes = 0;

      return response;
    }
  }

  // call this function after draining complete replies when the byte stream ends
  assertComplete(): void {
    this.ensureHealthy();

    if (this.buffer.length > 0 || this.responseCode !== null) {
      this.fail("SMTP stream ended with an incomplete reply.");
    }
  }

  private ensureHealthy(): void {
    if (this.failure !== null) {
      throw this.failure;
    }
  }

  private fail(message: string): never {
    this.failure = new SmtpResponseParseError(message);
    throw this.failure;
  }
}
