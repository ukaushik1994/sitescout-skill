# SiteScout

A Claude Code skill. Find local businesses with weak or missing websites, build each one
a real preview site from their actual Google Maps data, and draft the outreach that sends
it.

Claude does the design and the writing. A small zero-dependency CLI does the parts that
must be exact: Google Maps lookups, website defect checks, and prospect scoring.

## Why it runs inside Claude

There is no API key for the AI and no server to pay for. The Claude you already use does
the generation, so the running cost of building a site is whatever your Claude plan
already covers.

It also means Claude can open the file it just wrote, look at the result at phone width,
and fix the overflow before you ever see it. That single feedback loop is the difference
between a preview you can send and one you have to apologise for.

## Install

**New here and someone sent you a zip? Read [INSTALL.md](INSTALL.md) instead.**

Requires **Claude Code** (CLI, desktop app, or IDE extension) and **Node 18 or newer**.
This skill runs scripts and reads and writes local files, so the claude.ai web chat on its
own is not enough.

**Just you, all projects:**

```bash
git clone https://github.com/<owner>/sitescout-skill ~/.claude/skills/sitescout
```

**One project, shared with a team via the repo:**

```bash
git clone https://github.com/<owner>/sitescout-skill .claude/skills/sitescout
```

Claude picks it up from the `SKILL.md` frontmatter. Ask for something like "find dentists
in Bandra who need a website" and it activates on its own.

## Google Maps key

Optional, strongly recommended. Without it you can still work, you just enter businesses
by hand and lose real review quotes, real hours and real photos.

1. Create a key in Google Cloud Console
2. Enable **Places API (New)** on that project
3. Make sure billing is active

Then either:

```bash
export GOOGLE_MAPS_KEY="..."
```

or write `~/.sitescout/config.json`:

```json
{ "googleKey": "..." }
```

### Check it before you build

```bash
node ~/.claude/skills/sitescout/scripts/sitescout.mjs doctor
```

`reviews`, `photos` and `editorialSummary` are billed at a higher Places tier than
`rating` and opening hours. If that tier is not enabled, **the API returns HTTP 200 and
silently leaves those fields out**. Nothing errors. Every site you build quietly falls
back to showing a star rating instead of real customer quotes, and to abstract SVG
visuals instead of photos.

`doctor` is one call that tells you which fields your key can actually read, so you find
out now rather than after ten pitches.

## The loop

```
find → rank → audit → build → verify → pitch
```

| Command | Does |
|---|---|
| `search "<niche>" "<city>"` | Find businesses on Google Maps |
| `add name="..." phone="..."` | Record a business by hand, no key needed |
| `list [--status=found]` | Show the pipeline |
| `fit [--all] [--limit=20]` | Rank prospects, threshold 60 |
| `audit <slug>` | Deep-check their existing website |
| `enrich <slug>` | Real reviews, hours, Google summary |
| `photos <slug> [--max=3]` | Download their real photos |
| `facts <slug>` | The only facts allowed on the site |
| `set <slug> key=value` | Update a lead |
| `doctor` | Check which Places fields your key can read |

Pipeline data lives in `./.sitescout/leads.json` where you run it. Generated sites go to
`./sitescout-previews/`. Each project keeps its own pipeline, so a folder per city or per
niche works well.

## Two scores, not one

- **Opportunity** — how weak their web presence is. High is good for you.
- **Fit** — whether they are a viable, reachable, paying prospect. Threshold 60.

A business with no website and no phone number scores 95 opportunity and 0 fit. Do not
build for it. No phone means no way to pitch, and being marked closed on Google is an
automatic out. Fit also catches chains: if four branches share a name, head office owns
the website and the local manager cannot buy from you.

## What the audit actually checks

Eleven real, verifiable defects on their existing site: no https, no mobile viewport,
missing meta description, missing page title, thin content, stale copyright year, no
linked social profiles, never mentions its own neighbourhood, no structured data, no
WhatsApp path, no booking path. It also collects contact emails and social links.

Nothing is inferred. These lines end up in front of the business owner, so if the audit
says the site never mentions Bandra, it is because that word is genuinely absent from the
page text.

## Ground rules

These are enforced in `SKILL.md` and they are not decoration.

- **No invented facts.** No years of experience, no team members, no testimonials written
  by the AI, no certifications, no prices. Only what `facts` returns.
- **Every preview carries `noindex, nofollow`.** A preview must never compete in search
  with the business it was built for.
- **Direct link only.** No index page listing prospects, no browsable directory of
  businesses that have not agreed to anything.
- **No lookalike domains**, and never present a preview anywhere it could be mistaken for
  the business's own live site. It is a concept for the owner, not a replica in the wild.
- **Drafts, never sends.** Outreach text is handed to you. Sending is your call.

## Limits worth knowing

- No dashboard. The pipeline is a JSON file and whatever Claude prints. For scanning
  hundreds of leads at a glance, a spreadsheet or a real app is better.
- No unattended batch mode. It works while you are in the conversation.
- Photos need the higher Places tier. Without it, sites use SVG visuals.
- One Maps search returns up to 20 businesses. Tight geography beats broad: "dentists in
  Bandra" gives a better pitch than "dentists in Mumbai", because naming the
  neighbourhood is half the hook.

## Licence

MIT.
