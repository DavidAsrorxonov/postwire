import { decodeAttachmentBase64, encodeMimeBase64 } from "./base64.js";
import { formatAttachmentDisposition } from "./filename.js";
import { MimeAttachment, MimePart } from "./types.js";

const MEDIA_NAME = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;

function formatContentType(value: string): string {
  const [type, subtype, ...extra] = value.split("/");

  if (
    /[^\x21-\x7E]/.test(value) ||
    type === undefined ||
    subtype === undefined ||
    extra.length > 0 ||
    !MEDIA_NAME.test(type) ||
    !MEDIA_NAME.test(subtype)
  ) {
    throw new Error("Invalid attachment content type.");
  }

  const normalizedType = type.toLowerCase();
  const normalizedSubtype = subtype.toLowerCase();

  if (normalizedType === "multipart" || normalizedType === "message") {
    throw new Error("Unsupported attachment content type.");
  }

  const mediaType = `${normalizedType}/${normalizedSubtype}`;
  const line = `Content-Type: ${mediaType}`;

  return line.length <= 78 ? line : `Content-Type:\r\n ${mediaType}`;
}

export function buildAttachmentPart(attachment: MimeAttachment): MimePart {
  const contentType = formatContentType(attachment.contentType);
  const disposition = formatAttachmentDisposition(attachment.filename);
  const bytes = decodeAttachmentBase64(attachment.contentBase64);

  return {
    headers: [contentType, "Content-Transfer-Encoding: base64", disposition],
    body: encodeMimeBase64(bytes),
  };
}
