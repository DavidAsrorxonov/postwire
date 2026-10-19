import { Buffer } from "node:buffer";

const MAX_CHUNK_BYTES = 39;

export function formatSubject(subject: string): string {
  if (/[\x00-\x1F\x7F-\x9F\u2028\u2029]/u.test(subject)) {
    throw new Error("Subject must not contain control characters.");
  }

  const canUsePlainText =
    /^[\x20-\x7E]*$/.test(subject) &&
    subject.length <= 67 &&
    subject === subject.trim() &&
    !subject.includes("=?");

  if (canUsePlainText) {
    return `Subject: ${subject}`;
  }

  const chunks: string[] = [];
  let chunk = "";
  let chunkBytes = 0;

  for (const char of subject) {
    const codePointt = char.codePointAt(0)!;

    if (codePointt >= 0xd800 && codePointt <= 0xdfff) {
      throw new Error("Subject contains an unpaired surrogate.");
    }

    const charBytes = Buffer.byteLength(char, "utf-8");

    if (chunkBytes + charBytes > MAX_CHUNK_BYTES) {
      chunks.push(chunk);
      chunk = "";
      chunkBytes = 0;
    }

    chunk += char;
    chunkBytes += charBytes;
  }

  if (chunk !== "") {
    chunks.push(chunk);
  }

  const words = chunks.map((val) => {
    const encoded = Buffer.from(val, "utf-8").toString("base64");
    return `=?UTF-8?B?${encoded}?=`;
  });

  return `Subject: ${words.join("\r\n ")}`;
}
