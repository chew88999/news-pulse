import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { collect, parseWindow, type Window } from "./collector.ts";
import { rankTop3 } from "./rank.ts";
import type { Snapshot } from "./types.ts";
import { validateMany } from "./validate.ts";

const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const MAX_VALIDATE = Number(process.env.MAX_VALIDATE ?? 8);

/** data/top3.json for the rolling window, data/day-YYYY-MM-DD.json for a chosen day. */
function snapshotPath(key: string): string {
  return key === "latest" ? `${DATA_DIR}top3.json` : `${DATA_DIR}day-${key}.json`;
}

const running = new Map<string, Promise<Snapshot>>();
const lastError = new Map<string, string>();

/** Collect → validate → rank → save. At most one refresh per window runs at a time. */
export function refresh(window: Window = parseWindow()): Promise<Snapshot> {
  let job = running.get(window.key);
  if (!job) {
    lastError.delete(window.key);
    job = doRefresh(window)
      .catch((err: Error) => {
        lastError.set(window.key, err.message);
        throw err;
      })
      .finally(() => running.delete(window.key));
    running.set(window.key, job);
  }
  return job;
}

export function refreshState(key: string): { running: boolean; error?: string } {
  return { running: running.has(key), error: lastError.get(key) };
}

async function doRefresh(window: Window): Promise<Snapshot> {
  const started = Date.now();
  const candidates = await collect(window);
  console.log(`[pipeline] ${window.label}: collected ${candidates.length} candidates; validating top ${MAX_VALIDATE}`);

  const { ok, failed } = await validateMany(candidates.slice(0, MAX_VALIDATE));
  const { items, rejectedAsFake } = rankTop3(ok);

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    window: window.label,
    day: window.key === "latest" ? undefined : window.key,
    items,
    stats: { collected: candidates.length, validated: ok.length, rejectedAsFake, failed },
  };
  // The rolling view keeps its previous result if nothing passed; a chosen day saves even an
  // empty result so the page can say "nothing that day" instead of crawling again.
  if (items.length > 0 || (window.key !== "latest" && failed === 0)) {
    const file = snapshotPath(window.key);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(snapshot, null, 2));
    await rename(`${file}.tmp`, file);
  } else {
    console.warn("[pipeline] no items passed validation; keeping the previous snapshot");
  }
  console.log(`[pipeline] done in ${Math.round((Date.now() - started) / 1000)}s`);
  return snapshot;
}

export async function loadSnapshot(key = "latest"): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(snapshotPath(key), "utf8")) as Snapshot;
  } catch {
    return null;
  }
}
