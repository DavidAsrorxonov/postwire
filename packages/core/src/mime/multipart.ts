import { createHash } from "crypto";
import { MimePart } from "./types.js";

export function buildMultipartPart(
  parts: readonly MimePart[],
  subtype: "alternative" | "mixed",
  boundarySeed: string,
): MimePart {
  if (parts.length === 0) {
    throw new Error("Multipart messages require at least one part.");
  }

  if (boundarySeed.length === 0) {
    throw new Error("Multipart messages require a boundary seed.");
  }

  const digest = createHash("sha256")
    .update(boundarySeed, "utf8")
    .digest("hex")
    .slice(0, 32);

  const label = subtype === "alternative" ? "alt" : "mixed";
  const boundary = `=_postwire_${label}_${digest}`;

  const sections = parts.map((part) =>
    [`--${boundary}`, ...part.headers, "", part.body].join("\r\n"),
  );

  return {
    headers: [`Content-Type: multipart/${subtype};\r\n boundary="${boundary}"`],
    body: `${sections.join("\r\n")}\r\n--${boundary}--\r\n`,
  };
}
