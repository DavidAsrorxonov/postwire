const ATOM = /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+$/;

const DOMAIN_LITERAL = /^\[[\x21-\x5A\x5E-\x7E]*\]$/;

function isDotAtom(value: string): boolean {
  return value.split(".").every((part) => ATOM.test(part));
}

export function validateMessageId(messageId: string): void {
  if (messageId.length === 0 || /[^\x21-\x7E]/.test(messageId)) {
    throw new Error("Invalid Message-ID.");
  }

  const separator = messageId.indexOf("@");

  if (separator === -1) {
    throw new Error("Invalid Message-ID.");
  }

  const left = messageId.slice(0, separator);
  const right = messageId.slice(separator + 1);

  if (!isDotAtom(left) || !(isDotAtom(right) || DOMAIN_LITERAL.test(right))) {
    throw new Error("Invalid Message-ID.");
  }
}
