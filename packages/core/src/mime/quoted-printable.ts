import { Buffer } from "node:buffer";

export function encodeQuotedPrintable(text: string): string {
  const normalized = text.replace(/\r\n|\r|\n/g, "\n");

  return normalized
    .split("\n")
    .map((line) => {
      const bytes = Buffer.from(line, "utf-8");
      let output = "";
      let column = 0;

      for (const [index, byte] of bytes.entries()) {
        const printable =
          (byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126);

        const interiorSpace = byte === 32 && index < bytes.length - 1;

        const token =
          printable || interiorSpace
            ? String.fromCharCode(byte)
            : `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;

        if (column + token.length > 75) {
          output += "=\r\n";
          column = 0;
        }

        output += token;
        column += token.length;
      }

      return output;
    })
    .join("\r\n");
}
