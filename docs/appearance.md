# Application appearance

## Supported behavior

Appearance is an application-wide preference, independent of financial profiles.
Settings > General exposes a theme selector and a color-mode
selector (System, Light, or Dark). Changing profiles or signing out does not reset
appearance. The saved appearance also applies to the profile chooser and window
controls. The chooser currently has no appearance selector of its own.

Ledger preserves the original green palette. Graphite uses neutral interface
colors while preserving income, expense, destructive-action, and secondary chart
colors. Bubblegum, Japan Blues, Sakura, Zen, and Claude Plus adapt the supplied
tweakcn CSS exports. These themes apply their colors, sans/serif/monospace font
stacks, corner radii, shadow presets, spacing scale, and letter spacing in both
color modes. They do not replace component markup, financial rules, category
colors, or the application layout. Income and expense retain the app's dedicated
semantic tokens because the exports do not define those roles.

The shared font loader requests Instrument Sans, JetBrains Mono, Poppins,
Fira Code, Lora, Inter, Playfair Display, Outfit, and Geist Mono in weights 400,
500, and 600 from Google Fonts. Font names alone do not load fonts. An internet
connection is required to download uncached fonts; the exported fallback stacks
remain usable when font delivery is unavailable. Serif tokens are available for
components that request `font-serif`; themes do not force serif onto sans text.
The loader fetches the optional font definitions after the local document's load
event and injects them only when delivery succeeds. Pending or failed requests do
not participate in document readiness or delay presenting the window.

| Theme             | UI font         | Monospace font | Base radius | Spacing unit | Tracking |
| ----------------- | --------------- | -------------- | ----------- | ------------ | -------- |
| Ledger / Graphite | Instrument Sans | JetBrains Mono | 0.75rem     | 0.25rem      | 0em      |
| Bubblegum         | Poppins         | Fira Code      | 0.4rem      | 0.25rem      | 0em      |
| Japan Blues       | System sans     | System mono    | 0.5rem      | 0.22rem      | 0em      |
| Sakura            | Inter           | JetBrains Mono | 0.5rem      | 0.25rem      | -0.01em  |
| Zen               | Inter           | JetBrains Mono | 0.5rem      | 0.25rem      | 0.01em   |
| Claude Plus       | Outfit          | Geist Mono     | 1rem        | 0.25rem      | 0em      |

The default is Ledger with System mode. System follows the operating system while
explicit Light and Dark remain fixed. CSS color tokens, the `.light`/`.dark`
classes used by Tailwind, and `color-scheme` are applied together to the document
root. Menus, dialogs, and other portals therefore inherit the active appearance.

## Ownership and persistence

- `src/shared/contracts/appearance.ts` defines the IPC contract, built-in theme
  metadata, allowed identifiers, native background fallbacks, and input validation.
- `src/main/appearance.ts` owns persistence and monotonically increasing snapshot
  revisions within a running application. Preferences are stored in
  `appearance.json` under Electron's user-data directory; development uses
  `appearance.dev.json` in that directory. No database migration is needed.
- `electron/main.cjs` coordinates native color mode, window backgrounds, initial
  snapshots, and events for both renderers. Appearance IPC accepts only the
  application's content and title-bar WebContents.
- Preload exposes a bounded appearance API, including a synchronous startup
  snapshot. Subscriptions request a fresh snapshot after installing their listener
  so a change during module loading is not lost.
- `src/renderer/lib/appearance.ts` applies snapshots to a root element and manages
  subscriptions without depending on React. Both renderers use it.
- `src/renderer/store/appearance.ts` owns React preference state, pending writes,
  errors, and handler guards. Older responses cannot replace newer snapshots.
- `src/renderer/lib/theme-fonts.ts` loads optional web fonts after document load
  in both renderers, leaving the fallback stacks usable when delivery is pending
  or fails. No remote font stylesheet is imported by the local CSS entry points.
- `src/renderer/themes/index.css` imports shared defaults and each scoped
  theme stylesheet for both renderers. `colors.css` contains the Ledger defaults
  and Graphite palette. Every theme switches by a root `data-theme` attribute;
  unselected exports cannot publish any styles.
- Tailwind's centralized mappings in `global.css` resolve font, radius, shadow,
  and tracking utilities through `--theme-*` variables. The runtime `--spacing`
  variable drives spacing utilities. Supplied `--font-*`, `--shadow-*`, and
  `--tracking-*` declarations are namespaced to avoid collisions with Tailwind's
  utility configuration. Exported numerical values remain unchanged.
- Common card/popover surfaces use `--surface-shadow`; filled/outline buttons,
  inputs, and select triggers use `--control-shadow`. Ledger and Graphite keep
  these additions at `none`. Imported themes use their small and extra-small
  shadow presets. Explicit component shadow utilities retain precedence.

Startup restores preferences before creating the window. The window is shown
after both renderer documents load. Native backgrounds use sRGB approximations
of the corresponding CSS background tokens while content loads.

Missing, unreadable, malformed, or unsupported saved preferences use the default.
Writes replace the preference file through a temporary file before publishing the
new state. A failed write preserves the previous theme and exposes a retryable
error in settings; selecting an option retries. Renderer reloads obtain a fresh
snapshot. Subscription cleanup supports development hot reloads.

Appearance does not acquire `useFinancialOperations` tokens: it cannot conflict
with financial reads, navigation, or mutations. Only concurrent appearance writes
disable the appearance controls, with a matching guard in the store action.

## Adding a built-in theme

1. Add a stable English identifier and display name to `appearanceThemes`, with
   light and dark native background fallbacks. The `ThemeId` union, main-process
   validation, and selector options derive from this registry.
2. Add a separate stylesheet with `:root[data-theme='example']` overrides followed
   by `:root.dark[data-theme='example']` overrides, and import it in `index.css`.
   Explicitly cover every role the theme changes. Unchanged roles inherit Ledger
   defaults. Returning to Ledger resets imported values through those defaults.
   Prefer `var(...)` aliases for roles that intentionally share a value.
   Do not import raw exports with global `:root`/`.dark` rules: these would affect
   every theme. Remove their duplicate Tailwind imports, `@custom-variant`,
   `@theme`, and base rules after adapting their token definitions.
   Map exported fonts, shadows, and tracking onto the matching `--theme-*` names.
   Map derived radius rules to `--theme-radius-*` so shape changes apply to
   existing `rounded-*` utilities. Imported radius formulas subtract 4px/2px for
   small/medium corners and add 4px for extra-large corners, clamped at zero.
   Add required web font families to the optional font loader and preserve fallback stacks.
3. Cover foreground/surface pairs, focus rings, selected states, inputs, borders,
   overlays, and chart colors in both modes. Keep financial and destructive
   meanings distinct. Category colors remain user data and need contrast checks.
4. Validate both renderers, profile selection, settings, tables, menus, dialogs,
   keyboard focus, system mode, restart, and failure/retry behavior. Keep native
   background metadata aligned with the CSS background tokens.
5. Update this specification and the changelog for user-visible additions.

New components consume semantic tokens such as `bg-card`, `text-foreground`, and
`border-border`; they must not branch on theme identifiers. Named built-in themes
are compiled into the application. Runtime theme imports, theme editors, and
per-profile appearance are not implemented.

Do not rename a shipped identifier without adding a preference upgrade path.
Removing an identifier currently causes the stored preference to fall back to
Ledger/System, so such a change requires an explicit compatibility assessment.

## Validation

Automated coverage checks persistence across service recreation, invalid input and
saved data, system-mode resolution, write failures, concurrent handler guards,
stale response rejection, retry, subscription ordering/cleanup, and root mode
replacement. These tests do not establish visual contrast or native-window
behavior; those require running the desktop application.

Verified on 2026-10-22:

- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and all 194 tests in
  `pnpm test:db` passed. Seven tests specifically cover the appearance service,
  store, subscription, and root application behavior.
- Renderer production bundling and main/preload bundling passed.
- An Electron integration check with isolated user data and a test database
  exercised all six theme/mode combinations in both renderers, invalid IPC input,
  renderer reloads, profile entry, and changes through the actual settings
  selectors. Native update handling was checked by forcing effective native light
  and dark modes; this does not constitute manually switching the OS preference.
- A second Electron process restored Graphite/Dark in both renderers. Settings
  screenshots were inspected in Graphite/Dark and Ledger/Light. This is not an
  exhaustive contrast or cross-platform audit.

Additional verification on 2026-10-22 for the supplied tweakcn themes:

- An isolated Electron check exercised all 21 theme/mode combinations, root and
  window-control typography, derived radii, runtime spacing, letter spacing,
  exported shadows, and the seven options in the actual settings selector.
- Returning to Ledger in each mode restored the pre-switch computed values.
  The minimum supported 700px window width was also checked.
- All nine requested web font families loaded through the browser font API.
  The invalid `#oklch(...)` card foreground in the supplied Japan Blues export
  was corrected to valid `oklch(...)` syntax.
- Settings tabs, solid secondary card surfaces, and hovered window controls use
  their corresponding foreground tokens. Imported high-contrast secondary fills
  therefore do not inherit the page foreground accidentally.
- Lint, type checking, formatting, renderer/main/preload bundling, and the full
  194-test regression suite passed again after integration. Visual checks covered
  imported settings screens in both modes; this was not an exhaustive audit of
  every financial-data state or contrast combination.

Corrections verified on 2026-10-23:

- The optional font loader has regression coverage for delayed delivery, success,
  offline rejection, and HTTP failure. It starts after local document load and
  never adds a render-blocking remote stylesheet to the initial document.
- Secondary foregrounds cover month navigation, dialog close controls, timeline
  actions, and the category fallback node. Supporting card headers and timeline
  hover fills use muted surfaces instead of translucent secondary fills.
- An appearance-only snapshot excluded concurrent sidebar work. Lint, type
  checking, formatting, all 196 tests, and Windows x64 `pnpm make` passed.
- A harness using the packaged 0.11.0 code opened a visible, usable window while
  both renderer font requests remained pending for four seconds, then continued
  after cancelling them. Real mouse hover checks confirmed the navigation and
  dialog-close foregrounds in dark Japan Blues and Claude Plus.
- Packaged 0.10.1 code created an isolated profile and income/expense fixture.
  Packaged 0.11.0 code reopened it without changing the profile or transactions.
  This verifies a packaged-code data transition under the same Electron runtime;
  it does not establish installer execution or an installed upgrade.
