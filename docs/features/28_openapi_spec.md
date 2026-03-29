# Feature 28 — OpenAPI Spec & Swagger UI

## Overview

`public/api/openapi.yaml` is the single source of truth for PostSyncer's public
REST API contract. This document explains how to serve it at runtime, embed a
developer UI, and manage future API versions.

---

## Serving the spec via GET /api/v1/openapi.json

Create a Next.js route handler that reads the static YAML file, parses it with
`js-yaml`, and returns it as JSON. This lets API consumers fetch a
machine-readable spec without needing access to the repo.

```
src/app/api/v1/openapi/route.ts
```

Key implementation points:

1. Use `fs.readFileSync` at startup (or `next/cache` with `force-cache`) to
   read `public/api/openapi.yaml` — it is a static asset so no DB call is
   needed.
2. Convert YAML → JSON with `js-yaml` (`yaml.load`) and return with
   `Content-Type: application/json`.
3. Add `Cache-Control: public, max-age=3600` so CDN edges can cache it.
4. No authentication is required — the spec is public documentation.
5. Optionally expose the raw YAML at `/api/v1/openapi.yaml` by serving the
   file directly from `/public/api/openapi.yaml` (Next.js serves `/public`
   statically) or via a second route handler that sets
   `Content-Type: application/yaml`.

Because the file lives under `/public`, Next.js already serves it at
`/api/openapi.yaml` with no extra code. The route handler at
`/api/v1/openapi.json` is additive and provides the versioned JSON form.

---

## Embedding Swagger UI in the settings/api page

Swagger UI is best loaded as an in-browser component so the interactive console
works without a separate server.

### Recommended approach — `swagger-ui-react`

```
npm install swagger-ui-react
npm install --save-dev @types/swagger-ui-react
```

Create a client component (e.g. `src/components/ApiDocsPanel.tsx`):

```tsx
'use client';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export function ApiDocsPanel() {
  return (
    <SwaggerUI
      url="/api/openapi.yaml"
      persistAuthorization
      tryItOutEnabled
    />
  );
}
```

Render it inside the existing settings page at
`src/app/(app)/settings/api/page.tsx`:

```tsx
import { ApiDocsPanel } from '@/components/ApiDocsPanel';

export default function ApiSettingsPage() {
  return (
    <div>
      {/* ... existing API key management UI ... */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">API Reference</h2>
        <ApiDocsPanel />
      </section>
    </div>
  );
}
```

### Styling notes

- Swagger UI ships its own CSS; import it once in the client component.
- Override the default font/colours in `globals.css` using the `.swagger-ui`
  selector to match the PostSyncer design system.
- The `persistAuthorization` prop keeps the Bearer token in `localStorage`
  across page refreshes, which is convenient for developers testing their keys.
- `tryItOutEnabled` opens the "Try it out" panels by default.

### Alternative — Scalar (lighter, more modern)

`@scalar/nextjs-api-reference` renders a polished reference page with a single
route handler and zero CSS conflicts. It is a good drop-in if Swagger UI's
default styling is hard to override.

---

## API versioning strategy

### Current state

All public endpoints live under `/api/v1/`. The `v1` prefix is part of the URL
path and communicated in the `servers` block of the OpenAPI spec.

### Principles

| Concern | Decision |
|---|---|
| **Versioning mechanism** | URL path prefix (`/v1`, `/v2`, …) — easy to route, cache, and document |
| **Breaking changes** | Require a new major version (`/v2`) |
| **Additive changes** | Fields, query params, and new endpoints may be added to an existing version without bumping |
| **Deprecation window** | Old versions are supported for at least 12 months after a new major version ships |
| **Discovery** | The OpenAPI spec for each version is served at `/api/vN/openapi.json` |

### What counts as a breaking change

- Removing or renaming a field from a response schema
- Changing a field's type
- Removing or renaming a query / path parameter
- Changing authentication or scope requirements
- Removing an endpoint

### Introducing v2

When a breaking change is needed:

1. Create `src/app/api/v2/` alongside `v1/`.
2. Write a new `public/api/openapi-v2.yaml` (or keep both in a `versions/`
   folder).
3. Update the `servers` block in the v2 spec.
4. Add a `Deprecation` / `Sunset` header to v1 responses so clients can detect
   the upcoming end-of-life.
5. Announce the deprecation timeline in the changelog and via email to API key
   holders.

### Changelog

Breaking changes and new features should be documented in
`docs/api-changelog.md` with the date and affected version, following the
[Keep a Changelog](https://keepachangelog.com/) format.
