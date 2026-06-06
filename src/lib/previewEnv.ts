// Preview env handling.
//
// The WebContainer preview runs the REAL imported app inside the browser, so any
// env value we inject ends up exposed to the client. Only public, browser-safe
// keys may be injected. We accept `NEXT_PUBLIC_*` and `VITE_*` (framework public
// prefixes) and hard-reject anything that looks like a server secret.

export interface ParsedEnv {
  /** Accepted public KEY=value pairs. */
  safe: Record<string, string>;
  /** Keys rejected because they look like server secrets (would leak to the browser). */
  rejected: string[];
}

const PUBLIC_PREFIX = /^(NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_)/;
// Secret-shaped keys never belong in a client-exposed preview.
const SECRET_RE = /(SERVICE_ROLE|SECRET|PRIVATE|_TOKEN|PASSWORD|^DATABASE_URL$|ANTHROPIC|OPENAI|GEMINI)/i;

function isPublicKey(key: string): boolean {
  if (SECRET_RE.test(key)) return false;
  return PUBLIC_PREFIX.test(key);
}

/** Parse a `.env`-style blob into accepted (public) and rejected (secret-shaped) keys. */
export function parsePreviewEnv(raw: string | null | undefined): ParsedEnv {
  const safe: Record<string, string> = {};
  const rejected: string[] = [];
  if (!raw) return { safe, rejected };

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    // Strip surrounding quotes.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (isPublicKey(key)) safe[key] = value;
    else rejected.push(key);
  }
  return { safe, rejected };
}

/** Serialize accepted keys back into a `.env.local` file body. */
export function buildEnvFile(safe: Record<string, string>): string {
  return Object.entries(safe)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}
