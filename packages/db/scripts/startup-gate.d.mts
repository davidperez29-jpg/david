/** See startup-gate.mjs. */
export declare const SETUP_SETTINGS: string[];
export declare function startupFingerprint(
  env: Record<string, string | undefined>,
): { release: string; fingerprint: string } | null;
