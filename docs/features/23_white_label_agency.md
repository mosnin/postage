# 23 – White-Label Agency

## 1. Overview

The Agency tier lets marketing agencies rebrand and resell PostSyncer to their
clients under a custom domain and visual identity. Each agency owns one or more
client Workspaces, manages billing centrally, and presents a fully branded
experience—no PostSyncer logo, colours, or support addresses visible to end
users.

---

## 2. Database Schema

Add the `Agency` model and a foreign-key on `Workspace` in `prisma/schema.prisma`.

```prisma
model Agency {
  id            String      @id @default(cuid())
  name          String
  domain        String      @unique  // e.g. "app.myagency.com"
  logoUrl       String?
  primaryColor  String      @default("#6366f1")
  supportEmail  String
  workspaces    Workspace[]
  createdAt     DateTime    @default(now())
}

// Existing model – add the relation fields:
model Workspace {
  // … existing fields …
  agencyId      String?
  agency        Agency?     @relation(fields: [agencyId], references: [id])
}
```

Migration command:

```bash
npx prisma migrate dev --name add_agency_white_label
```

---

## 3. Custom Domain Routing

Detect the incoming hostname in `middleware.ts`, resolve the matching `Agency`,
and forward its id + branding config to all downstream route handlers via
request headers.

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const isCustomDomain =
    !hostname.endsWith(".postsyncer.com") && hostname !== "localhost:3000";

  if (isCustomDomain) {
    const agency = await prisma.agency.findUnique({
      where: { domain: hostname },
      select: { id: true, primaryColor: true, logoUrl: true, supportEmail: true },
    });

    if (!agency) return NextResponse.next(); // unknown domain – fall through

    const res = NextResponse.next();
    res.headers.set("x-agency-id", agency.id);
    res.headers.set("x-agency-color", agency.primaryColor);
    res.headers.set("x-agency-logo", agency.logoUrl ?? "");
    res.headers.set("x-agency-support", agency.supportEmail);
    return res;
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
```

Cache the Prisma lookup with an in-memory LRU or `unstable_cache` to avoid a
DB hit on every request.

---

## 4. Branding Context

A server component reads the agency headers injected by middleware and renders
a `<style>` tag that overrides CSS custom properties for the entire subtree.

```tsx
// components/AgencyBrandingProvider.tsx
import { headers } from "next/headers";

export async function AgencyBrandingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const color = h.get("x-agency-color") ?? "#6366f1";
  const logo  = h.get("x-agency-logo")  ?? "";

  const css = `
    :root {
      --primary: ${color};
      --logo-url: url('${logo}');
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </>
  );
}
```

Wrap the root layout's `<body>` with `<AgencyBrandingProvider>`. All Tailwind
`primary-*` utility classes and `bg-[var(--primary)]` references pick up the
agency colour automatically.

---

## 5. Agency Dashboard

New route group `app/(agency)/agency/` protected by an `AGENCY_OWNER` role
check in the layout.

| Route | Purpose |
|---|---|
| `/agency` | Overview: total clients, MRR, active posts |
| `/agency/clients` | Table of client Workspaces with usage stats |
| `/agency/clients/[id]` | Per-client detail: members, posts, billing |
| `/agency/billing` | Subscription management via Stripe Customer Portal |
| `/agency/settings` | Domain, logo, colours, support email |

Server Actions in `app/(agency)/agency/actions.ts` handle client invite,
workspace creation, and branding updates. All actions gate on
`session.user.role === "AGENCY_OWNER"`.

---

## 6. Plan & Pricing

| Plan | Price | Client Workspaces | White-Label | Support |
|---|---|---|---|---|
| Starter | $19/mo | — | No | Community |
| Pro | $49/mo | — | No | Email |
| **Agency** | **$299/mo** | Unlimited | **Yes** | Priority |

The `AGENCY` plan is stored as a new `PlanType` enum value. Stripe product/price
IDs are kept in `lib/plans.ts` alongside existing entries. Upgrading to Agency
unlocks the `/agency/*` routes and the domain-routing middleware path.

---

## 7. Implementation Priority

### Phase 1 – Foundation (2 weeks)
- Prisma schema migration (`Agency` model + `Workspace.agencyId`)
- Middleware hostname detection + header injection
- `AgencyBrandingProvider` + CSS custom properties
- `AGENCY` plan in Stripe + `PlanType` enum

### Phase 2 – Agency Dashboard (2 weeks)
- `/agency/*` route group with role guard
- Client overview table + usage stats (posts scheduled, accounts connected)
- Workspace invite flow (agency owner creates workspace on behalf of client)
- Branding settings page (logo upload to S3/R2, colour picker)

### Phase 3 – Advanced Features (4 weeks)
- Custom transactional email domain (SendGrid domain authentication API)
- Billing passthrough: agency marks up client invoices via Stripe Connect
- Audit log per client workspace
- Agency-level analytics aggregated across all client workspaces
