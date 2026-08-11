// Automates the manual cloudflared dance from the README's "Telegram
// setup" section: kill any stale tunnel for this project, start a fresh
// one, parse the quick-tunnel URL it prints, and rewrite
// NEXT_PUBLIC_APP_URL in .env to match — the same steps done by hand
// whenever the tunnel dies mid-session. Never touches `npm run dev`
// itself (see the dev-server-workflow note in the README) — you still
// need to restart that yourself once .env changes, same as always.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env");
const TUNNEL_URL = "http://localhost:3000";
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function cloudflaredIsInstalled(): boolean {
  return spawnSync("which", ["cloudflared"]).status === 0;
}

/** Best-effort — only matches processes running this exact tunnel target, never any other cloudflared process on the machine. */
function killStaleTunnel(): void {
  const found = spawnSync("pgrep", ["-f", `cloudflared tunnel --url ${TUNNEL_URL}`]);
  const pids = found.stdout?.toString().trim().split("\n").filter(Boolean) ?? [];
  for (const pid of pids) {
    spawnSync("kill", [pid]);
  }
}

function updateEnvFile(url: string): void {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const line = `NEXT_PUBLIC_APP_URL="${url}"`;
  const hasLine = /^NEXT_PUBLIC_APP_URL=/m.test(existing);
  const updated = hasLine ? existing.replace(/^NEXT_PUBLIC_APP_URL=.*$/m, line) : `${existing.trimEnd()}\n${line}\n`;
  writeFileSync(ENV_PATH, updated);
}

function main(): void {
  if (!cloudflaredIsInstalled()) {
    console.error("cloudflared isn't installed — run `brew install cloudflared` first (see README).");
    process.exit(1);
  }

  killStaleTunnel();

  console.log("Starting a fresh cloudflared tunnel...\n");
  const child = spawn("cloudflared", ["tunnel", "--url", TUNNEL_URL], { stdio: ["inherit", "pipe", "pipe"] });

  let urlHandled = false;
  function handleChunk(chunk: Buffer): void {
    process.stderr.write(chunk); // cloudflared logs go to its own stdout/stderr either way — mirror all of it through
    if (urlHandled) return;
    const match = chunk.toString().match(URL_PATTERN);
    if (!match) return;
    urlHandled = true;
    const url = match[0];
    updateEnvFile(url);
    console.log(`\n✓ NEXT_PUBLIC_APP_URL updated to ${url}`);
    console.log("  Restart `npm run dev` to pick it up (env vars only load at startup).\n");
  }

  child.stdout?.on("data", handleChunk);
  child.stderr?.on("data", handleChunk);

  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

main();
