# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday people managing personal portfolios, including self-hosters who run their own instance on a home server. They typically check progress, risk, and allocation health in short, repeat sessions on desktop and mobile. The job to be done: confidently understand what the portfolio is doing now, why it changed, and what to review next.

## Product Purpose

Sigma Finance is an open-source, self-hosted portfolio tracker — one place to manage personal assets, values, transactions, alerts, and reports across every asset class. Success means the user can see, trust, and act on a complete picture of their wealth without spreadsheets and without handing custody of their data to a vendor. It is free to self-host; a paid hosted option is planned but not built.

## Positioning

Three claims neighboring products do not truthfully combine in one tool:

- **All asset classes in one portfolio** — stocks/funds, crypto, bank accounts, real estate, life insurance, loans, savings, luxury watches, and other valuables/collectibles live side by side.
- **Self-hosted data ownership** — open source, runs on the user's own hardware; data and market-data packs (`.sfpack`) stay local, with no vendor lock-in.
- **Professional-grade analysis** — performance, tax lots, heatmaps, market calendar, watchlists, alerts, and monitoring for people who want depth, not just balances.

(Reference points named by an earlier design context: Finary, Trade Republic, Kraken.)

## Operating Context

- Deployment is self-hosted: docker-compose plus PostgreSQL, maintained by the user on their own home server.
- Market data arrives through provider integrations and read-only daily candle packs (`.sfpack`); historical data jobs let long-history charts run without live API dependency.
- Used in short, repeat sessions on desktop and mobile.
- UI copy is currently English only.

## Capabilities and Constraints

- Core model: User → Portfolio → Position → Asset; Transactions, Watchlists, Alerts, Tags, Reports.
- Asset coverage in the product: stocks/funds, crypto, bank accounts, real estate, life insurance, luxury watches, other valuables/collectibles, loans, savings.
- Auth: registration, email verification, password reset.
- Analysis and tooling: performance analytics, tax lots, transaction management, market overviews and heatmaps, market calendar, finance database / instrument catalog, manual instruments.
- Financial correctness constraints (repository conventions): monetary amounts are stored as integer cents (`model.Money`), never floats; asset quantities and rates use decimals.
- Architecture: React/Vite web client over a GraphQL API (Go server) — answered by the existing codebase, not a greenfield decision.
- Open decisions: the paid hosted tier is planned but unbuilt; pricing, launch, and hosting details are undecided and must not be invented.

## Brand Commitments

- Name: "Sigma Finance" (browser title "ΣFinance"); ΣF monogram logo exists in code (`client/src/components/Logo.tsx`).
- Tagline: "Portfolio Management".
- Voice: pro, clean, modern, confidence-focused — clear hierarchy, accurate data presentation, restrained polish.

## Evidence on Hand

- A working codebase with the full feature surface under `client/` and `server/`.
- Market-data pack tooling and documentation (`packs/`, `docs/market-data-packs.md`, `docs/historical-datasets-status.md`).
- Absent: user testimonials, customers, benchmarks, press, or public pricing. Future work must not fabricate them.

## Product Principles

1. The user's data stays theirs — self-hosting and open source are the free path, never a crippled tier.
2. One portfolio, every asset class — a luxury watch and a stock position receive equal analytical respect in one view.
3. Answers in seconds — "what is my portfolio doing, why, and what should I review next" is the question every screen serves.
4. Professional depth, everyday clarity — advanced analysis (tax lots, attribution) stays available without weighing down the default view.
5. Confidence through accuracy — precise money handling and honest states beat visual flourish.

## Accessibility & Inclusion

- WCAG AA contrast and interaction standards are a non-negotiable baseline, confirmed as binding.
