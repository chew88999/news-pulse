# News Pulse

Shows IT and engineering staff the three defence and technology news items that matter, each with a short summary, its source and a check on whether it is factual. See `PRODUCT_BRIEF.md` for the why.

## How it works

```
feeds (server/feeds.ts) → collector → top N candidates
   → OpenCode server: agent "news-validator" + skill "defence-tech-news" (fetches pages, cross-checks)
   → ranker → data/top3.json → GET /api/top3 → web/index.html
```

- **Collector** (plain code, no AI): reads RSS/Atom feeds, keeps the last 48 h, removes duplicates, scores by keywords, recency and source tier.
- **Validator** (`.opencode/agents/news-validator.md`): read-only agent. Its only permissions are `webfetch` and the skill. Returns structured JSON (verdict, confidence, relevance, summary, corroborating URLs, red flags).
- **Skill** (`.opencode/skills/defence-tech-news/SKILL.md`): source tiers, corroboration rules, red flags, verdict rules and the relevance rubric. Edit this to tune judgement.
- **Ranker** (`server/rank.ts`): 65% relevance, 35% verification. Likely-fake items are never shown.

## Setup

1. Install OpenCode: `npm i -g opencode-ai`
2. `npm install`
3. Subscribe to OpenCode Go in the [OpenCode Console](https://opencode.ai/console) and create an API key.
4. Copy `.env.example` to `.env` and fill in `OPENCODE_GO_API_KEY`, `OPENCODE_MODEL` and `OPENCODE_SERVER_PASSWORD`.

## Choosing the model

Set `OPENCODE_MODEL` in `.env` as `opencode-go/<model-id>`. Only OpenCode reads it, through `opencode.json`, so after changing it restart just `npm run opencode`. The backend logs which model answered each article, and an account error names the model that was refused.

The validator needs a model that is good at tool calls (it fetches pages) and at returning structured JSON. Good starting points:

| Model | Notes |
|---|---|
| `opencode-go/kimi-k3` | Default. Strong tool use and reasoning |
| `opencode-go/glm-5.3` | Strong alternative |
| `opencode-go/deepseek-v4-pro` | Strong alternative |
| `opencode-go/qwen3.8-max` | Strong alternative |
| `opencode-go/glm-5.3-flash` | Cheaper and faster, uses less of the monthly allowance |

The full list is at https://opencode.ai/docs/go and may change. Go has monthly, weekly and 5-hour usage limits per model, so `MAX_VALIDATE` and `REFRESH_CRON` decide how quickly you use them up.

## Run

Terminal 1, the OpenCode server (only on 127.0.0.1, password-protected):

```
npm run opencode
```

Terminal 2, the backend and page on http://127.0.0.1:3000:

```
npm start
```

Other commands:

| Command | What it does |
|---|---|
| `npm run collect` | Lists candidates without calling the AI (free) |
| `npm run refresh` | Runs the whole pipeline once and writes `data/top3.json` |
| `npm run refresh -- yesterday` | Same, for one calendar day: `today`, `yesterday` or `YYYY-MM-DD` (also works with `collect`) |
| `npm run selftest` | Sends made-up test articles (`server/selftest/cases.ts`) to the validator and checks each verdict. Add case ids to run only some, e.g. `npm run selftest -- altered-details` |
| `npm run typecheck` | TypeScript check |

On the page, **Latest** shows the rolling view (refreshed by the schedule). **Pick a day** shows one day from the last 7. A day that hasn't been checked yet offers a button that crawls and checks it, which takes about 3 minutes and uses OpenCode Go allowance. Each day's result is saved as `data/day-YYYY-MM-DD.json`. This goes beyond the brief's "no history or archive", so delete those files if you don't want them kept.

**Check a link** (bottom of the page): paste any article URL, for example one forwarded on WhatsApp, and the validator agent checks it with the same skill. It takes about a minute. If the site is one of our feeds, its tier is reused; otherwise the agent works out the tier itself. Results stay in memory only and are lost when the server restarts. Links to this computer or the local network are refused, and at most two checks run at once.

To refresh by hand while the server is running, run `npm run refresh` in another terminal. The page shows the new result when reloaded.

## Settings (`.env`)

`MAX_VALIDATE` (default 8) caps how many articles the agent checks per refresh. This is the main cost lever. `REFRESH_CRON` sets the schedule (default every 2 hours). `MAX_AGE_HOURS` sets how far back articles are considered.

## Known gaps

- Breaking Defense returns HTTP 403 to the feed reader, so it is skipped.
- No history is kept by design. Each refresh replaces the snapshot, and OpenCode sessions are deleted after each verdict.
