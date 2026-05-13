package ciutil

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	packservice "sigma_finance/internal/service/marketdata/packs"
)

func TestAggregateRegistrySortsByPackID(t *testing.T) {
	dir := t.TempDir()
	entryB := packservice.RegistryPack{
		PackID:                FXPackID,
		Version:               "2026.05.11",
		Name:                  "FX",
		SourceProvider:        "ecb-statistics",
		DataLicense:           "ECB",
		RedistributionAllowed: true,
		GeneratedAt:           time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC),
		DownloadURL:           "https://example.test/fx.sfpack",
		Checksum:              "aaa",
		ArchiveSHA256:         "aaa",
		SignatureURL:          "https://example.test/fx.sfpack.sig",
	}
	entryA := packservice.RegistryPack{
		PackID:                CryptoPackID,
		Version:               "2026.05.01",
		Name:                  "Crypto",
		SourceProvider:        "binance-public-data",
		DataLicense:           "MIT",
		RedistributionAllowed: true,
		GeneratedAt:           time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC),
		DownloadURL:           "https://example.test/crypto.sfpack",
		Checksum:              "bbb",
		ArchiveSHA256:         "bbb",
		SignatureURL:          "https://example.test/crypto.sfpack.sig",
	}
	writeRegistryEntryFile(t, filepath.Join(dir, "2.registry.json"), entryB)
	writeRegistryEntryFile(t, filepath.Join(dir, "1.registry.json"), entryA)

	outPath := filepath.Join(dir, "registry.json")
	registry, err := AggregateRegistry(AggregateRegistryOptions{
		InputDir:      dir,
		OutputPath:    outPath,
		LatestVersion: "build-123",
	})
	if err != nil {
		t.Fatalf("aggregate registry: %v", err)
	}
	if len(registry.Packs) != 2 {
		t.Fatalf("expected 2 packs, got %d", len(registry.Packs))
	}
	if registry.Packs[0].PackID != CryptoPackID || registry.Packs[1].PackID != FXPackID {
		t.Fatalf("packs not sorted by pack_id: %+v", registry.Packs)
	}
}

func TestValidateRegistryPassesForValidFixtureOutput(t *testing.T) {
	dir := t.TempDir()
	writeArchivePair(t, dir, CryptoPackID, "2026.05.01")
	writeArchivePair(t, dir, FXPackID, "2026.05.11")

	registry := packservice.Registry{
		LatestVersion: "build-1",
		Packs: []packservice.RegistryPack{
			validRegistryPack(CryptoPackID, "2026.05.01", "binance-public-data"),
			validRegistryPack(FXPackID, "2026.05.11", "ecb-statistics"),
		},
	}
	registryPath := filepath.Join(dir, "registry.json")
	writeRegistry(t, registryPath, registry)

	if err := ValidateRegistry(ValidateRegistryOptions{
		RegistryPath: registryPath,
		DistDir:      dir,
	}); err != nil {
		t.Fatalf("validate registry: %v", err)
	}
}

func TestValidateRegistryFailsForForbiddenSourceProvider(t *testing.T) {
	dir := t.TempDir()
	writeArchivePair(t, dir, CryptoPackID, "2026.05.01")
	writeArchivePair(t, dir, FXPackID, "2026.05.11")

	registry := packservice.Registry{
		LatestVersion: "build-1",
		Packs: []packservice.RegistryPack{
			validRegistryPack(CryptoPackID, "2026.05.01", "yahoo-finance"),
			validRegistryPack(FXPackID, "2026.05.11", "ecb-statistics"),
		},
	}
	registryPath := filepath.Join(dir, "registry.json")
	writeRegistry(t, registryPath, registry)

	if err := ValidateRegistry(ValidateRegistryOptions{
		RegistryPath: registryPath,
		DistDir:      dir,
	}); err == nil {
		t.Fatal("expected forbidden source provider failure")
	}
}

func TestValidateRegistryFailsForProprietaryLocalOnlyProvider(t *testing.T) {
	dir := t.TempDir()
	writeArchivePair(t, dir, CryptoPackID, "2026.05.01")
	writeArchivePair(t, dir, FXPackID, "2026.05.11")

	registry := packservice.Registry{
		LatestVersion: "build-1",
		Packs: []packservice.RegistryPack{
			validRegistryPack(CryptoPackID, "2026.05.01", "proprietary-market-data-local-only"),
			validRegistryPack(FXPackID, "2026.05.11", "ecb-statistics"),
		},
	}
	registryPath := filepath.Join(dir, "registry.json")
	writeRegistry(t, registryPath, registry)

	if err := ValidateRegistry(ValidateRegistryOptions{
		RegistryPath: registryPath,
		DistDir:      dir,
	}); err == nil {
		t.Fatal("expected forbidden source provider failure")
	}
}

func TestValidateRegistryFailsForMarketParquetProvider(t *testing.T) {
	dir := t.TempDir()
	writeArchivePair(t, dir, CryptoPackID, "2026.05.01")
	writeArchivePair(t, dir, FXPackID, "2026.05.11")

	registry := packservice.Registry{
		LatestVersion: "build-1",
		Packs: []packservice.RegistryPack{
			validRegistryPack(CryptoPackID, "2026.05.01", "marketparquet"),
			validRegistryPack(FXPackID, "2026.05.11", "ecb-statistics"),
		},
	}
	registryPath := filepath.Join(dir, "registry.json")
	writeRegistry(t, registryPath, registry)

	if err := ValidateRegistry(ValidateRegistryOptions{
		RegistryPath: registryPath,
		DistDir:      dir,
	}); err == nil {
		t.Fatal("expected forbidden source provider failure")
	}
}

func TestValidateRegistryFailsForMissingSignatureOrChecksum(t *testing.T) {
	dir := t.TempDir()
	writeArchivePair(t, dir, CryptoPackID, "2026.05.01")
	writeArchivePair(t, dir, FXPackID, "2026.05.11")
	if err := os.Remove(filepath.Join(dir, FXPackID+"-2026.05.11.sfpack.sig")); err != nil {
		t.Fatal(err)
	}

	bad := validRegistryPack(FXPackID, "2026.05.11", "ecb-statistics")
	bad.Checksum = ""
	registry := packservice.Registry{
		LatestVersion: "build-1",
		Packs: []packservice.RegistryPack{
			validRegistryPack(CryptoPackID, "2026.05.01", "binance-public-data"),
			bad,
		},
	}
	registryPath := filepath.Join(dir, "registry.json")
	writeRegistry(t, registryPath, registry)

	if err := ValidateRegistry(ValidateRegistryOptions{
		RegistryPath: registryPath,
		DistDir:      dir,
	}); err == nil {
		t.Fatal("expected missing checksum/signature failure")
	}
}

func writeRegistryEntryFile(t *testing.T, path string, entry packservice.RegistryPack) {
	t.Helper()
	body, err := json.Marshal(entry)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, body, 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeRegistry(t *testing.T, path string, registry packservice.Registry) {
	t.Helper()
	body, err := json.Marshal(registry)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, body, 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeArchivePair(t *testing.T, dir, packID, version string) {
	t.Helper()
	archive := filepath.Join(dir, packID+"-"+version+".sfpack")
	if err := os.WriteFile(archive, []byte("archive"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(archive+".sig", []byte("signature"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func validRegistryPack(packID, version, provider string) packservice.RegistryPack {
	return packservice.RegistryPack{
		PackID:                packID,
		Version:               version,
		Name:                  packID,
		SourceProvider:        provider,
		DataLicense:           "license",
		LicenseURL:            "https://example.test/license",
		RedistributionAllowed: true,
		GeneratedAt:           time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC),
		DownloadURL:           "https://example.test/" + packID + ".sfpack",
		Checksum:              "sha256",
		ArchiveSHA256:         "sha256",
		SignatureURL:          "https://example.test/" + packID + ".sfpack.sig",
	}
}
