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

type fixtureConfig struct {
	distribution  string
	licensePolicy string
	redistribute  bool
	commercial    bool
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
	specContent := "pack_id: test-pack\n" +
		"name: Test Pack\n" +
		"version: 2026.05.01\n" +
		"format_version: 1\n" +
		"distribution: " + cfg.distribution + "\n" +
		"asset_type: CRYPTO\n" +
		"interval: 1d\n" +
		"quote_currency: USDT\n" +
		"source_provider: fixture-provider\n" +
		"license_policy: " + cfg.licensePolicy + "\n" +
		"history:\n  start: 2017-01-01\n  end: auto\n" +
		"universe:\n  file: packs/universes/crypto-binance-core.yaml\n" +
		"output:\n  compression: zstd\n  partition_by:\n    - asset_type\n    - quote_currency\n    - year\n"
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
