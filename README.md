# Speak Fluently (PWA)

Offline-first English course PWA for **Tanqeel**: a 90-day path from A2/B1 to B2+ English,
built for freelance client calls. Vanilla HTML/CSS/JS — no frameworks, no build step, no CDNs.
Works fully offline after installation.

## Run locally

Any static server works. From this folder:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Or with node:

```bash
npx serve .
```

## Deploy to GitHub Pages

1. Push this folder's contents to a repo (root or `docs/`).
2. Repo → **Settings → Pages** → deploy from branch.
3. Done — there is **no build step**.

All paths are relative (`css/…`, `js/…`, `content/…`, `audio/…`), the router is hash-based
(`#/learn`, `#/lesson/…`), and the service worker registers with a relative scope —
so the app works under any subpath (e.g. `username.github.io/fluent/`).

## Hosting: why GitHub Pages (and what would need more)

This app is **100% static — no backend, no server**. Everything runs
client-side: lessons, drills, quizzes, SM-2 scheduling, streaks, badges, error log,
and on-device TTS fallback all live in the browser + `localStorage`. That is
deliberate: it deploys free on GitHub Pages, works fully offline after first load,
and has zero running costs or accounts to manage.

**AI Coach is bring-your-own-key (BYOK):** the coach tab calls Google's Gemini API
directly from the browser using the user's own free key (`js/aicoach.js`). The key
is stored **only** in the device's `localStorage`, sent **only** to
`generativelanguage.googleapis.com`, never logged, never in any file. No key →
the whole app still works; the coach shows its setup prompt. This keeps the app
fully static while delivering real in-app AI feedback.

**Vercel / Netlify vs GitHub Pages:** for a static site like this one, all three
host it identically well. The only reason to move would be to add a backend —
and that backend is **not built**. If it's ever wanted, these are the exact
features that would need serverless functions (Netlify Functions / Vercel Edge
Functions, both free-tier friendly), and nothing else:

- **Cross-device progress sync** — progress currently lives in `localStorage` on one
  device. Syncing phone ↔ laptop needs an account + a tiny database.
- **Accounts & leaderboards** — logins, friend streaks, shared leaderboards all
  need auth + a database.

~~In-app AI feedback~~ — **done without a backend** via BYOK Gemini (see above).

Everything else — including any future modules, drills, quizzes, audio tracks,
and worksheets — stays static and GitHub Pages-deployable. Rule: if a feature
can't work from a static file host, it doesn't ship until the backend decision
is made deliberately.

## Offline behavior

- On first visit the service worker (`sw.js`, cache `fluent-v3`) precaches **everything
  except audio**: HTML, CSS, all JS, all 15 content JSON files, manifest and icons.
- After that first load the app works **fully offline** — lessons, drills, quizzes,
  task cards, review deck, progress: all local.
- **Audio** (12 MP3s, ~8 MB) is cached lazily: the first time a lesson plays a clip,
  the service worker stores it, and it works offline from then on. This keeps the
  install light on hostel Wi-Fi.
- Progress lives in `localStorage` on the device only. Nothing is uploaded anywhere.
- To force an update after deploying new content, bump the `CACHE` name in `sw.js`.

### First-load size

~285 KB total (HTML + CSS + JS + all content JSON), well under the 2 MB budget.
Audio is excluded — it streams/caches on demand.

## Themes

Light / dark / system modes, switchable from the ☀️/🌙 button in the header
(default: system — follows the phone). All colors are CSS custom properties
(`css/styles.css` token blocks); there are no hardcoded theme-breaking colors.
The choice is stored in localStorage (`fluent_theme`) and applied pre-paint to
avoid a flash of the wrong theme. `meta theme-color` follows the active theme.

## What's inside

| Screen | Route | What it does |
|---|---|---|
| Home | `#/home` | Greeting, streak hero, today's plan, continue-where-you-left-off, START HERE card |
| Learn | `#/learn` | 10 modules, per-module progress |
| Module / Lesson | `#/module/:id`, `#/lesson/:id` | Teach cards + drills, step-by-step |
| Practice | `#/practice`, `#/practice/:engine` | Drill arena, module quizzes, speaking task cards |
| Placement | `#/placement` | **START HERE**: 30 items, 100 points, bands A2 0–39 / B1 40–69 / B2 70–100 |
| Review | `#/review` | Flashcards (SM-2), Error Log |
| Progress | `#/progress` | XP chart, streak calendar, badges, 90-day checklist |

### Drill engines (`js/drills.js`)

`multiple-choice` · `fix-sentence` (with `accept` alternates) · `fill-blank` ·
`dialogue`/`complete-dialogue` · `shadowing` (model audio + MediaRecorder compare,
TTS fallback) · `flashcard`/`flashcards` (SM-2 self-grade) · `timed-quiz`
(mixed `mc`/`fix`/`order`/`self` questions, per-question timer) ·
`speaking-task` (timer + recorder + model script) · `journal` (on-device writing log) ·
`word-order` (tap-to-order)

### Mechanics

- **XP & levels** — every drill/lesson/quiz awards XP; levels in `Store.level()`.
- **Forgiving streaks** — any day with ≥10 XP counts; one missed day is auto-covered
  by a Streak Freeze (earned every 7-day streak, max 2 banked); longer gaps trigger a
  gentle comeback message, never shame.
- **Badges** — 26 badges incl. manuscript badges: Placed & Planned, Habit Locked,
  Article Ace, Clear Speaker, Flow State, Call-Ready, Brand Voice, Closer,
  Social Butterfly, Meeting Pro, Band Hunter.
- **Error Log** — every wrong answer is saved with your answer, the correction and
  the "why"; review and clear them from Review → Errors.
- **SM-2 review** — flashcards scheduled with EF 2.5, 1-day / 6-day / growing
  intervals, Again/Hard/Good/Easy ratings (`js/sm2.js`).
- **Placement** — Parts A–B auto-scored, Parts C–E self-checked against the key;
  result + band persisted and shown on Home/Learn.

## Content pipeline

Course content is generated from the manuscript sources — **never edit the JSON by hand**:

```bash
python3 tools/build-content.py   # converts course-book.md, interactive/quizzes (70 Qs),
                                 # interactive/speaking-tasks.md (30 cards), placement test,
                                 # copies 8 MP3s → content/*.json + audio/
python3 tools/rebalance.py       # enforces ≤4 drills/lesson, 4–8 lessons/module, wires audio
```

Sources (kept outside this folder, next to it):
`course-book.md` (15,182 words) · `interactive/quizzes/` (7×10) ·
`interactive/speaking-tasks.md` (30 cards) · `interactive/feedback-contract.md` ·
`audio/` + `audio/scripts/`.

### Content counts (generated)

- 10 modules · 68 lessons · 198 lesson drills
- 102 quiz questions (10 module quizzes) · 42 speaking task cards
- Placement: 30 items (12 fix + 8 MCQ + 4 writing + 2 speaking + 4 self-check), 100 points
- 12 MP3s wired to shadowing steps (warm-up, minimal pairs, discovery call,
  client phrases, self-intro, negotiation, accuracy chants, shadowing demo,
  IELTS speaking mock, presentation delivery, small talk, IELTS listening S1)

### JSON schema

**`content/module-<name>.json`**
```json
{"id":"accuracy","title":"…","icon":"🎯","color":"#…","tagline":"…","description":"…",
 "lessons":[{"id":"accuracy-l1","title":"…","minutes":12,"xp":50,
   "steps":[
     {"type":"teach","heading":"…","body":"**markdown** ok","example":"…","roman":"…","tip":"…"},
     {"type":"drill","engine":"fix-sentence","id":"…","wrong":"…","answer":"…",
      "accept":["alternate answer"],"explanation":"why (markdown ok)","xp":10},
     {"type":"drill","engine":"fill-blank","id":"…","text":"I'm looking forward ___ meeting you.",
      "options":["I'm looking forward ___ meeting you.","to","for"],"answer":"to","explanation":"…","xp":10},
     {"type":"drill","engine":"multiple-choice","id":"…","prompt":"…","options":["a","b","c"],"answer":0,"explanation":"…"},
     {"type":"drill","engine":"dialogue","id":"…","lines":[{"who":"Client","text":"…"}],"blank":"…","answer":"…"},
     {"type":"drill","engine":"shadowing","id":"…","title":"…","text":"…","audio":"audio/01-….mp3","tip":"…"},
     {"type":"drill","engine":"flashcards","id":"…","cards":[{"front":"…","back":"…","example":"…"}]},
     {"type":"drill","engine":"speaking-task","id":"…","title":"…","prompt":"…","checklist":["…"],
      "seconds":90,"model":"…","script":"plain-text for TTS","tip":"…"},
     {"type":"drill","engine":"journal","id":"…","prompt":"…"},
     {"type":"drill","engine":"word-order","id":"…","prompt":"…","words":["…"],"answer":"…"},
     {"type":"drill","engine":"timed-quiz","id":"…","title":"…","seconds":300,"xp":50,
      "questions":[{"kind":"mc|fix|order|self","prompt":"…","options":["…"],"answer":0,
                    "wrong":"…","words":["…"],"sample":"…","explanation":"…"}]}
   ]}]}
```

**`content/quizzes.json`** — array of 7: `{"id":"quiz-accuracy","module":"accuracy","title":"…","rule":"…","questions":[{…same as timed-quiz…}]}`.
Question kinds: `mc` (options+answer index), `fix` (wrong+answer+accept), `order`
(words+answer), `self` (prompt+sample+explanation, honestly self-graded).

**`content/taskcards.json`** — 30 cards:
`{"id":"tc1","module":"foundations","title":"…","kind":"speak|journal","seconds":90,
"prompt":"…","checklist":["…"],"model":"…","script":"…","tip":"…"}`.

**`content/placement.json`** —
`{"title":"…","parts":[{"part":"A","title":"…","kind":"fix|mc|self","instructions":"…",
"items":[{"n":1,"points":5,"wrong":"…","answer":"…"} | {"n":13,"points":2,"prompt":"…",
"options":[{"t":"…","v":"…"}],"answer":"…","full":"…"} | {"n":21,"points":5,"prompt":"…",
"key":"…","sample":"…"}]}]}`.

**`content/plan.json`** — `{"title","subtitle","dailyMinutes":25,"phases":[{days,module,focus}],"weeks":[{week,module,focus,milestone}]}`.

**`content/badges.json`** — `{"badges":[{"id","name","icon","desc","check":"<expr>"}]}`;
checks are evaluated by `Store.evalCheck` against counters like
`lessons_done`, `streak`, `placement_done`, `accuracy_done`, `task_cards_done`,
`journal_entries` (`==`, `>=` etc.).

**`content/practice.json`** — fallback drill bank keyed by engine, same drill shape as above.

### Audio scripts

`audio/*.mp3` are the recordings; matching scripts live in the source `audio/scripts/`
folder. In-app, shadowing steps play the MP3 and fall back to on-device TTS
(`speechSynthesis`) if the file is missing.

## Tests

```bash
# syntax + schema + asset references + no external URLs
for f in js/*.js; do node --check $f; done
python3 tools/build-content.py        # regenerates + validates JSON, prints counts
python3 tools/rebalance.py            # enforces lesson/drill limits, prints audit
node /tmp/smoke.js                    # (dev) renders every screen with a DOM shim
python3 -m http.server 8080           # crawl: every sw.js precache path must 200
```

Interactive checks (click-through, microphone recording, install-to-home-screen,
offline airplane-mode test) need a real browser + device — flagged for the
browser-capable agent.

## Feedback contract (for Muse chat)

In-app writing/speaking submissions are **self-checked or saved on-device**.
When Tanqeel brings work to the Muse chat, feedback is scored on: **clarity, tone,
structure, client-safety** — and it never invents experience, guarantees results,
badmouths anyone, does free custom work, shares private data, or begs.
