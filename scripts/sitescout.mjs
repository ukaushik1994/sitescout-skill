#!/usr/bin/env node
// SiteScout CLI - the deterministic half of the skill.
//
// Everything in here is cheap, repeatable and needs no AI: finding businesses,
// pulling their real Google data, scoring how weak their web presence is, and
// deciding whether they are worth building for. The AI half (designing the site
// and writing the pitch) is done by Claude in the session, using references/.
//
// Zero dependencies. Node 18+ (needs global fetch).
//
// Data lives in ./.sitescout/leads.json relative to where you run it, so each
// project keeps its own pipeline.

import fs from 'fs'
import path from 'path'
import os from 'os'

const DATA_DIR = path.join(process.cwd(), '.sitescout')
const LEADS_FILE = path.join(DATA_DIR, 'leads.json')
const CONFIG_FILE = path.join(os.homedir(), '.sitescout', 'config.json')

// ---------------------------------------------------------------- config

// Key resolution order: env var, then ~/.sitescout/config.json.
// Absent is fine - the skill has a keyless path that uses web search instead.
function googleKey() {
  if (process.env.GOOGLE_MAPS_KEY) return process.env.GOOGLE_MAPS_KEY
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).googleKey || ''
  } catch {
    return ''
  }
}

function requireKey() {
  const key = googleKey()
  if (!key) {
    fail(
      'No Google Maps key found.\n' +
        'Either set GOOGLE_MAPS_KEY in the environment, or write it to ' +
        CONFIG_FILE + ' as {"googleKey":"..."}.\n' +
        'Without a key, skip this command and use the keyless path in SKILL.md instead.'
    )
  }
  return key
}

// ---------------------------------------------------------------- storage

function readLeads() {
  try {
    const raw = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeLeads(leads) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2))
}

function upsert(incoming) {
  const leads = readLeads()
  const byId = new Map(leads.map((l) => [l.id, l]))
  let added = 0
  for (const lead of incoming) {
    if (byId.has(lead.id)) {
      // Never clobber work already done on a lead (audit, preview, pitch).
      Object.assign(byId.get(lead.id), { ...lead, ...byId.get(lead.id) })
    } else {
      byId.set(lead.id, lead)
      added++
    }
  }
  const out = [...byId.values()]
  writeLeads(out)
  return { added, total: out.length }
}

function patchLead(id, patch) {
  const leads = readLeads()
  const lead = leads.find((l) => l.id === id || l.slug === id)
  if (!lead) fail(`No lead matching "${id}". Run: sitescout list`)
  Object.assign(lead, patch)
  writeLeads(leads)
  return lead
}

function findLead(id) {
  const leads = readLeads()
  const lead = leads.find((l) => l.id === id || l.slug === id)
  if (!lead) fail(`No lead matching "${id}". Run: sitescout list`)
  return lead
}

// ---------------------------------------------------------------- helpers

function fail(msg) {
  console.error('Error: ' + msg)
  process.exit(1)
}

function out(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function humanizeType(t) {
  if (!t) return 'Local Business'
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Auto-pick an industry design direction from Google's place types.
function directionForTypes(types = []) {
  const t = types.join(' ')
  if (/dentist|dental|doctor|clinic|physiotherapist|hospital|health/.test(t)) return 'clean-medical'
  if (/restaurant|cafe|bakery|food|meal/.test(t)) return 'warm-hospitality'
  if (/beauty|salon|spa|hair|nail/.test(t)) return 'elegant-beauty'
  if (/car_repair|car_wash|plumber|electrician|roofing|moving|locksmith|painter|contractor|laundry|cleaning/.test(t)) return 'bold-trades'
  if (/real_estate|property/.test(t)) return 'premium-realty'
  if (/gym|fitness|yoga/.test(t)) return 'energetic-fitness'
  if (/lawyer|accounting|finance|insurance|consultant/.test(t)) return 'modern-professional'
  if (/store|shop|boutique|clothing|jewelry|florist/.test(t)) return 'playful-retail'
  return ''
}

// ---------------------------------------------------------------- search

const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.photos',
  'places.googleMapsUri',
  'places.businessStatus',
].join(',')

// First-pass opportunity score from Maps data alone. The deep audit comes later.
function initialScore(website) {
  if (!website) return { score: 95, scoreReasons: ['No website at all - highest opportunity'] }
  const w = website.toLowerCase()
  if (/facebook\.|instagram\.|linktr\.ee|wa\.me/.test(w)) {
    return { score: 85, scoreReasons: ['Only a social page, no real website'] }
  }
  return { score: null, scoreReasons: [] }
}

async function cmdSearch(niche, city) {
  const key = requireKey()
  if (!niche) fail('Usage: sitescout search "<niche>" "<city>"')
  const textQuery = `${niche} in ${city || ''}`.trim()

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': SEARCH_FIELDS,
    },
    body: JSON.stringify({ textQuery, maxResultCount: 20 }),
  })
  const data = await res.json()
  if (!res.ok) fail((data && data.error && data.error.message) || 'Google Places search failed')

  const now = Date.now()
  const incoming = (data.places || []).map((p) => {
    const website = p.websiteUri || ''
    const name = (p.displayName && p.displayName.text) || 'Unknown business'
    return {
      id: p.id,
      slug: slugify(name),
      name,
      address: p.formattedAddress || '',
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
      phoneIntl: p.internationalPhoneNumber || p.nationalPhoneNumber || '',
      website,
      rating: p.rating || null,
      ratingCount: p.userRatingCount || 0,
      types: p.types || [],
      photoRefs: (p.photos || []).slice(0, 6).map((ph) => ph.name),
      mapsUrl: p.googleMapsUri || '',
      businessStatus: p.businessStatus || '',
      niche,
      city: city || '',
      status: 'found',
      addedAt: now,
      ...initialScore(website),
    }
  })

  const { added, total } = upsert(incoming)
  out({ query: textQuery, found: incoming.length, added, pipelineTotal: total })
}

// Manual entry, for the keyless path: Claude finds a business by web search,
// then records it here so the rest of the pipeline works identically.
async function cmdAdd(args) {
  const kv = {}
  for (const a of args) {
    const i = a.indexOf('=')
    if (i > 0) kv[a.slice(0, i)] = a.slice(i + 1)
  }
  if (!kv.name) fail('Usage: sitescout add name="Business" phone="..." address="..." [website=...] [rating=4.7] [ratingCount=120] [city=...] [niche=...] [types=dentist]')
  const name = kv.name
  const lead = {
    id: kv.id || 'manual-' + slugify(name),
    slug: slugify(name),
    name,
    address: kv.address || '',
    phone: kv.phone || '',
    phoneIntl: kv.phoneIntl || kv.phone || '',
    website: kv.website || '',
    rating: kv.rating ? Number(kv.rating) : null,
    ratingCount: kv.ratingCount ? Number(kv.ratingCount) : 0,
    types: kv.types ? kv.types.split(',').map((s) => s.trim()) : [],
    photoRefs: [],
    mapsUrl: kv.mapsUrl || '',
    businessStatus: 'OPERATIONAL',
    niche: kv.niche || '',
    city: kv.city || '',
    status: 'found',
    addedAt: Date.now(),
    source: 'manual',
    ...initialScore(kv.website || ''),
  }
  const { added, total } = upsert([lead])
  out({ added, pipelineTotal: total, lead })
}

// ---------------------------------------------------------------- enrich

// Place Details is a pricier SKU than search, so spend it only on the business
// you are actually building for. This is what makes a generated site feel real:
// actual customer reviews, real opening hours, Google's own summary.
async function cmdEnrich(id) {
  const key = requireKey()
  const lead = findLead(id)
  if (lead.enrichedAt) {
    out({ skipped: 'already enriched', reviews: (lead.reviews || []).length, hours: (lead.hours || []).length })
    return
  }

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(lead.id)}`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'reviews,regularOpeningHours,editorialSummary,photos',
    },
  })
  const data = await res.json()
  if (!res.ok) fail((data && data.error && data.error.message) || 'Place Details call failed')

  const reviews = (data.reviews || [])
    .map((r) => ({
      author: (((r.authorAttribution && r.authorAttribution.displayName) || 'A customer').trim().split(/\s+/)[0]) || 'A customer',
      rating: r.rating || null,
      text: ((r.text && r.text.text) || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    }))
    .filter((r) => r.text)
    .slice(0, 5)

  const freshPhotos = (data.photos || []).slice(0, 8).map((p) => p.name)
  const updated = patchLead(lead.id, {
    reviews,
    hours: (data.regularOpeningHours && data.regularOpeningHours.weekdayDescriptions) || [],
    editorialSummary: (data.editorialSummary && data.editorialSummary.text) || '',
    // An empty array here means "the API did not return photos", not "this business
    // has none". Never let it wipe refs the search call already found.
    photoRefs: freshPhotos.length ? freshPhotos : lead.photoRefs || [],
    enrichedAt: Date.now(),
  })

  // The API returns HTTP 200 and omits fields the key is not entitled to read, so
  // there is no error to catch and silence looks identical to success. Say it out
  // loud, because the pitch hook depends on having real review quotes.
  const missing = []
  if (!updated.reviews.length) missing.push('reviews')
  if (!freshPhotos.length) missing.push('photos')
  if (!updated.editorialSummary) missing.push('editorialSummary')
  if (missing.length && data.regularOpeningHours) {
    console.error(
      '\nWarning: no ' + missing.join(', ') + ' returned for this business, but opening hours came through.\n' +
        'That pattern usually means the key cannot read those fields at all, rather than this business\n' +
        'lacking the data. Confirm with: sitescout doctor --deep\n' +
        'Until it is resolved the site will show the Google rating instead of real quotes, and SVG\n' +
        'visuals instead of photos. Both work, they are just weaker.\n'
    )
  }

  out({
    reviews: updated.reviews.length,
    hours: updated.hours.length,
    editorialSummary: !!updated.editorialSummary,
    photoRefs: (updated.photoRefs || []).length,
    fieldsUnavailable: missing,
  })
}

// ---------------------------------------------------------------- doctor

// The failure this catches is silent: Places returns 200 and omits fields the key
// is not entitled to. Without this you find out by shipping a site with no photos
// and a pitch with no customer quote.
async function cmdDoctor(flags = {}) {
  const flagsDeep = !!flags.deep
  const key = googleKey()
  console.log('Google Maps key: ' + (key ? 'found' : 'NOT FOUND'))
  if (!key) {
    console.log('\nThe keyless path still works: find businesses with web search, then use "sitescout add".')
    console.log('You will not get real review quotes, real opening hours or real photos.')
    return
  }

  // Any well-known place works as a probe; this is Google's own Sydney HQ sample.
  const leads = readLeads().filter((l) => l.source !== 'manual')
  const probeId = leads.length ? leads[0].id : 'ChIJN1t_tDeuEmsRUsoyG83frY4'
  const probe = async (mask) => {
    try {
      const r = await fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(probeId), {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask },
      })
      const d = await r.json()
      if (d.error) return { mask, ok: false, note: (d.error.message || '').slice(0, 100) }
      return { mask, ok: Object.keys(d).some((k) => k !== 'error') }
    } catch (e) {
      return { mask, ok: false, note: e.message }
    }
  }

  const results = []
  for (const m of ['displayName', 'rating', 'regularOpeningHours', 'reviews', 'photos', 'editorialSummary']) {
    results.push(await probe(m))
  }
  console.log('\nField access (probed against place ' + probeId + '):')
  for (const r of results) {
    console.log('  ' + (r.ok ? 'yes' : 'NO ').padEnd(5) + r.mask + (r.note ? '  (' + r.note + ')' : ''))
  }

  const blocked = results.filter((r) => !r.ok).map((r) => r.mask)
  if (blocked.length) {
    console.log('\nBlocked: ' + blocked.join(', '))
    console.log('\nThe API returns HTTP 200 and simply omits these fields. Nothing errors, so nothing')
    console.log('downstream will complain - you would only notice by shipping a site with no photos')
    console.log('and a pitch with no customer quote.')
    console.log('\nThis is an account-level entitlement on the Google Cloud project behind the key, not')
    console.log('a problem with a particular business and not something this tool can work around.')
    if (!flagsDeep) console.log('To confirm it is account-wide, run: sitescout doctor --deep')
    console.log('\nWorth checking in Google Cloud Console, though none of these is a confirmed cause:')
    console.log('  - Credentials > your key > API restrictions')
    console.log('  - Billing is fully active on the project, not trial credits')
    console.log('  - Places API (New) is enabled on that same project')
    console.log('If all three look right, this needs Google Cloud support rather than more guessing.')
    console.log('\nMeanwhile the tool still works. Without reviews, sites show the Google rating instead')
    console.log('of customer quotes. Without photos, sites use the SVG motif visuals. Both are')
    console.log('legitimate fallbacks, just weaker than the real thing.')
  } else {
    console.log('\nAll fields readable. Real reviews, hours and photos are available.')
  }

  if (flagsDeep) {
    // Distinguishes "this business has no data" from "the key cannot read the field".
    // A landmark with hundreds of thousands of reviews definitely has both.
    console.log('\n--- deep check: a landmark that certainly has photos and reviews ---')
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.userRatingCount,places.photos' },
      body: JSON.stringify({ textQuery: 'Gateway of India Mumbai', maxResultCount: 1 }),
    })
    const d = await r.json()
    const p = (d.places || [])[0]
    if (!p) {
      console.log('  could not reach the reference place; skipping')
    } else {
      const n = (p.photos || []).length
      console.log(`  ${(p.displayName && p.displayName.text) || '?'}: ${p.userRatingCount ?? '?'} reviews, ${n} photos returned`)
      console.log(n === 0
        ? '  Zero photos on a place with this many reviews confirms the block is account-wide.'
        : '  Photos come through here, so the earlier omission was specific to that business.')
    }
  }
}

// ---------------------------------------------------------------- photos

// Real photos of the business always beat abstract visuals. There is no server
// here to proxy them, so download to disk and optionally emit data URIs, which
// keeps the API key out of the generated HTML entirely.
async function cmdPhotos(id, flags) {
  const key = requireKey()
  const lead = findLead(id)
  const refs = (lead.photoRefs || []).slice(0, Number(flags.max || 3))
  if (!refs.length) fail('No photo references on this lead. Run: sitescout enrich ' + id)

  const dir = path.join(process.cwd(), 'sitescout-previews', 'assets')
  fs.mkdirSync(dir, { recursive: true })

  const saved = []
  for (const [i, ref] of refs.entries()) {
    const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=1600&key=${encodeURIComponent(key)}`
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      console.error(`  skipped photo ${i + 1}: HTTP ${res.status}`)
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const type = res.headers.get('content-type') || 'image/jpeg'
    const ext = type.includes('png') ? 'png' : 'jpg'
    const file = path.join(dir, `${lead.slug}-${i + 1}.${ext}`)
    fs.writeFileSync(file, buf)
    saved.push({
      file: path.relative(process.cwd(), file),
      relativeToPreview: `assets/${path.basename(file)}`,
      bytes: buf.length,
      dataUri: flags.base64 ? `data:${type};base64,${buf.toString('base64')}` : undefined,
    })
  }
  if (!saved.length) fail('No photos could be downloaded.')
  patchLead(lead.id, { localPhotos: saved.map((s) => s.relativeToPreview) })
  if (flags.base64) {
    // Data URIs are enormous; write them to a file rather than the terminal.
    const target = path.join(DATA_DIR, `${lead.slug}-photos.json`)
    fs.writeFileSync(target, JSON.stringify(saved.map((s) => s.dataUri), null, 2))
    out({ saved: saved.map((s) => ({ file: s.file, bytes: s.bytes })), dataUrisWrittenTo: path.relative(process.cwd(), target) })
  } else {
    out({ saved: saved.map((s) => ({ file: s.file, useInHtmlAs: s.relativeToPreview, bytes: s.bytes })) })
  }
}

// ---------------------------------------------------------------- audit

// Deep audit of an existing website. Every check here is a real, checkable
// defect - nothing inferred, nothing invented, because these lines end up in
// front of the business owner.
async function cmdAudit(id) {
  const lead = findLead(id)
  const problems = []
  const recs = []
  const strengths = []

  if (lead.rating && lead.rating >= 4.5 && lead.ratingCount >= 50) {
    strengths.push(`Rated ${lead.rating}★ by ${lead.ratingCount} customers on Google - real trust that their online presence never shows off`)
  } else if (lead.rating && lead.rating < 4.0) {
    problems.push(`Google rating is ${lead.rating}★ - reputation needs attention alongside the website`)
  }
  if (lead.ratingCount > 0 && lead.ratingCount < 25) {
    recs.push(`Only ${lead.ratingCount} Google reviews - start a simple ask-every-happy-customer habit`)
  }
  if (!lead.phone) {
    problems.push('No phone number on the Google listing')
    recs.push('Add a phone number to the Google Business Profile - customers cannot call what they cannot see')
  }
  if (lead.enrichedAt && (!lead.hours || !lead.hours.length)) {
    problems.push('No opening hours on the Google listing')
    recs.push('Add opening hours to the Google profile - "is it open now" is the top local search question')
  }

  let score
  let emails = lead.emails || []
  let socials = lead.socials || []

  if (!lead.website) {
    score = 95
    problems.unshift('No website at all - people who find the Google profile have nowhere to go next')
    recs.unshift('Launch a proper website')
    recs.push('Once the site is live, link Instagram/Facebook from it so the brand is followable')
  } else {
    score = 15
    const url = lead.website.startsWith('http') ? lead.website : 'https://' + lead.website
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        },
      })
      clearTimeout(timer)

      if (!res.ok) {
        score = 90
        problems.push(`Website returns an error (HTTP ${res.status}) - verify in a normal browser before pitching`)
      } else {
        const html = await res.text()
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')

        if (url.startsWith('http://')) {
          score += 20
          problems.push('No secure connection (https) - browsers mark it unsafe')
        }
        if (!/<meta[^>]+name=["']viewport/i.test(html)) {
          score += 25
          problems.push('Not built for mobile phones')
          recs.push('Rebuild mobile-first - most local searches happen on a phone')
        }
        if (!/<meta[^>]+name=["']description/i.test(html)) {
          score += 10
          problems.push('No description for Google search results')
        }
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
        if (!titleMatch || !titleMatch[1].trim()) {
          score += 10
          problems.push('Missing page title')
        }
        if (text.replace(/\s+/g, ' ').trim().length < 1500) {
          score += 10
          problems.push('Very little content on the site')
        }
        const years = [...html.matchAll(/(?:©|&copy;|copyright)[^\d]{0,20}(20\d\d)/gi)].map((m) => parseInt(m[1], 10))
        if (years.length) {
          const latest = Math.max(...years)
          if (latest <= new Date().getFullYear() - 2) {
            score += 15
            problems.push(`Copyright says ${latest} - looks abandoned`)
          }
        }

        emails = [
          ...new Set(
            (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
              .map((e) => e.toLowerCase())
              .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(e))
              .filter((e) => !/(example\.|sentry|wixpress|schema\.org|yourdomain|email@|no-?reply)/.test(e))
          ),
        ].slice(0, 3)
        socials = [
          ...new Set(html.match(/https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|linkedin\.com)\/[A-Za-z0-9_.\-/%]+/g) || []),
        ]
          .filter((u) => !/\/(sharer|share|intent)\b/.test(u))
          .slice(0, 3)

        if (!socials.length) {
          score += 5
          problems.push('No social profiles linked anywhere on the website')
          recs.push('Link Instagram/Facebook from the site - people check the socials before they call')
        }
        const locality = (lead.address || '').split(',').map((s) => s.trim()).filter(Boolean).slice(-3, -2)[0] || ''
        const cityName = (lead.city || '').trim()
        const mentionsPlace = [locality, cityName]
          .filter(Boolean)
          .some((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text))
        if ((locality || cityName) && !mentionsPlace) {
          score += 10
          problems.push(`The website never mentions ${locality || cityName}`)
          recs.push(
            `Name the area on the homepage - searches like "${(lead.types || [])[0]?.replace(/_/g, ' ') || 'business'} in ${locality || cityName}" cannot find a site that hides its neighbourhood`
          )
        }
        if (!/application\/ld\+json|schema\.org/i.test(html)) {
          recs.push('Add LocalBusiness structured data (schema) so Google understands exactly what the business is')
        }
        if (!/wa\.me|api\.whatsapp|whatsapp:/i.test(html)) {
          recs.push('Add a WhatsApp button - it is how customers here actually reach out')
        }
        if (!/appointment|book(ing| now| an| online)|reserve/i.test(text)) {
          recs.push('Add an obvious booking/appointment path so interest turns into visits')
        }

        score = Math.min(score, 92)
        if (!problems.length) {
          problems.push('Site looks modern and mobile-friendly - weak opportunity')
          score = Math.min(score, 35)
        }
      }
    } catch {
      score = 90
      problems.push('Website unreachable or broken - verify in a normal browser before pitching')
    }
  }

  const updated = patchLead(lead.id, {
    score,
    scoreReasons: problems,
    recommendations: recs,
    strengths,
    emails,
    socials,
    auditedAt: Date.now(),
  })
  out({
    name: updated.name,
    opportunityScore: updated.score,
    problems: updated.scoreReasons,
    recommendations: updated.recommendations,
    strengths: updated.strengths,
    emails: updated.emails,
    socials: updated.socials,
  })
}

// ---------------------------------------------------------------- fit

// Opportunity score says how weak their web presence is. Fit says whether they
// look like a viable, reachable, paying prospect. Both matter: a business with
// no website and no phone is a 95 opportunity and a 0 fit.
function computeFit(lead, allLeads = []) {
  const reasons = []
  let fit = 0
  let disqualified = false

  if (lead.businessStatus && lead.businessStatus !== 'OPERATIONAL') {
    return { fit: 0, fitReasons: ['Marked as closed on Google'], disqualified: true }
  }

  if (!lead.phone) {
    disqualified = true
    reasons.push('No phone number - no way to pitch them')
  } else {
    fit += 20
  }
  if ((lead.emails || []).length) fit += 10

  const count = lead.ratingCount || 0
  if (count >= 100) fit += 30
  else if (count >= 25) fit += 20
  else if (count >= 10) {
    fit += 10
    reasons.push(`Only ${count} Google reviews - thin customer flow`)
  } else {
    reasons.push(`Only ${count} Google reviews - business may be too small or too new`)
  }

  if (lead.rating >= 4.5) fit += 25
  else if (lead.rating >= 4.0) fit += 15
  else if (lead.rating) reasons.push(`Rating ${lead.rating}★ - reputation problem comes before a website`)

  const base = (n) => String(n || '').toLowerCase().split(/[-(|]/)[0].replace(/\s+/g, ' ').trim()
  const siblings = allLeads.filter((l) => l.id !== lead.id && base(l.name) === base(lead.name)).length
  if (siblings >= 1) {
    reasons.push(`Looks like a chain - ${siblings + 1} branches with this name in the pipeline; head office owns their website`)
  } else {
    fit += 15
  }

  return { fit: disqualified ? 0 : fit, fitReasons: reasons, disqualified }
}

const FIT_THRESHOLD = 60

function cmdFit(flags) {
  const leads = readLeads()
  if (!leads.length) fail('No leads yet. Run: sitescout search "<niche>" "<city>"')
  const scored = leads.map((l) => {
    const f = computeFit(l, leads)
    return {
      id: l.id,
      slug: l.slug,
      name: l.name,
      opportunity: l.score,
      fit: f.fit,
      passes: f.fit >= FIT_THRESHOLD && !f.disqualified,
      why: f.fitReasons,
      website: l.website || '(none)',
      status: l.status,
    }
  })
  scored.sort((a, b) => b.passes - a.passes || (b.opportunity || 0) - (a.opportunity || 0) || b.fit - a.fit)
  const shown = flags.all ? scored : scored.filter((s) => s.passes)
  out({
    threshold: FIT_THRESHOLD,
    total: scored.length,
    passing: scored.filter((s) => s.passes).length,
    leads: shown.slice(0, Number(flags.limit || 20)),
  })
}

// ---------------------------------------------------------------- facts

// The single source of truth handed to Claude before it designs anything.
// If a fact is not in here, it must not appear on the generated site.
function cmdFacts(id) {
  const lead = findLead(id)
  out({
    business: {
      name: lead.name,
      category: humanizeType((lead.types || [])[0]),
      address: lead.address,
      phone: lead.phone,
      whatsappNumber: String(lead.phoneIntl || lead.phone || '').replace(/[^\d]/g, ''),
      googleRating: lead.rating,
      googleReviewCount: lead.ratingCount,
      city: lead.city,
      googleDescription: lead.editorialSummary || '',
      openingHours: lead.hours || [],
      realCustomerReviews: (lead.reviews || []).map((r) => ({ author: r.author, rating: r.rating, quote: r.text })),
      photoUrls: lead.localPhotos || [],
    },
    designSeed: String(lead.id || lead.name).split('').reduce((a, c) => a + c.charCodeAt(0), 0),
    suggestedDirection: directionForTypes(lead.types) || '(none matched - choose from references/design.md)',
    auditFindings: {
      opportunityScore: lead.score,
      problems: lead.scoreReasons || [],
      recommendations: lead.recommendations || [],
      strengths: lead.strengths || [],
    },
    enriched: !!lead.enrichedAt,
    audited: !!lead.auditedAt,
    designBrief: lead.designBrief || '',
  })
}

// ---------------------------------------------------------------- list / set

function cmdList(flags) {
  const leads = readLeads()
  if (!leads.length) {
    console.log('No leads yet. Run: sitescout search "dentists" "Mumbai"')
    return
  }
  const rows = leads
    .filter((l) => !flags.status || l.status === flags.status)
    .map((l) => ({
      slug: l.slug,
      name: l.name.slice(0, 34),
      opp: l.score ?? '-',
      fit: computeFit(l, leads).fit,
      website: l.website ? 'yes' : 'NO',
      status: l.status,
      preview: l.previewFile ? 'built' : '-',
    }))
  rows.sort((a, b) => (b.opp === '-' ? -1 : b.opp) - (a.opp === '-' ? -1 : a.opp))
  console.log(`${rows.length} leads in ${path.relative(process.cwd(), LEADS_FILE)}\n`)
  const pad = (s, n) => String(s).padEnd(n).slice(0, n)
  console.log(pad('slug', 30) + pad('opp', 5) + pad('fit', 5) + pad('site', 6) + pad('status', 15) + 'preview')
  console.log('-'.repeat(75))
  for (const r of rows) {
    console.log(pad(r.slug, 30) + pad(r.opp, 5) + pad(r.fit, 5) + pad(r.website, 6) + pad(r.status, 15) + r.preview)
  }
}

function cmdSet(id, pairs) {
  const patch = {}
  for (const a of pairs) {
    const i = a.indexOf('=')
    if (i > 0) patch[a.slice(0, i)] = a.slice(i + 1)
  }
  if (!Object.keys(patch).length) fail('Usage: sitescout set <slug> status=pitched [previewFile=...] [designBrief="..."]')
  const lead = patchLead(id, patch)
  out({ slug: lead.slug, updated: patch, status: lead.status })
}

// ---------------------------------------------------------------- main

const HELP = `SiteScout - find local businesses with weak websites, build them a preview, pitch it.

  sitescout search "<niche>" "<city>"   Find businesses on Google Maps (needs a key)
  sitescout add name="..." phone="..."  Record a business by hand (keyless path)
  sitescout list [--status=found]       Show the pipeline
  sitescout fit [--all] [--limit=20]    Rank prospects by whether they are worth building for
  sitescout audit <slug>                Deep-check their existing website
  sitescout enrich <slug>               Pull real reviews, hours, Google summary
  sitescout photos <slug> [--max=3]     Download their real Google photos
  sitescout facts <slug>                Print the ONLY facts allowed on the site
  sitescout set <slug> status=pitched   Update a lead
  sitescout doctor [--deep]             Check which Places fields your key can read

Google Maps key (optional): GOOGLE_MAPS_KEY env var, or ~/.sitescout/config.json
Pipeline data: ./.sitescout/leads.json`

const [cmd, ...rest] = process.argv.slice(2)
const flags = {}
const args = []
for (const a of rest) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2]
  else args.push(a)
}

try {
  switch (cmd) {
    case 'search': await cmdSearch(args[0], args[1]); break
    case 'add': await cmdAdd(args); break
    case 'list': cmdList(flags); break
    case 'fit': cmdFit(flags); break
    case 'audit': await cmdAudit(args[0]); break
    case 'enrich': await cmdEnrich(args[0]); break
    case 'photos': await cmdPhotos(args[0], flags); break
    case 'facts': cmdFacts(args[0]); break
    case 'set': cmdSet(args[0], args.slice(1)); break
    case 'doctor': await cmdDoctor(flags); break
    default: console.log(HELP)
  }
} catch (e) {
  fail(e && e.message ? e.message : String(e))
}
