---
name: Sigma Finance
description: Portfolio Management
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  destructive-foreground: "oklch(0.985 0 0)"
  gain: "oklch(0.478 0.118 163.2)"
  loss: "oklch(0.508 0.196 17.6)"
  warning: "oklch(0.47 0.11 70)"
  info: "oklch(0.484 0.18 272)"
  chart-1: "oklch(0.646 0.222 41.116)"
  chart-2: "oklch(0.6 0.118 184.704)"
  chart-3: "oklch(0.398 0.07 227.392)"
  chart-4: "oklch(0.828 0.189 84.429)"
  chart-5: "oklch(0.769 0.188 70.08)"
  sidebar: "oklch(0.985 0 0)"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: "1.5rem"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  badge: "2rem"
  pill: "9999px"
spacing:
  cell: "0.5rem"
  control: "0.625rem"
  gutter: "1rem"
  section: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0 0.625rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem 0"
---

# Design System: Sigma Finance

## Overview

**Creative North Star: "The Private Terminal"**

This is a private, calm place to see everything the user owns — their own portfolio view, running on their own hardware, answering "what is my portfolio doing, why, and what should I review next" in seconds. The visual system keeps that promise light: a near-achromatic ink-and-paper foundation, hairline structure, confident but comfortable typography, and saturated color spent only where it carries meaning — gains, losses, warnings, and data series. Nothing decorative competes with the numbers, and nothing heavy gets in their way.

The register is product-polished: clean, contemporary, product-grade. Surfaces are calm at rest, hierarchy is carried by type weight and spacing rather than ornament, and the polish shows in precision — exact alignment of financial figures, disciplined states on every control, both themes tuned to the same standard. Everyday clarity leads: the default view explains simply, and advanced depth — dense tables, heatmaps, deep charting — stays available where the user reaches for it. Density is a tool, never the identity.

Both themes are first-class citizens, not an inverted afterthought, and the system ships seven selectable component styles (Vega → Sera) that reshape radii, density, and chrome while preserving the same identity, tokens, and financial semantics.

**Key Characteristics:**
- Ink-and-paper neutrals; saturated color reserved for financial meaning and chart series.
- Hairline-first structure: 1px borders and tonal surfaces carry layout; shadows only under floating layers.
- Numbers at a glance: KPI values at 24px/700, signed deltas with trend arrows, labels never below an 11px floor.
- Every semantic color tuned per theme to clear WCAG AA against its own card surface — documented per token, not assumed.
- One dial for shape: all radii derive from a single `--ui-radius` variable, overridden per style.
- Glass is chrome-only: backdrop blur on the shell header and sidebar, never on content cards.

## Colors

An ink-and-paper neutral core carries the entire product; saturation enters only as financial signal, and every semantic hue is independently tuned for each theme's surfaces.

### Primary
- **Console Ink**: primary actions, active tabs, selection — near-black in light theme, inverting to near-white (oklch(0.922 0.006 264)) in dark so the "strongest" element is always the one with maximum contrast. Paired with its foreground token for button fills and checked states.

### Secondary
- **Ledger Green** (`gain`): positive deltas, up trends, gains. Dark theme lifts to oklch(0.769 0.168 163.2) — 9.27:1 against the dark card. A muted companion token exists for secondary gain text.
- **Loss Crimson** (`loss`): negative deltas, losses, down trends. Light oklch(0.508 0.196 17.6) clears 6.46:1 on white; dark lifts to oklch(0.704 0.191 22.2). **Destructive Red** is a separate token for deletion and error actions — never borrow loss color for a delete button or vice versa.

### Tertiary
- **Caution Amber** (`warning`): stale data, attention states, market warnings. Light oklch(0.47 0.11 70) = 7.01:1 on white; dark oklch(0.82 0.15 75).
- **Signal Indigo** (`info`): informational states and neutral attention. Light oklch(0.484 0.18 272); dark oklch(0.74 0.14 272).
- **Chart Series** (`chart-1`…`chart-5`): two deliberately different series palettes — light runs orange/teal/navy-navy/amber/ochre, dark runs blue/green/orange/violet/red — so series read as data, distinct from the money colors above.

### Neutral
- **Paper** (`background`, `card`, `popover`): pure white in light theme. In dark theme all surfaces shift to a "Midnight Zinc" family with a faint hue-264 tint (chroma ≤ 0.012) so they never read as default-untinted components: background oklch(0.145 0.008 264), card oklch(0.205 0.01 264), sidebar oklch(0.205 0.01 264).
- **Ink** (`foreground`): near-black text on paper; dark theme flips to oklch(0.985 0.003 264).
- **Quiet Mist** (`muted`, `secondary`, `accent`): the single resting wash — oklch(0.97 0 0) light, oklch(0.269 0.012 264) dark — used for hover fills, inset areas, and tab tracks.
- **Steel Mist** (`muted-foreground`): secondary text at oklch(0.556 0 0) light / oklch(0.708 0.012 264) dark; all placeholder, description, and caption text.
- **Hairline** (`border`, `input`): oklch(0.922 0 0) light; in dark it becomes white at 10% opacity — the entire separation system.
- **Focus Grey** (`ring`): oklch(0.708 0 0) light / oklch(0.556 0.02 264) dark, rendered as a 3px 50%-alpha halo plus a border shift.
- **Sidebar** (`sidebar` family): light sidebar is oklch(0.985 0 0) — just off paper; it owns a full token family (foreground, primary, accent, border, ring) so menu color modes (default / inverted / translucent) can swap whole sets without touching components.

### Named Rules
**The Money-Only Color Rule.** Saturated color appears only where it carries financial or status meaning — gain, loss, warning, info, chart series. Chrome, navigation, headings, and buttons stay near-achromatic. If a surface needs "more life", fix hierarchy or spacing, not hue.

**The Both-Themes-AA Rule.** No semantic text color is reused across themes. Each is tuned and verified to ≥4.5:1 against its own theme's card surface (the code documents the exact ratio per token); borders and fills may use opacity since they only answer to the 3:1 non-text threshold.

## Typography

**Display Font:** Inter (with `-apple-system, BlinkMacSystemFont, sans-serif` fallback) — the default of ten selectable interface fonts.
**Body Font:** Inter (same stack).
**Label/Mono Font:** system monospace for tickers, keyboard hints, and aligned figures.

**Character:** Product-polished and neutral. Inter's clarity does the work; hierarchy comes from size and weight steps, never from novelty. A custom `--text-micro` floor (0.6875rem / 11px) exists specifically because the stocks page once shipped 8–10px type that was unreadable at render — the floor is a scar, and it holds.

### Hierarchy
- **Display** (700, 2rem/1.5rem, line-height 2rem): KPI numerals and total-value figures (e.g. portfolio total value). The largest thing on any dashboard.
- **Headline** (600, 1.125rem / 18px, 1.75rem): dialog and sheet titles.
- **Title** (500, 1rem / 16px, 1.5rem): card titles, section headers, nav groups.
- **Body** (400, 0.875rem / 14px, 1.25rem): the product default — tables, forms, descriptions, data chrome.
- **Label** (500, 0.75rem / 12px, 1rem): badges, table column headers, metadata; uppercase + tracking only in editorial styles (Sera).
- **Micro** (500, 0.6875rem / 11px): the absolute floor for badges and table chrome (`--text-micro`).

### Named Rules
**The 11px Floor Rule.** Labels never render below 0.6875rem (11px). If a label needs to be smaller than that to fit, cut the label instead.

**The Numerals Rule.** Money and quantities are the clearest type on any screen: KPI values at 2rem/700, deltas at body size with weight ≥500, always signed and colored by semantic token. Identifiers that must align (tickers, percentages in columns) take the mono stack where implemented.

## Layout

A collapsible icon-rail sidebar (fixed left, `bg-card/50` with backdrop blur) beside a fluid content column. The shell header is 3.5rem (h-14) with `border-b`; main content sits on a faint muted wash (`bg-muted/10` over `bg-secondary/5`) at `p-4` mobile / `p-6` desktop, capped at a 1800px max-width with `space-y-6` section rhythm. Dashboards compose as responsive card grids — 1 column on mobile, 2 at `md`, 3–4 on wide screens — with every widget inside the same card primitive.

Breakpoints follow Tailwind defaults plus one custom step: `xs` 475px (the only bespoke breakpoint — a 2-column grid for very small devices), `sm` 640px, `md` 768px, `lg` 1024px. Mobile is not an afterthought: touch targets ≥44px (`touch-target` class), form inputs forced to 16px font to prevent iOS zoom, safe-area insets honored on all four edges, and chart controls hidden below 768px.

The default density stays comfortable: table rows use `p-2` cells with 2.5rem headers, controls are 2.25rem tall, and the spacing vocabulary is 0.5rem (cell) / 0.625rem (control) / 1rem (gutter) / 1.5rem (section). Density is opt-in, never imposed — the Mira style compresses all of these together for users who ask for it.

## Elevation & Depth

The system is flat by default, with functional shadows only. Structure at rest is drawn with 1px hairline borders and tonal surface shifts (`muted`, `card`, `background`); depth exists solely as a response to floating or state: shadows under popovers, dropdowns, dialogs, and sheets, plus glass blur confined to shell chrome (header `bg-background/50 backdrop-blur-md`, sidebar `bg-card/50 backdrop-blur-xl`, and an optional translucent menu mode at 0.85 opacity / 12px blur). The one style with a different appetite is Maia, which adds xl/2xl shadows to its soft look — inside its own style, never as a system default.

### Shadow Vocabulary
- **Control shadow** (`shadow-xs`, e.g. `0 1px 2px rgb(0 0 0 / 0.05)`): the resting edge of inputs, checkboxes, switches, triggers.
- **Floating shadow** (`shadow-md`): dropdowns, popovers, selects, context menus — anything that leaves the flow.
- **Overlay shadow** (`shadow-lg`): dialogs, alert dialogs, sheets.
- *(Maia only)* `shadow-xl` / `shadow-2xl` for its soft, raised surfaces.

### Named Rules
**The Hairline-First Rule.** At rest, separation is 1px `--border` (white at 10% in dark). Cards, panels, and sections never carry drop shadows; if a surface needs emphasis, shift its tone or its border, not its shadow.

## Shapes

Shape is a single dial. Every radius derives from `--ui-radius` (default 0.625rem) through four computed steps: `--radius-sm` (−4px → 0.375rem), `--radius-md` (−2px → 0.5rem), `--radius-lg` (base), `--radius-xl` (+4px → 0.875rem). Controls take `md`, cards take `xl`, dialogs take `lg`. Round forms (avatars, switches, slider tracks, progress bars) take `pill`; badges take the 2rem `rounded-4xl` soft pill. Everything else — including the extremes — is the style dial's business: Lyra and Sera set `--ui-radius: 0` (sharp, editorial), Maia and Luma set 0.875rem (soft, generous), Mira 0.375rem (compact).

Input shape is style-owned and splits into two families: full-stroke fields (Vega, Nova, Mira, Lyra — 1px border on all sides) and underline-only fields (Sera — a single bottom rule, `px-0`, no side borders). A component may not mix the two families.

### Named Rules
**The One Dial Rule.** All radii derive from `--ui-radius`. Never hand-pick a radius per component outside the four derived steps; a style that wants different corners changes the one variable.

## Components

Controls are precise and restrained: standard 2.25rem heights, quiet borders, minimal motion, and states that answer immediately. Nothing shouts; the only physical gesture is a 1px "press nudge" (`translate-y-px` on active).

### Buttons
- **Shape:** medium rounding (0.5rem / `--radius-md`), 2.25rem tall default, horizontal padding 0.625rem with a 0.375rem gap to icons.
- **Sizes:** xs 1.5rem / sm 2rem / default 2.25rem / lg 2.5rem; matching square icon sizes. Compact styles shift the whole ladder (Nova) or lift it for editorial weight (Sera buttons are 2.5rem, uppercase, tracked).
- **Primary:** ink fill (`background: --primary`, `color: --primary-foreground`); hover drops the fill to 90% alpha; active nudges down 1px.
- **Focus:** border shifts to `--ring` plus a 3px 50%-alpha ring halo — the same treatment on every focusable control in the system.
- **Secondary / Outline / Ghost / Link:** outline is paper with a 50%-alpha border; ghost is transparent until a Quiet Mist hover fill; link is underlined-on-hover text in primary. Destructive is the only filled variant besides primary.
- **Disabled:** 50% opacity, pointer events off. No spinner baked in.

### Inputs / Fields
- **Style:** 2.25rem tall, transparent background (dark theme adds a 30% `--input` tint), 1px full stroke at rest, medium radius.
- **Focus:** border → `--ring` + 3px halo; no glow, no shadow growth.
- **Error:** border and ring shift to destructive at shared alpha; the message text takes the destructive token.
- **Disabled:** 50% opacity. Selects and textareas inherit the identical language; textarea min-height 4rem.

### Cards / Containers
- **Corner Style:** large rounding (0.875rem / `--radius-xl`).
- **Background:** `--card` with `--card-foreground` text — the base canvas of every dashboard widget.
- **Shadow Strategy:** none at rest (see Elevation). Border: 1px hairline.
- **Internal Padding:** 1.5rem horizontal rhythm (`py-6` vertical, `px-6` header/content/footer), 0.25rem gap between title and description.
- **Title:** 1rem/500; description 14px Steel Mist.

### Badges / Chips
- **Style:** 1.25rem tall soft pill (2rem radius), 12px/500, horizontal padding 0.5rem; tinted fill variants; icon slots at 0.75rem. Used for statuses (STALE FX, asset class tags) — never for actions.

### Navigation
- **Sidebar:** icon-collapsible rail, 3.5rem header carrying the ΣF mark, grouped collapsible nav (Overview / Markets / Assets / Tools) with 1rem icons; active items take sidebar tokens (`--sidebar-primary`, `--sidebar-accent`), hover utilizes the Quiet Mist wash. Menu accent (subtle/bold) and menu color (default / inverted / translucent glass) are user preferences layered on the same tokens.
- **Header:** 3.5rem, glass (`bg-background/50 backdrop-blur-md`), command-palette search trigger on desktop (⌘K), market ticker strip (mono, 12px) where present.
- **Command palette:** dialog-mounted (⌘K), grouped commands, 12px group headings. The fastest path to any view.

### Data Tables & Financial Indicators (signature)
- **Tables:** 14px body, 2.5rem headers at 500 weight, 0.5rem cell padding, no zebra striping — hairline row borders only. Readable by default with a comfortable row rhythm; the Mira style goes denser only when a user asks.
- **Deltas:** every gain/loss figure is a signed number in `--gain`/`--loss` with a 16px triangular trend arrow (custom SVG, `currentColor` filled) — the arrow and the color always travel together.
- **Charts:** ECharts (`echarts-for-react`) for analytics and distribution, TradingView `lightweight-charts` for price series, all series drawn from `--chart-1…5` per theme; tooltips use dedicated chart-tooltip components, charts always live inside the card primitive.

### Style Variants (vega → sera)
The seven styles are first-class user choices (Settings → Appearance), selected via `data-style` and persisted locally; each overrides component tokens only, never product truth. Vega is the canonical default this document specifies.
- **Vega** — the classic shadcn/ui look: clean, balanced, medium spacing. *(Default.)*
- **Nova** — reduced padding, tighter spacing for compact layouts.
- **Maia** — soft, rounded, generous spacing; the only style with raised shadows.
- **Lyra** — boxy, sharp, zero radius; pairs with mono fonts.
- **Mira** — ultra-compact, dense-interface mode.
- **Luma** — bright and airy; subtle transparency, pill-ish rounding.
- **Sera** — editorial and sharp: uppercase tracked buttons and card titles, underline-only fields.

## Do's and Don'ts

### Do:
- **Do** route every text and chrome color through semantic tokens (`text-gain`, `--primary`, `--muted-foreground`…); the tokens are theme-aware and the styles depend on them.
- **Do** tune each semantic color separately per theme and check it against that theme's `--card` (≥4.5:1 for text) — copy the documented ratios, don't eyeball.
- **Do** keep structure hairline-first: 1px `--border` at rest; shadows only on floating layers (dropdowns, popovers, dialogs, sheets).
- **Do** derive radii from `--ui-radius` (`calc()` steps sm→xl); controls `md`, cards `xl`.
- **Do** keep type inside the hierarchy: body 14px, tables 14px, labels ≥11px (`--text-micro` floor), KPI numerals 2rem/700, signed deltas with a trend arrow.
- **Do** lead with everyday clarity: the default view exists for understanding your money, not for showing how much data can fit — depth is something the user reaches for.
- **Do** hold 44px touch targets on mobile and 16px input font at mobile widths; hide chart controls below 768px.
- **Do** keep glass on shell chrome only (header/sidebar), and keep both themes verified — light and dark are equal citizens.
- **Do** keep the style dial one-dimensional per component family: if a style changes input form language (stroke → underline), it changes all inputs.

### Don't:
- **Don't** introduce saturated color into chrome — no colored nav, headers, buttons, or decorative accents. Color is money and status, nothing else.
- **Don't** reuse a semantic value across themes (light `gain` on a dark surface fails the AA gate the token system exists to enforce).
- **Don't** put shadows on cards, panels, or sections at rest; no elevation as decoration.
- **Don't** render financial deltas without sign + semantic color + arrow (green/red alone is ambiguous and fails color-blind users).
- **Don't** render type below 11px anywhere; cut the label instead.
- **Don't** hand-pick radii, paddings, or shadows that a style override should own — component styles (vega→sera) inherit from tokens; hardcoding breaks all seven at once.
- **Don't** mix destructive red and loss crimson: deletion uses `destructive`, performance uses `loss`.
- **Don't** ship density, jargon, or heavy chrome as the default experience — professional depth is opt-in, never imposed.
