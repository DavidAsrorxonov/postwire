# Phase 1 MIME inspection — 2026-10-19

The assistant inspected [phase-1.eml](phase-1.eml), generated through the built
`@postwire/core` public export. Its input matches the one-attachment case in
[`build-message.fixtures.test.ts`](../../packages/core/src/mime/build-message.fixtures.test.ts).
The complete raw message was read, with byte-level checks and independent decoding
using Python's generic `base64`, `quopri`, and URL percent-decoding utilities.
No dependencies were added.

## Recorded artifact

- Size: 1,113 bytes; 35 CRLF sequences; no bare CR or LF.
- Longest physical line: 61 ASCII bytes, excluding CRLF.
- SHA-256: `5b32e385b031ac2d1b11da0c97a878408246a1bbf887d5c8541db07779279333`.
- Fixed metadata: `fixture-001@example.com`, `2026-01-01T00:00:00.000Z`,
  boundary seed `phase-1-fixture`.

## Inspection results

| Area | Observed result |
| --- | --- |
| Message headers | UTC Date with matching weekday, From, To, Cc, bracketed Message-ID, and MIME-Version present. Header/body separators and continuation whitespace are correct. |
| Subject | `=?UTF-8?B?Y2Fmw6k=?=` decodes to `café`. |
| Privacy | No Bcc header or hidden recipient address appears in the message. The original Bcc input is preserved. |
| Multipart structure | Mixed contains an alternative body followed by one attachment. Alternative contains plain text followed by HTML. Each boundary has two opening delimiters and one closing delimiter; inner and outer boundaries are distinct. |
| Newlines | Every physical line uses CRLF. The text's own final newline is preserved before the delimiter's CRLF. The nested multipart closing line is also preserved before the outer delimiter. |
| Text encoding | Quoted-printable decodes to `Hello, café!\r\n` and `<p>Hello, café!</p>`. Encoded lines are below 76 characters. |
| Attachment | Base64 `AAEC/f7/` decodes to six bytes: `00 01 02 FD FE FF`. |
| Filename | `filename*=UTF-8''%63%61%66%C3%A9%2E%62%69%6E` decodes to `café.bin`. |
| Repeatability | Repeated public-API calls produce identical output and leave message and metadata inputs unchanged. |

The inspection used [RFC 5322](https://www.rfc-editor.org/rfc/rfc5322.html)
for message syntax, [RFC 2045](https://www.rfc-editor.org/rfc/rfc2045.html)
for transfer encodings, [RFC 2046 §5.1](https://www.rfc-editor.org/rfc/rfc2046.html#section-5.1)
for multipart framing, [RFC 2047](https://www.rfc-editor.org/rfc/rfc2047.html)
for subject encoding, and [RFC 2231](https://www.rfc-editor.org/rfc/rfc2231.html)
for the filename parameter. This is inspection of this sample, supported by unit
tests; mail-client interoperability and real SMTP delivery belong to later work.

## Verification run

- `npm test -w packages/core`: 201 tests passed across 15 files.
- `npm run build`: core, db-models, web, and worker passed.
- `npm run check:boundaries`: package and source boundaries passed.
- Root-level import of built `@postwire/core`: public API smoke passed; only
  `buildMessage` is exported at runtime. Nested multipart structure, CRLF,
  deterministic output, Bcc omission, and unchanged inputs were checked.

To reproduce the inspected bytes after building, run this from the repository root:

```sh
node --input-type=module <<'JS'
import { buildMessage } from '@postwire/core';
import { createHash } from 'node:crypto';
const raw = buildMessage({
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  cc: ['copy@example.com'],
  bcc: ['hidden@example.com'],
  subject: 'café',
  text: 'Hello, café!\n',
  html: '<p>Hello, café!</p>',
  attachments: [{
    filename: 'café.bin',
    contentType: 'application/octet-stream',
    contentBase64: 'AAEC/f7/',
  }],
}, {
  messageId: 'fixture-001@example.com',
  date: new Date('2026-01-01T00:00:00.000Z'),
  boundarySeed: 'phase-1-fixture',
});
console.log(createHash('sha256').update(raw, 'utf8').digest('hex'));
process.stdout.write(raw);
JS
```
