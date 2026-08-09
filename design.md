# Donor Dashboard Design

This document describes the product, application architecture, interface system, and implementation conventions for the Donor Dashboard. It is the reference point for changes that affect structure, interaction patterns, or visual consistency.

## Product purpose

The Donor Dashboard helps a social-impact organization coordinate donors, students, teachers, scholarships, schools, and student progress reports. The interface should make sensitive operational data easy to manage without becoming impersonal or visually overwhelming.

The product serves three primary experiences:

- **Administrators** manage users, roles, students, donors, teachers, schools, scholarships, grant types, reports, contact requests, and organization branding.
- **Teachers** manage assigned students and create or edit student reports.
- **Donors** review supported students and submit renewal requests.

An `agent` role exists in the data and authentication model, but it does not currently have a dedicated routed application area.

## Design principles

1. **Clarity before density.** Important status, ownership, and next actions should be understandable at a glance.
2. **Respectful presentation.** Student and donor information should be presented neutrally, with no unnecessary exposure of personal data.
3. **Consistent workflows.** Lists, detail views, forms, loading states, errors, and confirmations should behave the same across roles.
4. **Role-aware simplicity.** Each role should see the smallest useful set of navigation and actions.
5. **Accessible by default.** Maintain readable contrast, visible focus states, semantic labels, keyboard access, and responsive layouts.
6. **Brandable, not fragmented.** Organization branding may change color, typography, and radius, while layout and interaction conventions remain stable.

## Application architecture

The frontend is a React and TypeScript single-page application built with Vite. Mantine supplies UI primitives, React Router owns navigation, and Supabase provides authentication, relational data, storage, and server-side edge functions.

```text
src/main.tsx
  BrowserRouter
    AuthProvider
      BrandingProvider
        MantineProvider
          App routes
            ProtectedRoute / RoleRoute
              AppShellLayout
                Feature pages

Feature page
  -> shared design-system components
  -> Supabase client
  -> database / storage / edge functions
```

### Key boundaries

- `src/App.tsx` is the route map and the source of truth for role access at the UI layer.
- `src/modules/` contains role- or feature-oriented pages (`admin`, `auth`, `donor`, `profile`, and `teacher`).
- `src/layout/` owns authenticated navigation and responsive application chrome.
- `src/design-system/` owns tokens, theme construction, semantic mappings, branding conversion, and reusable interface patterns.
- `src/lib/supabaseClient.ts` owns the shared Supabase client and application data types.
- `supabase/functions/` contains privileged or server-side workflows such as invitations, user creation, and donor renewal requests.
- `schema_only.sql` and `full_schema.sql` document the database model. Database authorization must be enforced with Supabase policies; route guards are not a security boundary.

## Authentication and authorization

`AuthProvider` loads the Supabase session, profile, and all assigned roles. When a user has several roles, the primary interface role is selected in this order:

1. Admin
2. Teacher
3. Agent
4. Donor

`ProtectedRoute` restricts authenticated areas and `RoleRoute` restricts role-specific route groups. New protected pages must be placed inside both the authenticated shell and the appropriate role boundary. Data access must also be permitted by database row-level security or a controlled edge function.

## Information architecture

Authenticated pages share `AppShellLayout`. Navigation should be grouped by the user's work rather than by database table names.

- **Admin:** overview; people and roles; students; schools; donors; scholarships and grant types; reports; requests; branding.
- **Teacher:** overview; assigned students; reports.
- **Donor:** overview; supported student details; renewal.
- **All authenticated users:** profile and sign out.

List pages should lead to focused create, detail, or edit routes. Breadcrumbs or clear back links should be used when a workflow is more than one level deep.

## Visual system

The visual system is defined in `src/design-system/` and applied through `buildTheme()` in `src/main.tsx`.

### Tokens

Use exported values from `tokens.ts` rather than introducing literal colors, spacing, radii, shadows, font sizes, icon sizes, breakpoints, z-indexes, or animation durations inside pages.

The default visual character is:

- Clean white and light-neutral surfaces
- Blue primary and accent colors, replaceable by organization branding
- Modest borders and shadows that separate content without excessive elevation
- Medium corner radii and compact, readable controls
- A system-font stack for performance and language coverage

Runtime branding may configure the primary color, secondary color, font family, and default button radius. Components should consume Mantine theme values so branding changes propagate automatically.

### Responsive layout

The desktop shell uses a persistent navigation width of `220px`. Mobile uses a compact `56px` bar and drawer-based navigation. Pages must work from narrow mobile widths upward and must not rely on desktop-only tables for essential actions.

Preferred responsive behavior:

- Stack form fields and action groups on small screens.
- Allow tables to scroll horizontally, or replace dense rows with cards where scanning improves.
- Keep primary actions reachable without horizontal scrolling.
- Avoid fixed content widths except for intentionally focused flows such as authentication.

## Shared components and page patterns

Prefer the shared components exported by `src/design-system/index.ts`:

- `PageHeader` for title, context, and page-level actions
- `SectionCard` for grouped content
- `StatCard` for concise dashboard metrics
- `StatusBadge` for semantic states
- `FormActions` for save, cancel, and destructive actions
- `LoadingState`, `EmptyState`, and `InlineMessage` for feedback

A standard data page should render in this order:

1. Page title, short context, and primary action
2. Optional summary metrics or filters
3. Loading, error, or empty feedback when applicable
4. Main table, cards, form, or detail content
5. Secondary and destructive actions with clear labels

Forms should use visible labels, helpful validation messages, sensible defaults, and a single obvious submit action. Preserve user input when a recoverable request fails. Destructive operations require confirmation and should explain their impact.

## Status and feedback

Status colors carry consistent meaning:

- Success: completed, active, approved
- Warning: pending, expiring, or requiring attention
- Danger: failed, rejected, destructive, or overdue
- Info: neutral progress or contextual information
- Neutral: inactive, unknown, or not applicable

Do not communicate status through color alone. Pair color with text and, when useful, an icon. Use notifications for short action outcomes and inline messages when the information must remain visible in context.

Every asynchronous page must explicitly handle loading, empty, error, and success states. Avoid blank screens during authentication or data fetching when a branded loading state is appropriate.

## Data and privacy

The application handles information about students and donors. Follow `DATA_POLICY.md` and these implementation rules:

- Request and display only the fields needed for the current task.
- Avoid personal data in logs, URLs, analytics, screenshots, and error messages.
- Do not place privileged service credentials in Vite environment variables or browser code.
- Use edge functions for privileged Auth administration and other operations that cannot safely run with the anonymous client key.
- Treat exports, attachments, and free-text reports as sensitive data.
- Preserve auditability for meaningful administrative changes where the schema supports it.

## Adding or changing a feature

When implementing a feature:

1. Place the page in the relevant module and register it inside the correct route guard.
2. Reuse an existing page pattern and shared design-system component before creating a new abstraction.
3. Add reusable visual values to tokens or semantic mappings, not directly to a page.
4. Keep Supabase queries close to the feature until repetition or complexity justifies a dedicated data layer.
5. Verify authorization in both the UI and Supabase policies or edge function.
6. Test loading, empty, error, success, keyboard, mobile, and long-content states.
7. Run `npm run build` before merging.

## Current constraints and future direction

- There is no automated test suite or configured linter yet; the production build is the minimum automated verification.
- Database types are maintained manually in `supabaseClient.ts`. Generating types from the Supabase schema would reduce drift.
- Page-level Supabase queries are straightforward but repeated patterns may eventually justify shared hooks or repositories.
- The agent role needs an explicit product decision before routes or navigation are added.
- Accessibility and responsive behavior should be checked as features are touched, then formalized with automated tests when test infrastructure is introduced.

Update this document when a change introduces a new architectural boundary, role workflow, reusable interaction pattern, or design token.
