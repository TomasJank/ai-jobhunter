# Jobhunter scraper

Pulls real job postings from free API/RSS sources, scores them against your résumés
with Claude, and writes `live-data.js` — which `Jobhunter.html` loads before its mock
`data.js`, so the prototype shows live jobs (and falls back to mock data if never run).

## Run

```bash
cd scraper
npm install          # once — installs @anthropic-ai/sdk
npm test             # self-checks (no network)
npm start            # scrape → score → write live-data.js
```

## Control panel (add sites, set preferences, run)

```bash
npm run serve        # → http://localhost:8090
```

Open it and go to **Scraper config**. From there you can, with changes saved to
`sources.json` / `prefs.json` automatically:

- **Add a job site** — paste a careers URL or type a company name. It auto-detects the
  platform (Greenhouse/Lever/Ashby/SmartRecruiters/Workday/Amazon/Apple/Google/Eightfold),
  or probes the common ATSes by company name. Unsupported sites (LinkedIn, Glassdoor,
  Meta, Microsoft) show a clear "can't scrape this" warning.
- **Toggle / delete** any source.
- **Preferences**: seniority levels (deselected levels are filtered out — intern is off by
  default), work mode, preferred locations, Telegram threshold, Telegram on/off.
- **Run now** — on the config page runs a scrape locally; on the dashboard it triggers
  the **cloud** GitHub Actions run (needs `gh` logged in, or `GITHUB_TOKEN`+`GITHUB_REPO`
  in `.env` — see `.env.example`).

Seniority is a hard filter (by title); location & work mode are soft — they steer the AI
match score so mismatches rank lower rather than being dropped.

The prototype opened directly (`../Jobhunter.html`) still shows the latest scraped jobs,
but the config page is read-only unless the control panel is running.

## Sources — `sources.json`

Each entry is a scraper config. `active: false` skips it. Supported `source` values:

| source           | needs                     | notes                                   |
|------------------|---------------------------|-----------------------------------------|
| `remoteok`       | —                         | RemoteOK JSON API; optional `tags`      |
| `weworkremotely` | `category` (RSS slug)     | e.g. `remote-front-end-programming-jobs`|
| `hackernews`     | —                         | latest "Ask HN: Who is hiring?" thread  |
| `ats`            | `provider` + company ref  | `greenhouse`/`ashby`/`lever`/`smartrecruiters` (`slug`) or `workday` (`host`+`tenant`+`site`) |
| `amazon`         | optional `query`          | amazon.jobs hidden JSON API             |
| `eightfold`      | `base` + `domain`         | Eightfold boards (Netflix etc.), plain GET |
| `apple`          | optional `query`          | ⚠️ experimental — headless Chrome (Akamai blocks plain HTTP); times out often |
| `google`         | optional `query`          | ⚠️ experimental — Google Careers via headless Chrome; times out often |
| `jobspy`         | `site` + `query`          | Indeed / Google Jobs via JobSpy (Python) |

`apple`/`google` are best-effort: they need Chrome or Chromium installed (auto-detected;
override with `JH_CHROME`) and still time out frequently behind anti-bot protection —
treat them as experimental, not reliable daily sources. `jobspy` needs a one-time setup
in this folder — the GitHub workflow
installs it itself:

```bash
python3 -m venv .venv && .venv/bin/pip install python-jobspy
```

Optional `keywords` filter each config by title/tags (word-start match). RemoteOK/HN
are broad feeds — expect some off-topic rows; the LLM scoring layer ranks those low.

## Résumés — `resumes/`

One `.md`/`.txt` file per résumé; the filename (minus extension) is its id
(`rsm_se.md` → `rsm_se`). The first line is the display name. Replace the sample with
your own; add more files for multi-résumé ranking.

## LLM scoring

Set `ANTHROPIC_API_KEY` to enable real match scoring (defaults to `claude-haiku-4-5`;
override with `JH_SCORING_MODEL`). Without a key, jobs get neutral scores and a note —
scraping still works.

Easiest local setup — a gitignored `.env` file (loaded natively, no dependency):

```bash
cp .env.example .env    # then edit .env and paste your key
npm start
```

## Telegram reporting

Each run compares against `seen.json` (jobs already encountered) and messages you the
**new** jobs scoring ≥ 6 — quiet when there's nothing worth seeing. Setup (~1 min):

1. Message **@BotFather** on Telegram → `/newbot` → copy the bot token.
2. Send your new bot any message, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the `"chat":{"id":…}`.
3. Put both in `.env` (locally) or as repo secrets `TELEGRAM_BOT_TOKEN` /
   `TELEGRAM_CHAT_ID` (GitHub Actions).

Threshold via `JH_NOTIFY_MIN_SCORE` (default 6). Requires scoring to be enabled.

## Env knobs

- `ANTHROPIC_API_KEY` — enables scoring
- `JH_SCORING_MODEL` — scoring model (default `claude-haiku-4-5`)
- `JH_PER_CONFIG_CAP` — max jobs kept per source (default 8; bounds runtime + LLM cost)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — enables Telegram reports
- `JH_NOTIFY_MIN_SCORE` — Telegram score threshold (default 6)

## Daily automation

`.github/workflows/scrape.yml` runs daily at 06:00 UTC (09:00 Lithuania in summer) —
edit its one `cron:` line to change frequency. It commits the refreshed `live-data.js`
and `seen.json` so "new job" state persists between runs. To activate: push this repo
to GitHub and add the secrets above.
