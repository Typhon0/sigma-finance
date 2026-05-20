package sources

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadUniverseFromSample(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get wd: %v", err)
	}
	samplePath := filepath.Clean(filepath.Join(wd, "../../../../../packs/universes/crypto-binance-core-100.yaml"))
	universe, err := LoadUniverse(samplePath)
	if err != nil {
		t.Fatalf("load universe: %v", err)
	}
	if len(universe.Symbols) == 0 {
		t.Fatalf("expected symbols")
	}
}
