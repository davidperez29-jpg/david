import { appendFileSync, mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';

/**
 * Timed UX tasks (Fase 9 acceptance, §16.2): each task counts the person's interactions
 * (clicks, selections, typing a field) and the elapsed time from the starting screen.
 * Results are appended to test-results/ux-timings.jsonl and summarised in docs/UX_REVIEW.md.
 */
export class TimedTask {
  private started = Date.now();
  interactions = 0;
  constructor(
    readonly page: Page,
    readonly name: string,
  ) {}
  /** One human interaction. */
  async step<T>(fn: () => Promise<T>): Promise<T> {
    this.interactions++;
    return fn();
  }
  done() {
    const ms = Date.now() - this.started;
    mkdirSync('test-results', { recursive: true });
    appendFileSync(
      'test-results/ux-timings.jsonl',
      JSON.stringify({ task: this.name, interactions: this.interactions, ms }) + '\n',
    );
    console.log(
      `UX · ${this.name}: ${this.interactions} interacciones, ${(ms / 1000).toFixed(1)} s`,
    );
    return { ms, interactions: this.interactions };
  }
}
