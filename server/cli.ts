// npm run collect [-- <day>]  → list the candidates without calling OpenCode (free; good first check)
// npm run refresh [-- <day>]  → run the whole pipeline once and write data/top3.json
// <day> is "today", "yesterday" or YYYY-MM-DD; leave it out for the last MAX_AGE_HOURS.
import { collect, parseWindow } from "./collector.ts";
import { refresh } from "./pipeline.ts";

const [command, day] = process.argv.slice(2);
const window = parseWindow(day);

if (command === "collect") {
  const items = await collect(window);
  console.log(`${window.label}: ${items.length} candidates\n`);
  for (const i of items.slice(0, 30)) {
    console.log(`${i.prescore.toFixed(1).padStart(5)}  [${i.source}] ${i.title}\n       ${i.url}`);
  }
} else if (command === "refresh") {
  const snapshot = await refresh(window);
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.error("usage: cli.ts collect|refresh [today|yesterday|YYYY-MM-DD]");
  process.exit(1);
}
