// npm run selftest [-- <case-id> ...]
// Sends the made-up articles in cases.ts to the validator agent and checks each verdict.
// Nothing is saved and the page is not touched. Uses OpenCode Go allowance (about 6 articles).
import { assertReachable, validateOne } from "../validate.ts";
import { CASES, type TestCase } from "./cases.ts";

const only = process.argv.slice(2);
const cases = only.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
if (cases.length === 0) {
  console.error(`No matching cases. Available: ${CASES.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

await assertReachable();
console.log(`Running ${cases.length} test case(s)…\n`);

async function runCase(tc: TestCase) {
  const started = Date.now();
  try {
    const { validation: v, model } = await validateOne(tc.candidate);
    const failure = tc.check(v);
    return { tc, ok: failure === null, line: `${v.verdict} (${Math.round(v.confidence * 100)}%)`, failure, v, model, secs: Math.round((Date.now() - started) / 1000) };
  } catch (err) {
    return { tc, ok: false, line: "error", failure: (err as Error).message, v: null, model: "", secs: Math.round((Date.now() - started) / 1000) };
  }
}

// Three at a time, like the real pipeline.
const results: Awaited<ReturnType<typeof runCase>>[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(3, cases.length) }, async () => {
    while (next < cases.length) results.push(await runCase(cases[next++]));
  }),
);

results.sort((a, b) => CASES.indexOf(a.tc) - CASES.indexOf(b.tc));
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.tc.id.padEnd(24)} ${r.line.padEnd(22)} ${r.secs}s  ${r.model}`);
  console.log(`      ${r.tc.what}`);
  if (r.failure) console.log(`      ✗ ${r.failure}`);
  if (r.v) {
    if (r.v.red_flags.length) console.log(`      red flags: ${r.v.red_flags.join(" | ")}`);
    console.log(`      reasons:   ${r.v.reasons.join(" | ")}`);
  }
  console.log();
}
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
