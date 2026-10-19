import { Buffer } from "node:buffer";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function getAttachmentByteLength(value: string): number {
  if (value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value)) {
    throw new Error("Invalid attachment Base64.");
  }

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;

  const dataLength = value.length - padding;
  const firstPadding = value.indexOf("=");

  if (firstPadding !== -1 && firstPadding !== dataLength) {
    throw new Error("Invalid attachment Base64.");
  }

  if (padding > 0) {
    const lastValue = BASE64_ALPHABET.indexOf(value[dataLength - 1]!);
    const unusedBitMask = padding === 2 ? 15 : 3;

    if ((lastValue & unusedBitMask) !== 0) {
      throw new Error("Invalid attachment Base64.");
    }
  }

  return (value.length / 4) * 3 - padding;
}

export function decodeAttachmentBase64(value: string): Buffer {
  getAttachmentByteLength(value);

  return Buffer.from(value, "base64");
}

export function encodeMimeBase64(bytes: Uint8Array): string {
  const encoded = Buffer.from(bytes).toString("base64");
  const lines: string[] = [];

  for (let offset = 0; offset < encoded.length; offset += 76) {
    lines.push(encoded.slice(offset, offset + 76));
  }

  return lines.join("\r\n");
}
