import { createHash } from "node:crypto";
import type { MimeMessage, MimePart } from "./types.js";
import { buildTextPart } from "./text-part.js";
import { buildMultipartPart } from "./multipart.js";

export function buildBody(
  message: Pick<MimeMessage, "text" | "html">,
  boundarySeed: string,
): MimePart {
  const parts: MimePart[] = [];

  if (message.text != null) {
    parts.push(buildTextPart(message.text, "plain"));
  }

  if (message.html != null) {
    parts.push(buildTextPart(message.html, "html"));
  }

  if (parts.length === 0) {
    throw new Error("At least one of text or html is required.");
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (boundarySeed.length === 0) {
    throw new Error("Multipart messages require a boundary seed.");
  }

  return buildMultipartPart(parts, "alternative", boundarySeed);
}
