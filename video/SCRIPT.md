# News Pulse: promo video script

**Audience:** IT and engineering staff in the defence industry
**Length:** about 63 seconds, 1920×1080, 30 fps, no audio. All the words are on screen, so it works muted in an office or on an intranet page. A voiceover can be recorded from the lines below.
**Tone:** calm, precise, credible. No hype, and nothing claimed that we haven't shown or tested.

| # | Time | On screen | Voiceover (optional) |
|---|---|---|---|
| 1 | 0–7 s | A chat window fills with forwarded links: "Did you see this?!", "URGENT: China cyberattack has disabled navigation on every US Navy ship", "Forwarded many times". Counter: *08:47 · 214 unread* | "Defence and tech news reaches you from everywhere: sites, colleagues, the group chat." |
| 2 | 7–13 s | "Which of it is true?" then "Which of it matters to you?" then *Sorting it out by hand: more than 3 hours.* | "Which of it is true? Which of it matters? Sorting it out by hand takes hours." |
| 3 | 13–19 s | A pulse line draws itself, then the **News Pulse** logo. *The three stories that matter. Checked.* | "News Pulse. The three stories that matter, checked." |
| 4 | 19–31 s | Three steps: **Collect** (trusted defence and technology sources, refreshed every 2 hours), **Verify** (an AI agent reads each article and looks for independent and official sources), **Rank** (only the three that matter to engineers) | "It collects from trusted defence and technology sources, has an AI agent check each story against independent and official sources, and gives you only the three that matter." |
| 5 | 31–41 s | The real app: the top three for 20 Oct 2026, each with a verdict, source tier and 1–2 line summary. Callouts: *Verdict at a glance*, *Summary in two lines*, *Reasons you can check* | "Every story comes with a verdict, a two-line summary and the reasons behind it." |
| 6 | 41–51 s | "Got a forwarded link?" The WhatsApp claim is pasted into **Check a link** and returns ❌ **Likely fake**, with red flags: only anonymous sources, urgency and conspiracy framing, and the claim appears nowhere else | "Got a forwarded link? Paste it in. News Pulse tells you if it holds up, and why." |
| 7 | 51–57 s | Three proof points: *Caught every planted fake in our tests, including a real link with altered facts* · *Shows its reasoning. You make the call.* · *Read-only AI: it can read the web, never act on it.* | "It shows its reasoning, so you make the call." |
| 8 | 57–63 s | End card: **News Pulse**. *Three stories. Checked. Minutes, not hours.* *For IT and engineering teams in defence.* | "News Pulse. Three stories. Checked." |

## Narration and subtitles

The video now has a spoken narration (Microsoft Mark, a built-in Windows voice, generated on this PC), burned-in subtitles, and an English subtitle track that players can switch on or off. The same captions are also in `news-pulse-promo.srt` for platforms that take a separate file.

The narration lines and their start times are in `narration.json`, which replaces the "Voiceover" column above. To change the narration:

1. Edit `narration.json` (`start` and `end` are in ms; each line must finish before its `end`).
2. `powershell -ExecutionPolicy Bypass -File voice.ps1`: makes `voice/*.wav`.
3. `node subtitles.mjs`: measures each clip, checks it fits, writes `subtitles.js` and the `.srt`.
4. `node render.mjs` for the full video. If only the words changed and the picture didn't, use `node render.mjs --audio-only` for the audio but still do a full render, because the burned-in captions are part of the picture.

To use a professional or neural voice instead, record one WAV per line with the same file names (`voice/01.wav` …) and start at step 3.

## What every claim is based on

- **"Trusted sources, every 2 hours":** `server/feeds.ts` (official defence releases plus specialist defence and technology press) and the default `REFRESH_CRON`.
- **"Independent and official sources":** the `defence-tech-news` skill's corroboration rules. In the 20 Oct run, the agent confirmed The Register's story against the UK ICO's own release.
- **The app screens:** screenshots of the running app (`npm run capture`), showing real results.
- **The WhatsApp example:** the `whatsapp-forward` self-test case. Its red flags are the agent's actual output.
- **"Caught every planted fake in our tests":** `npm run selftest` passed 7 of 7 with GLM-5.3-Flash, including `altered-details`. This is a small test set, so the wording says "in our tests" and claims no accuracy rate.
- **"Minutes, not hours":** the product goal from the brief (today more than 3 hours, target under 15 minutes). It's a design goal, not a measured result. Remove it if the video is used outside the team before that's been measured.
