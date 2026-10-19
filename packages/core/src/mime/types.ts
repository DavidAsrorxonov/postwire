export interface MimeMessage {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string | null;
  html?: string | null;
  attachments?: MimeAttachment[];
}

export interface MimeMetadata {
  messageId: string;
  date: Date;
  boundarySeed: string;
}

export interface MimePart {
  headers: string[];
  body: string;
}

export interface MimeAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}
