# Bun ORM Migration Workflow for sigma-finance

## Recommended Practices

### 1. Structure
- Place all migration files in `server/cmd/bun/migrations/`.
- Name migration files with a timestamp and description, e.g. `14052025_init_db.go`, `20250810_add_alerts.go`.
- Each migration file should register its up/down logic using `Migrations.MustRegister(up, down)`.
- Keep a single `main.go` in the migrations folder to initialize the registry (`Migrations.DiscoverCaller()`).

### 2. Creating a Migration
- Create a new file in `server/cmd/bun/migrations/` for each schema change.
- Example template:
  ```go
  package migrations
  import (
    "context"
    "github.com/uptrace/bun"
  )
  func init() {
    Migrations.MustRegister(
      func(ctx context.Context, db *bun.DB) error {
        // up migration SQL or Bun table creation
        return nil
      },
      func(ctx context.Context, db *bun.DB) error {
        // down migration SQL
        return nil
      },
    )
  }
  ```

### 3. Applying Migrations
- Migrations are run automatically at server startup via Bun's migrator in `main.go`.
- To apply all migrations: `go run ./cmd/main.go` from the `server` directory.
- To rollback, add logic to call `migrator.Rollback(ctx)` in a CLI or admin script.

### 4. Best Practices
- One migration file per logical change (not per table).
- Always provide both up and down logic for reversibility.
- Document each migration with comments on what it changes and why.
- Test migrations on a local/dev database before running in production.

### 5. Example Migration Registration
```go
Migrations.MustRegister(
  func(ctx context.Context, db *bun.DB) error {
    // Create new table or column
    return nil
  },
  func(ctx context.Context, db *bun.DB) error {
    // Drop table or column
    return nil
  },
)
```

### 6. References
- Bun ORM Migrations: https://bun.uptrace.dev/guide/migrations.html
- Project structure: see `.github/copilot-instructions.md` for architecture overview

---

If you add new migration files, update this workflow as needed. For questions or automation scripts, ask GitHub Copilot for examples or troubleshooting!
