## Mode

Caveman coding mode:
- Code first. No filler, pleasantries, or long plans unless strictly required.
- Inspect repo before editing. Repository truth > documentation.
- No guessing. If information is missing, ask for it explicitly.
- Run relevant checks after changes. Report commands and results.
- Always rebuild & recreate the backend container (`docker compose build server && docker compose up -d server`) after backend changes or plan execution.

## References (Progressive Disclosure)
Detailed instructions are divided into modular reference documents. Read them when working on the respective layer:
- **Backend Standards & Architecture**: `[backend.md](file:///home/dev/repos/sigma-finance/.agents/backend.md)`
- **Frontend Standards & UI**: `[frontend.md](file:///home/dev/repos/sigma-finance/.agents/frontend.md)`
- **Financial, Security, & Performance Rules**: `[financial_security.md](file:///home/dev/repos/sigma-finance/.agents/financial_security.md)`

## Core Model
Portfolio tracker to manage personal assets, values, transactions, alerts, and reports.
```text
User -> Portfolio -> Position -> Asset
Transaction -> Position/User
Watchlist -> Asset
Alert -> Asset/Portfolio
Tag -> Asset/Portfolio
Report -> User/Portfolio
```
**Asset types**: Stocks/funds, Crypto, Bank accounts, Real estate, Life insurance, Luxury watches, Other valuables.

## Decision Tables

### Frontend State: Apollo Client vs. Zustand
| Question | → Apollo Client | → Zustand |
| :--- | :---: | :---: |
| Is the data source primary server-driven GraphQL? | ✅ | |
| Is it client-only state (e.g. active tab, local toggles, forms)? | | ✅ |
| Does the state persist across sessions locally? | | ✅ |

### Backend Representation: Money vs. Decimal
| Data Type | → `model.Money` (int64 cents) | → `decimal.Decimal` |
| :--- | :---: | :---: |
| Monetary amount (price, cost, valuation)? | ✅ | |
| Asset quantity (fractional stocks, crypto)? | | ✅ |
| Interest rates or ownership percentages? | | ✅ |

## Procedural Workflow (End-to-End Feature Lifecycle)
Follow these exact steps when adding or modifying a feature:
1. **Database**: Add migrations to `server/cmd/bun/migrations/` and apply them. Update Bun model annotations.
2. **Domain Models**: Update/create models in `server/internal/domain/model/`.
3. **Repository**: Declare methods in `server/internal/repository/` interface and implement them.
4. **Service**: Implement use-case logic in `server/internal/service/`. Enforce authorization (e.g. ownership validation) and input validation.
5. **API & Resolvers**: Expose functions in the schema (`server/internal/handler/graphql/schema/*.graphqls`) and implement resolvers under `server/internal/handler/graphql/`. Run `gqlgen generate`.
6. **Frontend Query/Mutation**: Write GraphQL document. Run `codegen` to generate typed hooks.
7. **Frontend Component**: Integrate generated Apollo/Zustand hooks into ShadCN/Tailwind components.
8. **Rebuild & Restart**: Always rebuild and restart the backend container after backend code modifications or executing plans (`docker compose build server && docker compose up -d server`).

## Code Patterns

### Go Database Transaction
```go
err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
    existing, err := uow.Portfolio().GetByID(ctx, portfolioID)
    if err != nil {
        return fmt.Errorf("failed to get portfolio: %w", err)
    }
    // Perform additional writes via uow
    return uow.Portfolio().Update(ctx, existing)
})
```

### React Mutation with Optimistic Update
```tsx
const [updatePortfolio] = useMutation(UPDATE_PORTFOLIO, {
  optimisticResponse: (vars) => ({
    updatePortfolio: { __typename: "Portfolio", id: vars.id, name: vars.input.name }
  }),
  update: (cache, { data }) => {
    if (data?.updatePortfolio) {
      cache.writeFragment({
        id: `Portfolio:${data.updatePortfolio.id}`,
        fragment: gql`fragment P on Portfolio { name }`,
        data: data.updatePortfolio,
      });
    }
  }
});
```
