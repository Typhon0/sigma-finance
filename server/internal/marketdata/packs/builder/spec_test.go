package builder

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSpecFromSample(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get wd: %v", err)
	}
	specPath := filepath.Clean(filepath.Join(wd, "../../../../../packs/specs/crypto-binance-core-daily-usdt.yaml"))
	spec, err := LoadSpec(specPath)
	if err != nil {
		t.Fatalf("load spec: %v", err)
	}
	if spec.PackID != "crypto-binance-core-daily-usdt" {
		t.Fatalf("unexpected pack id %s", spec.PackID)
	}
}

func TestValidateSpecWithDiscover(t *testing.T) {
	spec := &PackSpec{
		PackID:         "test-pack",
		Name:           "Test Pack",
		Version:        "1.0.0",
		FormatVersion:  1,
		Distribution:   "local",
		AssetType:      "CRYPTO",
		Interval:       "1d",
		QuoteCurrency:  "USDT",
		SourceProvider: "binance-public-data",
		History: HistorySpec{
			Start: "2024-01-01",
			End:   "2024-01-02",
		},
		Universe: UniverseConfig{
			Discover: 50,
		},
		Output: OutputConfig{
			Compression: "zstd",
			PartitionBy: []string{"year"},
		},
	}
	if err := spec.Validate(); err != nil {
		t.Fatalf("expected valid spec when discover is set, but got error: %v", err)
	}

	// Neither file nor discover
	spec.Universe.Discover = 0
	spec.Universe.File = ""
	if err := spec.Validate(); err == nil {
		t.Fatalf("expected error when neither file nor discover is set")
	}

	// File only
	spec.Universe.File = "some/file.yaml"
	if err := spec.Validate(); err != nil {
		t.Fatalf("expected valid spec when file is set, but got error: %v", err)
	}
}
