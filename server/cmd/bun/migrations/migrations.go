package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/migrate"
)

// Migrate runs all pending migrations.
func Migrate(ctx context.Context, db *bun.DB) error {
	migrator := migrate.NewMigrator(db, Migrations)

	if err := migrator.Init(ctx); err != nil {
		return fmt.Errorf("failed to initialize migrator: %w", err)
	}

	group, err := migrator.Migrate(ctx)
	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	if group.IsZero() {
		fmt.Println("There are no new migrations to run.")
		return nil
	}

	fmt.Printf("Migrated to %s\n", group)
	return nil
}
