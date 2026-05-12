## Mode

Caveman coding mode.

- No filler. No pleasantries. No long plans unless needed.
- Code first. Explanation only when it changes a decision.
- Inspect repo before editing. Repo truth > this file.
- No guessing. If info missing: say exact missing info.
- Smallest safe change. No drive-by refactors.
- Challenge bad ideas. Give concrete reason + safer path.
- Run relevant checks after changes. Report commands + result.

## Tools

Use before guessing:

- Current library docs: `context7`
- External/current research: `websearch`
- GitHub examples: `grep_app`
- Browser/page inspect: `playwright`

Tool discipline:

- Think before tool call.
- Stop blind chaining.
- Adapt after each result.
- Prefer primary docs over blogs.

## Stack

Backend:

- Go 1.24.3
- Fiber v2
- gqlgen
- PostgreSQL
- Bun ORM
- migrate
- validator/v10
- shopspring/decimal

Frontend:

- React 19
- TypeScript strict
- Vite 6
- Tailwind CSS 4
- ShadCN
- TanStack Router
- TanStack Table
- zod
- recharts
- date-fns
- numeral
- Tabler Icons / Lucide

Package manager:

- Use lockfile.
- `bun.lock*` -> Bun
- `pnpm-lock.yaml` -> pnpm
- `package-lock.json` -> npm
- Do not switch package manager without explicit reason.

## Project

Portfolio tracker.

Goal: manage personal assets, portfolio value, performance, transactions, alerts, reports.

Core model:

```text
User -> Portfolio -> Position -> Asset
Transaction -> Position/User
Watchlist -> Asset
Alert -> Asset/Portfolio
Tag -> Asset/Portfolio
Report -> User/Portfolio
```

Asset types:

- Stocks/funds
- Crypto
- Bank accounts
- Real estate
- Life insurance
- Luxury watches
- Other valuables

## Architecture

Clean Architecture.

Rules:

- Dependencies point inward.
- Domain has no Fiber, gqlgen, Bun, HTTP, DB, UI.
- Services hold use cases.
- Repositories hide persistence.
- Handlers/resolvers stay thin.
- Infrastructure owns external systems.
- Dependency injection via constructors.
- No service locator.
- No business logic in GraphQL resolvers.
- No business logic in repositories.


## Financial Rules

Non-negotiable:

- Money: never float.
- Store money as integer minor units or decimal, according to existing repo pattern.
- Quantities: use decimal for fractional assets when possible.
- Prices need currency, source, timestamp.
- Currency conversions need rate, source, timestamp.
- Portfolio value = sum position values.
- Multi-write financial operations must use DB transaction.
- Keep audit trail for financial writes.
- Validate stale prices before calculations.
- Do not silently mix currencies.
- Do not round during internal calculations. Round only at display/boundary.

## Backend Standards

Go:

- Explicit errors.
- Wrap errors with context.
- Keep errors typed or coded.
- Pass `context.Context`.
- Validate at boundary and service layer.
- Use DB transactions for multi-step writes.
- Avoid N+1 queries.
- Batch GraphQL loading when needed.
- Add migrations for schema changes.
- Keep generated gqlgen code generated, not hand-edited.
- Use Bun tags on DB models.
- Keep GraphQL schema domain-oriented, not table-oriented.

Errors:

- Use stable codes:
  - `INVALID_INPUT`
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `NOT_FOUND`
  - `ASSET_NOT_FOUND`
  - `INSUFFICIENT_FUNDS`
  - `CONFLICT`
  - `INTERNAL`
- Client message: safe and actionable.
- Logs: detailed server-side only.
- Never leak secrets, SQL internals, stack traces.

Validation:

- Buy quantity positive.
- Sell quantity valid against holdings.
- Portfolio name unique per user.
- Asset symbol required for tradeable assets.
- Ownership percent between 0 and 100.
- Required metadata by asset type.
- Wallet/account formats validated when supported.

GraphQL:

- Mutations return:
  - `success`
  - `data`
  - `errors`
- List queries support:
  - filter
  - sort
  - pagination
- Prefer subscriptions for real-time updates only if infra already exists.
- Do not add polling-heavy features without reason.

## Frontend Standards

TypeScript:

- Strict mode.
- No `any`.
- Use `unknown` at unsafe boundaries.
- Type props explicitly.
- Use zod for external/input validation.
- Keep components focused.
- Extract repeated logic into hooks/utils.

UI:

- Mobile-first.
- Light/dark support.
- WCAG AA contrast.
- Loading, empty, error, success states for async UI.
- Skeletons for tables/cards.
- Error boundaries around financial views.
- Optimistic updates only with rollback.
- Dense but readable. Signal > decoration.

Financial display:

- Money: localized, 2 decimals unless asset requires more.
- Gains: positive/negative/neutral visually distinct.
- Show currency.
- Show timestamp/staleness when value depends on market data.
- Mask sensitive account/wallet data by default.

## Security

- Users access only own data.
- Enforce ownership in service/resolver layer.
- Validate asset exists before creating position.
- Protect account numbers, wallet addresses, policy numbers.
- Secrets only from env/config.
- No secrets in logs.
- Sanitize client errors.

## Performance

- Paginate large lists.
- Cache portfolio calculations when useful.
- Invalidate cache on positions, transactions, prices.
- Batch price updates.
- Avoid unnecessary dependencies.
- Lazy-load heavy UI/routes.
- Avoid GraphQL N+1.
- Avoid polling unless no better option.

## Naming

Go:

- Packages: lowercase.
- Files: snake_case.
- Exported types: PascalCase.
- Interfaces: small, behavior-focused.
- Interfaces may use `Repository`, `Service`, or `er` suffix when natural.

TypeScript/React:

- Files: kebab-case.
- Components: PascalCase.
- Hooks: `useX`.
- Directories: lowercase, kebab-case for multi-word.
- Alias: `@/` -> `src/`.

## Commands

Prefer repo scripts.

Server:

```bash
cd server
go test ./...
go run github.com/99designs/gqlgen generate
go mod tidy
```

Run server only after checking actual `cmd/` entrypoint.

Client:

```bash
cd client
bun install
bun run dev
bun run build
bun run lint
```

If repo uses pnpm/npm lockfile, use that instead.

## Output Format

For coding tasks, answer with:

```text
Changed:
- file/path: what changed

Checks:
- command: result

Notes:
- risk or follow-up only if real
```

For review tasks:

```text
Issues:
1. severity - file/area - problem - fix

Verdict:
- approve / needs changes
```

Do not dump huge explanations unless asked.
