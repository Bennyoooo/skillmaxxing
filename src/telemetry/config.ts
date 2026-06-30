import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { ensureDir } from '../util/fs.js';

/** On-disk telemetry preferences. No PII — anonId is a random UUID. */
export interface TelemetryConfig {
  /** Random, non-reversible install identifier. */
  anonId: string;
  /** Whether usage events may be sent. */
  enabled: boolean;
  /** True once the user has been asked (so we never prompt twice). */
  prompted: boolean;
  /** ISO date (YYYY-MM-DD) of the last active ping, to ping at most once/day. */
  lastActive?: string;
  createdAt: string;
}

function configFile(): string {
  // Resolved per-call so tests can override HOME between runs.
  return path.join(os.homedir(), '.skillmax', 'telemetry.json');
}

export function configPath(): string {
  return configFile();
}

export function loadConfig(): TelemetryConfig | null {
  try {
    const data = JSON.parse(fs.readFileSync(configFile(), 'utf-8'));
    if (data && typeof data.anonId === 'string' && typeof data.enabled === 'boolean') {
      return data as TelemetryConfig;
    }
  } catch {
    /* absent or corrupt */
  }
  return null;
}

export function saveConfig(cfg: TelemetryConfig): void {
  const file = configFile();
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export function newConfig(now: string): TelemetryConfig {
  return { anonId: randomUUID(), enabled: false, prompted: false, createdAt: now };
}
