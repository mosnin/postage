# SEO Audit — PostSyncer

**Date:** 2026-03-29
**Auditor:** Claude Code (automated)
**Scope:** All marketing pages under `src/app/(marketing)/`, root layout, and public assets

---

## Summary

The foundation is solid — the root layout exports a well-formed `Metadata` object with title template, description, basic Open Graph, and Twitter card. Several marketing pages add their own `metadata` exports. However, there are five critical gaps that will limit organic reach until fixed: no `robots.txt`, no sitemap, no OG images, the homepage is `"use client"` (blocks server-side metadata), and structured data is completely absent.

---

## 1. Missing robots.txt

**Severity: High**

`/public/robots.txt` does not exist. Without it, search crawlers have no guidance on what to index or disallow. This also means no `sitemap` reference that crawlers look for by default.

**Fix:** Create `/public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /api/
Sitemap: https://postsyncer.com/sitemap.xml
```

---

## 2. Missing Sitemap

**Severity: High**

Neither `/src/app/sitemap.ts` nor `/public/sitemap.xml` exists. Without a sitemap, crawlers must discover pages by following links — they will likely miss dynamic routes like `/compare/[competitor]` and `/platforms/[platform]`.

**Fix:** Add `/src/app/sitemap.ts` using Next.js's built-in sitemap convention:

```ts
import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://postsyncer.com";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/features`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/ai-agents`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    // compare pages, platform pages, tool pages…
  ];
}
```

---

## 3. Homepage Cannot Export Metadata (Critical)

**Severity: Critical**

`src/app/(marketing)/page.tsx` opens with `"use client"` because it uses `useState` for the pricing toggle. Client components **cannot** export `metadata` — Next.js ignores any `metadata` export from a client component. The homepage currently relies entirely on the root layout's default metadata, which means:

- The page `<title>` is the generic fallback, not a page-specific optimised title.
- No page-specific Open Graph description or canonical URL is set.

**Fix (two options):**

1. **Preferred — Extract the interactive pricing toggle** into a separate `PricingToggle` client component. Make `page.tsx` a server component and add a `metadata` export at the top:

```ts
export const metadata: Metadata = {
  title: "PostSyncer — Social Media Scheduler & AI Content Tool",
  description: "Schedule posts to 11 platforms, generate AI captions and videos, manage your team — all in one place. Loved by 50,000+ creators. Try free for 7 days.",
  alternates: { canonical: "https://postsyncer.com" },
  openGraph: { url: "https://postsyncer.com", images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
};
```

2. **Quick workaround** — Move the `isAnnual` toggle state into a small `<PricingBillingToggle>` client component so the page itself becomes a server component.

---

## 4. Pages Missing Metadata Exports

**Severity: Medium**

| Page | Has `metadata` export? | Notes |
|---|---|---|
| `/` (homepage) | No (blocked by `"use client"`) | Critical — see §3 |
| `/features` | Yes | Good — has title, description, OG url |
| `/pricing` | No | `"use client"` — same root cause as homepage |
| `/blog` | Yes | Good |
| `/ai-agents` | Yes | Good |
| `/compare/[competitor]` | Yes — `generateMetadata()` | Good |
| `/tools/hashtag-generator` | Yes | Good |

**Action required:** `/pricing/page.tsx` is also a `"use client"` file (uses `useState` for billing toggle) and therefore exports no metadata. Apply the same server/client split described in §3.

---

## 5. No Open Graph Images

**Severity: High**

The root `layout.tsx` sets `openGraph` and `twitter` card metadata but provides **no `images` array**. No page-level metadata includes an OG image either. When any PostSyncer URL is shared on Slack, Twitter, LinkedIn, or iMessage, no preview image appears — dramatically reducing click-through rates from social shares.

**Fix (two-step):**

1. Create a default OG image at `/public/og-image.png` (1200×630 px) with the PostSyncer brand.
2. Add it to the root `layout.tsx` metadata:

```ts
openGraph: {
  ...
  images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "PostSyncer" }],
},
twitter: {
  ...
  images: ["/og-image.png"],
},
```

3. For high-value pages, use Next.js dynamic OG image generation (`opengraph-image.tsx`) or supply page-specific images.

---

## 6. Missing Structured Data (JSON-LD)

**Severity: Medium**

No page uses JSON-LD structured data. This is a missed opportunity for rich results in Google Search.

**Recommended schemas by page:**

| Page | Schema type | Benefit |
|---|---|---|
| Homepage | `WebSite` + `SoftwareApplication` | Sitelinks searchbox, star ratings |
| `/pricing` | `SoftwareApplication` with `offers` | Price rich snippets |
| `/blog/[slug]` | `Article` or `BlogPosting` | Article rich results |
| `/faqs` | `FAQPage` | FAQ accordion in SERPs (high CTR boost) |
| `/compare/[competitor]` | `WebPage` with `breadcrumb` | Breadcrumb trail in SERPs |
| Tool pages | `WebApplication` | App-type rich cards |

**Example for homepage** — add as a `<script>` tag in the page (server component once §3 is fixed):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "PostSyncer",
      "applicationCategory": "SocialNetworkingApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "AggregateOffer",
        "lowPrice": "29",
        "highPrice": "99",
        "priceCurrency": "USD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "2500"
      }
    })
  }}
/>
```

---

## 7. Open Graph `url` Uses `process.env` at Build Time

**Severity: Low**

`layout.tsx` sets `url: process.env.NEXT_PUBLIC_APP_URL`. If this env var is not set at build time, the OG `url` will be `undefined`, which strips the canonical social URL. Verify the variable is present in the production build environment, or hard-code the production URL as a fallback:

```ts
url: process.env.NEXT_PUBLIC_APP_URL ?? "https://postsyncer.com",
```

---

## 8. Core Web Vitals Considerations

**Severity: Medium**

| Issue | Impact | Recommendation |
|---|---|---|
| Platform logos use inline coloured `div` elements with letter abbreviations, not actual `<img>` tags | No LCP image to optimise | Replace with real SVG or `<Image>` components |
| Feature section screenshots are gradient placeholder `div`s | LCP element will be text — not ideal | Replace with real screenshots using `next/image` with `priority` on above-fold image |
| `Inter` font loaded via `next/font/google` — good | Prevents FOUT | No change needed |
| No `<link rel="canonical">` on most pages | Duplicate content risk (www vs non-www, trailing slash) | Add `alternates.canonical` to every page's `metadata` export |
| `"use client"` on high-traffic pages | Increases JS bundle sent to browser, delays TTI | Split into server + minimal client components (already needed for §3) |

---

## 9. Keyword & Meta Description Quality

**Severity: Low–Medium**

- Root description (83 chars): good length, includes product name and key benefit.
- `/features` description: good.
- `/blog` description: decent but generic — could include a power keyword like "social media strategy".
- The `keywords` array in `layout.tsx` (5 entries) is very short. Google does not use the `keywords` meta tag, so this is harmless but also pointless — it can be removed to reduce HTML payload.
- No pages set `<meta name="robots" content="...">` — fine, since the default is `index, follow`, but consider `noindex` on thin tool pages once content is fleshed out.

---

## Priority Fix Order

| Priority | Fix | Effort |
|---|---|---|
| P0 | Add `robots.txt` | 5 min |
| P0 | Add `sitemap.ts` | 30 min |
| P0 | Split homepage into server + client components to unlock `metadata` | 1–2 hrs |
| P0 | Split pricing page for same reason | 30 min |
| P1 | Create OG image (`/public/og-image.png`) and wire into layout | 1 hr |
| P1 | Add `alternates.canonical` to every page metadata | 30 min |
| P1 | Add `FAQPage` JSON-LD to `/faqs` page | 30 min |
| P2 | Add `SoftwareApplication` JSON-LD to homepage | 1 hr |
| P2 | Add `Article` JSON-LD to blog post pages | 1 hr |
| P2 | Fix `NEXT_PUBLIC_APP_URL` fallback in layout | 5 min |
| P3 | Replace screenshot placeholders with real `next/image` assets | Ongoing |
| P3 | Add dynamic `opengraph-image.tsx` for blog posts | 2 hrs |
