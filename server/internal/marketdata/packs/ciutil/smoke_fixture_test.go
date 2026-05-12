package ciutil

import (
	"context"
	"net/http/httptest"
	"path/filepath"
	"testing"

	packbuilder "sigma_finance/internal/marketdata/packs/builder"
	sfpackwriter "sigma_finance/internal/marketdata/packs/writer/sfpack"
)

func TestFixtureBuildArchiveAndRegistrySmoke(t *testing.T) {
	data, err := LoadDefaultFixtureServerData()
	if err != nil {
		t.Fatalf("load fixture data: %v", err)
	}
	handler, err := NewFixtureHandler(data)
	if err != nil {
		t.Fatalf("new fixture handler: %v", err)
	}
	server := httptest.NewServer(handler)
	defer server.Close()

	packsRoot, err := fixtureRootDir()
	if err != nil {
		t.Fatalf("fixture root: %v", err)
	}
	repoRoot := filepath.Clean(filepath.Join(packsRoot, "..", "..", "..", ".."))
	specCrypto := filepath.Join(repoRoot, "packs", "specs", "ci", "crypto-binance-core-daily-usdt.yaml")
	specFX := filepath.Join(repoRoot, "packs", "specs", "ci", "fx-ecb-core-daily.yaml")
	signingKey := filepath.Join(repoRoot, "packs", "fixtures", "keys", "test-ed25519-private-key.hex")

	dist := t.TempDir()
	cryptoPlan, err := packbuilder.PrepareBuild(context.Background(), specCrypto, dist)
	if err != nil {
		t.Fatalf("prepare crypto plan: %v", err)
	}
	fxPlan, err := packbuilder.PrepareBuild(context.Background(), specFX, dist)
	if err != nil {
		t.Fatalf("prepare fx plan: %v", err)
	}

	cryptoResult, err := packbuilder.BuildUnpackedPack(context.Background(), cryptoPlan, packbuilder.BuildUnpackedOptions{
		AllSymbols:    true,
		SourceBaseURL: server.URL,
		WorkDir:       filepath.Join(dist, "work-crypto"),
	})
	if err != nil {
		t.Fatalf("build crypto unpacked: %v", err)
	}
	fxResult, err := packbuilder.BuildUnpackedPack(context.Background(), fxPlan, packbuilder.BuildUnpackedOptions{
		AllSymbols:    true,
		SourceBaseURL: server.URL,
		WorkDir:       filepath.Join(dist, "work-fx"),
	})
	if err != nil {
		t.Fatalf("build fx unpacked: %v", err)
	}

	if _, err := packbuilder.ValidatePack(cryptoResult.PackDir, packbuilder.ValidateOptions{}); err != nil {
		t.Fatalf("validate crypto unpacked: %v", err)
	}
	if _, err := packbuilder.ValidatePack(fxResult.PackDir, packbuilder.ValidateOptions{}); err != nil {
		t.Fatalf("validate fx unpacked: %v", err)
	}

	cryptoArchive, err := sfpackwriter.CreateArchive(context.Background(), sfpackwriter.ArchiveOptions{
		PackDir:    cryptoResult.PackDir,
		OutDir:     dist,
		SigningKey: signingKey,
	})
	if err != nil {
		t.Fatalf("archive crypto: %v", err)
	}
	fxArchive, err := sfpackwriter.CreateArchive(context.Background(), sfpackwriter.ArchiveOptions{
		PackDir:    fxResult.PackDir,
		OutDir:     dist,
		SigningKey: signingKey,
	})
	if err != nil {
		t.Fatalf("archive fx: %v", err)
	}
	if cryptoArchive.SignaturePath == "" || fxArchive.SignaturePath == "" {
		t.Fatalf("expected archive signatures for fixture packs")
	}

	if _, err := packbuilder.ValidatePack(cryptoArchive.PackPath, packbuilder.ValidateOptions{}); err != nil {
		t.Fatalf("validate crypto archive: %v", err)
	}
	if _, err := packbuilder.ValidatePack(fxArchive.PackPath, packbuilder.ValidateOptions{}); err != nil {
		t.Fatalf("validate fx archive: %v", err)
	}

	cryptoMeta := &sfpackwriter.ArchiveMetadata{
		PackID:          cryptoArchive.PackID,
		Version:         cryptoArchive.Version,
		ArchivePath:     cryptoArchive.PackPath,
		ArchiveSHA256:   cryptoArchive.ArchiveSHA256,
		ManifestSHA256:  cryptoArchive.ManifestSHA256,
		ChecksumsSHA256: cryptoArchive.ChecksumsSHA256,
		SizeBytes:       cryptoArchive.SizeBytes,
		Manifest:        cryptoArchive.Manifest,
	}
	fxMeta := &sfpackwriter.ArchiveMetadata{
		PackID:          fxArchive.PackID,
		Version:         fxArchive.Version,
		ArchivePath:     fxArchive.PackPath,
		ArchiveSHA256:   fxArchive.ArchiveSHA256,
		ManifestSHA256:  fxArchive.ManifestSHA256,
		ChecksumsSHA256: fxArchive.ChecksumsSHA256,
		SizeBytes:       fxArchive.SizeBytes,
		Manifest:        fxArchive.Manifest,
	}

	cryptoURL := "file://" + cryptoArchive.PackPath
	fxURL := "file://" + fxArchive.PackPath
	cryptoEntry, err := sfpackwriter.BuildRegistryEntry(cryptoMeta, cryptoURL, cryptoURL+".sig")
	if err != nil {
		t.Fatalf("build crypto registry entry: %v", err)
	}
	fxEntry, err := sfpackwriter.BuildRegistryEntry(fxMeta, fxURL, fxURL+".sig")
	if err != nil {
		t.Fatalf("build fx registry entry: %v", err)
	}

	cryptoRegistryPath := filepath.Join(dist, cryptoArchive.PackID+"-"+cryptoArchive.Version+".registry.json")
	fxRegistryPath := filepath.Join(dist, fxArchive.PackID+"-"+fxArchive.Version+".registry.json")
	if err := sfpackwriter.WriteRegistryEntry(cryptoRegistryPath, cryptoEntry); err != nil {
		t.Fatalf("write crypto registry entry: %v", err)
	}
	if err := sfpackwriter.WriteRegistryEntry(fxRegistryPath, fxEntry); err != nil {
		t.Fatalf("write fx registry entry: %v", err)
	}

	registryPath := filepath.Join(dist, "registry.json")
	if _, err := AggregateRegistry(AggregateRegistryOptions{
		InputDir:      dist,
		OutputPath:    registryPath,
		LatestVersion: "fixture-smoke",
	}); err != nil {
		t.Fatalf("aggregate registry: %v", err)
	}
	if err := ValidateRegistry(ValidateRegistryOptions{
		RegistryPath: registryPath,
		DistDir:      dist,
	}); err != nil {
		t.Fatalf("validate registry: %v", err)
	}
}
