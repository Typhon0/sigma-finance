package migrations

import (
	"log"

	"github.com/uptrace/bun/migrate"
)

var Migrations = migrate.NewMigrations()

func init() {
	if err := Migrations.DiscoverCaller(); err != nil {
		// DiscoverCaller attempts to discover SQL migration files from the caller directory.
		// In production/stripped binaries or multi-stage containers without source files,
		// all migrations are compiled Go code registered via MustRegister, so this is non-fatal.
		log.Printf("bun migrations: DiscoverCaller skipped (%v)", err)
	}
}
