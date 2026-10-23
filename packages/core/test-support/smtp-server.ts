import { Buffer } from "node:buffer";
import { once } from "node:events";
import { createServer, type Socket } from "node:net";

export interface SmtpTestPeer {
  readLine(): Promise<string>;
  send(...chunks: string[]): Promise<void>;
  disconnect(): void;
}

export interface SmtpTestServer {
  readonly host: string;
  readonly port: number;

  // resolves when the server script finishes.
  // rejects when the script, socket, or watchdog fails.
  readonly done: Promise<void>;

  close(): Promise<void>;
}

// this is a fixture input limit, not the productijn SMTP command limit
const MAX_INPUT_LINE_BYTES = 64 * 1024;

async function* readLines(socket: Socket): AsyncGenerator<string> {
  let pending: Buffer = Buffer.alloc(0);
}
