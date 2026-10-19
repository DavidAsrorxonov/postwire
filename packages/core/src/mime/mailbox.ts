import { isIP } from "node:net";

const ATOM = /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+$/;

const QUOTED_LOCAL = /^"(?:[\x20-\x21\x23-\x5B\x5D-\x7E]|\\[\x20-\x7E])*"$/;

const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function isLocalPart(value: string): boolean {
  if (value.length === 0 || value.length > 64) {
    return false;
  }

  return (
    QUOTED_LOCAL.test(value) ||
    value.split(".").every((part) => ATOM.test(part))
  );
}

function isDomain(value: string): boolean {
  if (value.startsWith("[") && value.endsWith("]")) {
    const literal = value.slice(1, -1);

    if (/^IPv6:/i.test(literal)) {
      const address = literal.slice(5);

      return !address.includes("%") && isIP(address) === 6;
    }

    return isIP(literal) === 4;
  }

  return value.split(".").every((part) => DOMAIN_LABEL.test(part));
}

export function validateMailbox(address: string): void {
  if (
    address.length === 0 ||
    address.length > 254 ||
    /[^\x20-\x7E]/.test(address)
  ) {
    throw new Error("Invalid mailbox address.");
  }

  const separator = address.lastIndexOf("@");

  if (separator === -1) {
    throw new Error("Invalid mailbox address.");
  }

  const local = address.slice(0, separator);
  const domain = address.slice(separator + 1);

  if (!isLocalPart(local) || !isDomain(domain)) {
    throw new Error("Invalid mailbox address.");
  }
}
