# Chalk Design System

Chalk is a quiet, tablet-first POS for pool halls. The interface should stay mostly neutral, with chalk blue reserved for primary action and felt green used as a rare brand accent.

## Color

Tokens live in `src/app/globals.css` and support light and dark themes.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#FAFAF7` | `#0E0E0C` | Page background |
| `--surface` | `#FFFFFF` | `#18181A` | Cards, modals, sheets |
| `--surface-2` | `#F5F4EF` | `#1F1F1D` | Subtle controls and hover states |
| `--border` | `#E8E6DF` | `#2A2A26` | Default 1px dividers |
| `--border-strong` | `#D4D2CA` | `#3A3A36` | Higher-contrast dividers and empty art |
| `--text` | `#18181A` | `#F5F5F2` | Primary text |
| `--text-muted` | `#6B6A65` | `#9C9A92` | Secondary text |
| `--text-faint` | `#9C9A92` | `#6B6A65` | Placeholders |
| `--chalk` | `#1E5BB8` | `#1E5BB8` | Primary buttons, active states, links |
| `--chalk-soft` | `#E8EFFB` | `#102A4F` | Selected backgrounds |
| `--felt` | `#1A5E4A` | `#1A5E4A` | Logo mark and the single dashboard revenue stripe |
| `--felt-soft` | `#E6F0EB` | `#0F2F25` | Rare felt-tinted background |
| `--success` | `#2D7A4F` | `#2D7A4F` | Revenue and successful states |
| `--warning` | `#B8770F` | `#B8770F` | Warnings |
| `--danger` | `#B83A2E` | `#B83A2E` | Errors and destructive actions |

Use roughly 90% neutral colors on normal screens. Do not introduce additional accent colors without extending this document.

## Typography

Fonts are loaded in `src/app/layout.tsx` with `next/font/google`.

| Token | Font | Use |
| --- | --- | --- |
| `--font-sans` | Inter | All normal UI text |
| `--font-display` | Instrument Serif | Chalk wordmark, revenue totals, live timers |
| `--font-mono` | JetBrains Mono | Durations, ticket-like identifiers |

Utilities:

| Utility | Size / line-height | Use |
| --- | --- | --- |
| `text-display-lg` | `3.5rem / 1.05` | Future session scoreboard timer |
| `text-display` | `2.5rem / 1.1` | Large totals |
| `text-h1` | `1.75rem / 1.25` | Page titles |
| `text-h2` | `1.375rem / 1.3` | Modal and section titles |
| `text-h3` | `1.125rem / 1.4` | Card titles |
| `text-body` | `1rem / 1.55` | Main copy |
| `text-body-sm` | `0.875rem / 1.5` | Secondary copy |
| `text-caption` | `0.75rem / 1.4` | Labels, status captions |

Use only regular `400` and medium `500` weights.

## Components

Shared primitives live in `src/components/ui`.

| Component | Purpose |
| --- | --- |
| `Button` | Primary, secondary, ghost, danger actions. Default height is 44px. Supports `loading` and `iconLeft`. |
| `Input` | Token-driven text/number input with error helper support. |
| `Card` | Neutral 1px bordered surface. No drop shadow. |
| `Badge` | Neutral, success, warning, danger, and chalk pills. |
| `StatusDot` | Pool-ball-inspired numbered table marker. Uses one muted color, not ball colors. |
| `Logo` | Instrument Serif wordmark with the felt `◐` mark. |
| `EmptyState` | Generic centered empty state wrapper. |
| `EmptyRack` | Dashboard-only rack line art for no active sessions. |
| `Modal` | Centered confirmation/content modal. |
| `Sheet` | Right-side tablet workflow drawer. |
| `ToastProvider` / `useToast` | Bottom-right notifications. |
| `DataTable` | Flat data table with row dividers. |
| `PageHeader` | Standard page title/action layout. |
| `TabBar` | Segmented control. |
| `PaymentMethodPicker` | Checkout method selector with `terminalSlot` for Stripe Terminal work. |
| `AppShell` | Sidebar on desktop, bottom navigation below `1024px`. |

## Signature Moments

The creative pool references are deliberately limited:

1. `Logo` wordmark with the felt `◐` mark.
2. `StatusDot` on table cards.
3. Instrument Serif timers and monetary totals.
4. `EmptyRack` when the dashboard has no active sessions.
5. A single felt stripe on the dashboard revenue stat.

Do not add more pool-themed decoration.

## Notes For Feature Agents

Use `PaymentMethodPicker` for checkout work and pass Stripe Terminal UI through `terminalSlot`.

Use `PageHeader`, `Card`, `DataTable`, `TabBar`, and `Badge` for menu, analytics, settings, and billing screens. Keep business logic and data access scoped exactly as defined in `AGENTS.md`.
