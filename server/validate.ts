import { createOpencodeClient } from "@opencode-ai/sdk/v2";
import { Agent, setGlobalDispatcher } from "undici";
import { z } from "zod";
import { Validation, type Candidate } from "./types.ts";

// A validation can take several minutes while the agent fetches pages. Node's fetch gives up
// after 5 minutes without response headers, so turn that off and use our own limit instead.
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const OPENCODE_URL = process.env.OPENCODE_URL ?? "http://127.0.0.1:4096";
// The model is not chosen here: OpenCode uses the one in opencode.json (OPENCODE_MODEL, read when
// `npm run opencode` starts). One place to change it, and only OpenCode needs a restart.
const AGENT = "news-validator";
const ARTICLE_TIMEOUT_MS = Number(process.env.ARTICLE_TIMEOUT_MINUTES ?? 8) * 60_000;

function authHeaders(): Record<string, string> {
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  const username = process.env.OPENCODE_SERVER_USERNAME ?? "opencode";
  return password ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` } : {};
}

function client() {
  return createOpencodeClient({ baseUrl: OPENCODE_URL, headers: authHeaders() });
}

/** Fails fast with a readable message instead of one error per article. */
export async function assertReachable(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${OPENCODE_URL}/config`, { headers: authHeaders(), signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new Error(`OpenCode server is not reachable at ${OPENCODE_URL}. Start it with "npm run opencode".`);
  }
  await res.body?.cancel();
  if (res.status === 401) throw new Error("OpenCode rejected the password. Check OPENCODE_SERVER_PASSWORD in .env.");
}

// OpenCode's json_schema output mode failed with Kimi K3, so the agent returns plain JSON
// which we check ourselves. This also works the same way with any model.
const SCHEMA_TEXT = JSON.stringify(z.toJSONSchema(Validation), null, 1);

/** A problem with the OpenCode Go account rather than with one article: stop the whole batch. */
class AccountError extends Error {}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.cause ? `${err.message} (${String(err.cause)})` : err.message;
  return typeof err === "object" ? JSON.stringify(err) : String(err);
}

/** Asks the OpenCode news-validator agent to check one article. Throws if the agent fails or returns bad data. */
export async function validateOne(candidate: Candidate): Promise<{ validation: Validation; model: string }> {
  const oc = client();
  const session = await oc.session.create({ title: `validate: ${candidate.title.slice(0, 60)}` });
  if (!session.data) throw new Error(`could not create OpenCode session: ${describeError(session.error)}`);
  const sessionID = session.data.id;
  let model = "unknown model";

  async function ask(text: string): Promise<string> {
    const res = await oc.session.prompt({ sessionID, agent: AGENT, parts: [{ type: "text", text }] });
    if (!res.data) throw new Error(`OpenCode prompt failed (HTTP ${res.response?.status}): ${describeError(res.error)}`);
    const { info, parts } = res.data;
    model = `${info.providerID}/${info.modelID}`;
    if (info.error) {
      const data = info.error.data as { message?: string; statusCode?: number } | undefined;
      // Account problems (bad key, model disabled, usage limit) won't fix themselves on the next article.
      if (info.error.name === "ProviderAuthError" || data?.statusCode === 401 || data?.statusCode === 403) {
        throw new AccountError(`OpenCode Go refused ${model}: ${data?.message ?? info.error.name}. Check your key, model access and usage limits at https://opencode.ai/console`);
      }
      throw new Error(`agent error ${info.error.name}: ${data?.message ?? JSON.stringify(data).slice(0, 300)}`);
    }
    return parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");
  }

  const work = async (): Promise<{ validation: Validation; model: string }> => {
    let reply = await ask(buildPrompt(candidate));
    let parsed = parseReply(reply);
    if (!parsed.ok) {
      // One retry in the same session: the agent keeps what it already found.
      reply = await ask(`Your last reply was not valid (${parsed.error}). Reply with ONLY the JSON object, no other text.`);
      parsed = parseReply(reply);
    }
    if (!parsed.ok) throw new Error(`agent did not return valid JSON: ${parsed.error}`);
    return { validation: parsed.value, model };
  };

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ARTICLE_TIMEOUT_MS / 60_000} min`)), ARTICLE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work(), timeout]);
  } catch (err) {
    await oc.session.abort({ sessionID }).catch(() => {});
    throw err instanceof AccountError ? err : new Error(describeError(err));
  } finally {
    clearTimeout(timer);
    // No history is kept (see the product brief), so remove the session once we have the verdict.
    await oc.session.delete({ sessionID }).catch(() => {});
  }
}

function parseReply(text: string): { ok: true; value: Validation } | { ok: false; error: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "no JSON object found" };
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return { ok: false, error: `JSON parse error: ${(err as Error).message}` };
  }
  const result = Validation.safeParse(json);
  if (!result.success) return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, value: result.data };
}

function buildPrompt(c: Candidate): string {
  // The feed text is untrusted, so it goes inside a clearly marked data block.
  return [
    "Validate this news article using the defence-tech-news skill.",
    "",
    "<article_data>",
    `title: ${c.title}`,
    `url: ${c.url}`,
    c.submittedByUser
      ? `submitted by: a user who wants to know if this is authentic (site: ${c.source}; work out the tier from the domain yourself)`
      : `feed: ${c.source} (configured tier ${c.sourceTier})`,
    `domain: ${c.submittedByUser ? "unknown (may not be defence or technology; judge relevance honestly)" : c.domain}`,
    `published: ${c.publishedAt || "unknown (find the date on the page)"}`,
    `snippet: ${c.snippet}`,
    "</article_data>",
    "",
    "When you are done, your final reply must be ONLY a JSON object (no markdown fences, no other text) matching this JSON Schema:",
    SCHEMA_TEXT,
  ].join("\n");
}

/** Validates candidates a few at a time. Failures are reported, not thrown. */
export async function validateMany(
  candidates: Candidate[],
  concurrency = 3,
): Promise<{ ok: { candidate: Candidate; validation: Validation }[]; failed: number }> {
  await assertReachable();
  const ok: { candidate: Candidate; validation: Validation }[] = [];
  let failed = 0;
  let next = 0;
  let accountError: AccountError | undefined;
  async function worker() {
    while (next < candidates.length && !accountError) {
      const candidate = candidates[next++];
      const started = Date.now();
      try {
        const { validation, model } = await validateOne(candidate);
        ok.push({ candidate, validation });
        console.log(`[validate] ${model}  ${validation.verdict.padEnd(14)} rel=${validation.relevance.toFixed(2)}  ${Math.round((Date.now() - started) / 1000)}s  ${candidate.title}`);
      } catch (err) {
        if (err instanceof AccountError) accountError ??= err;
        failed++;
        console.warn(`[validate] failed after ${Math.round((Date.now() - started) / 1000)}s: ${candidate.title}: ${describeError(err)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
  if (accountError) throw accountError;
  return { ok, failed };
}
