import { describe, expect, it } from "vitest";
import { buildMessage } from "./build-message.js";

// Fixed independently using SHA-256("phase-1-fixture"). Expected bytes must
// never be derived from the message or production formatting helpers.
const metadata = {
  messageId: "fixture-001@example.com",
  date: new Date("2026-01-01T00:00:00.000Z"),
  boundarySeed: "phase-1-fixture",
};

const message = {
  from: "sender@example.com",
  to: ["recipient@example.com"],
  cc: ["copy@example.com"],
  bcc: ["hidden@example.com"],
  subject: "café",
  text: "Hello, café!\n",
  html: "<p>Hello, café!</p>",
};

const headers = [
  "Date: Thu, 01 Jan 2026 00:00:00 +0000",
  "From: sender@example.com",
  "To: recipient@example.com",
  "Cc: copy@example.com",
  "Subject: =?UTF-8?B?Y2Fmw6k=?=",
  "Message-ID: <fixture-001@example.com>",
  "MIME-Version: 1.0",
];

const alternative = [
  "Content-Type: multipart/alternative;",
  ' boundary="=_postwire_alt_f367e27e5cffa0c21f810d049676c0e6"',
  "",
  "--=_postwire_alt_f367e27e5cffa0c21f810d049676c0e6",
  'Content-Type: text/plain; charset="UTF-8"',
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Hello, caf=C3=A9!",
  "", // The text's own newline precedes the delimiter's CRLF.
  "--=_postwire_alt_f367e27e5cffa0c21f810d049676c0e6",
  'Content-Type: text/html; charset="UTF-8"',
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "<p>Hello, caf=C3=A9!</p>",
  "--=_postwire_alt_f367e27e5cffa0c21f810d049676c0e6--",
  "",
];

describe("complete MIME byte fixtures", () => {
  it("matches the complete text and HTML alternative message", () => {
    const expected = [...headers, ...alternative].join("\r\n");
    expect(Buffer.from(buildMessage(message, metadata), "utf8")).toEqual(
      Buffer.from(expected, "utf8"),
    );
  });

  it("matches the complete nested alternative and one attachment message", () => {
    const expected = [
      ...headers,
      "Content-Type: multipart/mixed;",
      ' boundary="=_postwire_mixed_f367e27e5cffa0c21f810d049676c0e6"',
      "",
      "--=_postwire_mixed_f367e27e5cffa0c21f810d049676c0e6",
      ...alternative,
      "--=_postwire_mixed_f367e27e5cffa0c21f810d049676c0e6",
      "Content-Type: application/octet-stream",
      "Content-Transfer-Encoding: base64",
      "Content-Disposition: attachment;",
      " filename*=UTF-8''%63%61%66%C3%A9%2E%62%69%6E",
      "",
      "AAEC/f7/",
      "--=_postwire_mixed_f367e27e5cffa0c21f810d049676c0e6--",
      "",
    ].join("\r\n");

    const actual = buildMessage(
      {
        ...message,
        attachments: [{
          filename: "café.bin",
          contentType: "application/octet-stream",
          contentBase64: "AAEC/f7/",
        }],
      },
      metadata,
    );
    expect(Buffer.from(actual, "utf8")).toEqual(Buffer.from(expected, "utf8"));
  });
});
