package builder

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPrepareBuildPublicRedistributionDeniedFails(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:  "public",
		licensePolicy: "yahoo-finance",
		redistribute:  false,
		commercial:    false,
	})
	_, err := PrepareBuild(context.Background(), specPath, t.TempDir())
	if err == nil {
		t.Fatalf("expected public build failure")
	}
}

func TestPrepareBuildPublicMissingLicenseFails(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:  "public",
		licensePolicy: "",
		redistribute:  true,
		commercial:    true,
	})
	_, err := PrepareBuild(context.Background(), specPath, t.TempDir())
	if err == nil {
		t.Fatalf("expected missing license failure")
	}
}

func TestPrepareBuildLocalRedistributionDeniedPassesWithWarning(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:  "local",
		licensePolicy: "eodhd-local-only",
		redistribute:  false,
		commercial:    false,
	})
	plan, err := PrepareBuild(context.Background(), specPath, t.TempDir())
	if err != nil {
		t.Fatalf("expected local build pass, got %v", err)
	}
	if len(plan.LicenseGate.Warnings) == 0 {
		t.Fatalf("expected license warning")
	}
}

func TestPrepareBuildForModePublicReleaseRejectsNonPublicDistribution(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:  "local",
		licensePolicy: "proprietary-market-data-local-only",
		redistribute:  false,
		commercial:    false,
	})
	_, err := PrepareBuildForMode(context.Background(), specPath, t.TempDir(), BuildModePublicRelease)
	if err == nil || !strings.Contains(err.Error(), "public_release build rejected: pack test-pack has upload_forbidden=true") {
		t.Fatalf("expected upload_forbidden rejection, got %v", err)
	}
}

func TestPrepareBuildForModePublicReleaseRejectsRedistributionDisabled(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:  "public",
		licensePolicy: "proprietary-market-data-local-only",
		redistribute:  false,
		commercial:    true,
	})
	_, err := PrepareBuildForMode(context.Background(), specPath, t.TempDir(), BuildModePublicRelease)
	if err == nil || !strings.Contains(err.Error(), "public_release build rejected: pack test-pack has redistribution_allowed=false") {
		t.Fatalf("expected redistribution rejection, got %v", err)
	}
}

func TestPrepareBuildForModePublicReleaseRejectsStockFundWithoutExplicitLicense(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:  "public",
		assetType:     "STOCK",
		licensePolicy: "proprietary-market-data-local-only",
		redistribute:  false,
		commercial:    true,
	})
	_, err := PrepareBuildForMode(context.Background(), specPath, t.TempDir(), BuildModePublicRelease)
	if err == nil || !strings.Contains(err.Error(), "public_release build rejected: STOCK/FUND packs require explicit redistribution license") {
		t.Fatalf("expected stock/fund redistribution license rejection, got %v", err)
	}
}

func TestPrepareBuildForModePublicReleaseRejectsMarketParquet(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:   "public",
		sourceProvider: "marketparquet",
		assetType:      "STOCK",
		licensePolicy:  "marketparquet-local-only",
		redistribute:   false,
		commercial:     false,
	})
	_, err := PrepareBuildForMode(context.Background(), specPath, t.TempDir(), BuildModePublicRelease)
	if err == nil || !strings.Contains(err.Error(), "public_release build rejected: MarketParquet packs are local-user-build only") {
		t.Fatalf("expected marketparquet public release rejection, got %v", err)
	}
}

func TestPrepareBuildForModeLocalUserRejectsPublicDistribution(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:  "public",
		licensePolicy: "binance-public-data",
		redistribute:  true,
		commercial:    true,
	})
	_, err := PrepareBuildForMode(context.Background(), specPath, t.TempDir(), BuildModeLocalUser)
	if err == nil || !strings.Contains(err.Error(), "local_user_build rejected: pack test-pack has distribution=public") {
		t.Fatalf("expected public distribution rejection, got %v", err)
	}
}

func TestPrepareBuildForModeLocalUserAcceptsMarketParquet(t *testing.T) {
	root := t.TempDir()
	specPath := writeFixturePackFiles(t, root, fixtureConfig{
		distribution:   "local",
		sourceProvider: "marketparquet",
		assetType:      "STOCK",
		licensePolicy:  "marketparquet-local-only",
		redistribute:   false,
		commercial:     false,
	})
	_, err := PrepareBuildForMode(context.Background(), specPath, t.TempDir(), BuildModeLocalUser)
	if err != nil {
		t.Fatalf("expected local_user_build marketparquet acceptance, got %v", err)
	}
}

type fixtureConfig struct {
	distribution   string
	sourceProvider string
	assetType      string
	licensePolicy  string
	redistribute   bool
	commercial     bool
}

func writeFixturePackFiles(t *testing.T, root string, cfg fixtureConfig) string {
	t.Helper()
	universePath := filepath.Join(root, "packs", "universes", "crypto-binance-core.yaml")
	if err := os.MkdirAll(filepath.Dir(universePath), 0o755); err != nil {
		t.Fatalf("mkdir universe dir: %v", err)
	}
	universeContent := "symbols:\n  - instrument_id: \"00000000-0000-0000-0000-000000000001\"\n    symbol: BTCUSDT\n    base_asset: BTC\n    quote_asset: USDT\n    asset_type: CRYPTO\n"
	if err := os.WriteFile(universePath, []byte(universeContent), 0o644); err != nil {
		t.Fatalf("write universe: %v", err)
	}

	licensePolicy := strings.TrimSpace(cfg.licensePolicy)
	if licensePolicy != "" {
		licensePath := filepath.Join(root, "packs", "licenses", licensePolicy+".yaml")
		if err := os.MkdirAll(filepath.Dir(licensePath), 0o755); err != nil {
			t.Fatalf("mkdir license dir: %v", err)
		}
		licenseContent := "provider_id: " + licensePolicy + "\n" +
			"name: " + licensePolicy + "\n" +
			"source_url: https://example.test\n" +
			"license_name: TEST\n" +
			"redistribution_allowed: " + boolYAML(cfg.redistribute) + "\n" +
			"commercial_use_allowed: " + boolYAML(cfg.commercial) + "\n" +
			"attribution_required: true\n" +
			"terms_checked_at: \"2026-05-11\"\n" +
			"allowed_distribution_modes:\n  - public\n  - private\n  - local\n"
		if err := os.WriteFile(licensePath, []byte(licenseContent), 0o644); err != nil {
			t.Fatalf("write license: %v", err)
		}
	}

	specPath := filepath.Join(root, "packs", "specs", "fixture.yaml")
	if err := os.MkdirAll(filepath.Dir(specPath), 0o755); err != nil {
		t.Fatalf("mkdir spec dir: %v", err)
	}
	assetType := strings.TrimSpace(cfg.assetType)
	if assetType == "" {
		assetType = "CRYPTO"
	}
	sourceProvider := strings.TrimSpace(cfg.sourceProvider)
	if sourceProvider == "" {
		sourceProvider = "fixture-provider"
	}
	specContent := "pack_id: test-pack\n" +
		"name: Test Pack\n" +
		"version: 2026.05.01\n" +
		"format_version: 1\n" +
		"distribution: " + cfg.distribution + "\n" +
		"asset_type: " + assetType + "\n" +
		"interval: 1d\n" +
		"quote_currency: USDT\n" +
		"source_provider: " + sourceProvider + "\n" +
		"license_policy: " + cfg.licensePolicy + "\n" +
		"history:\n  start: 2017-01-01\n  end: auto\n" +
		"universe:\n  file: packs/universes/crypto-binance-core.yaml\n" +
		"output:\n  compression: zstd\n  partition_by:\n    - asset_type\n    - quote_currency\n    - year\n"
	if strings.EqualFold(cfg.distribution, "local") {
		specContent = strings.Replace(specContent, "history:\n", "upload_forbidden: true\ngenerated_by_user: true\ninstall_mode: build_local\nhistory:\n", 1)
	}
	if err := os.WriteFile(specPath, []byte(specContent), 0o644); err != nil {
		t.Fatalf("write spec: %v", err)
	}
	return specPath
}

func boolYAML(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
