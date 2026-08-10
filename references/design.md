# Building the preview site

Read this before writing a single line of HTML. The output is a **single HTML file**
with all CSS inline in one `<style>` tag. It gets sent to a real business owner as a
preview of what their website could be, so it has to look premium and trustworthy.

## The one rule that outranks every other rule

**Never invent a fact.** Run `sitescout facts <slug>` and treat that JSON as the
complete universe of true statements about this business. Specifically banned:

- Years in business, "since 1998", "over a decade of experience"
- Team members, staff names, founder bios, photos of people
- Testimonials or quotes you wrote yourself
- Certifications, awards, accreditations, association memberships
- Prices, packages, discounts, offers
- Any phone number other than the exact one in the facts

Generic benefit copy is fine ("clear quotes before any work starts"). Invented
specifics are not. The owner will read this page and spot a false claim instantly,
and that ends the conversation.

## Design personality: derive it, do not choose it

The facts JSON gives you a `designSeed` (a number). Use it so the same business always
gets the same personality, and no two businesses look alike.

- **Layout archetype** = `ARCHETYPES[designSeed % 4]`
- **Typography** = `TYPE_PAIRINGS[floor(designSeed / 7) % 4]`

### ARCHETYPES

0. Split hero: headline and copy on the left, a large visual panel on the right; angled or curved section dividers between sections.
1. Full-bleed visual hero with a dark cinematic overlay and centered minimal text; sections alternate light and dark backgrounds.
2. Editorial magazine style: oversized display headline set top-left, asymmetric layout grid, generous whitespace, thin rules between sections.
3. Layered cards: compact hero, then all content floating in elevated cards over a softly textured background.

### TYPE_PAIRINGS

0. High-contrast serif display font for headings, plus a clean humanist sans for body.
1. One geometric sans family at extreme weight contrast: 800-900 headlines, 300-400 body.
2. Elegant serif throughout, with letterspaced uppercase section labels.
3. Rounded friendly sans with generous line-height and pill-shaped buttons.

## Industry direction

The facts JSON gives you `suggestedDirection`. Use its motif language and its section
guidance. If it says none matched, pick the closest fit below.

| id | Industry | Direction |
|---|---|---|
| `clean-medical` | Healthcare & clinics | Clinical-clean: generous white space, soft teal/blue palette, rounded cards, calm reassuring tone. Sections: hero with a trust promise, services, why-patients-trust-us, prominent "Book an appointment" and tap-to-call. |
| `warm-hospitality` | Restaurants & cafés | Appetite-first: warm palette (terracotta, cream, deep brown), large imagery zones, menu-highlight section, story-of-the-kitchen section, opening hours prominent, "Reserve a table". |
| `elegant-beauty` | Salons, spas, beauty | Elegant minimal: soft neutrals with one blush or gold accent, serif display headings, airy spacing, services layout, transformation-story section, "Book your visit". |
| `bold-trades` | Trades & home services | Bold action: strong contrast (dark slate plus safety orange or yellow), big headline promising speed and reliability, oversized tap-to-call repeated down the page, service-area section, simple 3-step how-it-works. |
| `premium-realty` | Real estate & property | Premium dark: near-black background, gold or bronze accents, wide full-bleed imagery zones, thin elegant typography, featured-properties grid, private-consultation CTA. |
| `energetic-fitness` | Gyms & fitness | High-energy: dark background with one neon accent, condensed bold uppercase headings, transformation-journey section, class or program cards, "Start today". |
| `modern-professional` | Law, finance, consulting | Credibility: navy and white, structured grid, one restrained accent, expertise areas as numbered sections, principles-and-values section, "Schedule a consultation". No stock-photo clichés. |
| `playful-retail` | Shops & boutiques | Fresh retail: light background, two or three cheerful accent colors, product-category tiles, new-arrivals strip, visit-us section with the address emphasised, Instagram-follow CTA. |

### Visual motif language per direction

Build hero and section visuals as **custom inline SVG** shapes and patterns in the site
palette. Crafted and abstract. Never clipart, never emoji.

- `clean-medical` — soft rounded arcs and smile-curve shapes, a subtle plus-sign pattern, calm layered depth
- `warm-hospitality` — organic blob shapes, rising steam curves, circular plate motifs
- `elegant-beauty` — thin-line botanical strokes, petal arcs, hairline gold dividers
- `bold-trades` — strong diagonal stripes, hexagon and bolt patterns, angular section cuts
- `premium-realty` — thin architectural frame lines, precise grids, wide horizon lines
- `energetic-fitness` — dynamic diagonal slashes, pulse lines, motion streaks
- `modern-professional` — precise grid lines, large numbered sections, understated geometric accents
- `playful-retail` — confetti dots, rounded price-tag shapes, sticker-like badges

The palette must feel chosen for this exact business and motif. Not a default blue or teal.

## Design philosophy

This is a story-driven site, not a brochure. Find the story already sitting in the real
data: the neighbourhood, the craft, the rating earned from actual customers. Let the copy
tell that story and invite people into a community around the business. World-class,
current design standards.

## Required sections

- Sticky header: business name and a call button
- Hero with a story-driven headline rooted in the real place and neighbourhood
- About, built on `googleDescription` if one is provided
- 3-4 services inferred from the category
- Real reviews section
- Opening hours, **only if** `openingHours` is non-empty
- Contact: `tel:` link, address, WhatsApp booking button
- Simple footer

## Hard requirements

- Mobile-first responsive. Clear type scale, generous whitespace, one accent color, consistent spacing and border-radius. Alt text on every image.
- **Real reviews only.** Feature 2-3 of `realCustomerReviews` as styled quote cards, attributed like `— Priya, on Google`. Trim long quotes neatly mid-sentence. Never write your own. If none are provided, show the Google rating and review count instead.
- **WhatsApp button** links to `https://wa.me/<whatsappNumber>?text=<short pre-filled enquiry a customer would actually send>`.
- Proper `<title>`, meta description, and Open Graph tags, using only real data.
- **Photos**: if `photoUrls` is non-empty, use them as `<img>` sources in the hero and about sections. Real photos of the business always beat abstract visuals. If it is empty, build the visuals from the SVG motif language above. Never plain flat gradients alone, and never any other image URL.
- Every phone number shown must be exactly the one in the facts.
- No external JS or CSS libraries. The only allowed external resource is one Google Fonts CSS import, with `font-display: swap` and a system-font fallback stack. Keep the page fast.
- **Add `<meta name="robots" content="noindex, nofollow">`.** A preview must never compete in search with the real business it was built for.

## Pass two: the design director review

After the first draft exists, review it as a demanding design director at a world-class
studio and rework it to a level you would present to a paying client.

- Visual hierarchy, typography scale, spacing rhythm, color discipline
- The story: headline and copy must feel written for **this** business and its neighbourhood, never generic filler
- CTAs: calling and WhatsApp prominent and effortless on mobile
- Mobile layout flawless, nothing cramped or overflowing
- Factual integrity: remove anything not supported by the facts JSON
- **Sameness check**: if this page could pass as a generic template with the business name swapped out, redesign the hero and at least one section until it could not

### Mandatory checklist, fix every violation

- No emojis as icons, inline SVG only
- `cursor: pointer` on everything clickable
- Hover and focus states with 150-300ms transitions
- Text contrast at least 4.5:1
- Visible keyboard focus
- `prefers-reduced-motion` respected
- Responsive at 375, 768, 1024 and 1440 with **no horizontal scroll at any width**
- Touch targets at least 44px
- Body text at least 16px on mobile
- Headings in sequential hierarchy
- Alt text on every image

## Verify before you hand it over

You can actually open the file, unlike a one-shot generator. Do it.

1. Open the saved HTML in a browser.
2. Check it at 375px width specifically. Horizontal overflow on mobile is the single
   most common defect in generated preview sites, and a footer or a header call button
   is usually the culprit.
3. Confirm every phone number matches the facts, and that no review quote was invented.
4. Fix what you find, then re-check. Do not hand over a site you have not looked at.
