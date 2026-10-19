import type { MimePart } from "./types.js";
import { encodeQuotedPrintable } from "./quoted-printable.js";

export function buildTextPart(
  content: string,
  subtype: "plain" | "html",
): MimePart {
  return {
    headers: [
      `Content-Type: text/${subtype}; charset="UTF-8"`,
      "Content-Transfer-Encoding: quoted-printable",
    ],
    body: encodeQuotedPrintable(content),
  };
}
