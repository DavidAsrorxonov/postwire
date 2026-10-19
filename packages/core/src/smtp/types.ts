export type SmtpTlsMode = "implicit" | "starttls-required";

export type SmtpAuthMechanism = "PLAIN" | "LOGIN";

export interface SmtpCredentials {
  readonly username: string;
  readonly password: string;
}

// All durations are milliseconds.
export interface SmtpTimeouts {
  readonly connect: number;
  readonly tls: number;
  readonly greeting: number;
  readonly command: number;
  readonly dataWrite: number;
  readonly finalDataResponse: number;
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly tlsMode: SmtpTlsMode;

  // the client identity sent with EHLO
  readonly ehloHostname: string;

  // decrypted by the caller; never included in result or diagnostics
  readonly credentials: SmtpCredentials;

  // omitted values will use defaults defined with the connection layer
  readonly timeouts?: Partial<SmtpTimeouts>;

  // optional PEM trust roots, including our local integration-test CA.
  // certificate-chain and hostname verification remain mandatory
  readonly ca?: string | readonly string[];
}

export type SmtpStage =
  | "connect"
  | "tls"
  | "greeting"
  | "ehlo"
  | "starttls"
  | "auth"
  | "mail"
  | "rcpt"
  | "data"
  | "data-write"
  | "data-checkpoint"
  | "data-final"
  | "quit";

// a complete reply, emitted only after its final line arrives
// lines contain reply text without the code, separator or trailing CRLF
// internal protocol data: do not log blindly, especially during AUTH
export interface SmtpResponse {
  readonly code: number;
  readonly lines: readonly string[];
}

export interface SmtpEnvelope {
  readonly from: string;

  // selected recipients for this attempt, inlcuding applicable Bcc
  // this can differ from the original message's visible To/Cc headers
  readonly recipients: readonly string[];
}

export type SmtpFailureKind =
  | "response"
  | "transport"
  | "timeout"
  | "protocol"
  | "configuration"
  | "checkpoint"
  | "aborted";

export interface SmtpFailure {
  readonly kind: SmtpFailureKind;
  readonly stage: SmtpStage;

  // A bounded, sanitized explanation, never raw credentials or AUTH payloads.
  readonly message: string;

  readonly responseCode?: number;
}

interface SmtpRecipientResultBase {
  readonly address: string;

  // The stage that determined this recipient's outcome.
  readonly stage: SmtpStage;
  readonly responseCode?: number;
  readonly failure?: SmtpFailure;
}

export type SmtpRecipientResult = SmtpRecipientResultBase &
  (
    | {
        readonly status: "sent";
        readonly acceptance: "accepted";
      }
    | {
        readonly status: "retry";
        readonly acceptance: "not-accepted";
      }
    | {
        readonly status: "failed";
        readonly acceptance: "not-accepted";
      }
    | {
        readonly status: "unknown";
        readonly acceptance: "unknown";
      }
  );

export type SmtpRcptResult =
  | {
      readonly address: string;
      readonly status: "admitted";
      readonly responseCode: 250 | 251;
    }
  | {
      readonly address: string;
      readonly status: "retry" | "failed";
      readonly responseCode: number;
    };

export interface SmtpDataCheckpoint {
  // Snapshot of every envelope recipient's RCPT outcome.
  // "Admitted" means eligible for DATA, not accepted as a sent message.
  readonly recipients: readonly SmtpRcptResult[];
}

export interface SmtpSendRequest {
  readonly config: SmtpConfig;
  readonly envelope: SmtpEnvelope;

  // Complete output from buildMessage(), before SMTP dot-stuffing.
  readonly mime: string;

  readonly signal?: AbortSignal;

  // Called after writing the payload but before sending the DATA terminator.
  // Resolution acknowledges the checkpoint. Rejection prevents the terminator.
  readonly beforeDataCommit?: (snapshot: SmtpDataCheckpoint) => Promise<void>;
}

export interface SmtpAttemptResult {
  // Exactly one final outcome for each selected envelope recipient.
  readonly recipients: readonly SmtpRecipientResult[];

  // A session-level failure, if one interrupted the attempt.
  readonly failure?: SmtpFailure;

  // Cleanup problems must not overwrite definitive delivery outcomes.
  readonly cleanupFailure?: SmtpFailure;
}
