# Writing the pitch

Two pieces, always: a WhatsApp message and an email. Plain, friendly, no hype words,
no exclamation marks, short sentences. You are writing to a small business owner who
did not ask to be contacted.

## Facts you may use

Only what `sitescout facts <slug>` returns, plus the preview link. In particular:

- Business name, category, address
- Google rating and review count
- `realCustomerReviews` - what customers actually said
- `auditFindings.strengths` - verified strengths
- `auditFindings.problems` - real defects found on their existing site
- `auditFindings.recommendations` - the wider brand wins
- The preview URL or file path

## The hook

If real review quotes or verified strengths exist, **open with the strongest one**, then
point out that their online presence shows none of it. That contrast is the entire hook.
It is the difference between "your website is bad" (insulting) and "your customers love
you and your website hides it" (true, and useful).

## Scrub internal language

Audit findings are written for you, not for them. Never paste them raw. Rewrite:

| Internal | Client-facing |
|---|---|
| `- highest opportunity` | delete the phrase entirely |
| `- weak opportunity` | delete the phrase entirely |
| `- looks abandoned` | `(site looks unmaintained)` |
| `- browsers mark it unsafe` | `(browsers mark it "Not secure")` |
| `Only N Google reviews - thin customer flow` | do not use at all, it reads as an insult |
| opportunity score, fit score | never mention a score to the prospect |

## Position it as a brand review, not a website sale

Mention one or two of the wider `recommendations` (Google profile, social, discoverability)
so it reads like a 360-degree look at the brand rather than a website pitch. Say a full
review is part of the conversation. Do not list everything you found; you are opening a
conversation, not delivering the work for free.

Weave the angle in naturally, one sentence maximum:

> We design websites that tell a business's story and build a community of customers
> around it, not template brochures.

If the preview site you built **is** a generic template, do not use that line. Rebuild
the site first.

## Format

```
WHATSAPP MESSAGE
----------------
(max 80 words, casual, ends by sharing the preview link)

EMAIL
-----
Subject: (one line)
(max 130 words, names the specific problems found, shares the preview link,
 asks for a 15-minute call)
```

## Worked shape, for reference only

Do not copy this wording. It is here to show the structure and the register.

```
WHATSAPP MESSAGE
----------------
Hi, this is [your name]. I was looking at [Business] on Google - one customer wrote
"[real quote, trimmed]". That kind of reputation is hard to build. But the website
doesn't show any of it, and people who find you on Google have nowhere to go next.

So I built a preview of what it could look like, using your real details: [link]

Worth a quick call?

EMAIL
-----
Subject: A website preview for [Business]

Hi,

[Business] came up while I was reviewing [niche] in [area] on Google. [Strongest real
strength or review]. Here is what I noticed about the current online presence:

- [real problem 1]
- [real problem 2]

Two quick wins beyond the website: [recommendation 1], and [recommendation 2].

Rather than send a sales pitch, I built a working preview using your real details: [link]

If you like the direction, it can be live on your own domain quickly, and anything can
be changed. Would 15 minutes this week work?
```

## Before sending

- Every claim traces to the facts JSON. No paraphrased quotes, no inferred intent.
- The preview link actually resolves for someone who is not on your machine. A
  `file://` path or `localhost` link is a dead link in a pitch.
- The phone number in the message matches the phone number on the preview site.
- You have opened the preview on a phone-width screen yourself.
