// Starts the whole app in one process tree for hosting (Docker / Render):
// OpenCode on 127.0.0.1 with a random password, then the web server on HOST:PORT.
// If either stops, the other is stopped too so the host restarts the container.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = {
  ...process.env,
  OPENCODE_MODEL: process.env.OPENCODE_MODEL || "opencode-go/glm-5.3-flash",
  OPENCODE_URL: process.env.OPENCODE_URL || "http://127.0.0.1:4096",
  // Only the web server talks to OpenCode, so a fresh random password each start is enough.
  OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || randomBytes(24).toString("hex"),
  HOST: process.env.HOST || "0.0.0.0",
};
if (!env.OPENCODE_GO_API_KEY) {
  console.error("OPENCODE_GO_API_KEY is not set. Add it in your host's environment settings.");
  process.exit(1);
}

const children = [];
function start(name, cmd, args, { shell = false } = {}) {
  const child = spawn(cmd, args, { cwd: root, env, stdio: "inherit", shell });
  child.on("exit", (code) => {
    console.error(`[start-cloud] ${name} exited (${code}); stopping`);
    for (const c of children) if (c !== child) c.kill();
    process.exit(code ?? 1);
  });
  children.push(child);
  return child;
}
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => children.forEach((c) => c.kill(sig)));

const oc = new URL(env.OPENCODE_URL);
// On Windows `opencode` is a .cmd shim, which needs a shell; the Linux container doesn't.
start("opencode", "opencode", ["serve", "--hostname", oc.hostname, "--port", oc.port || "4096"], { shell: process.platform === "win32" });

// Wait until OpenCode answers (401 = up and password-protected).
const deadline = Date.now() + 90_000;
while (true) {
  // Short timeout: while OpenCode is starting it may accept a connection without answering.
  const status = await fetch(`${env.OPENCODE_URL}/config`, { signal: AbortSignal.timeout(3000) }).then((r) => r.status, () => 0);
  if (status === 401 || status === 200) break;
  if (Date.now() > deadline) {
    console.error("[start-cloud] OpenCode did not start within 90 s");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`[start-cloud] OpenCode is up (model ${env.OPENCODE_MODEL})`);

start("web", process.execPath, ["--import", "tsx", "server/index.ts"]);
