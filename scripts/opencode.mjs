// Starts `opencode serve` in the project folder so it picks up opencode.json,
// .opencode/agents and .opencode/skills, with the variables from .env.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

for (const name of ["OPENCODE_GO_API_KEY", "OPENCODE_MODEL"]) {
  if (!process.env[name]) {
    console.error(`${name} is not set. Fill it in in .env (see .env.example).`);
    process.exit(1);
  }
}
console.log(`Model: ${process.env.OPENCODE_MODEL}`);
if (!process.env.OPENCODE_SERVER_PASSWORD) {
  console.warn("Warning: OPENCODE_SERVER_PASSWORD is not set, so the OpenCode server has no password.");
}

const url = new URL(process.env.OPENCODE_URL ?? "http://127.0.0.1:4096");
const root = fileURLToPath(new URL("..", import.meta.url));

const child = spawn("opencode", ["serve", "--hostname", url.hostname, "--port", url.port || "4096"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
