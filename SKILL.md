---
name: sitescout
description: Find local businesses with weak or missing websites, build each one a real preview site from their actual Google data, and draft the outreach that sends it. Use when the user wants to find leads or prospects for web design work, scout local businesses, check whether a business has a bad website, build a spec or preview site to pitch someone, or write cold outreach for a website sale. Triggers on "find me leads", "scout businesses", "who needs a website", "build a preview site for", "pitch this business".
---

# SiteScout

Turn "this business has a terrible website" into a preview site they can open and a
message they might actually answer.

The loop: **find → rank → audit → build → verify → pitch**.

You do the judgment and the design. A small CLI does the parts that must be exact
(Google Maps data, defect checks, scoring) so they are identical every run and cost no
tokens.

## Setup

The CLI needs Node 18 or newer. Nothing to install, zero dependencies.

Run it as `node <this-skill-dir>/scripts/sitescout.mjs <command>`. Resolve
`<this-skill-dir>` once at the start of a session and reuse it.

**Google Maps key is optional but strongly recommended.** With one, you get real
businesses, real customer reviews, real opening hours and real photos. Set
`GOOGLE_MAPS_KEY` in the environment, or write `{"googleKey":"..."}` to
`~/.sitescout/config.json`. It needs the **Places API (New)** enabled.

**Run `sitescout doctor` before your first build.** `reviews`, `photos` and
`editorialSummary` sit in a higher Places billing tier than `rating` and hours. When
that tier is not enabled, the API returns HTTP 200 and silently omits those fields, so
nothing errors and nothing warns. You find out by shipping a site with no photos and a
pitch with no customer quote. `doctor` tells you in one call which fields your key can
actually read.

If reviews come back blocked, say so plainly to the user and carry on: sites will show
the Google rating instead of quotes, and use SVG visuals instead of photos. Both are
legitimate fallbacks, they are just weaker than the real thing.

Without a key, use the keyless path: find candidate businesses with web search, then
record each one with `sitescout add name="..." phone="..." address="..."`. Everything
downstream works the same, minus real review quotes and photos.

Pipeline data lives in `./.sitescout/leads.json` where you run it. Generated sites go to
`./sitescout-previews/`. Each project keeps its own pipeline.

## 1. Find

```
node scripts/sitescout.mjs search "dentists" "Bandra Mumbai"
```

Pulls up to 20 businesses. Businesses with no website score 95, social-page-only score 85.

Ask the user for niche and city if they have not said. Suggest tight geography over broad:
"dentists in Bandra" beats "dentists in Mumbai" because the pitch can name the
neighbourhood, and naming the neighbourhood is half the hook.

## 2. Rank

```
node scripts/sitescout.mjs fit
```

Two different numbers, and both matter:

- **Opportunity** = how weak their web presence is. High is good for you.
- **Fit** = whether they are a viable, reachable, paying prospect. Threshold is 60.

A business with no website and no phone number is opportunity 95 and fit 0. Do not build
for it. No phone means no way to pitch, which is an automatic disqualification, as is
being marked closed on Google.

Fit also flags chains. If four branches share a name, head office owns the website and a
local manager cannot buy from you. Skip them.

Show the user the passing leads and let them pick. Do not build for a whole list unasked;
each site is real work and they may only want one.

## 3. Audit

```
node scripts/sitescout.mjs audit <slug>
```

Fetches their actual website and checks 11 real defects: no https, no mobile viewport,
missing meta description, missing title, thin content, stale copyright, no linked socials,
never mentions its own neighbourhood, no structured data, no WhatsApp path, no booking
path. Also harvests contact emails and social links.

Every finding is checkable. Nothing is inferred. These lines end up in front of the owner,
so if the audit says the site never mentions Bandra, that is because the word is genuinely
absent from the page text.

If the audit reports the site is unreachable or errored, **open it in a browser yourself
before pitching**. A site that blocks automated fetches is not a broken site, and telling
an owner their working website is down destroys your credibility instantly.

## 4. Gather the real material

```
node scripts/sitescout.mjs enrich <slug>     # reviews, hours, Google's summary
node scripts/sitescout.mjs photos <slug>     # download their real photos
node scripts/sitescout.mjs facts <slug>       # the facts JSON
```

Enrich uses a pricier Google SKU than search, so spend it only on businesses you are
actually building for.

`facts` is the contract. Read it fully before designing. **Anything not in it must not
appear on the site.**

## 5. Build

Read `references/design.md` now, then write the site.

One HTML file, all CSS inline. The design personality is derived from the `designSeed`
in the facts, so the same business always gets the same look and no two businesses look
alike. Save to `./sitescout-previews/<slug>.html`, then record it:

```
node scripts/sitescout.mjs set <slug> previewFile=sitescout-previews/<slug>.html status=preview_ready
```

Do the design-director second pass described in `references/design.md`. It is not
optional; the first draft is never the one you send.

## 6. Verify

**Open the file and look at it.** This is the step a one-shot generator cannot do, and it
is where most of the quality comes from.

Check 375px width specifically. Horizontal overflow on mobile is the most common defect,
usually in the footer or a header call button. Confirm no invented facts, and that the
phone number is exactly right.

Fix, re-check, and only then show the user.

## 7. Pitch

Read `references/pitch.md`, then draft the WhatsApp message and the email.

The preview link must resolve for the recipient. A `file://` path or a `localhost` URL is
a dead link. Either the user hosts the file somewhere they control, or you tell them
plainly that the link needs hosting before the pitch can go out.

**Draft only. Never send.** Do not send an email, a WhatsApp message or any other outreach
on the user's behalf unless they explicitly ask you to in that moment. Hand them the text.

## Rules that do not bend

**Never invent a fact about a real business.** No years of experience, no team members, no
testimonials you wrote, no certifications, no prices. The owner will spot it immediately.

**Every preview carries `<meta name="robots" content="noindex, nofollow">`.** A preview
must never compete in search with the business it was built for.

**Share previews by direct link only.** Do not build an index page listing prospects, and
do not publish a browsable directory of businesses that have not agreed to anything.

**Never register or suggest a lookalike domain**, and never present a preview anywhere it
could be mistaken for the business's own live site. It is a concept for the owner to look
at, not a replica in the wild.

**No scraping beyond this.** The CLI reads public Google Places data and fetches the
business's own homepage once. Do not harvest personal data, do not collect anything about
individuals, and do not bulk-mail the emails the audit finds.

## Commands

| Command | Does |
|---|---|
| `search "<niche>" "<city>"` | Find businesses on Google Maps |
| `add name="..." phone="..."` | Record a business by hand (keyless path) |
| `list [--status=found]` | Show the pipeline |
| `fit [--all] [--limit=20]` | Rank prospects, threshold 60 |
| `audit <slug>` | Deep-check their existing website |
| `enrich <slug>` | Real reviews, hours, Google summary |
| `photos <slug> [--max=3] [--base64]` | Download their real photos |
| `facts <slug>` | The only facts allowed on the site |
| `set <slug> key=value` | Update a lead |
| `doctor` | Check which Places fields your key can read |
