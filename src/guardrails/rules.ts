import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type Finding = {
  severity: "error" | "warn";
  file: string;
  rule: string;
  message: string;
};

const SECRET_PATTERNS: { rule: string; re: RegExp }[] = [
  { rule: "secret-token", re: /sk-[a-zA-Z0-9]{20,}/ },
  { rule: "secret-aws", re: /AKIA[0-9A-Z]{16}/ },
  { rule: "secret-bearer", re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i },
  {
    rule: "secret-env-inline",
    re: /(api[_-]?key|password|secret)\s*[:=]\s*["'][^"']{12,}["']/i,
  },
];

const REQUIRED_FEATURE_TAGS = ["@api"];
const RISK_TAGS = ["@smoke", "@critical", "@high", "@medium", "@low", "@regression"];

const ALLOWED_HOST_HINTS = [
  "127.0.0.1",
  "localhost",
  "stock-room-ashishraj-tyagi.vercel.app",
];

export function loadOpenApiPaths(
  openapiPath = resolve("artifacts/openapi.json"),
): Set<string> | null {
  const fallback = resolve("artifacts/openapi.snapshot.json");
  const path = existsSync(openapiPath)
    ? openapiPath
    : existsSync(fallback)
      ? fallback
      : null;
  if (!path) return null;
  const doc = JSON.parse(readFileSync(path, "utf8")) as {
    paths?: Record<string, unknown>;
  };
  return new Set(Object.keys(doc.paths ?? {}));
}

export function listFeatureFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".feature"))
    .map((f) => join(dir, f))
    .sort();
}

function extractHttpCalls(content: string): { method: string; path: string }[] {
  const calls: { method: string; path: string }[] = [];
  const re =
    /(?:send a|send)\s+(GET|POST|PUT|PATCH|DELETE)\s+request\s+to\s+"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    calls.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return calls;
}

function featureTags(content: string): string[] {
  const firstLines = content.split("\n").slice(0, 30);
  const tags: string[] = [];
  for (const line of firstLines) {
    if (/^\s*Feature:/i.test(line)) break;
    const found = line.match(/@[a-zA-Z0-9_-]+/g);
    if (found) tags.push(...found);
  }
  return tags;
}

export function checkFeature(
  file: string,
  content: string,
  openApiPaths: Set<string> | null,
): Finding[] {
  const findings: Finding[] = [];
  const base = file.split(/[/\\]/).pop() ?? file;

  const tags = featureTags(content);
  for (const required of REQUIRED_FEATURE_TAGS) {
    if (!tags.includes(required)) {
      findings.push({
        severity: "error",
        file: base,
        rule: "required-tag",
        message: `Feature must include tag ${required}`,
      });
    }
  }
  if (!RISK_TAGS.some((t) => tags.includes(t))) {
    findings.push({
      severity: "error",
      file: base,
      rule: "risk-tag",
      message: `Feature must include a risk/priority tag: ${RISK_TAGS.join(", ")}`,
    });
  }

  for (const { rule, re } of SECRET_PATTERNS) {
    if (re.test(content)) {
      findings.push({
        severity: "error",
        file: base,
        rule,
        message: "Possible secret or credential pattern detected",
      });
    }
  }

  for (const hint of ["https://", "http://"]) {
    if (content.toLowerCase().includes(hint)) {
      const hostOk = ALLOWED_HOST_HINTS.some((h) => content.includes(h));
      if (!hostOk) {
        findings.push({
          severity: "error",
          file: base,
          rule: "host-allowlist",
          message:
            "Absolute URL found outside StockRoom allowlist — use relative API paths only",
        });
        break;
      }
    }
  }

  const calls = extractHttpCalls(content);
  if (calls.length === 0) {
    findings.push({
      severity: "warn",
      file: base,
      rule: "no-http-steps",
      message:
        'No recognizable "send a METHOD request to \\"/path\\"" steps found',
    });
  }

  if (openApiPaths) {
    for (const { method, path } of calls) {
      const normalized = path.split("?")[0];
      // Allow path params like /api/products/{id} vs /api/products/prod-1
      const matched = [...openApiPaths].some((p) => {
        if (p === normalized) return true;
        const pattern = "^" + p.replace(/\{[^}]+\}/g, "[^/]+") + "$";
        return new RegExp(pattern).test(normalized);
      });
      if (!matched) {
        findings.push({
          severity: "error",
          file: base,
          rule: "openapi-path",
          message: `${method} ${normalized} is not in OpenAPI snapshot (run npm run ingest)`,
        });
      }
    }
  } else {
    findings.push({
      severity: "warn",
      file: base,
      rule: "missing-openapi",
      message: "artifacts/openapi.json missing — contract path checks skipped",
    });
  }

  if (!/Scenario:/i.test(content)) {
    findings.push({
      severity: "error",
      file: base,
      rule: "has-scenario",
      message: "Feature file has no Scenario",
    });
  }

  return findings;
}
