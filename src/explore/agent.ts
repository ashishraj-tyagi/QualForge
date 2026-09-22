import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, stockroomBaseUrl, vercelBypassHeaders } from "../lib/env.js";

loadEnv();

type Op = { method: string; path: string; summary?: string };

type StepLog = {
  step: number;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  note: string;
  durationMs: number;
};

type Finding = {
  severity: "info" | "warn" | "bug";
  title: string;
  steps: string[];
  expected: string;
  actual: string;
};

function loadOps(): Op[] {
  const live = resolve("artifacts/openapi.json");
  const snap = resolve("artifacts/openapi.snapshot.json");
  const path = existsSync(live) ? live : snap;
  if (!existsSync(path)) {
    throw new Error("No OpenAPI snapshot — run npm run ingest");
  }
  const doc = JSON.parse(readFileSync(path, "utf8")) as {
    paths?: Record<string, Record<string, { summary?: string }>>;
  };
  const ops: Op[] = [];
  for (const [p, methods] of Object.entries(doc.paths ?? {})) {
    for (const m of Object.keys(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
      ops.push({
        method: m.toUpperCase(),
        path: p,
        summary: methods[m]?.summary,
      });
    }
  }
  return ops;
}

function concretePath(template: string): string {
  // Replace {id} with a seeded product id for GET probes
  return template.replace(/\{[^}]+\}/g, "prod-1");
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...vercelBypassHeaders(),
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function main(): Promise<void> {
  const maxSteps = Number(process.env.EXPLORE_MAX_STEPS ?? 12);
  const timeoutMs = Number(process.env.EXPLORE_TIMEOUT_MS ?? 20000);
  const base = stockroomBaseUrl();
  const ops = loadOps().filter((o) => !o.path.includes("/test/reset")); // avoid wipe by default
  const deadline = Date.now() + timeoutMs;
  const log: StepLog[] = [];
  const findings: Finding[] = [];
  let token: string | undefined;

  console.log(
    `Bounded explore → ${base} (maxSteps=${maxSteps}, timeoutMs=${timeoutMs})`,
  );
  console.log(`Allowlist size: ${ops.length} operations from OpenAPI`);

  // Prefer a safe ordered plan within allowlist
  const plan: Op[] = [];
  const prefer = [
    "GET /api/health",
    "POST /api/auth",
    "GET /api/auth",
    "GET /api/products",
    "GET /api/products/{id}",
    "GET /api/cart",
    "GET /api/orders",
  ];
  for (const key of prefer) {
    const [method, path] = key.split(" ");
    const hit = ops.find((o) => o.method === method && o.path === path);
    if (hit) plan.push(hit);
  }
  for (const o of ops) {
    if (!plan.some((p) => p.method === o.method && p.path === o.path)) {
      // Only auto-add safe GETs beyond the prefer list
      if (o.method === "GET") plan.push(o);
    }
  }

  for (let i = 0; i < Math.min(maxSteps, plan.length); i++) {
    if (Date.now() > deadline) {
      findings.push({
        severity: "info",
        title: "Exploration stopped: timeout",
        steps: log.map((s) => `${s.method} ${s.path} → ${s.status}`),
        expected: `Complete within ${timeoutMs}ms`,
        actual: `Hit timeout after ${log.length} steps`,
      });
      break;
    }

    const op = plan[i];
    const path = concretePath(op.path);
    const started = Date.now();
    let status = 0;
    let note = op.summary ?? "";
    let bodyText = "";

    try {
      let body: string | undefined;
      if (op.method === "POST" && op.path === "/api/auth") {
        body = JSON.stringify({
          username: "standard",
          password: "password123",
        });
      }
      // Skip mutating admin/cart/order writes in bounded explore unless explicitly allowed
      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(op.method) &&
        op.path !== "/api/auth"
      ) {
        log.push({
          step: i + 1,
          method: op.method,
          path,
          status: 0,
          ok: true,
          note: "skipped mutating op (read-mostly explore)",
          durationMs: 0,
        });
        continue;
      }

      const res = await fetch(`${base}${path}`, {
        method: op.method,
        headers: headers(token),
        body,
        redirect: "manual",
      });
      status = res.status;
      bodyText = await res.text();
      if (op.path === "/api/auth" && op.method === "POST" && res.ok) {
        try {
          token = (JSON.parse(bodyText) as { token?: string }).token;
          note = "captured session token";
        } catch {
          /* ignore */
        }
      }

      // Heuristic findings
      if (status >= 500) {
        findings.push({
          severity: "bug",
          title: `Server error on ${op.method} ${path}`,
          steps: [
            ...log.map((s) => `${s.method} ${s.path}`),
            `${op.method} ${path}`,
          ],
          expected: "2xx/4xx without 5xx",
          actual: `HTTP ${status}: ${bodyText.slice(0, 180)}`,
        });
      } else if (
        op.method === "GET" &&
        status === 401 &&
        op.path !== "/api/auth" &&
        !token
      ) {
        findings.push({
          severity: "info",
          title: `Auth required for ${path}`,
          steps: [`${op.method} ${path}`],
          expected: "401 without token is acceptable for protected routes",
          actual: `HTTP ${status}`,
        });
      }
    } catch (err) {
      note = err instanceof Error ? err.message : String(err);
      findings.push({
        severity: "bug",
        title: `Request failed: ${op.method} ${path}`,
        steps: log.map((s) => `${s.method} ${s.path}`),
        expected: "Reachable AUT",
        actual: note,
      });
    }

    log.push({
      step: i + 1,
      method: op.method,
      path,
      status,
      ok: status > 0 && status < 500,
      note,
      durationMs: Date.now() - started,
    });
    console.log(
      `  [${i + 1}/${maxSteps}] ${op.method} ${path} → ${status || "skip"} (${note})`,
    );
  }

  if (log.length >= maxSteps) {
    findings.push({
      severity: "info",
      title: "Exploration stopped: step cap reached",
      steps: log.map((s) => `${s.method} ${s.path} → ${s.status}`),
      expected: `Stay within EXPLORE_MAX_STEPS=${maxSteps}`,
      actual: `Executed ${log.length} steps`,
    });
  }

  mkdirSync(resolve("artifacts"), { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: base,
    maxSteps,
    timeoutMs,
    stepsExecuted: log.length,
    log,
    findings,
  };
  writeFileSync(
    resolve("artifacts/explore-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );

  const md = [
    "# Bounded exploratory agent report",
    "",
    `_Generated: ${report.generatedAt}_`,
    "",
    `Base: \`${base}\` · steps: **${log.length}/${maxSteps}** · timeout: ${timeoutMs}ms`,
    "",
    "## Findings",
    "",
  ];
  if (findings.length === 0) {
    md.push("_No findings._", "");
  } else {
    for (const f of findings) {
      md.push(
        `### [${f.severity}] ${f.title}`,
        "",
        `- Expected: ${f.expected}`,
        `- Actual: ${f.actual}`,
        `- Steps:`,
        ...f.steps.map((s) => `  - \`${s}\``),
        "",
      );
    }
  }
  md.push("## Step log", "", "```");
  for (const s of log) {
    md.push(
      `${s.step}. ${s.method} ${s.path} → ${s.status} (${s.durationMs}ms) ${s.note}`,
    );
  }
  md.push("```", "");
  writeFileSync(resolve("artifacts/explore-report.md"), md.join("\n"));

  console.log(`Findings: ${findings.length}`);
  console.log("Wrote artifacts/explore-report.json and explore-report.md");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
