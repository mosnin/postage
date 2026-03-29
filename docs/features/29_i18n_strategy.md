# PostSyncer Internationalization Strategy

## 1. Library Recommendation

Use **next-intl** (best Next.js 15 App Router support, RSC-compatible, no client bundle overhead for server components).

## 2. URL Structure

`/[locale]/dashboard` — locale prefix in URL path.

- Default locale (en) can be served at both `/en/` and `/` (redirect)
- `next.config.ts`: no built-in i18n needed with next-intl's middleware

## 3. Setup (key files)

**middleware.ts addition:**
```typescript
import createMiddleware from 'next-intl/middleware';
export default createMiddleware({
  locales: ['en', 'es', 'fr', 'de', 'pt', 'ja'],
  defaultLocale: 'en',
  localePrefix: 'as-needed' // hides /en/ prefix
});
```

**messages/en.json structure:**
```json
{
  "nav": { "dashboard": "Dashboard", "compose": "Compose" },
  "compose": { "title": "Create Post", "placeholder": "What's on your mind?" },
  "billing": { "upgrade": "Upgrade Plan", "monthly": "Monthly", "annual": "Annual" },
  "errors": { "unauthorized": "You don't have permission" }
}
```

## 4. User Locale Preference

- Detect from `Accept-Language` header on first visit
- Store `locale` preference in User model (`locale String @default("en")`)
- Settings page: locale selector dropdown

## 5. Translation Extraction Tooling

- `i18next-scanner` or `@formatjs/cli` to extract hardcoded strings
- Run: `npx formatjs extract 'src/**/*.tsx' --out-file messages/en.json`

## 6. Priority Translation Order

1. Marketing pages (homepage, pricing, features) — SEO impact
2. Auth pages (login, register, onboarding) — conversion impact
3. Core app pages (dashboard, compose, calendar)
4. Settings and billing pages

## 7. What NOT to Translate

- Platform names (Twitter, Instagram, etc.)
- Brand name "PostSyncer"
- API documentation
- Admin panel (English only)

## 8. RTL Support

Arabic and Hebrew would need `dir="rtl"` on `<html>` and Tailwind's RTL plugin (`tailwindcss-rtl`). Defer to v2.

## 9. Date/Number Formatting

Use `next-intl`'s `useFormatter()` hook — wraps `Intl.DateTimeFormat` and `Intl.NumberFormat` with locale awareness. Replace all `formatDate()` calls from `src/lib/utils.ts`.

## 10. Pluralization

next-intl handles ICU message format: `"posts": "{count, plural, one {# post} other {# posts}}"`
