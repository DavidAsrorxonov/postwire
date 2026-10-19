import { validateMailbox } from "./mailbox.js";

export function formatMailboxHeader(
  name: "To" | "Cc",
  addresses: readonly string[],
): string {
  if (addresses.length === 0) {
    throw new Error(`${name} requires at least one address.`);
  }

  const lines: string[] = [];
  let line = `${name}:`;

  for (const [index, address] of addresses.entries()) {
    validateMailbox(address);

    const suffix = index < addresses.length - 1 ? "," : "";
    const token = `${address}${suffix}`;

    if (line.length + 1 + token.length > 78) {
      lines.push(line);
      line = ` ${token}`;
    } else {
      line += ` ${token}`;
    }
  }

  lines.push(line);
  return lines.join("\r\n");
}
