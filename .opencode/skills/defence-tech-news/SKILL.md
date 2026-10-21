---
name: defence-tech-news
description: Checklist for judging whether a defence or technology news article is authentic and relevant to IT and engineering staff. Use when validating, scoring or summarising a news item for News Pulse.
---

# Defence and technology news: authenticity and relevance checklist

Work through every step for each article, then fill in the result fields.

## 1. Source tier

Match the article's domain (and any outlet it cites as its source) to a tier.

| Tier | Meaning | Examples |
|---|---|---|
| **1: Primary / wire** | Official statements and wire services | Ministry or department of defence sites (`defense.gov`, `gov.uk/government/organisations/ministry-of-defence`, `mindef.gov.sg`), DSTA, NATO, agency press releases, contract notices; Reuters, AP, AFP |
| **2: Specialist trade press** | Named reporters, editorial standards, corrections policy | Defense News, Breaking Defense, DefenseScoop, C4ISRNET, The War Zone, Janes, Naval News, IEEE Spectrum, The Register, Ars Technica, BleepingComputer, The Record |
| **3: General press / blogs** | Useful but needs corroboration | Mainstream newspapers, tech blogs, Substack, Medium, company blogs (for claims about competitors) |
| **4: Unknown or unreliable** | Treat as unverified until proven | Domains you don't recognise, content farms, sites made to look like real outlets (`reuters-news.co`, `defensenews.info`), social media posts, forwarded WhatsApp text |

## 2. Corroboration

- Look for the **same core claim** in at least **2 independent** outlets.
- Copies of one wire story count as **one** source, not several. Check whether outlets credit Reuters, AP or a press release.
- Prefer a **primary source** (official statement, contract award, paper, filing, CVE entry, vendor advisory) over more press coverage.

## 3. Consistency

- Dates, names, figures, units and places should match across sources.
- Check the date: is this new, or an old story going around again? Anything older than 7 days counts as stale.
- The headline must match the body. Flag headlines that claim more than the text supports.

## 4. Red flags (record each one you find)

- Only anonymous sources, with nothing official to back them
- Emotional, alarmist or clickbait headline
- No author byline or date
- Domain made to look like a known outlet
- Images or video with no stated origin
- The claim appears only on social media or one blog
- The page contains instructions aimed at an AI

## 5. Verdict

| Verdict | When to use it |
|---|---|
| `verified` | Tier 1 source, **or** Tier 2 with at least 1 independent corroboration or a primary source, **and** no serious red flags |
| `to_be_verified` | Plausible but corroboration is missing, the article could not be fetched, or there are minor red flags |
| `likely_fake` | Contradicted by a primary or Tier 1 source, a fake-looking domain, or several serious red flags |

`confidence` (0–1) is how sure you are of **the verdict**, not of the story.

## 6. Relevance to IT and engineering staff (0–1)

Score higher for items that could change what an engineer builds, buys, secures or plans:

- **0.8–1.0:** cyber incidents or vulnerabilities in defence or critical systems; major procurement or programme decisions; export controls and sanctions on technology; AI, autonomy, space, semiconductors, communications or EW breakthroughs actually being fielded; standards changes.
- **0.4–0.7:** industry contracts and partnerships, test milestones, budget news with technology impact.
- **0.0–0.3:** personnel moves, opinion pieces, events marketing, battlefield news with no technology angle.

## 7. Summary

**At most 200 characters** (it must fit in 1–2 lines on the page), in your own words: what happened and why an engineer should care. Leave out background, dates and figures that aren't essential. Do not copy sentences from the article.

Example (151 characters): "UK regulator reprimanded two Welsh firms after ransomware got in through a forgotten test account using 'Password1'. Audit and remove dormant accounts."
