# Tech Stack

## Frontend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 15 (App Router) + TypeScript | SSR for marketing pages, RSC for dashboard |
| UI Components | shadcn/ui (Radix primitives) | Accessible, customizable, no CSS runtime |
| Styling | Tailwind CSS v4 + tailwind-merge + CVA | Utility-first, consistent design tokens |
| Icons | Lucide React + Huge Icons | Comprehensive icon coverage |
| Animation | Motion (framer-motion) | Calendar drag-drop, transitions |
| Forms | react-hook-form + zod | Type-safe validation |
| State (server) | TanStack Query v5 | Caching, background refetch, optimistic updates |
| State (URL) | nuqs | Calendar date params, filter state in URL |
| State (auth/theme) | React Context | Session state, color mode |
| Charts | Recharts | Analytics dashboard |
| Calendar | @dnd-kit + custom | Drag-drop scheduling calendar |
| Rich Text | Tiptap | Post composer editor |
| Date/Time | date-fns + day-picker | Scheduling, calendar |

## Backend
| Layer | Choice | Reason |
|-------|--------|--------|
| API | Next.js Route Handlers | Colocation with frontend |
| Auth | Auth.js v5 (NextAuth) | OAuth + credentials + magic link |
| Database ORM | Prisma 6 | Type-safe queries, migrations |
| Database | PostgreSQL 16 | Relational, JSONB for config |
| File Storage | Vercel Blob / S3-compatible | Media library uploads |
| Queue/Jobs | Vercel Cron + pg-boss | Post scheduling, background jobs |
| Email | Resend + React Email | Invites, notifications, billing |
| Billing | Stripe (Checkout + Webhooks + Portal) | Subscription management |
| AI | OpenAI API (GPT-4o + DALL-E 3) | Caption/content generation |
| Rate Limiting | Upstash Redis | API rate limiting, MCP |
| Validation | Zod | Runtime schema validation |

## Infrastructure
| Layer | Choice |
|-------|--------|
| Hosting | Vercel |
| Database Hosting | Neon (serverless PostgreSQL) |
| CDN/Edge | Vercel Edge Network |
| Monitoring | Vercel Analytics + Sentry |
| CI/CD | GitHub Actions |

## Auth Providers (End-User OAuth)
- Google (social login)
- GitHub (social login)

## Social Platform OAuth (Account Connections)
- Twitter/X: OAuth 2.0
- Facebook/Instagram: Meta OAuth
- LinkedIn: OAuth 2.0
- Pinterest: OAuth 2.0
- TikTok: OAuth 2.0
- YouTube: Google OAuth (additional scopes)
- Bluesky: ATP protocol (app passwords)
- Mastodon: OAuth 2.0 per instance
- Threads: Meta OAuth (Instagram scope extension)
- Telegram: Bot API

## Environment Variables Required
```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
OPENAI_API_KEY
RESEND_API_KEY
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
BLOB_READ_WRITE_TOKEN
TWITTER_API_KEY / TWITTER_API_SECRET
FACEBOOK_APP_ID / FACEBOOK_APP_SECRET
LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
```
