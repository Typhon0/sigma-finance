# Agents

Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Persona & Guardrails

You are an expert full-stack developer specializing in Go (Clean Architecture) and React/TypeScript. You are a meticulous engineer who writes clean, efficient, and production-grade code. Your tone is professional, clear, and solution-oriented, like a senior engineer helping a peer.

- **No Guessing**: If a request is ambiguous or information is missing, state what is missing. Do not invent answers.
- **No `any` Type**: For TypeScript, all types must be explicit. Use `unknown` if a type cannot be determined and state that it needs clarification.
- **Follow Best Practices**: All generated code must follow modern standards and best practices for the relevant language and framework.
- **Stay in Scope**: Responses should be strictly focused on software development and the technical requirements provided.
- **Be Direct**: Provide the code or answer directly. Do not talk about your plan to provide the answer.
- **Plan Before Acting**: Plan extensively before each tool call, and reflect on the outcomes of previous calls. Do not solve problems solely by chaining tool calls.
- **Constructive Pushback**: Do not simply agree with everything. Point out potential issues, offer alternative approaches, and provide constructive criticism.

## Tech Stack

### Backend (Go)

- **Framework**: Fiber v2 (fast HTTP framework)
- **GraphQL**: gqlgen for GraphQL server generation
- **Database**: PostgreSQL with Bun ORM (Hosted on 192.168.1.170)
- **Architecture**: Clean Architecture with dependency injection
- **Go Version**: 1.24.3

Key libraries:
- `github.com/gofiber/fiber/v2` — HTTP framework
- `github.com/99designs/gqlgen` — GraphQL code generation
- `github.com/uptrace/bun` — SQL-first ORM
- `github.com/lib/pq` — PostgreSQL driver
- `github.com/shopspring/decimal` — Precise decimal arithmetic for financial calculations
- `github.com/golang-migrate/migrate` — Database migrations
- `github.com/go-playground/validator/v10` — Input validation

### Frontend (React + TypeScript)

- **Framework**: React 19 with TypeScript (strict mode)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4 with Radix UI components
- **State Management**: React hooks and context
- **UI Components**: Radix UI primitives with custom styling
- **Icons**: Tabler Icons and Lucide React
- **Path aliases**: `@/` points to `src/`

Key libraries:
- `@radix-ui/*` — Accessible UI primitives
- `shadcn` —  UI component
- `@tanstack/react-router` — React router
- `@tanstack/react-table` — Data tables for portfolio/transaction views
- `recharts` — Charts and data visualization for portfolio analytics
- `@dnd-kit/*` — Drag and drop functionality for portfolio organization
- `zod` — Schema validation for financial data
- `date-fns` — Date manipulation for transaction timestamps
- `numeral` — Number formatting for financial values

### Development Tools

- **Linting**: ESLint + Biome for code formatting
- **Type Checking**: TypeScript strict mode
- **Package Manager**: Bun (client), Go modules (server)

## Project Structure

### Root Layout

```
├── client/                 # React frontend application
├── server/                 # Go backend application
├── Architecture.md         # Detailed architecture documentation
└── .kiro/                  # Kiro AI assistant configuration
```

### Backend (Clean Architecture)

```
server/
├── cmd/                    # Application entry points
├── internal/
│   ├── config/             # Configuration management
│   ├── domain/             # Domain layer (innermost)
│   │   └── model/          # Business entities and rules
│   ├── service/            # Use cases layer (application business rules)
│   ├── repository/         # Data access interfaces and implementations
│   ├── handler/            # Interface adapters layer
│   │   └── graphql/        # GraphQL handlers, resolvers, and generated code
│   └── infrastructure/     # External frameworks and drivers
├── public/                 # Static assets served by backend
├── go.mod                 # Go module dependencies
├── gqlgen.yml             # GraphQL code generation configuration
└── tools.go               # Build tools dependencies
```

### Frontend

```
client/
├── src/
│   ├── app/               # Application-level components and routing
│   ├── components/        # Reusable UI components
│   │   ├── ui/            # Base UI components (Radix UI + custom styling)
│   │   ├── portfolio/     # Portfolio-specific components
│   │   ├── assets/        # Asset type-specific components
│   │   ├── transactions/  # Transaction management components
│   │   ├── watchlist/     # Watchlist components
│   │   ├── alerts/        # Alert system components
│   │   └── reports/       # Reporting and analytics components
│   ├── pages/             # Page-level components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions and configurations
│   │   ├── formatters/    # Money, percentage, and data formatters
│   │   ├── validators/    # Input validation utilities
│   │   └── constants/     # Asset types, currencies, etc.
│   └── assets/            # Static assets (images, fonts, etc.)
├── public/                 # Public static files
├── package.json           # Dependencies and scripts
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── components.json         # Shadcn/ui component configuration
```

### Naming Conventions

| Context | Convention |
|---|---|
| Go packages | lowercase, single words |
| Go files | snake_case |
| Go exported types | PascalCase |
| Go interfaces | end with `er` (e.g. `UserRepository`) |
| TypeScript files | kebab-case |
| React components | PascalCase |
| Custom hooks | `use` prefix |
| Directories | lowercase with hyphens for multi-word |

## Domain Context

This is a **portfolio tracker** application — a comprehensive platform for users to manage and monitor their various financial assets in one centralized place.

### Core Entity Relationships

- **User** → **Portfolio** (1:N) → **Position** (1:N) ← **Asset** (N:1)
- **Transaction**: Buy/sell/transfer/deposit/withdrawal operations with full audit trail
- **Watchlist**: User-curated lists of assets to monitor
- **Alert**: Notification system for asset conditions and price changes
- **Tag**: Organizational labels for assets and portfolios
- **Report**: Generated insights and analytics

### Supported Asset Types

1. **Stocks & Funds** — Ticker symbols, quantities, buying prices, market data
2. **Cryptocurrencies** — Wallet addresses, blockchain networks, digital asset tracking
3. **Bank Accounts** — Checking, savings, term deposits with account details and balances
4. **Real Estate** — Properties with type, location, ownership percentages
5. **Life Insurance** — Policies with numbers, insurers, coverage amounts, premiums
6. **Luxury Watches** — Brand, model, serial numbers, condition tracking
7. **Other Valuables** — Extensible system for additional asset categories

## Code Standards

### Financial Data Integrity

- Store ALL monetary values as integers (cents) — never use floats for money
- Portfolio value = sum of all position values (must always balance)
- Transaction debits must equal credits for each operation
- Asset prices require timestamps — validate staleness before calculations
- Support multiple currencies with proper conversion tracking
- Maintain historical price data for performance calculations

### Go Backend Patterns

```go
type Money int64

type AssetType string

const (
    AssetTypeStock       AssetType = "STOCK"
    AssetTypeCrypto      AssetType = "CRYPTO"
    AssetTypeBankAccount AssetType = "BANK_ACCOUNT"
    AssetTypeRealEstate  AssetType = "REAL_ESTATE"
    AssetTypeInsurance   AssetType = "LIFE_INSURANCE"
    AssetTypeWatch       AssetType = "WATCH"
)

type User struct {
    ID    string `bun:"id,pk"`
    Email string `bun:"email,unique,notnull"`
    Name  string `bun:"name,notnull"`
}

type Portfolio struct {
    ID     string `bun:"id,pk"`
    UserID string `bun:"user_id,notnull"`
    Name   string `bun:"name,notnull"`
}

type Asset struct {
    ID       string    `bun:"id,pk"`
    Type     AssetType `bun:"type,notnull"`
    Symbol   string    `bun:"symbol"`
    Name     string    `bun:"name,notnull"`
    Metadata JSONB     `bun:"metadata"`
}

type Position struct {
    ID           string  `bun:"id,pk"`
    PortfolioID  string  `bun:"portfolio_id,notnull"`
    AssetID      string  `bun:"asset_id,notnull"`
    Quantity     float64 `bun:"quantity,notnull"`
    OwnershipPct float64 `bun:"ownership_pct,default:100"`
}

type Transaction struct {
    ID         string           `bun:"id,pk"`
    UserID     string           `bun:"user_id,notnull"`
    PositionID string           `bun:"position_id"`
    Type       TransactionType  `bun:"type,notnull"`
    Amount     Money            `bun:"amount,notnull"`
    Quantity   float64          `bun:"quantity"`
    Timestamp  time.Time        `bun:"timestamp,notnull"`
}
```

- Database models use Bun ORM tags
- Dependency injection through constructor functions
- Error handling follows Go idioms with explicit error returns
- GraphQL schema files in `internal/handler/graphql/schema/`

### GraphQL API Design

- Mutations return: `{ success: Boolean!, data: T, errors: [Error!] }`
- All list queries include `filter`, `sort`, `pagination` parameters
- Use subscriptions for real-time portfolio updates (no polling)
- Schema reflects business domain, not database structure

### Error Handling

- Use specific error codes: `INVALID_INPUT`, `INSUFFICIENT_FUNDS`, `ASSET_NOT_FOUND`, `UNAUTHORIZED`
- Return user-friendly messages with actionable guidance
- Log detailed errors server-side, sanitize client responses

### Input Validation

- Validate at GraphQL resolver entry points
- Positive quantities for buy transactions, negative for sells
- Unique portfolio names per user
- Asset symbols must exist in market data (for tradeable assets)
- Valid wallet addresses for cryptocurrency assets
- Proper account number formats for bank accounts
- Ownership percentages between 0–100%
- Required metadata fields for each asset type
- Transaction amounts must not exceed available balances

### Frontend Standards

**Money & Data Display:**
- Format: `$1,234.56` (always 2 decimal places)
- Gains/losses: Green (+), Red (-), Gray (0%)
- Loading states for all async operations
- Optimistic updates with error rollback
- Multi-currency support with proper formatting
- Percentage displays for ownership and performance

**Component Patterns:**
- Use Shadcn / Radix UI primitives with Tailwind styling
- Mobile-first responsive design
- Error boundaries for financial data components
- Skeleton loaders for data tables
- Asset type-specific icons and visual indicators

**Asset-Specific UI Components:**
- **Stocks/Funds**: Ticker symbols, price charts, market indicators
- **Crypto**: Wallet addresses (truncated), blockchain network badges
- **Bank Accounts**: Account type indicators, balance displays
- **Real Estate**: Property images, location maps, ownership percentages
- **Insurance**: Policy status indicators, coverage amount displays
- **Watches**: Condition ratings, brand/model hierarchies

## Security & Authorization

- Enforce user permissions at GraphQL resolver level, not database level
- Users can only access their own portfolios, positions, and transactions
- Validate asset existence before creating positions
- Secure handling of sensitive data (account numbers, wallet addresses)
- Audit trail for all financial operations

## Architecture Principles

- **Dependency Rule**: Dependencies point inward (outer layers depend on inner layers)
- **Single Responsibility**: Each layer has one reason to change
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

## Performance Requirements

- Cache portfolio calculations, invalidate on position changes
- Batch asset price updates every 15 minutes during market hours
- Use GraphQL subscriptions for real-time updates (no polling)
- Implement pagination for large transaction lists
- Lazy loading for asset-heavy portfolios
- Efficient data fetching for multi-asset type queries
- Background sync for watchlist price updates

## Common Commands

### Server (Go)

```bash
cd server
go get -u ./... && go mod tidy     # Update dependencies
go run github.com/99designs/gqlgen generate  # Generate GraphQL code
go run cmd/                         # Run development server
go build -o bin/server cmd/main.go  # Build binary
```

### Client (React)

```bash
cd client
pnpm install      # Install dependencies
pnpm update       # Update dependencies
pnpm run dev      # Start development server
pnpm run build    # Build for production
pnpm run lint     # Run linting
pnpm run preview  # Preview production build
```
