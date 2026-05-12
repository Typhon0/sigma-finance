package packs

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestValidateManifestRejectsUnsupportedFormat(t *testing.T) {
	manifest := &Manifest{
		PackID:        "core-daily",
		Version:       "2026-05",
		Name:          "Core Daily",
		Interval:      "1d",
		FormatVersion: CurrentFormatVersion + 1,
		Files:         []ManifestFile{{Path: "data/part-000.parquet", Checksum: "abc"}},
		CreatedAt:     time.Now(),
	}
	if err := ValidateManifest(manifest, "0.0.0"); err == nil {
		t.Fatal("expected unsupported format version error")
	}
}

func TestValidatePackChecksumsRejectsBadChecksum(t *testing.T) {
	dir := t.TempDir()
	dataPath := filepath.Join(dir, "data")
	if err := os.MkdirAll(dataPath, 0o755); err != nil {
		t.Fatal(err)
	}
	filePath := filepath.Join(dataPath, "part-000.parquet")
	if err := os.WriteFile(filePath, []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}
	manifest := &Manifest{
		PackID:        "core-daily",
		Version:       "2026-05",
		Name:          "Core Daily",
		Interval:      "1d",
		FormatVersion: CurrentFormatVersion,
		Files:         []ManifestFile{{Path: "data/part-000.parquet", Checksum: "deadbeef"}},
	}
	if err := ValidatePackChecksums(dir, manifest); err == nil {
		t.Fatal("expected checksum error")
	}
}

func TestValidatePackChecksumsAcceptsGoodChecksum(t *testing.T) {
	dir := t.TempDir()
	dataPath := filepath.Join(dir, "data")
	if err := os.MkdirAll(dataPath, 0o755); err != nil {
		t.Fatal(err)
	}
	body := []byte("fixture")
	filePath := filepath.Join(dataPath, "part-000.parquet")
	if err := os.WriteFile(filePath, body, 0o644); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(body)
	manifest := &Manifest{
		PackID:        "core-daily",
		Version:       "2026-05",
		Name:          "Core Daily",
		Interval:      "1d",
		FormatVersion: CurrentFormatVersion,
		Files:         []ManifestFile{{Path: "data/part-000.parquet", Checksum: hex.EncodeToString(sum[:])}},
	}
	if err := ValidatePackChecksums(dir, manifest); err != nil {
		t.Fatalf("expected checksum success: %v", err)
	}
}

func TestBuildSignaturePayload(t *testing.T) {
	payload := string(BuildSignaturePayload("archive", "manifest", "checksums"))
	const expected = `{"archive_sha256":"archive","checksums_sha256":"checksums","manifest_sha256":"manifest"}`
	if payload != expected {
		t.Fatalf("unexpected signature payload: %s", payload)
	}
}

func TestNormalizeSHA256(t *testing.T) {
	if got := normalizeSHA256(" sha256:ABC123 "); got != "abc123" {
		t.Fatalf("unexpected digest normalization: %q", got)
	}
}
