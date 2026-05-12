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
