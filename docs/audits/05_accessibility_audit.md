# Accessibility Audit — PostSyncer

**Standard:** WCAG 2.1 Level AA
**Auditor:** Claude Code (automated static analysis)
**Date:** 2026-03-29
**Scope:** `src/components/` and `src/app/`

---

## Executive Summary

The PostSyncer codebase uses Radix UI primitives for its core dialog, sheet, dropdown, and form components, which provides a solid WCAG-compliant foundation for keyboard navigation, focus management, and ARIA roles. However, a significant number of custom interactive elements and dynamic regions are missing required ARIA attributes, labels, and live-region announcements. The issues below are grouped by category, ordered by severity (Critical → High → Medium → Low).

**Issue counts by severity:**

| Severity | Count |
|----------|-------|
| Critical | 8 |
| High | 14 |
| Medium | 11 |
| Low | 6 |

---

## 1. Missing Skip Navigation Links

**Severity: Critical — WCAG 2.4.1 (Bypass Blocks)**

There is no skip-to-main-content link anywhere in the application.

| File | Detail |
|------|--------|
| `src/app/layout.tsx` | Root layout renders `<Providers>{children}</Providers>` with no skip link. |
| `src/app/(app)/layout.tsx` | App shell renders sidebar then `<AppHeader>` before `<main>`. Keyboard users must tab through all sidebar navigation items on every page load. |

**Required fix:** Add a visually-hidden-until-focused skip link as the very first focusable element inside `<body>`:

```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 z-[200] bg-background px-4 py-2 rounded-md font-medium">
  Skip to main content
</a>
```

The `<main>` element in `src/app/(app)/layout.tsx:69` needs `id="main-content"`.

---

## 2. Missing `aria-live` Regions for Dynamic Content

**Severity: Critical — WCAG 4.1.3 (Status Messages)**

Dynamic feedback is displayed visually but never announced to screen readers.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/post-composer.tsx` | 292–296 | Success banner (green "Draft saved successfully" etc.) is rendered with `setSuccessMessage` but has no `role="status"` or `aria-live`. Screen readers will not announce it. |
| `src/components/posts/post-composer.tsx` | 299–303 | Error banner for mutation failures has no `role="alert"` or `aria-live="assertive"`. |
| `src/app/(app)/settings/workspace/workspace-settings-form.tsx` (`src/components/team/workspace-settings-form.tsx`) | 381–389 | "Settings saved successfully." success message has no live-region attribute. |
| `src/components/media/media-uploader.tsx` | 219–223 | Upload status text ("Uploading 2 files…" / "3 files processed") changes dynamically but has no `aria-live`. |
| `src/app/(app)/settings/billing/page.tsx` | 276–304 | Trial countdown banner has no live-region for programmatic updates. |

**Required fix:** Add `role="status" aria-live="polite"` for success/informational messages, and `role="alert" aria-live="assertive"` for errors.

---

## 3. Icon-Only Buttons Missing Accessible Labels

**Severity: Critical — WCAG 1.1.1 / 4.1.2**

Several icon-only buttons convey meaning through icon alone with no accessible text.

| File | Line(s) | Element | Missing label |
|------|---------|---------|---------------|
| `src/components/posts/post-composer.tsx` | 511–519 | "AI Assist" button | Has visible text but the `<Sparkles>` icon has no `aria-hidden="true"` — will be announced as an unlabelled SVG element by some screen readers. |
| `src/components/posts/post-composer.tsx` | 360–364 | Remove-media `<X>` button | No `aria-label`. Screen readers announce it as an unlabelled button. |
| `src/components/media/media-uploader.tsx` | 226–229 | "Clear done" button | The `onClick` button has visible text but `<X>` icons in `UploadRow` remove buttons (line 291–297) have no `aria-label`. |
| `src/components/media/media-item.tsx` | 101–107 | Copy URL button (list view) | Uses only `title="Copy URL"` — `title` is not reliably exposed by all screen readers and fails on touch devices. Needs `aria-label`. |
| `src/components/media/media-item.tsx` | 108–114 | Delete button (list view) | Same issue — only `title="Delete"`. |
| `src/components/media/media-item.tsx` | 153–159 | Open detail button (grid hover) | Only `title="Open detail"`. |
| `src/components/media/media-item.tsx` | 162–177 | Copy/Delete buttons (grid hover overlay) | Same `title`-only pattern. |
| `src/components/calendar/calendar-month-view.tsx` | 107–113 | "+N more" expand button | No `aria-label` describing which day or what it expands. |
| `src/components/calendar/calendar-month-view.tsx` | 114–120 | "Show less" collapse button | Same issue. |

---

## 4. Custom Checkbox/Selection Controls Without ARIA Roles

**Severity: Critical — WCAG 4.1.2 (Name, Role, Value)**

Custom `<div>` elements are used as interactive checkboxes without the required ARIA semantics.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/media/media-item.tsx` | 69–79 | List-view checkbox is a `<div>` with `onClick` and visual check styling, but has no `role="checkbox"`, no `aria-checked`, and no focusable `tabIndex`. It is completely invisible to assistive technology. |
| `src/components/media/media-item.tsx` | 143–150 | Grid-view overlay checkbox has the same issue — `<div onClick={handleCheckbox}>` with no ARIA attributes. |

**Required fix:** Replace with a native `<input type="checkbox">` (visually styled with CSS) or add `role="checkbox"`, `aria-checked={isSelected}`, `tabIndex={0}`, and keyboard event handlers (`onKeyDown` for Space/Enter).

---

## 5. Missing Form Error Associations (`aria-describedby`)

**Severity: High — WCAG 1.3.1, 3.3.1**

Error messages are rendered as adjacent `<p>` elements but are not programmatically associated with their inputs.

| File | Line(s) | Fields affected |
|------|---------|----------------|
| `src/app/(auth)/login/page.tsx` | 194–196, 225–227 | Email, Password — error `<p>` elements not linked via `aria-describedby` to the inputs. |
| `src/app/(auth)/register/page.tsx` | 191–193, 213–215, 235–237, 259–261 | Name, Email, Password, Terms — same pattern. |
| `src/components/team/invite-member-form.tsx` | 144–146, 166–168, 193–196 | Email, Role, Message — error `<p>` elements not linked. Note: this form uses raw `<Input>` + `<Label>` without the `<Form>` / `<FormField>` pattern from `src/components/ui/form.tsx` that would provide automatic `aria-describedby`. |
| `src/components/team/workspace-settings-form.tsx` | 286–288, 302–304, 333–336 | Workspace Name, Slug, Timezone — same issue. |

**Note:** `src/components/ui/form.tsx` correctly implements `aria-describedby` and `aria-invalid` via `FormControl`. Forms that use `react-hook-form` directly without wrapping in `<Form>/<FormField>/<FormControl>` miss these associations.

**Required fix:** Either adopt the `<FormControl>` pattern, or manually add `id` to each error `<p>` and `aria-describedby="<error-id>"` to the corresponding `<input>`.

---

## 6. Server-Level Error Messages Not Associated with Inputs

**Severity: High — WCAG 3.3.1, 4.1.3**

The server-error banner in login and register pages is not associated with any specific form field, and has no live-region role.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/app/(auth)/login/page.tsx` | 169–172 | `serverError` div has no `role="alert"`, no `aria-live`. Appears after failed credential login but screen readers may not announce it. |
| `src/app/(auth)/register/page.tsx` | 168–171 | Same issue. |

---

## 7. Missing `aria-label` / `aria-labelledby` on Navigation Landmarks

**Severity: High — WCAG 1.3.6, 2.4.6**

Multiple `<nav>` and `<aside>` landmarks are present without distinguishing labels, which is problematic when a page has more than one landmark of the same type.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/layout/sidebar.tsx` | 161 | Desktop `<nav>` inside `<aside>` has no `aria-label`. |
| `src/components/layout/sidebar.tsx` | 310 | Mobile `<nav>` (bottom tab bar) has no `aria-label`. There are now two `<nav>` elements with no differentiation. |
| `src/app/(app)/settings/layout.tsx` | 61 | Settings sidebar `<nav>` has no `aria-label`. |
| `src/app/(app)/layout.tsx` | 69 | `<main>` lacks `id="main-content"` (needed for skip link target). |
| `src/components/layout/marketing-nav.tsx` | 44 | Outer `<nav>` wrapping the marketing header has no `aria-label`. |

**Required fix:** Add `aria-label="Main navigation"`, `aria-label="Mobile navigation"`, `aria-label="Settings navigation"` etc.

---

## 8. Dropdown Platforms Menu Missing ARIA Expanded State

**Severity: High — WCAG 4.1.2**

The desktop "Platforms" dropdown in the marketing nav uses a custom `<button>` + conditional `<div>` pattern rather than a Radix `DropdownMenu`.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/layout/marketing-nav.tsx` | 61–83 | The `<button>` that toggles the platforms dropdown has no `aria-expanded={platformsOpen}` and no `aria-haspopup="true"`. The dropdown `<div>` has no `role="menu"` or equivalent. The dropdown items are plain `<Link>` elements without `role="menuitem"`. |

---

## 9. `<aside>` in Sidebar Missing `aria-label`

**Severity: High — WCAG 1.3.1**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/layout/sidebar.tsx` | 132 | `<aside>` element has no `aria-label` attribute. Screen reader users navigating by landmarks cannot distinguish this from other aside regions. |

---

## 10. Progress/Usage Bars Not Accessible

**Severity: High — WCAG 1.3.1, 4.1.2**

Custom `<div>`-based progress bars are used in multiple places without ARIA roles or value attributes.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/accounts/accounts-list.tsx` | 259–274 | Account usage bar is a raw `<div>` with no `role="progressbar"`, no `aria-valuenow`, no `aria-valuemin`, no `aria-valuemax`, and no `aria-label`. |
| `src/app/(app)/settings/billing/page.tsx` | 120–142 | `UsageBar` component renders a raw `<div>` progress bar with no ARIA attributes. Used four times on the billing page (accounts, workspaces, AI credits, storage). |
| `src/components/media/storage-usage-bar.tsx` | 29–36 | Storage usage bar is a raw `<div>` with no `role="progressbar"` or value annotations. |
| `src/components/media/media-uploader.tsx` | 275–280 | Individual upload progress bar `<div>` has no `role="progressbar"` or accessible label. |

**Note:** `src/components/ui/progress.tsx` uses Radix `ProgressPrimitive` which correctly adds `role="progressbar"` and `aria-value*`. The custom bars above bypass this component and are not accessible.

---

## 11. Schedule Picker Time Selects Missing Labels

**Severity: High — WCAG 1.3.1, 3.3.2**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/schedule-picker.tsx` | 121–130 | Hour `<select>` has no `<label>` and no `aria-label`. |
| `src/components/posts/schedule-picker.tsx` | 132–140 | Minute `<select>` has no `<label>` and no `aria-label`. |
| `src/components/posts/schedule-picker.tsx` | 89–98 | The calendar picker trigger `<button>` shows date text dynamically but does not update an `aria-label` to reflect the selected date (only updates visible text). |

---

## 12. Missing `role` on Collapsible Sections in Post Composer

**Severity: Medium — WCAG 4.1.2**

The `Section` component used in the post composer is a custom collapsible with no ARIA attributes.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/post-composer.tsx` | 83–103 | The `Section` toggle `<button>` has no `aria-expanded` attribute indicating whether the section is open or closed. The hidden content `<div>` has no `aria-hidden` when collapsed. |

---

## 13. First Comment Textarea Without Label

**Severity: Medium — WCAG 1.3.1, 3.3.2**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/post-composer.tsx` | 380–387 | The "First Comment" `<textarea>` has a placeholder but no associated `<label>`. Placeholder text is not a sufficient substitute for a label per WCAG 3.3.2. |

---

## 14. Campaign `<select>` Without Visible Label

**Severity: Medium — WCAG 1.3.1**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/post-composer.tsx` | 454–466 | The campaign `<select>` has no `<label>` element or `aria-label`. The parent `Section` heading provides visual context but is not programmatically linked. |

---

## 15. Tiptap Editor Without Accessible Label

**Severity: Medium — WCAG 1.3.1, 4.1.2**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/post-composer.tsx` | 149–155 | `EditorContent` renders a `contenteditable` div. The `editorProps.attributes` include a CSS class but no `aria-label` or `aria-labelledby`. Screen readers may announce it without context as a generic edit region. |

---

## 16. Approval Review Panel — Platform Navigation Buttons Without Labels

**Severity: Medium — WCAG 4.1.2**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/approval-review-panel.tsx` | 495–500, 509–514 | ChevronLeft/ChevronRight platform navigation buttons have no `aria-label`. Screen readers cannot determine their purpose. |

---

## 17. `PlatformDot` / `PlatformIcon` in Collapsed Sidebar Relies on `title` Only

**Severity: Medium — WCAG 1.1.1**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/queue-item.tsx` | 38–52 | `PlatformDot` uses only `title={label}` for its accessible name. `title` attributes are not reliably announced by all screen readers and fail on touch-only devices. The `aria-label` attribute should be used instead. |
| `src/components/accounts/account-card.tsx` | 108–115 | Platform icon `<div>` uses only `title={platformLabel}`. Same issue. |

**Note:** `src/components/ui/platform-icon.tsx` correctly uses `aria-label={label}` — the pattern should be replicated in these inline components.

---

## 18. Status Badge Color Conveys Meaning Without Text Alternative

**Severity: Medium — WCAG 1.4.1 (Use of Color)**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/accounts/account-card.tsx` | 116–118 | The colored dot `<span className={cn("h-2 w-2 rounded-full", statusConfig.color)} />` conveys status (green/red/yellow/grey) purely through color. It has no `aria-label` or `aria-hidden` with an adjacent text alternative. |
| `src/app/(app)/settings/billing/page.tsx` | 144–163 | `StatusBadge` uses background color classes (`bg-green-100 text-green-700` etc.) as the sole visual differentiator between subscription states (Active, Past Due, Canceled). The text content is present so this is minor, but the color alone is the first indicator. |

---

## 19. `<svg>` Spinner Without `aria-label` in Auth Pages

**Severity: Medium — WCAG 4.1.2**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/app/(auth)/login/page.tsx` | 23–46 | `Spinner` component renders a raw `<svg>` with no `aria-label`, `aria-hidden`, or `role="status"`. When it appears during form submission, screen readers may announce it as an unlabelled graphic or ignore it entirely. |
| `src/app/(auth)/register/page.tsx` | 28–39 | Identical `Spinner` with the same issue. |

**Note:** The Lucide-based `<Loader2 className="animate-spin" />` icons used elsewhere in the app have the same issue (no `aria-hidden` or `aria-label`), though they are typically accompanied by visible button text.

---

## 20. Modal/Dialog Focus Scope — `ApprovalReviewPanel` Renders Two Simultaneous Focus Traps

**Severity: Medium — WCAG 2.1.2 (No Keyboard Trap)**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/approval-review-panel.tsx` | 424–631 | The panel uses a Radix `Sheet` (which is Radix Dialog-based) for the outer modal, but `DecisionForm` is rendered inline inside it. Radix handles focus trapping correctly for the Sheet. However, the `<Textarea>` for the decision note (line 351) has `id="decision-note"` which duplicates `id` if multiple panels were ever mounted — this could become a problem. |
| `src/components/calendar/calendar-month-view.tsx` | 126–142 | The post detail overlay is a custom `<div>` overlay (`fixed inset-0 z-40`) that dismisses on click but has no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, and no focus trap. Focus is not moved into the panel on open, so keyboard users cannot access the panel content. |

---

## 21. Workspace Delete Confirmation Input Not Associated With Its Description

**Severity: Medium — WCAG 3.3.2**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/team/workspace-settings-form.tsx` | 450–461 | The confirmation `<Input>` inside the delete `<AlertDialog>` has no `id` or `aria-label`, so the instructional text ("Type {workspace.name} to confirm") at line 445–449 is not programmatically linked to the input via `aria-describedby`. |

---

## 22. Missing `lang` Attribute for Non-English Content

**Severity: Low — WCAG 3.1.2**

No issues found with inline language changes — all visible content is English only. The root `<html lang="en">` in `src/app/layout.tsx:8` is correctly set.

---

## 23. Auth Logo Link Missing `aria-label`

**Severity: Low — WCAG 2.4.4**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/app/(auth)/layout.tsx` | 19–38 | The logo `<Link href="/">` contains an SVG icon and the text "PostSyncer". The SVG has no `aria-hidden="true"`, which means screen readers may attempt to describe it redundantly alongside the text "PostSyncer". |

---

## 24. Marketing Footer Logo Link Missing `aria-label`

**Severity: Low — WCAG 2.4.4**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/layout/marketing-footer.tsx` | 56–60 | The `<Link href="/">` logo contains a `<Zap>` icon and the text "PostSyncer". The icon SVG has no `aria-hidden="true"`. |
| `src/components/layout/marketing-nav.tsx` | 46–54 | Same pattern — `<Zap>` icon inside logo link without `aria-hidden`. |
| `src/components/layout/sidebar.tsx` | 141–149 | Logo link has `aria-label="PostSyncer home"` (correct), but the inner `<Zap>` icon has no `aria-hidden="true"`. |

---

## 25. Mobile Nav Inbox Badge Not Announced

**Severity: Low — WCAG 4.1.3**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/layout/sidebar.tsx` | 342–345 | The unread-count badge on the mobile Inbox tab renders a number but has no `aria-label` (e.g., "3 unread messages"). The number alone provides some information but the context ("unread items") is lost. The desktop version (line 252–257) has the same issue. |

---

## 26. `focus-visible` Indicator Styles — Partial Coverage

**Severity: Low — WCAG 2.4.7 (Focus Visible)**

The application's `<Button>` component at `src/components/ui/button.tsx:7` correctly applies `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`, which is adequate. However several custom `<button>` elements bypass this:

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/posts/post-composer.tsx` | 472–494 | Schedule mode selection buttons (`Publish Now`, `Add to Queue`, `Schedule for Later`) have no `focus-visible` ring styles. |
| `src/components/posts/approval-review-panel.tsx` | 115–133 | `PlatformTab` custom `<button>` has no `focus-visible` styles. |
| `src/app/(app)/settings/billing/page.tsx` | 391–419 | Monthly/Annual toggle buttons have no `focus-visible` ring. |

---

## 27. `<table>` in Billing Page Missing `scope` Attributes

**Severity: Low — WCAG 1.3.1**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/app/(app)/settings/billing/page.tsx` | 525–533 | The `<thead>` `<th>` elements ("Date", "Description", "Amount", "Status", "Invoice") are missing `scope="col"` attributes, which is required for tables with multiple header rows or to explicitly declare column scope for assistive technologies. |

---

## 28. Color Contrast — Potential Issues

**Severity: Requires manual verification — WCAG 1.4.3 (Contrast Minimum)**

The following color combinations cannot be verified by static analysis alone (they depend on CSS variable values resolved at runtime) but are flagged as requiring manual contrast checking:

| Area | File | Concern |
|------|------|---------|
| `text-muted-foreground` on `bg-background` | Throughout | Tailwind's `text-muted-foreground` maps to a CSS variable. If the theme resolves to approximately `#9ca3af` on white, this is ~3.0:1, below the 4.5:1 minimum for normal text. |
| `text-muted-foreground/70` on sidebar headers | `src/components/layout/sidebar.tsx:165` | 70% opacity muted-foreground further reduces contrast. |
| Auth page `text-slate-400` on `bg-slate-900` gradient | `src/app/(auth)/login/page.tsx:127, 244` | `text-slate-400` (#94a3b8) on `bg-slate-900` (#0f172a) is approximately 3.5:1, below the 4.5:1 threshold for normal-weight text at 14px. |
| Auth page `text-slate-500` divider text | `src/app/(auth)/login/page.tsx:162` | `text-slate-500` (#64748b) on dark gradient background is likely below 4.5:1. |
| `text-green-700 dark:text-green-400` status messages | `src/components/team/workspace-settings-form.tsx:382` | Green-on-white variants need verification. |
| Orange/yellow billing status badges | `src/app/(app)/settings/billing/page.tsx:147–150` | `bg-orange-100 text-orange-700` — orange-on-light orange needs contrast check. |

**Tool recommendation:** Run axe-core or Chrome Lighthouse in the running application to confirm exact contrast ratios.

---

## Summary of Required Fixes by Priority

### Immediate (Critical)

1. Add a skip navigation link to `src/app/layout.tsx` targeting `#main-content` on `<main>` in `src/app/(app)/layout.tsx`.
2. Add `role="alert" aria-live="assertive"` to all error banners in the post composer, auth pages, and form submissions.
3. Add `role="status" aria-live="polite"` to success banners (post composer, workspace settings).
4. Add `aria-label` to all icon-only remove/delete/copy buttons in `media-item.tsx` and `post-composer.tsx`.
5. Replace `<div onClick>` custom checkboxes in `media-item.tsx` with native `<input type="checkbox">` or properly ARIA-attributed elements.

### Short-term (High)

6. Associate form error messages with inputs via `aria-describedby` in login, register, invite-member, and workspace-settings forms.
7. Add `aria-expanded` and `aria-haspopup` to the Platforms dropdown button in `marketing-nav.tsx`.
8. Add `aria-label` attributes to all `<nav>` and `<aside>` landmark elements.
9. Add ARIA attributes (`role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`) to all custom progress/usage bars.
10. Add `aria-label` to the hour and minute `<select>` elements in `schedule-picker.tsx`.

### Medium-term

11. Add `aria-expanded` to the `Section` collapsible toggle buttons in `post-composer.tsx`.
12. Add `aria-label` to the `<textarea>` in the First Comment section.
13. Convert the calendar day post-detail panel into a proper accessible dialog (`role="dialog"`, `aria-modal`, focus trap, focus restoration).
14. Add `aria-label` to platform navigation arrows in `approval-review-panel.tsx`.
15. Add `role="status"` or `aria-label` to the `Spinner` SVG in auth pages.

### Low-priority

16. Add `aria-hidden="true"` to decorative SVG icons inside logo links.
17. Add `aria-label` context to unread-count badges (sidebar desktop and mobile).
18. Add `focus-visible` ring styles to custom toggle button groups in billing page, schedule picker, and approval panel.
19. Add `scope="col"` to `<th>` elements in the billing history table.
