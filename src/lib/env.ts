import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Load KEY=value pairs from .env if present (no dependency on dotenv). */
export function loadEnv(cwd = process.cwd()): void {
  const path = resolve(cwd, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function stockroomBaseUrl(): string {
  return (
    process.env.STOCKROOM_BASE_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:43124"
  );
}

export function vercelBypassHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret?.trim()) return {};
  return { "x-vercel-protection-bypass": secret.trim() };
}
