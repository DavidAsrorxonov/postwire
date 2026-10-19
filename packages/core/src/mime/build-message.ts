import { MimeMessage, MimeMetadata } from "./types.js";
import { formatSubject } from "./subject.js";
import { validateMessageId } from "./message-id.js";
import { validateMailbox } from "./mailbox.js";
import { formatMailboxHeader } from "./mailbox-header.js";
import { buildBody } from "./body.js";
import { buildMultipartPart } from "./multipart.js";
import { buildAttachmentPart } from "./attachment.js";
import { validateAttachmentSizes } from "./attachment-limits.js";

function header(name: string, value: string): string {
  if (/[^\x20-\x7E]/.test(value)) {
    throw new Error(`${name} must contain printable ASCII only.`);
  }

  const line = `${name}: ${value}`;

  if (line.length > 998) {
    throw new Error(`${name} requires header folding.`);
  }

  return line;
}

export function buildMessage(
  message: MimeMessage,
  metadata: MimeMetadata,
): string {
  validateMessageId(metadata.messageId);

  if (
    !Number.isFinite(metadata.date.getTime()) ||
    metadata.date.getUTCFullYear() < 1900 ||
    metadata.date.getUTCFullYear() > 9999
  ) {
    throw new Error("Message date must be valid and within 1900-9999.");
  }

  if (message.to.length === 0) {
    throw new Error("At least one To recipient is required.");
  }

  validateMailbox(message.from);

  for (const recipient of message.bcc ?? []) {
    validateMailbox(recipient);
  }

  const date = metadata.date.toUTCString().replace(/GMT$/, "+0000");

  const attachments = message.attachments ?? [];
  validateAttachmentSizes(attachments);
  const bodyPart = buildBody(message, metadata.boundarySeed);

  const part =
    attachments.length === 0
      ? bodyPart
      : buildMultipartPart(
          [bodyPart, ...attachments.map((att) => buildAttachmentPart(att))],
          "mixed",
          metadata.boundarySeed,
        );

  const headers = [
    header("Date", date),
    header("From", message.from),
    formatMailboxHeader("To", message.to),
    ...(message.cc && message.cc.length > 0
      ? [formatMailboxHeader("Cc", message.cc)]
      : []),
    formatSubject(message.subject),
    header("Message-ID", `<${metadata.messageId}>`),
    "MIME-Version: 1.0",
    ...part.headers,
  ];

  const result = `${headers.join("\r\n")}\r\n\r\n${part.body}`;

  return result.endsWith("\r\n") ? result : `${result}\r\n`;
}
