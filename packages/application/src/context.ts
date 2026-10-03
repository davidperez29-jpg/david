import type { Database } from '@tp/db';
import type { KeyRing } from '@tp/auth';
import type { Actor } from '@tp/domain';

export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

/** In-memory mailer used in development and tests until an EU email provider is configured. */
export class MemoryMailer implements Mailer {
  readonly sent: { to: string; subject: string; text: string }[] = [];
  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    this.sent.push(message);
  }
}

export interface AppContext {
  db: Database;
  keys: KeyRing;
  mailer: Mailer;
  baseUrl: string;
  now: () => Date;
  requestId?: string;
  ipHash?: string | null;
}

export interface RequestContext extends AppContext {
  actor: Actor;
}
