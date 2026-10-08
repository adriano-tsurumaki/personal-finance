# Ledger design system

This reference is based exclusively on the Ledger Design System export. Read it before implementing or changing frontend components, layouts, styles, themes, icons, motion, or UI copy. It describes the design independently of the consuming application's current implementation.

## Reading workflow

Read the foundations and relevant component recipes first. Consult source CSS, JSX, and matching declarations for additional detail. Distinguish original patterns, later additions, and implementation limitations. Document deliberate changes to these design rules in this reference with their rationale.

## Provenance and source navigation

Baseline inspected on **2026-09-28**: the local `F:\Portfolio\Ledger Design System` export. This guide is self-contained for routine implementation; the sibling directory is optional supporting evidence, not a runtime dependency. No remote revision was verified. Its `github.md` reports a sync on `2026-08-17T22:45:00Z`, but the export also contains subsequent additions and provides no pinned commit for this snapshot.

Paths in this table are relative to that external export:

| Source                                                                                                     | Use                                                                |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `tokens/colors.css`, `typography.css`, `radius.css`, `spacing.css`, `effects.css`, `fonts.css`, `base.css` | Exact values, theme overrides, font loading, defaults              |
| `components/components.css`                                                                                | Rendered geometry, states, tints, responsive rules                 |
| `components/{core,data,finance,feedback}/*.jsx`                                                            | Actual markup and behavior                                         |
| Matching `*.d.ts` and `*.prompt.md`                                                                        | Reference props and usage examples; verify against JSX             |
| `ui_kits/ledger/*.jsx`, `index.html`                                                                       | Complete screen composition and interactive specimens              |
| `ui_kits/ledger/finance-data.js`                                                                           | Demo fixtures and calculations only; never production domain logic |
| `guidelines/*.html`                                                                                        | Foundation specimens                                               |
| `readme.md`, `ui_kits/ledger/README.md`, `github.md`                                                       | Intent, additions, provenance                                      |
| `assets/ledger-mark*`, `assets/icons/`                                                                     | App mark and Lucide glyph references                               |

The bundle, manifest, and adherence configuration are export tooling, not packages to install or rules to import wholesale. The original product stacked monthly, weekly, and recurring sections. The export adds tabs, toasts, modals, and installments. These are valid design patterns, not a requirement to implement all of those features.

Source discrepancies and interpretation:

- `Icon.jsx` renders inline SVG, despite the README describing CSS masks and `LEDGER_ICON_BASE`. The JSX determines actual rendering.
- The original-product prose says no entrance animation or fixed elements. The added modal and toaster intentionally use fixed positioning and a 150ms fade with a 4px lift.
- `tokens/base.css` applies a universal 400ms color transition; component CSS specifies 150ms. The component rules override the base timing where specified.
- The kit's tabs lack arrow-key navigation, and its modal does not implement a complete focus trap or focus restoration. These are limitations of the reference implementation.

## Quick implementation rules

- One centered financial surface, maximum width 48rem, quiet horizontal section dividers, compact controls, and restrained headings.
- Use semantic green-tinted tokens. Income is green; expense is red. Destructive actions have their own token.
- Instrument Sans for UI text; JetBrains Mono with tabular numerals for financial amounts and numeric counters.
- Border and fill define surfaces. No decorative shadows, glass, blur, photography, patterned backgrounds, or background gradients.
- Use Lucide icons, sentence-case English UI copy, and formatted amounts.
- Use the reference component contracts as design guidance, not as proof of local exports or compatible props.
- Sample dates and calculations illustrate the screens rather than defining production domain rules.

## Color tokens and themes

Values below are CSS `oklch(...)` arguments. Author colors through semantic tokens, not duplicated literals in components. Light mode is the default; dark mode replaces the same roles. Foreground tokens must accompany their corresponding filled surfaces.

| Token                                       | Light                 | Dark                  |
| ------------------------------------------- | --------------------- | --------------------- |
| `--background`                              | `0.985 0.004 145`     | `0.19 0.015 165`      |
| `--foreground`                              | `0.22 0.02 160`       | `0.96 0.01 150`       |
| `--card`, `--popover`                       | `1 0 0`               | `0.23 0.018 165`      |
| `--card-foreground`, `--popover-foreground` | `0.22 0.02 160`       | `0.96 0.01 150`       |
| `--primary`, `--ring`, `--chart-1`          | `0.52 0.11 162`       | `0.7 0.13 160`        |
| `--primary-foreground`                      | `0.985 0.01 150`      | `0.18 0.02 165`       |
| `--secondary`, `--muted`                    | `0.955 0.01 155`      | `0.28 0.02 165`       |
| `--secondary-foreground`                    | `0.3 0.03 160`        | `0.96 0.01 150`       |
| `--muted-foreground`                        | `0.53 0.02 160`       | `0.7 0.02 155`        |
| `--accent`                                  | `0.94 0.03 160`       | `0.32 0.04 162`       |
| `--accent-foreground`                       | `0.3 0.04 162`        | `0.96 0.01 150`       |
| `--destructive`                             | `0.577 0.2 25`        | `0.65 0.18 25`        |
| `--border`                                  | `0.9 0.008 160`       | `1 0 0 / 12%`         |
| `--input`                                   | `0.9 0.008 160`       | `1 0 0 / 15%`         |
| `--income`                                  | `0.55 0.12 158`       | `0.72 0.13 158`       |
| `--income-foreground`                       | `0.98 0.01 150`       | `0.18 0.02 160`       |
| `--expense`                                 | `0.55 0.18 25`        | `0.68 0.17 27`        |
| `--expense-foreground`                      | `0.98 0.01 30`        | `0.18 0.02 30`        |
| `--chart-2`                                 | `0.62 0.13 155`       | `0.62 0.13 155`       |
| `--chart-3`                                 | `0.7 0.1 90`          | `0.75 0.11 90`        |
| `--chart-4`                                 | `0.6 0.16 40`         | `0.65 0.16 40`        |
| `--chart-5`                                 | `0.55 0.15 25`        | `0.62 0.16 25`        |
| `--overlay`                                 | `0.22 0.02 160 / 30%` | `0.12 0.02 165 / 55%` |

Tint recipe: `color-mix(in oklab, var(--primary) 10%, transparent)`. Use 5% for milestone fills, 10% for tinted nodes/badges, 20% for installment outlines, and 30% for tinted borders. KPI tiles use background at 60%. Do not introduce another palette for installment or recurrence status. Legacy `--sidebar-*` tokens do not authorize adding a sidebar.

The export exposes CSS variables and `.ldg-*` classes through `styles.css`. Tailwind examples below express equivalent geometry; they do not require a specific consumer framework.

## Typography

| Role                                   | Size                | Weight and treatment                             |
| -------------------------------------- | ------------------- | ------------------------------------------------ |
| Body, action, section heading          | 14px                | 400 body; 500 actions/headings; headings primary |
| Month heading                          | 18px                | 600                                              |
| Main balance                           | 36px; 48px at 640px | Mono, 600, tracking -0.025em                     |
| KPI value                              | 18px                | Mono, 600                                        |
| Weekly target / current spending       | 24px / 30px         | Mono, 600                                        |
| Metadata, field label, hint            | 12px                | Muted; field labels 500                          |
| Timeline metadata and section subtitle | 14px                | Muted                                            |
| Category and count pill                | 11px                | 500; numeric counts mono                         |
| Weekly chart label                     | 10px                | Tabular numerals                                 |
| Group eyebrow                          | 12px                | 600, uppercase, tracking 0.025em                 |

Weights are 400, 500, and 600. Line-height tokens are 1, 1.25, 1.375, and 1.5; body defaults to 1.5. Use `text-wrap: pretty` for explanatory copy. Every money amount uses `font-mono tabular-nums`. Do not enlarge ordinary section headings into marketing headlines.

Font stacks: `"Instrument Sans", ui-sans-serif, system-ui, sans-serif` and `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`. The export loads Google Fonts and contains no font binaries. Font-family aliases alone do not load fonts. The README allows replacing the font import with self-hosted files.

## Spacing, layout, and surfaces

Spacing scale in pixels: **2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40**. These correspond to `--space-0-5`, `1`, `1-5`, `2`, `2-5`, `3`, `4`, `5`, `6`, `8`, `10` in the export and the equivalent Tailwind spacing utilities.

- Main container: `mx-auto max-w-3xl px-5 sm:px-8` (48rem maximum including padding under border-box sizing).
- Header: card surface, bottom 1px border, 40px top and 32px bottom padding. Other sections use the page background and 32–40px vertical padding.
- Gaps: 16px between cards, 12px in grids, 8px between list rows.
- KPI grid: two columns below 640px, three from 640px. Form grids become two columns at 640px; wide fields span both.
- Weekly composition: stacked until 1024px, then 3fr/2fr. Recurring and installment forecast compositions can use `1fr 260px` from 768px with the aside sticky at 16px.
- Keep financial amounts legible at narrow widths; allow text to truncate or wrap without causing page overflow. Tabs must remain reachable when labels do not fit.
- No product sidebar, dashboard grid, floating action button, fixed product header, or bottom navigation by default.

Base radius is `--radius: 0.75rem` (12px at a 16px root): sm = ×0.6 (7.2px), md = ×0.8 (9.6px), lg = ×1 (12px), xl = ×1.4 (16.8px), 2xl = ×1.8 (21.6px), 3xl = ×2.2 (26.4px), 4xl = ×2.6 (31.2px). Full radius is 9999px. Do not substitute a framework's default radius scale for these mappings.

| Surface        | Radius | Padding | Fill and border                                 |
| -------------- | ------ | ------- | ----------------------------------------------- |
| Panel          | 16.8px | 20px    | Card, 1px border                                |
| Flat list card | 12px   | 16px    | Card, 1px border                                |
| KPI tile       | 12px   | 12px    | Background at 60%, 1px border                   |
| Milestone      | 12px   | 16px    | Primary at 5%, border primary at 30%            |
| Empty state    | 12px   | 24px    | Transparent, dashed border, centered muted copy |

There is no elevation shadow system. A focus ring is the exception. The only decorative gradient is the sparkline area fill.

## Component selection and reference contracts

These contracts describe the Ledger export. Consult matching `.d.ts` and `.jsx` files for complete attributes, defaults, and behavior.

| Component                        | Contract and use                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                         | `variant`: default, outline, secondary, ghost, destructive, link. `size`: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg. At most one primary action per section. Supports `as="button"` or `as="a"`. |
| `IconButton`                     | `shape`: round for month navigation, square for steppers; 36px square; accessible name required.                                                                                                            |
| `Icon`                           | Lucide glyph `name`, default `size=16`; renders inline SVG.                                                                                                                                                 |
| `Badge`                          | `tone`: neutral, income, expense, primary, label. Status/category/count display, never an action.                                                                                                           |
| `Card`                           | `variant`: panel, flat, tile, milestone, dashed; surface recipes above.                                                                                                                                     |
| `Field`, `Input`, `Select`       | Field label and `htmlFor`, optional `wide`; native input/select attributes. Associate labels, errors, and controls.                                                                                         |
| `Switch`                         | Controlled `checked`, `onChange(next)`, accessible `label`; 36×20px track, 16px knob, primary when on.                                                                                                      |
| `Tabs`, `TabPanel`               | Controlled `value`, `onChange(id)`; descriptors with id, label, icon, count, disabled; matching panel id. 40px tab height, 24px gap, 2px active primary underline, foreground active label.                 |
| `SectionHeader`                  | icon, title, subtitle, actions, heading level via `as`; 14px/500 primary heading.                                                                                                                           |
| `StatTile`                       | Preformatted label/value, income/expense/neutral/muted tone, optional icon and net hint; use a description list.                                                                                            |
| `MiniStat`                       | Preformatted label/value and same tones, borderless; 14px mono value.                                                                                                                                       |
| `ProgressBar`                    | value, max, optional preformatted left/right labels; 12px pill track; primary until over target, then expense. Define zero-target behavior before division.                                                 |
| `Sparkline`                      | Numeric data or `{ balance, date? }` points, optional dimensions/padding/label; fewer than two points renders nothing.                                                                                      |
| `WeekBars`                       | `{ key, label, total }[]`, target, currentKey, height; render weekly comparison, not generic multiseries analytics.                                                                                         |
| `CategoryNode`                   | category, kind, optional glyph override in export; 36px circle. The reference maps category names to glyphs.                                                                                                |
| `TimelineEntryRow`               | entry with identity/date/kind/title, optional description/category/amount/balance/installment; see `TimelineEntryRow.d.ts` for the complete shape.                                                          |
| `RecurringRow`                   | rule identity/title/kind/category/amount/frequencyLabel/active, monthlyHint, onToggle(id), onRemove(id); paused rows stay visible at 55% opacity.                                                           |
| `InstallmentMeter`               | count, one-based index, optional dense; index 0 means not started, above count means schedule finished in the demo.                                                                                         |
| `InstallmentPlanRow`             | plan identity/title/category/total/count/perAmount, index, due/upcoming/paid status, meta/note, onRemove(id). The kit derives status from the selected month.                                               |
| `EmptyState`                     | Centered, dashed-border message naming the next action.                                                                                                                                                     |
| `Modal`                          | open, onClose, title, description, icon, size, footer, dismissible, closeLabel; renders nothing while closed.                                                                                               |
| `Toast`, `Toaster`, `ToastState` | Descriptors with id/title/description/icon/tone; state exposes toasts/push/dismiss. Reference duration is 3200ms. Call `ToastState()` as a hook.                                                            |

### Controls and interaction states

Button heights: xs 24px, sm 28px, default 32px, lg 36px; icon variants are square at the same sizes. Default padding is 10px horizontally with a 6px gap; xs uses 8px and a 4px gap. Small buttons use 12.8px text; xs uses 12px. Standard buttons have 12px radius; xs/sm use 9.6px.

| State or variant          | Treatment                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Primary button            | Primary fill and primary-foreground text; reference button has no hover fill change (anchor variant uses 80% primary) |
| Outline / ghost hover     | Muted fill; outline retains a border                                                                                  |
| Secondary hover           | Secondary at 80%                                                                                                      |
| Destructive action        | Destructive at 10% fill, 20% on hover; destructive text                                                               |
| Round / square icon hover | Secondary / accent fill                                                                                               |
| Delete icon hover         | Secondary fill and expense icon                                                                                       |
| Press                     | Button moves down 1px; no scale or lift                                                                               |
| Focus-visible             | Ring border and 3px ring at 50%; destructive ring uses destructive at 20%                                             |
| Disabled                  | 50% opacity and no interaction; navigation uses 40% and not-allowed cursor                                            |

Reference fields use background fill, 1px input border, 9.6px radius, 8px vertical/12px horizontal padding, 14px text, and a solid 2px focus ring. Labels are 12px muted medium with 4px below. Select adds space for a Lucide chevron. Input and Select forward native attributes; Field wraps the label and control.

Project Select positioning rule (2026-09-28): open the option list below the trigger by default, without aligning the selected item over the trigger or automatically flipping above it. Constrain the internal list to 24rem or the available height, whichever is smaller, and scroll its contents. Keep the popup frame stationary. Show Base UI scroll arrows at the top and bottom only while more items are available in that direction; hovering an arrow scrolls the list. Touch input retains native scrolling. Selecting an item must not change the popup's anchor position. This is an explicit project adaptation for the custom Select, rather than behavior specified by the export's native select.

### Financial compositions and charts

Timeline: ordered list, 1px border-colored rail, 36px nodes, 16px gap between node and body, 24px below each body. The reference rail is positioned 18px from its container's left. Title and category occupy the left side; signed amount and optional secondary balance align right. Income nodes use 10% income fill/30% border; ordinary expense nodes are neutral; milestone nodes are solid primary. Do not display a running balance unless the contract supplies a meaningful value.

Timeline actions (2026-10-08): compact ghost edit and remove icon buttons sit below
the amount, with reserved space so revealing them does not shift the row. Show
them on row hover or when a button has visible keyboard focus. Apply a subtle
secondary fill at 40% only to the hovered row, without a shadow or position change. Remove
uses the expense color on hover. Both buttons have accessible names and reuse the
context menu actions, including removal confirmation.

Installments: show the per-installment amount prominently and full purchase total as secondary information. Use a mono `3/12` badge and segmented meter: past segments primary at 55%, current at 100%, future border-colored; 4px segments or 3px dense. Timeline nodes gain a 2px primary-at-20% outline. Due cards use milestone tint; completed cards use 55% opacity. The kit derives completion from schedule position, not verified payment state.

Sparkline: default 240×56, 2px non-scaling primary stroke, 3px last-point dot, primary area gradient from 22% to transparent. No axes or decorative grid. Week bars: income below/equal target, expense above; previous weeks 55% opacity, current week 100%; 9.6px top corners and a dashed target line in primary at 70%. Sparkline accepts an accessible label; inspect JSX for data edge cases.

### Dialogs, notifications, and motion

Modal: flat overlay token, no blur; card surface with 1px border, 16.8px radius, 20px padding; widths sm 20rem, default 26rem, lg 34rem constrained to the viewport. Allow long contents to scroll. Title and description explain one task. Footer contains Cancel and one primary verb action. Escape, close button, and outside click dismiss when dismissible.

Toast: card surface, 1px border, 12px radius, 12px/16px padding; only the icon receives the semantic tone. Stack bottom-center with 24px bottom offset and 8px gaps. Toast uses `role="status"` and Toaster uses `aria-live="polite"`.

Application modal integration (2026-10-08): keep one toast provider and viewport
around the application. While a dialog portal is mounted, render the viewport in
that portal, outside the popup, with a higher stacking level than the modal
backdrop. This preserves one notification stream while keeping notifications
visible above the backdrop and within the modal portal. Nested dialogs register
their own target; closing them restores the previous target. Do not mount another
provider using the same global manager inside a dialog.

Default transitions use 150ms and `cubic-bezier(0.4, 0, 0.2, 1)` for relevant properties. Modal/toast entrance may fade and move up from 4px below. Over-budget overflow alone may pulse from opacity 1 to 0.5 over 2s. There are no springs, bouncing, zoom entrances, or scroll effects. Several components use `transition: all`; base styles separately apply 400ms color transitions. The inspected CSS has no reduced-motion override.

## Icons, copy, and financial formatting

Use Lucide at 16px by default, 14px for hints/small controls, 12px in xs controls, with 2px stroke, `currentColor`, round caps/joins. Decorative icons are hidden from assistive technology. Icon-only controls need accessible names. The brand lockup is a wallet icon plus “Ledger” at 14px/500 primary; do not invent a wordmark.

The fixed category mapping in `components/finance/category-icons.js` is:

| Category      | Glyph            |
| ------------- | ---------------- |
| Salary        | banknote         |
| Freelance     | laptop           |
| Investment    | landmark         |
| Housing       | house            |
| Food          | utensils-crossed |
| Transport     | bus              |
| Shopping      | shopping-bag     |
| Health        | dumbbell         |
| Entertainment | clapperboard     |
| Savings       | car              |

Milestones use `award`; absent categories use `sparkles`. An explicit `name` overrides the glyph. A nonempty unknown category currently yields no mapped glyph, unlike an absent category.

Structural glyphs include wallet, target, repeat, credit-card, calendar-clock, arrow-up-right/arrow-down-right, trending-up/trending-down, chevrons, plus/minus, x, and trash-2.

Write plain, sentence-case English copy. Labels are nouns, buttons are verbs, and empty states name the next action. Avoid hype, emoji, exclamation marks, and decorative pictographs. Uppercase is reserved for group eyebrows. Use `·` between metadata, `–` for ranges, and `−` for negative amounts. Handle singular/plural counts.

The reference formats money as en-US/USD: `$5,200.00` for detailed values and `$5,200` for compact KPI/forecast amounts; rates appear as `47%`. StatTile and MiniStat receive preformatted values. Financial rows format numeric props internally. These are display conventions, not a specification of storage units or accounting rules.

Copy examples:

- Empty recurring list: “No recurring items yet. Add your salary, rent, or subscriptions to project them.”
- Empty schedule: “Nothing scheduled.”
- Empty chart: “No spending data yet.”
- Placeholder: “e.g. Netflix, Rent, Salary” or “0.00”.
- Metadata: “Monthly · ~$20.00/mo” and “This week · Mar 23 – 29”.

## Screen recipes and demo boundaries

### Local profile screens in Personal Finance

The application extends the Ledger recipes with a local profile creation form
and a profile entry screen. Use the centered 48rem surface, a form panel up to
28rem wide, 20px panel padding, the 16.8px panel radius, compact typography,
semantic green selection fills, and one primary submit action. Profile entry
uses radio selection and a Continue action. The financial header shows a circular
36px profile icon button that opens an anchored menu. Keep the selected profile
name and locale inside that menu, followed by a Change language submenu with checked options for Português (Brasil) and English (US), and the Leave profile action. Keep the
header in normal flow; use the menu primitive's keyboard navigation, dismissal,
and focus restoration.

Text inputs, select triggers, money-field surfaces, and date triggers share the
same muted fill on hover, with a 150ms color transition and visible keyboard
focus. Disabled controls do not react to hover. Apply the money-field hover to
the complete surface, including its currency prefix, rather than the inner input.

The confirmed product requirement localizes interface copy through English-keyed
JSON catalogs for `pt-BR` and `en-US`. This deliberately extends the reference's
English-copy convention. Both languages display BRL, with locale-specific
separators, rather than the reference demo's USD. A language preview is available
before creation; the profile menu can update the saved language afterward. The interface applies the new language only after persistence succeeds. Local profile
entry has no password or authentication boundary.

The monthly summary API remains deferred. Show dashes in unavailable indicator
tiles and a clear pending message beneath the balance label. Omit the large
balance value while unavailable rather than enlarging a placeholder dash or
presenting prototype zeroes as financial data. Capitalize month headings in both
supported locales while preserving locale-specific date wording.

The original product stacks monthly, weekly, and recurring sections. The expanded kit keeps the monthly header above **Timelines / Installments / Weekly Goals / Recurring** tabs.

| Screen            | Composition                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| Monthly statement | Wallet lockup, month navigator, balance and sparkline, Income/Expenses/Saved tiles                                  |
| Timeline          | Dated income, expenses, milestones, installments, Add transaction action                                            |
| Weekly goal       | Spending progress, target stepper/range, pace feedback, weekly bars                                                 |
| Recurring         | Projection tiles, inline form, income/expense groups with pause/delete, sticky 45-day forecast                      |
| Installments      | Due in month/Open plans/Still owed tiles, Due this month/Upcoming/Paid off groups, sticky eight-month load forecast |
| Add transaction   | Modal with title, amount, type, category, date, note; optional installment count, amount, and preview               |

The kit limits timeline navigation to January–March 2026 and anchors the forecast to March 20, 2026. Its changes update in-memory sample data. These are demo boundaries, not requirements for consuming applications.

`styles.css` imports fonts, colors, typography, radius, spacing, effects, base, and components, in that order. The standalone kit reads components from `window.LedgerDesignSystem_*` and data from `window.LedgerData`.

## Behavioral coverage and limitations

The source demonstrates focus rings, disabled states, icon-control names, switch semantics, tab/panel associations, dialog labels, dismissal, initial field focus, scroll locking, and polite toast announcements.

- Tabs lack arrow-key navigation and managed roving tab stops.
- Modal does not implement a full focus trap or focus restoration.
- Inspected styles contain no reduced-motion override.
- Sample financial calculations and schedule statuses are not production accounting contracts.
- Declarations describe intended props; consult JSX to verify actual behavior.

## Reference checklist

- Consult this reference before changing a component.
- Identify the matching component, variant, tokens, and screen recipe.
- Preserve semantic light/dark colors, radius relationships, compact typography, and single-column rhythm.
- Use borders and fills for separation, with the documented sparkline and modal/toast exceptions.
- Match hover, press, focus, disabled, paused, and over-target treatments.
- Keep formatting, icons, and copy consistent with the reference.
- Resolve source discrepancies explicitly instead of assuming undocumented behavior.
- Record deliberate design changes here with their rationale.
