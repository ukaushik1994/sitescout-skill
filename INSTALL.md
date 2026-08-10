# Install SiteScout (5 minutes)

You were sent `sitescout-skill.zip`. Here is how to make it work in your Claude.

## What you need first

- **Claude Code** — the CLI, the desktop app, or the VS Code / JetBrains extension.
  This is a skill that runs scripts, so it needs Claude Code. The claude.ai web chat on
  its own is not enough.
- **Node 18 or newer.** Check with `node --version`. If that errors, install Node first.

## Step 1 — unzip it into your skills folder

```bash
mkdir -p ~/.claude/skills/sitescout && unzip -o ~/Downloads/sitescout-skill.zip -d ~/.claude/skills/sitescout
```

Adjust the path if your download went somewhere else. That is the whole install.

## Step 2 — check it loaded

Start Claude Code and ask:

> what skills do you have?

`sitescout` should be in the list. If it is not, confirm `~/.claude/skills/sitescout/SKILL.md`
exists and restart Claude Code.

## Step 3 — decide about a Google Maps key

**Without a key** the skill still works. You find businesses yourself (Claude can web
search), record them with one command, and everything after that is identical. You lose
real customer review quotes, real opening hours and real photos.

**With a key** you get automatic lead discovery from Google Maps plus that real data.

To get one:

1. Create a project in Google Cloud Console
2. Enable **Places API (New)** on it
3. Turn on billing for that project
4. Create an API key

Then either export it:

```bash
export GOOGLE_MAPS_KEY="your-key-here"
```

Or save it once, which survives new terminals:

```bash
mkdir -p ~/.sitescout && printf '{"googleKey":"your-key-here"}\n' > ~/.sitescout/config.json
```

**Use your own key.** Do not reuse someone else's. It is billed per call and the quota is
shared, so a shared key means one person's bulk searching breaks everyone else's.

## Step 4 — verify the key can read what matters

```bash
node ~/.claude/skills/sitescout/scripts/sitescout.mjs doctor
```

This exists because of a genuinely nasty failure mode. `reviews`, `photos` and
`editorialSummary` are billed at a higher Places tier than `rating` and opening hours.
If your project is not on that tier, **Google returns HTTP 200 and silently leaves those
fields out**. Nothing errors. Nothing warns. Every site you build quietly falls back to a
star-rating box instead of real customer quotes, and you would not know for weeks.

`doctor` tells you in one call. If it reports `reviews` and `photos` as blocked, go back
and check billing and key restrictions on that Google Cloud project.

## Step 5 — use it

Just ask in plain language:

> find dentists in Bandra West who need a website

> build a preview site for the top one

> write me the pitch for it

The full loop is find, rank, audit, build, verify, pitch. Claude does the design and the
writing. The bundled CLI does the exact parts: Maps lookups, eleven website defect checks,
and the two scores.

Read `README.md` for how the scoring works and what the audit actually checks.

## The rules built into it

These are enforced, not suggestions. If you find yourself working around them, stop.

- **No invented facts about a real business.** No years of experience, no team members, no
  testimonials written by the AI, no certifications, no prices.
- **Every preview is `noindex, nofollow`.** A preview must never compete in search with the
  business it was built for.
- **Direct link only.** Never publish a browsable list of prospects who have not agreed to
  anything.
- **No lookalike domains**, and never put a preview somewhere it could be mistaken for the
  business's own live site.
- **Claude drafts the outreach. You send it.** Never let it send on your behalf.
