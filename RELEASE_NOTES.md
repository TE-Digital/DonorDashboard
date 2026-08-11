# Design branch release notes

Release date: 11 August 2026

## Overview

This release introduces the Lumen design system across the Donor Dashboard. It aligns the application with the new grants-console reference: warm neutral surfaces, compact data density, a restrained blue primary action, consistent status treatments, and a workspace-oriented navigation shell.

The release also consolidates repeated list-screen behavior into shared components, expands the internal design documentation, and adds reference routes for reviewing the system in isolation.

## Highlights

### Lumen design system

- Added a complete Lumen component layer for controls, forms, badges, navigation, feedback, cards, tables, filters, sorting, pagination, dialogs, and layout.
- Added a warm neutral color ramp and a fixed Lumen blue brand ramp.
- Standardized the product on an 8px radius, compact control sizing, ringless shadows, tabular numeric alignment, and sentence-case labels.
- Added CSS custom properties for color, typography, spacing, borders, elevation, controls, and responsive layout.
- Added Lucide icons through a typed local icon registry.
- Updated Mantine theme defaults so legacy Mantine screens visually align with Lumen components.
- Preserved tenant logos, copy, secondary colors, and fonts while pinning the primary action color to the Lumen blue.

### Application shell and navigation

- Rebuilt the authenticated shell to match the reference workspace layout.
- Reorganized navigation into Overview, Community, Programmes, Giving, and Organisation sections.
- Added compact breadcrumb and account controls in the desktop top bar.
- Added a responsive mobile header and drawer using the same role-aware navigation structure.
- Added clearer active navigation states, profile initials, role context, and logout treatment.
- Preserved access to every existing destination while improving grouping and hierarchy.

### Data tables and list screens

- Added `TableSection` as the standard list-screen composition.
- Centralized KPI rows, search, column filtering, sorting, filter chips, selection, empty states, paging, and page-size controls.
- Added the Lumen `DataTable`, `FilterBar`, `KpiCard`, `Pagination`, and supporting data primitives.
- Standardized sticky table headers, 44px rows, subtle separators, tabular figures, and compact status badges.
- Migrated these admin screens to the shared table system:
  - Students
  - Teachers
  - Schools
  - Donors
  - Scholarships
  - Teacher assignments
  - Users and roles
  - Grant types
  - Contact requests

### Shared components

- Refreshed page headers, section cards, stat cards, status badges, empty states, inline messages, form actions, and the branded hero.
- Removed the obsolete `SectionCard` SCSS implementation in favor of the unified component styling.
- Standardized loading, empty, error, success, and action hierarchy treatments.
- Added global styling for typography, form controls, tables, cards, focus visibility, and reduced-motion behavior.

### Authentication and branding

- Updated login, password reset, welcome, and invite screens to use the new auth surface.
- Improved logo sizing and responsive form presentation.
- Added compatibility handling so legacy stored branding defaults do not override the new system defaults.
- Kept custom organization branding values available where they remain compatible with the system.

### Design review routes

- Added `/design-system` with an interactive grants-console reference screen.
- Added `/design-system/reference` with the component and token catalogue.
- Added representative data, navigation, forms, feedback, and table states for visual review.

### Types and dependencies

- Added an optional `role` field to the shared `Profile` interface.
- Added `lucide-react` for the typed Lumen icon registry.
- Expanded the central design-system exports with `TableSection` and its types.

### Documentation

- Added `design.md` with product, architecture, role, privacy, and UI conventions.
- Expanded `.claude/Design-system.md` as the authoritative implementation guide.
- Documented color, typography, spacing, components, navigation, data tables, responsive behavior, accessibility, language, and privacy rules.

## Earlier design-system groundwork included in this branch

- Introduced centralized tokens, typography roles, semantic status mappings, theme generation, and organization branding conversion.
- Added shared loading, empty, message, page-header, section-card, stat-card, status-badge, and form-action components.
- Migrated admin, teacher, donor, profile, and authentication screens away from repeated visual values.
- Added SCSS mixins, CSS variable generation, shared formatting helpers, and Supabase relationship helpers.

## Verification

- Production build: `npm run build`
- Formatting and whitespace: `git diff --check`
- Responsive visual review performed on desktop and mobile sign-in layouts during the design pass.

## Notes

- No database migration is required.
- Existing Supabase authentication, queries, route protection, and role behavior remain in place.
- The design-system routes are reference surfaces and use representative sample data.
- Vite still reports the existing CommonJS API deprecation and large-bundle warnings during production builds.
