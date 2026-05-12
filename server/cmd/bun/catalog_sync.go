package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"sigma_finance/internal/config"
	"sigma_finance/internal/infrastructure/trustwallet"
	"sigma_finance/internal/repository"
	catalogservice "sigma_finance/internal/service/catalog"
	"strings"

	"github.com/uptrace/bun"
	"github.com/urfave/cli/v2"
)

func newCatalogCommand(db *bun.DB) *cli.Command {
	return &cli.Command{
		Name:  "catalog",
		Usage: "manage canonical crypto catalog sync and snapshots",
		Subcommands: []*cli.Command{
			{
				Name:  "sync",
				Usage: "run catalog sync (full_seed, search_import, snapshot_import)",
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "mode", Value: string(catalogservice.SyncModeFullSeed)},
					&cli.StringFlag{Name: "external-id"},
					&cli.StringFlag{Name: "snapshot"},
					&cli.StringFlag{Name: "expected-version"},
				},
				Action: func(c *cli.Context) error {
					syncService, cfg := newCatalogSyncService(db)

					mode := catalogservice.SyncMode(strings.ToLower(strings.TrimSpace(c.String("mode"))))
					request := catalogservice.SyncRequest{Mode: mode}

					switch mode {
					case catalogservice.SyncModeSearchImport:
						request.ExternalID = strings.TrimSpace(c.String("external-id"))
						if request.ExternalID == "" {
							return errors.New("--external-id is required for search_import mode")
						}
					case catalogservice.SyncModeSnapshotImport:
						request.SnapshotPath = firstNonEmpty(c.String("snapshot"), cfg.Catalog.SnapshotPath)
						if strings.TrimSpace(request.SnapshotPath) == "" {
							return errors.New("--snapshot or CATALOG_SNAPSHOT_PATH is required for snapshot_import mode")
						}
						request.ExpectedCatalogVersion = firstNonEmpty(c.String("expected-version"), cfg.Catalog.CatalogVersion)
					case catalogservice.SyncModeFullSeed:
					default:
						return fmt.Errorf("unsupported sync mode %q", mode)
					}

					result, err := syncService.Sync(c.Context, request)
					if err != nil {
						return err
					}

					fmt.Printf("catalog sync completed: mode=%s status=%s scanned=%d upserted=%d failed=%d\n",
						mode,
						result.Run.Status,
						result.Stats.Scanned,
						result.Stats.Upserted,
						result.Stats.Failed,
					)
					return nil
				},
			},
			{
				Name:  "export",
				Usage: "export canonical crypto catalog snapshot",
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "output"},
					&cli.StringFlag{Name: "version"},
				},
				Action: func(c *cli.Context) error {
					syncService, cfg := newCatalogSyncService(db)
					outputPath := firstNonEmpty(c.String("output"), cfg.Catalog.SnapshotPath)
					if strings.TrimSpace(outputPath) == "" {
						return errors.New("--output or CATALOG_SNAPSHOT_PATH is required")
					}

					summary, err := syncService.ExportSnapshot(c.Context, outputPath, firstNonEmpty(c.String("version"), cfg.Catalog.CatalogVersion))
					if err != nil {
						return err
					}

					fmt.Printf("catalog snapshot exported: path=%s version=%s records=%d\n", summary.Path, summary.CatalogVersion, summary.RecordCount)
					return nil
				},
			},
			{
				Name:  "import",
				Usage: "import canonical crypto catalog snapshot",
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "input"},
					&cli.StringFlag{Name: "expected-version"},
				},
				Action: func(c *cli.Context) error {
					syncService, cfg := newCatalogSyncService(db)
					inputPath := firstNonEmpty(c.String("input"), cfg.Catalog.SnapshotPath)
					if strings.TrimSpace(inputPath) == "" {
						return errors.New("--input or CATALOG_SNAPSHOT_PATH is required")
					}

					result, err := syncService.Sync(c.Context, catalogservice.SyncRequest{
						Mode:                   catalogservice.SyncModeSnapshotImport,
						SnapshotPath:           inputPath,
						ExpectedCatalogVersion: firstNonEmpty(c.String("expected-version"), cfg.Catalog.CatalogVersion),
					})
					if err != nil {
						return err
					}

					fmt.Printf("catalog snapshot imported: status=%s scanned=%d upserted=%d failed=%d\n",
						result.Run.Status,
						result.Stats.Scanned,
						result.Stats.Upserted,
						result.Stats.Failed,
					)
					return nil
				},
			},
			{
				Name:  "status",
				Usage: "show latest catalog sync run",
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "source", Value: catalogservice.DefaultCatalogSource},
				},
				Action: func(c *cli.Context) error {
					syncService, _ := newCatalogSyncService(db)
					run, err := syncService.GetLatestRun(c.Context, c.String("source"))
					if err != nil {
						return err
					}

					fmt.Printf("catalog run id=%s source=%s mode=%s status=%s started=%s\n", run.ID, run.Source, run.Mode, run.Status, run.StartedAt.Format("2006-01-02T15:04:05Z07:00"))
					if run.FinishedAt != nil {
						fmt.Printf("finished=%s\n", run.FinishedAt.Format("2006-01-02T15:04:05Z07:00"))
					}
					if run.ErrorText != nil {
						fmt.Printf("error=%s\n", *run.ErrorText)
					}
					if len(run.StatsJSON) > 0 {
						pretty := run.StatsJSON
						var payload map[string]any
						if err := json.Unmarshal(run.StatsJSON, &payload); err == nil {
							if bytes, marshalErr := json.MarshalIndent(payload, "", "  "); marshalErr == nil {
								pretty = bytes
							}
						}
						fmt.Printf("stats=%s\n", string(pretty))
					}
					return nil
				},
			},
		},
	}
}

func newCatalogSyncService(db *bun.DB) (catalogservice.SyncService, *config.Config) {
	cfg := config.LoadConfig()
	uow := repository.NewUnitOfWork(db)
	service := catalogservice.NewSyncService(
		trustwallet.NewClient(),
		uow.Instrument(),
		uow.InstrumentProviderMapping(),
		uow.CatalogSyncRun(),
	)
	return service, cfg
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
