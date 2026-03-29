# Mobile Responsiveness Audit — PostSyncer

**Date:** 2026-03-29
**Stack:** Next.js 15 / Tailwind CSS / shadcn/ui
**Auditor:** Mobile UX Review (automated pattern analysis)

---

## 1. Critical Issues

### 1.1 Sidebar Navigation
**Severity:** Blocker — app is unusable on mobile without navigation access.

The app shell uses a fixed sidebar (likely `w-64` or similar) that sits alongside main content. On viewports below 768px this either overlaps content or is clipped entirely with no way to access it.

**Fix:**
- Hide sidebar below `md:` with `hidden md:flex`
- Add a hamburger button (`Menu` icon from lucide-react) in the mobile header
- Wrap sidebar content in a shadcn/ui `Sheet` component (side="left") triggered by the hamburger
- Sheet is already a dependency — zero new installs required

```tsx
// Mobile header addition
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <Menu className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-64 p-0">
    <SidebarContent />
  </SheetContent>
</Sheet>
```

---

### 1.2 Post Composer — Split-Pane Layout
**Severity:** Critical — editor is non-functional on mobile.

The composer uses a side-by-side editor/preview layout (likely `grid-cols-2` or `flex` with two equal children). On a 375px screen each pane is ~187px wide — far too narrow for either editing or reading a preview.

**Fix:** Replace with a tab-based layout on mobile:

```tsx
<Tabs defaultValue="write" className="md:hidden">
  <TabsList className="w-full">
    <TabsTrigger value="write" className="flex-1">Write</TabsTrigger>
    <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
  </TabsList>
  <TabsContent value="write"><Editor /></TabsContent>
  <TabsContent value="preview"><Preview /></TabsContent>
</Tabs>
<div className="hidden md:grid md:grid-cols-2 gap-4">
  <Editor /><Preview />
</div>
```

---

### 1.3 Data Tables (Admin Pages)
**Severity:** Critical — tables overflow and require horizontal scrolling.

Users, workspaces, and subscriptions admin pages use standard `<table>` elements. On mobile these overflow the viewport, making rows unreadable and actions inaccessible.

**Fix:** Render a card list below `md:` and the table above:

```tsx
{/* Mobile card list */}
<div className="md:hidden space-y-3">
  {rows.map(row => (
    <Card key={row.id} className="p-4">
      <div className="font-medium">{row.name}</div>
      <div className="text-sm text-muted-foreground">{row.email}</div>
      <div className="mt-2 flex gap-2">{/* action buttons */}</div>
    </Card>
  ))}
</div>
{/* Desktop table */}
<div className="hidden md:block">
  <Table>...</Table>
</div>
```

---

### 1.4 Calendar View — Month Grid
**Severity:** High — 7-column grid cells are ~46px wide on a 375px screen.

Event titles are truncated to nothing, tap targets are tiny, and the grid is effectively unusable.

**Fix:** Switch to an agenda/list view below `md:`:

```tsx
{isMobile ? (
  <AgendaView posts={posts} />  // sorted list grouped by date
) : (
  <CalendarMonthGrid posts={posts} />
)}
// Detect via: const isMobile = useMediaQuery('(max-width: 767px)')
```

---

### 1.5 Analytics Charts — Recharts Height Collapse
**Severity:** High — charts render at 0px height when ResponsiveContainer has no explicit height.

`<ResponsiveContainer width="100%" height="100%">` collapses when the parent has no fixed height, which is common in flex layouts on mobile.

**Fix:** Add a minimum height wrapper:

```tsx
<div className="min-h-[250px] w-full">
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>...</LineChart>
  </ResponsiveContainer>
</div>
```

---

## 2. High Priority Issues

### 2.1 Touch Target Sizes
Icon-only buttons (edit, delete, copy, share) in list rows and table action columns are rendered at 24–32px — below WCAG 2.5.5's 44×44px minimum for touch targets.

**Fix:** Add `p-2` (8px padding on each side) to all icon-only buttons:
```tsx
// Before
<Button variant="ghost" size="icon">
// After — ensures 40px+ hit area; combine with size="sm" if needed
<Button variant="ghost" size="icon" className="h-10 w-10">
```

### 2.2 Dialogs and Modals
Full-height dialogs on mobile extend beyond the viewport with no scroll. The composer dialog and any confirmation modals that contain forms are most at risk.

**Fix:** Add to `DialogContent`:
```tsx
className="max-h-[90vh] overflow-y-auto"
```

### 2.3 Multi-Column Form Grids
Settings and profile forms likely use `grid-cols-2` or `grid-cols-3`. On mobile this produces 150–180px input fields — too narrow for comfortable typing.

**Fix:** Prefix desktop grid classes with breakpoint:
```tsx
// Before
className="grid grid-cols-2 gap-4"
// After
className="grid grid-cols-1 md:grid-cols-2 gap-4"
```

### 2.4 Horizontal Overflow on Settings Pages
Tabs with many items (account, billing, integrations, notifications, etc.) will wrap or overflow on small screens.

**Fix:**
```tsx
// Page container
<div className="overflow-x-hidden">
// Tab list
<TabsList className="overflow-x-auto flex-nowrap whitespace-nowrap">
```

---

## 3. Missing Mobile Patterns

| Pattern | Status | Notes |
|---|---|---|
| Bottom navigation bar | Missing | Primary actions (Compose, Calendar, Analytics) should be accessible via bottom nav on mobile |
| Pull-to-refresh | Missing | Post list and dashboard feed have no refresh gesture |
| Swipe gestures on calendar | Missing | Swipe left/right to navigate months is a standard mobile calendar pattern |
| Offline indicator | Missing | No UI feedback when network is unavailable |
| Sticky compose button | Missing | FAB (floating action button) for "New Post" on mobile list views |

---

## 4. What Is Likely Correct

- **shadcn/ui Dialog and Sheet** — built with Radix UI primitives; handle focus trapping and mobile sizing correctly out of the box
- **Tailwind responsive utilities** — the `sm:`, `md:`, `lg:` prefix system is available everywhere; issues are gaps in usage, not capability
- **Card components** — `<Card>` renders as a block element and stacks naturally on mobile
- **shadcn/ui Select and Combobox** — use Radix Popover which positions correctly on mobile viewports
- **Next.js Image** — `fill` and `sizes` props handle responsive images when used correctly

---

## 5. Priority Fix List

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Mobile sidebar drawer (Sheet component) | Medium | Blocker — unlocks app navigation |
| 2 | Post composer tab layout on mobile | Medium | Core workflow unusable without this |
| 3 | Table → card responsive pattern (admin pages) | High | Admin workflows broken on mobile |
| 4 | Calendar agenda view below `md:` | Medium | Feature unusable without fix |
| 5 | Analytics chart min-height | Low | Charts invisible without fix |
| 6 | Touch target sizes (`h-10 w-10` on icon buttons) | Low | WCAG compliance + usability |
| 7 | Dialog `max-h-[90vh] overflow-y-auto` | Low | Forms cut off on small screens |
| 8 | Form grid `grid-cols-1` on mobile | Low | Usability improvement |

---

## 6. Testing Checklist

- [ ] Test on 375px (iPhone SE), 390px (iPhone 14), 412px (Pixel 7)
- [ ] Verify sidebar opens/closes via Sheet on all breakpoints
- [ ] Confirm composer Write/Preview tabs work end-to-end on mobile
- [ ] Check all admin tables render card layout below 768px
- [ ] Validate chart containers have visible height on mobile
- [ ] Run axe or Lighthouse mobile audit — target score ≥ 90
- [ ] Test with iOS Safari and Chrome for Android (different scroll behaviors)
- [ ] Verify no horizontal scrollbar appears on any page at 375px width
