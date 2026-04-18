package main

import (
	"fmt"
	"log"
	"os"
	"sigma_finance/cmd/bun/migrations"
	"sigma_finance/internal/infrastructure"
	"strings"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/migrate"

	"github.com/joho/godotenv"
	"github.com/urfave/cli/v2"
)

func main() {
	loadDotEnv()

	appDB, err := infrastructure.NewDB()
	if err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}
	defer appDB.Close()

	migrationDB, err := newMigrationDB()
	if err != nil {
		log.Fatalf("failed to initialize migration database: %v", err)
	}
	defer migrationDB.Close()

	templateData := map[string]string{
		"Prefix": "example_",
	}
	app := &cli.App{
		Name: "bun",

		Commands: []*cli.Command{
			newDBCommand(migrate.NewMigrator(migrationDB, migrations.Migrations, migrate.WithTemplateData(templateData)), newSeedCommand(appDB)),
		},
	}
	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
	}
}

func newMigrationDB() (*bun.DB, error) {
	cfg := infrastructure.DBConfig{
		Host:     firstNonEmptyEnv("DB_ADMIN_HOST", "TEST_DB_ADMIN_HOST", "DB_HOST", "localhost"),
		Port:     firstNonEmptyEnv("DB_ADMIN_PORT", "TEST_DB_ADMIN_PORT", "DB_PORT", "5432"),
		User:     firstNonEmptyEnv("DB_ADMIN_USER", "TEST_DB_ADMIN_USER", "DB_USER", "postgres"),
		Password: firstNonEmptyEnv("DB_ADMIN_PASSWORD", "TEST_DB_ADMIN_PASSWORD", "DB_PASSWORD", "postgres"),
		DBName:   firstNonEmptyEnv("DB_ADMIN_NAME", "TEST_DB_ADMIN_NAME", "DB_NAME", "sigma_finance"),
		SSLMode:  firstNonEmptyEnv("DB_ADMIN_SSLMODE", "TEST_DB_ADMIN_SSLMODE", "DB_SSLMODE", "disable"),
	}
	return infrastructure.NewDBWithConfig(cfg)
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func loadDotEnv() {
	candidates := []string{".env", "../.env", "../../.env"}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			if err := godotenv.Load(candidate); err != nil {
				log.Printf("failed to load %s: %v", candidate, err)
			}
			return
		}
	}
	log.Println("No .env file found, using environment variables")
}

func newDBCommand(migrator *migrate.Migrator, seedCommand *cli.Command) *cli.Command {
	return &cli.Command{
		Name:  "db",
		Usage: "database migrations",
		Subcommands: []*cli.Command{
			{
				Name:  "init",
				Usage: "create migration tables",
				Action: func(c *cli.Context) error {
					return migrator.Init(c.Context)
				},
			},
			{
				Name:  "migrate",
				Usage: "migrate database",
				Action: func(c *cli.Context) error {
					if err := migrator.Lock(c.Context); err != nil {
						return err
					}
					defer migrator.Unlock(c.Context) //nolint:errcheck

					group, err := migrator.Migrate(c.Context)
					if err != nil {
						return err
					}
					if group.IsZero() {
						fmt.Printf("there are no new migrations to run (database is up to date)\n")
						return nil
					}
					fmt.Printf("migrated to %s\n", group)
					return nil
				},
			},
			{
				Name:  "rollback",
				Usage: "rollback the last migration group",
				Action: func(c *cli.Context) error {
					if err := migrator.Lock(c.Context); err != nil {
						return err
					}
					defer migrator.Unlock(c.Context) //nolint:errcheck

					group, err := migrator.Rollback(c.Context)
					if err != nil {
						return err
					}
					if group.IsZero() {
						fmt.Printf("there are no groups to roll back\n")
						return nil
					}
					fmt.Printf("rolled back %s\n", group)
					return nil
				},
			},
			{
				Name:  "lock",
				Usage: "lock migrations",
				Action: func(c *cli.Context) error {
					return migrator.Lock(c.Context)
				},
			},
			{
				Name:  "unlock",
				Usage: "unlock migrations",
				Action: func(c *cli.Context) error {
					return migrator.Unlock(c.Context)
				},
			},
			{
				Name:  "create_go",
				Usage: "create Go migration",
				Action: func(c *cli.Context) error {
					name := strings.Join(c.Args().Slice(), "_")
					mf, err := migrator.CreateGoMigration(c.Context, name)
					if err != nil {
						return err
					}
					fmt.Printf("created migration %s (%s)\n", mf.Name, mf.Path)
					return nil
				},
			},
			{
				Name:  "create_sql",
				Usage: "create up and down SQL migrations",
				Action: func(c *cli.Context) error {
					name := strings.Join(c.Args().Slice(), "_")
					files, err := migrator.CreateSQLMigrations(c.Context, name)
					if err != nil {
						return err
					}

					for _, mf := range files {
						fmt.Printf("created migration %s (%s)\n", mf.Name, mf.Path)
					}

					return nil
				},
			},
			{
				Name:  "create_tx_sql",
				Usage: "create up and down transactional SQL migrations",
				Action: func(c *cli.Context) error {
					name := strings.Join(c.Args().Slice(), "_")
					files, err := migrator.CreateTxSQLMigrations(c.Context, name)
					if err != nil {
						return err
					}

					for _, mf := range files {
						fmt.Printf("created transaction migration %s (%s)\n", mf.Name, mf.Path)
					}

					return nil
				},
			},
			{
				Name:  "status",
				Usage: "print migrations status",
				Action: func(c *cli.Context) error {
					ms, err := migrator.MigrationsWithStatus(c.Context)
					if err != nil {
						return err
					}
					fmt.Printf("migrations: %s\n", ms)
					fmt.Printf("unapplied migrations: %s\n", ms.Unapplied())
					fmt.Printf("last migration group: %s\n", ms.LastGroup())
					return nil
				},
			},
			{
				Name:  "mark_applied",
				Usage: "mark migrations as applied without actually running them",
				Action: func(c *cli.Context) error {
					group, err := migrator.Migrate(c.Context, migrate.WithNopMigration())
					if err != nil {
						return err
					}
					if group.IsZero() {
						fmt.Printf("there are no new migrations to mark as applied\n")
						return nil
					}
					fmt.Printf("marked as applied %s\n", group)
					return nil
				},
			},
			seedCommand,
		},
	}
}
