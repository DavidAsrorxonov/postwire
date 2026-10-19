import { getAttachmentByteLength } from "./base64.js";
import { MimeAttachment } from "./types.js";

export const MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function validateAttachmentSizes(
  attachments: readonly MimeAttachment[],
): void {
  let totalBytes = 0;

  for (const attachment of attachments) {
    totalBytes += getAttachmentByteLength(attachment.contentBase64);

    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new Error("Combined attachment size must not exceed 5 MiB.");
    }
  }
}
