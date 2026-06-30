/**
 * Minimal PostHog capture client. The project API key is a *public, write-only*
 * key (PostHog is designed for it to ship in client apps), so embedding it is
 * safe. Until a real key is set, every call here is a no-op — the package can be
 * published and run with telemetry effectively dark.
 *
 * To enable: replace EMBEDDED_KEY with your PostHog project key (Project
 * Settings → API keys → "Project API Key", starts with `phc_`), or set
 * SKILLMAX_POSTHOG_KEY at runtime. EU users: set SKILLMAX_POSTHOG_HOST to
 * https://eu.i.posthog.com.
 */

const DEFAULT_HOST = 'https://us.i.posthog.com';
const EMBEDDED_KEY = 'phc_REPLACE_WITH_YOUR_POSTHOG_PROJECT_KEY';

/** Per-request wall-clock cap so a slow/offline network never stalls the CLI. */
const CAPTURE_TIMEOUT_MS = 1200;

/** Resolve the active key, or '' when none is configured (telemetry stays dark). */
export function posthogKey(): string {
  const k = (process.env.SKILLMAX_POSTHOG_KEY || EMBEDDED_KEY).trim();
  return k.startsWith('phc_REPLACE') ? '' : k;
}

function posthogHost(): string {
  return (process.env.SKILLMAX_POSTHOG_HOST || DEFAULT_HOST).replace(/\/+$/, '');
}

export interface CapturePayload {
  event: string;
  distinctId: string;
  properties: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Fire one capture event. Resolves quietly on any failure — telemetry must never
 * throw, hang, or surface an error to the user.
 */
export async function capture(payload: CapturePayload): Promise<void> {
  const apiKey = posthogKey();
  if (!apiKey || typeof fetch !== 'function') return;

  const body = JSON.stringify({
    api_key: apiKey,
    event: payload.event,
    distinct_id: payload.distinctId,
    properties: payload.properties,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CAPTURE_TIMEOUT_MS);
  try {
    await fetch(`${posthogHost()}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: ctrl.signal,
    });
  } catch {
    /* offline, aborted, blocked — silently ignore */
  } finally {
    clearTimeout(timer);
  }
}
