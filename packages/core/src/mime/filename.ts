import { Buffer } from "node:buffer";

export function formatAttachmentDisposition(filename: string): string {
  if (
    filename.trim().length === 0 ||
    /[\x00-\x1F\x7F-\x9F\u2028\u2029]/u.test(filename)
  ) {
    throw new Error("Invalid attachment filename.");
  }

  const prefix = "Content-Disposition: attachment;";
  const escaped = filename.replace(/["\\]/g, "\\$&");
  const quotedParameter = ` filename="${escaped}"`;

  if (/^[\x20-\x7E]+$/.test(filename) && quotedParameter.length <= 78) {
    return `${prefix}\r\n${quotedParameter}`;
  }

  const chunks: string[] = [];
  let chunk = "";

  for (const character of filename) {
    const codePoint = character.codePointAt(0)!;

    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw new Error("Invalid attachment filename.");
    }

    const encoded = [...Buffer.from(character, "utf8")]
      .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`)
      .join("");

    if (chunk.length + encoded.length > 48) {
      chunks.push(chunk);
      chunk = "";
    }

    chunk += encoded;
  }

  if (chunk !== "") {
    chunks.push(chunk);
  }

  if (chunks.length === 1) {
    return `${prefix}\r\n filename*=UTF-8''${chunks[0]}`;
  }

  const parameters = chunks.map((value, index) => {
    const charset = index === 0 ? "UTF-8''" : "";
    return ` filename*${index}*=${charset}${value}`;
  });

  return `${prefix}\r\n${parameters.join(";\r\n")}`;
}
