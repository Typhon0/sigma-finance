package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sigma_finance/internal/config"
	packbuilder "sigma_finance/internal/marketdata/packs/builder"
	sfpackwriter "sigma_finance/internal/marketdata/packs/writer/sfpack"
	"sigma_finance/internal/repository"
	marketdatapacks "sigma_finance/internal/service/marketdata/packs"
	"strings"

	"github.com/uptrace/bun"
	"github.com/urfave/cli/v2"
)

func newMarketDataCommand(db *bun.DB) *cli.Command {
	return &cli.Command{
		Name:  "market-data",
		Usage: "manage market data packs",
		Subcommands: []*cli.Command{
			{
				Name:  "packs",
				Usage: "manage historical candle packs",
				Subcommands: []*cli.Command{
					{
						Name:  "validate-spec",
						Usage: "validate pack build spec and license gate",
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:     "spec",
								Usage:    "path to pack spec yaml",
								Required: true,
							},
							&cli.BoolFlag{
								Name:  "skip-availability",
								Usage: "skip Binance public-data availability checks",
							},
							&cli.StringFlag{
								Name:  "availability-base-url",
								Usage: "override Binance public-data base URL for availability checks",
							},
							&cli.StringFlag{
								Name:  "build-mode",
								Usage: "build mode: public_release, ci_fixture, local_user_build",
								Value: packbuilder.BuildModeLocalUser,
							},
						},
						Action: func(c *cli.Context) error {
							plan, err := packbuilder.PrepareBuildForMode(
								c.Context,
								strings.TrimSpace(c.String("spec")),
								".",
								strings.TrimSpace(c.String("build-mode")),
							)
							if err != nil {
								return err
							}
							if strings.EqualFold(plan.Spec.SourceProvider, "binance-public-data") {
								if err := packbuilder.ValidateBinanceUniverse(c.Context, plan.UniversePath, plan.Universe, packbuilder.BinanceUniverseValidationOptions{
									CheckAvailability: !c.Bool("skip-availability"),
									BaseURL:           strings.TrimSpace(c.String("availability-base-url")),
								}); err != nil {
									return err
								}
							}
							symbolCount := 0
							if plan.Universe != nil {
								symbolCount = len(plan.Universe.Symbols)
							} else {
								symbolCount = plan.Spec.Universe.Discover
							}
							fmt.Printf("spec valid pack=%s version=%s distribution=%s symbols=%d\n", plan.Spec.PackID, plan.Spec.Version, plan.Spec.Distribution, symbolCount)
							for _, warning := range plan.LicenseGate.Warnings {
								fmt.Printf("warning: %s\n", warning)
							}
							return nil
						},
					},
					{
						Name:  "build",
						Usage: "build unpacked pack, and optionally archive/sign output",
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:     "spec",
								Usage:    "path to pack spec yaml",
								Required: true,
							},
							&cli.StringFlag{
								Name:     "out",
								Usage:    "output directory",
								Required: true,
							},
							&cli.BoolFlag{
								Name:  "dry-run-source",
								Usage: "download/parse/normalize source candles and print summary without writing packs",
							},
							&cli.BoolFlag{
								Name:  "all",
								Usage: "for dry-run-source, fetch all universe symbols (default: first 2 symbols)",
							},
							&cli.IntFlag{
								Name:  "max-symbols",
								Usage: "limit symbol count when not using --all (default: 2)",
							},
							&cli.StringFlag{
								Name:  "source-base-url",
								Usage: "override source base URL (used for local fixtures/tests)",
							},
							&cli.StringFlag{
								Name:  "work-dir",
								Usage: "scratch directory for source dry run (default: temp dir)",
							},
							&cli.BoolFlag{
								Name:  "archive",
								Usage: "write .sfpack archive after unpacked build",
							},
							&cli.BoolFlag{
								Name:  "sign",
								Usage: "sign archive output using --signing-key or PACK_SIGNING_KEY",
							},
							&cli.StringFlag{
								Name:  "signing-key",
								Usage: "path or inline ed25519 private key (flag wins over PACK_SIGNING_KEY)",
							},
							&cli.BoolFlag{
								Name:  "allow-unsigned-public",
								Usage: "allow unsigned public archives (unsafe; CI should not use)",
							},
							&cli.StringFlag{
								Name:  "download-url",
								Usage: "emit registry entry JSON with this download URL",
							},
							&cli.StringFlag{
								Name:  "signature-url",
								Usage: "signature URL for generated registry entry",
							},
							&cli.StringFlag{
								Name:  "build-mode",
								Usage: "build mode: public_release, ci_fixture, local_user_build",
								Value: packbuilder.BuildModeLocalUser,
							},
						},
						Action: func(c *cli.Context) error {
							specInput := strings.TrimSpace(c.String("spec"))
							specFiles := strings.Split(specInput, ",")
							var plans []*packbuilder.BuildPlan
							for _, specFile := range specFiles {
								specFile = strings.TrimSpace(specFile)
								if specFile == "" {
									continue
								}
								plan, err := packbuilder.PrepareBuildForMode(
									c.Context,
									specFile,
									strings.TrimSpace(c.String("out")),
									strings.TrimSpace(c.String("build-mode")),
								)
								if err != nil {
									return err
								}
								plans = append(plans, plan)
							}
							if len(plans) == 0 {
								return fmt.Errorf("no build specs provided")
							}

							if c.Bool("dry-run-source") {
								for _, plan := range plans {
									workDir := strings.TrimSpace(c.String("work-dir"))
									cleanupWorkDir := false
									if workDir == "" {
										tmpDir, tmpErr := os.MkdirTemp("", "sigma-finance-pack-dry-run-*")
										if tmpErr != nil {
											return tmpErr
										}
										workDir = tmpDir
										cleanupWorkDir = true
									}
									if cleanupWorkDir {
										defer os.RemoveAll(workDir) //nolint:errcheck
									}

									summary, dryRunErr := packbuilder.RunSourceDryRun(c.Context, plan, packbuilder.DryRunSourceOptions{
										AllSymbols:    c.Bool("all"),
										SourceBaseURL: strings.TrimSpace(c.String("source-base-url")),
										WorkDir:       workDir,
									})
									if dryRunErr != nil {
										return dryRunErr
									}
									fmt.Printf("source dry run pack=%s symbols=%d total_rows=%d\n", plan.Spec.PackID, len(summary.Symbols), summary.RowsCount)
									for _, symbol := range summary.Symbols {
										first := "n/a"
										last := "n/a"
										if !symbol.First.IsZero() {
											first = symbol.First.UTC().Format("2006-01-02")
										}
										if !symbol.Last.IsZero() {
											last = symbol.Last.UTC().Format("2006-01-02")
										}
										fmt.Printf("- %s rows=%d first=%s last=%s\n", symbol.Symbol, symbol.Rows, first, last)
									}
								}
								fmt.Println("dry-run-source complete")
								return nil
							}

							maxSymbolsSet := c.IsSet("max-symbols")
							maxSymbols := c.Int("max-symbols")
							if maxSymbolsSet && !c.Bool("all") && maxSymbols <= 0 {
								return fmt.Errorf("--max-symbols must be > 0 unless --all is set")
							}
							results, buildErr := packbuilder.BuildUnpackedPacksMulti(c.Context, plans, packbuilder.BuildUnpackedOptions{
								AllSymbols:    c.Bool("all"),
								MaxSymbols:    maxSymbols,
								MaxSymbolsSet: maxSymbolsSet,
								SourceBaseURL: strings.TrimSpace(c.String("source-base-url")),
								WorkDir:       strings.TrimSpace(c.String("work-dir")),
							})
							if buildErr != nil {
								return buildErr
							}

							for idx, result := range results {
								plan := plans[idx]
								fmt.Printf("build complete pack=%s version=%s\n", result.Manifest.PackID, result.Manifest.Version)
								fmt.Printf("output=%s\n", result.PackDir)
								fmt.Printf("rows=%d assets=%d files=%d\n", result.RowsCount, result.AssetsCount, result.FilesCount)
								fmt.Printf("history=%s..%s\n", result.Manifest.HistoryStart, result.Manifest.HistoryEnd)
								fmt.Printf("partition_by=%s\n", strings.Join(plan.Spec.Output.PartitionBy, ","))

								archiveRequested := c.Bool("archive") || c.Bool("sign") || strings.TrimSpace(c.String("download-url")) != "" || strings.TrimSpace(c.String("signature-url")) != ""
								if !archiveRequested {
									continue
								}

								signingKey := resolveSigningKey(strings.TrimSpace(c.String("signing-key")))
								if c.Bool("sign") && signingKey == "" {
									return fmt.Errorf("--sign requires --signing-key or PACK_SIGNING_KEY")
								}

								archiveResult, archiveErr := sfpackwriter.CreateArchive(c.Context, sfpackwriter.ArchiveOptions{
									PackDir:             result.PackDir,
									OutDir:              strings.TrimSpace(c.String("out")),
									SigningKey:          signingKey,
									AllowUnsignedPublic: c.Bool("allow-unsigned-public"),
								})
								if archiveErr != nil {
									return archiveErr
								}
								fmt.Printf("archive=%s\n", archiveResult.PackPath)
								fmt.Printf("archive_sha256=%s\n", archiveResult.ArchiveSHA256)
								if archiveResult.SignaturePath != "" {
									fmt.Printf("signature=%s\n", archiveResult.SignaturePath)
								}

								if downloadURL := strings.TrimSpace(c.String("download-url")); downloadURL != "" {
									resolvedDownloadURL := downloadURL
									resolvedSignatureURL := strings.TrimSpace(c.String("signature-url"))
									if len(results) > 1 {
										firstPackID := plans[0].Spec.PackID
										currPackID := plan.Spec.PackID
										resolvedDownloadURL = strings.ReplaceAll(downloadURL, firstPackID, currPackID)
										if resolvedSignatureURL != "" {
											resolvedSignatureURL = strings.ReplaceAll(resolvedSignatureURL, firstPackID, currPackID)
										}
									}

									meta := &sfpackwriter.ArchiveMetadata{
										PackID:          archiveResult.PackID,
										Version:         archiveResult.Version,
										ArchivePath:     archiveResult.PackPath,
										ArchiveSHA256:   archiveResult.ArchiveSHA256,
										ManifestSHA256:  archiveResult.ManifestSHA256,
										ChecksumsSHA256: archiveResult.ChecksumsSHA256,
										SizeBytes:       archiveResult.SizeBytes,
										Manifest:        archiveResult.Manifest,
									}
									registryEntry, regErr := sfpackwriter.BuildRegistryEntry(meta, resolvedDownloadURL, resolvedSignatureURL)
									if regErr != nil {
										return regErr
									}
									registryPath := filepath.Join(strings.TrimSpace(c.String("out")), fmt.Sprintf("%s-%s.registry.json", archiveResult.PackID, archiveResult.Version))
									if writeErr := sfpackwriter.WriteRegistryEntry(registryPath, registryEntry); writeErr != nil {
										return writeErr
									}
									fmt.Printf("registry=%s\n", registryPath)
								}
							}
							return nil
						},
					},
					{
						Name:  "validate",
						Usage: "validate unpacked pack directory or .sfpack archive",
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:     "path",
								Usage:    "path to unpacked pack directory or .sfpack",
								Required: true,
							},
							&cli.StringFlag{
								Name:  "archive-sha256",
								Usage: "expected archive digest for .sfpack validation",
							},
							&cli.StringFlag{
								Name:  "signature-public-key",
								Usage: "ed25519 public key to verify adjacent or explicit signature file",
							},
							&cli.StringFlag{
								Name:  "signature-path",
								Usage: "explicit signature path (default: <pack>.sfpack.sig)",
							},
						},
						Action: func(c *cli.Context) error {
							summary, err := packbuilder.ValidatePack(strings.TrimSpace(c.String("path")), packbuilder.ValidateOptions{
								ArchiveSHA256:      strings.TrimSpace(c.String("archive-sha256")),
								SignaturePublicKey: strings.TrimSpace(c.String("signature-public-key")),
								SignaturePath:      strings.TrimSpace(c.String("signature-path")),
							})
							if err != nil {
								return err
							}
							fmt.Printf("validation ok rows=%d assets=%d files=%d\n", summary.RowsCount, summary.AssetsCount, summary.FilesCount)
							return nil
						},
					},
					{
						Name:  "archive",
						Usage: "build .sfpack archive from unpacked pack directory",
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:     "path",
								Usage:    "path to unpacked pack directory",
								Required: true,
							},
							&cli.StringFlag{
								Name:     "out",
								Usage:    "output directory for .sfpack and optional .sig",
								Required: true,
							},
							&cli.StringFlag{
								Name:  "signing-key",
								Usage: "path or inline ed25519 private key (flag wins over PACK_SIGNING_KEY)",
							},
							&cli.BoolFlag{
								Name:  "allow-unsigned-public",
								Usage: "allow unsigned public archives (unsafe; CI should not use)",
							},
						},
						Action: func(c *cli.Context) error {
							result, err := sfpackwriter.CreateArchive(c.Context, sfpackwriter.ArchiveOptions{
								PackDir:             strings.TrimSpace(c.String("path")),
								OutDir:              strings.TrimSpace(c.String("out")),
								SigningKey:          resolveSigningKey(strings.TrimSpace(c.String("signing-key"))),
								AllowUnsignedPublic: c.Bool("allow-unsigned-public"),
							})
							if err != nil {
								return err
							}
							fmt.Printf("archive=%s\n", result.PackPath)
							fmt.Printf("archive_sha256=%s\n", result.ArchiveSHA256)
							if result.SignaturePath != "" {
								fmt.Printf("signature=%s\n", result.SignaturePath)
							}
							return nil
						},
					},
					{
						Name:  "sign",
						Usage: "sign existing .sfpack with canonical payload",
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:     "pack",
								Usage:    "path to .sfpack archive",
								Required: true,
							},
							&cli.StringFlag{
								Name:     "manifest",
								Usage:    "path to manifest.json from unpacked pack",
								Required: true,
							},
							&cli.StringFlag{
								Name:     "checksums",
								Usage:    "path to checksums.sha256 from unpacked pack",
								Required: true,
							},
							&cli.StringFlag{
								Name:     "out",
								Usage:    "output signature path",
								Required: true,
							},
							&cli.StringFlag{
								Name:     "signing-key",
								Usage:    "path or inline ed25519 private key (flag wins over PACK_SIGNING_KEY)",
								Required: false,
							},
						},
						Action: func(c *cli.Context) error {
							signingKey := resolveSigningKey(strings.TrimSpace(c.String("signing-key")))
							if signingKey == "" {
								return fmt.Errorf("signing key is required via --signing-key or PACK_SIGNING_KEY")
							}
							return sfpackwriter.SignArchive(sfpackwriter.SignArchiveOptions{
								PackPath:       strings.TrimSpace(c.String("pack")),
								ManifestPath:   strings.TrimSpace(c.String("manifest")),
								ChecksumsPath:  strings.TrimSpace(c.String("checksums")),
								OutputPath:     strings.TrimSpace(c.String("out")),
								SigningKeySpec: signingKey,
							})
						},
					},
					{
						Name:  "registry-entry",
						Usage: "generate registry item json for an archive",
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:     "pack",
								Usage:    "path to .sfpack archive",
								Required: true,
							},
							&cli.StringFlag{
								Name:     "download-url",
								Usage:    "archive download URL",
								Required: true,
							},
							&cli.StringFlag{
								Name:  "signature-url",
								Usage: "signature URL (optional)",
							},
							&cli.StringFlag{
								Name:  "out",
								Usage: "output json path (default: <pack>.registry.json)",
							},
						},
						Action: func(c *cli.Context) error {
							meta, err := sfpackwriter.InspectArchive(strings.TrimSpace(c.String("pack")))
							if err != nil {
								return err
							}
							entry, err := sfpackwriter.BuildRegistryEntry(meta, strings.TrimSpace(c.String("download-url")), strings.TrimSpace(c.String("signature-url")))
							if err != nil {
								return err
							}
							outPath := strings.TrimSpace(c.String("out"))
							if outPath == "" {
								outPath = strings.TrimSuffix(strings.TrimSpace(c.String("pack")), ".sfpack") + ".registry.json"
							}
							if err := sfpackwriter.WriteRegistryEntry(outPath, entry); err != nil {
								return err
							}
							fmt.Printf("registry=%s\n", outPath)
							return nil
						},
					},
					{
						Name:  "list",
						Usage: "list available and installed packs",
						Action: func(c *cli.Context) error {
							service := newMarketDataPackService(db)
							available, err := service.ListAvailablePacks(c.Context)
							if err != nil {
								fmt.Printf("available registry error: %v\n", err)
							} else {
								fmt.Println("available:")
								for _, pack := range available {
									marker := ""
									if pack.Recommended {
										marker = " recommended"
									}
									fmt.Printf("- %s version=%s assets=%d rows=%d%s\n", pack.PackID, pack.Version, pack.AssetsCount, pack.RowsCount, marker)
								}
							}
							installed, err := service.ListInstalledPacks(c.Context)
							if err != nil {
								return err
							}
							fmt.Println("installed:")
							for _, pack := range installed {
								fmt.Printf("- %s version=%s status=%s assets=%d rows=%d path=%s\n", pack.ID, pack.Version, pack.Status, pack.AssetsCount, pack.RowsCount, pack.FilePath)
							}
							return nil
						},
					},
					{
						Name:      "install",
						Usage:     "install pack by id",
						ArgsUsage: "PACK_ID",
						Action: func(c *cli.Context) error {
							packID := strings.TrimSpace(c.Args().First())
							if packID == "" {
								return fmt.Errorf("PACK_ID is required")
							}
							job, err := newMarketDataPackService(db).InstallPackBlocking(c.Context, packID)
							if err != nil {
								return err
							}
							fmt.Printf("install job id=%s pack=%s status=%s progress=%s\n", job.ID, job.PackID, job.Status, job.ProgressPercent.String())
							return nil
						},
					},
					{
						Name:  "update",
						Usage: "update all default packs or one pack",
						Action: func(c *cli.Context) error {
							cfg := config.LoadConfig()
							service := newMarketDataPackService(db)
							packIDs := cfg.MarketData.PackDefaultPacks
							if c.Args().Len() > 0 {
								packIDs = []string{c.Args().First()}
							}
							for _, packID := range packIDs {
								job, err := service.InstallPackBlocking(c.Context, packID)
								if err != nil {
									return err
								}
								fmt.Printf("update job id=%s pack=%s status=%s\n", job.ID, job.PackID, job.Status)
							}
							return nil
						},
					},
					{
						Name:  "status",
						Usage: "show installed pack status",
						Action: func(c *cli.Context) error {
							installed, err := newMarketDataPackService(db).ListInstalledPacks(c.Context)
							if err != nil {
								return err
							}
							for _, pack := range installed {
								fmt.Printf("%s version=%s status=%s installed_at=%v rows=%d\n", pack.ID, pack.Version, pack.Status, pack.InstalledAt, pack.RowsCount)
							}
							return nil
						},
					},
					{
						Name:      "repair",
						Usage:     "repair pack registry metadata",
						ArgsUsage: "PACK_ID",
						Action: func(c *cli.Context) error {
							packID := strings.TrimSpace(c.Args().First())
							if packID == "" {
								return fmt.Errorf("PACK_ID is required")
							}
							job, err := newMarketDataPackService(db).RepairPack(c.Context, packID)
							if err != nil {
								return err
							}
							fmt.Printf("repair job id=%s pack=%s status=%s\n", job.ID, job.PackID, job.Status)
							return nil
						},
					},
					{
						Name:      "remove",
						Usage:     "remove installed pack",
						ArgsUsage: "PACK_ID",
						Action: func(c *cli.Context) error {
							packID := strings.TrimSpace(c.Args().First())
							if packID == "" {
								return fmt.Errorf("PACK_ID is required")
							}
							job, err := newMarketDataPackService(db).RemovePack(c.Context, packID)
							if err != nil {
								return err
							}
							fmt.Printf("remove job id=%s pack=%s status=%s\n", job.ID, job.PackID, job.Status)
							return nil
						},
					},
					{
						Name:  "repair-local",
						Usage: "repair local-build pack metadata and coverage from disk",
						Action: func(c *cli.Context) error {
							repaired, err := newMarketDataPackService(db).RepairLocalBuildStorage(c.Context)
							if err != nil {
								return err
							}
							fmt.Printf("repair-local repaired=%d\n", repaired)
							return nil
						},
					},
				},
			},
		},
	}
}

func newMarketDataPackService(db *bun.DB) marketdatapacks.Service {
	cfg := config.LoadConfig()
	return marketdatapacks.NewService(
		repository.NewMarketDataPackRepository(db),
		marketdatapacks.Config{
			RegistryURL:                   cfg.MarketData.PackRegistryURL,
			StoragePath:                   cfg.MarketData.PackStoragePath,
			SignaturePublicKey:            cfg.MarketData.PackSignaturePublicKey,
			AppVersion:                    "0.0.0",
			LocalBuildDefaultHistoryYears: cfg.MarketData.LocalBuildDefaultHistoryYears,
			MarketParquetAPIBaseURL:       cfg.MarketData.MarketParquetAPIBaseURL,
			MarketParquetImportRoot:       cfg.MarketData.MarketParquetImportRoot,
		},
	)
}

func resolveSigningKey(flagValue string) string {
	if strings.TrimSpace(flagValue) != "" {
		return strings.TrimSpace(flagValue)
	}
	return strings.TrimSpace(os.Getenv("PACK_SIGNING_KEY"))
}
