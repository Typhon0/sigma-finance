package ciutil

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	packservice "sigma_finance/internal/service/marketdata/packs"
)

const (
	CryptoPackID = "crypto-binance-core-daily-usdt"
	FXPackID     = "fx-ecb-core-daily"
)

var defaultExpectedPackIDs = []string{CryptoPackID, FXPackID}

type AggregateRegistryOptions struct {
	InputDir       string
	OutputPath     string
	LatestVersion  string
	ExpectedPackID []string
}

type ValidateRegistryOptions struct {
	RegistryPath   string
	DistDir        string
	ExpectedPackID []string
}

func AggregateRegistry(opts AggregateRegistryOptions) (*packservice.Registry, error) {
	inputDir := strings.TrimSpace(opts.InputDir)
	if inputDir == "" {
		return nil, fmt.Errorf("input dir is required")
	}
	outputPath := strings.TrimSpace(opts.OutputPath)
	if outputPath == "" {
		return nil, fmt.Errorf("output path is required")
	}
	registryFiles, err := filepath.Glob(filepath.Join(inputDir, "*.registry.json"))
	if err != nil {
		return nil, err
	}

	var filteredFiles []string
	for _, path := range registryFiles {
		if filepath.Base(path) != "registry.json" {
			filteredFiles = append(filteredFiles, path)
		}
	}

	if len(filteredFiles) == 0 {
		return nil, fmt.Errorf("no registry entry files found in %s", inputDir)
	}

	packs := make([]packservice.RegistryPack, 0, len(filteredFiles))
	for _, path := range filteredFiles {
		body, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil, readErr
		}
		var entry packservice.RegistryPack
		if unmarshalErr := json.Unmarshal(body, &entry); unmarshalErr != nil {
			return nil, fmt.Errorf("decode %s: %w", path, unmarshalErr)
		}
		packs = append(packs, entry)
	}
	sort.Slice(packs, func(i, j int) bool {
		if packs[i].PackID == packs[j].PackID {
			return packs[i].Version < packs[j].Version
		}
		return packs[i].PackID < packs[j].PackID
	})

	latestVersion := strings.TrimSpace(opts.LatestVersion)
	if latestVersion == "" {
		latestVersion = time.Now().UTC().Format("2006-01-02")
	}
	registry := &packservice.Registry{
		LatestVersion: latestVersion,
		Packs:         packs,
	}
	if err := ensureRegistryParent(outputPath); err != nil {
		return nil, err
	}
	body, err := json.MarshalIndent(registry, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(outputPath, append(body, '\n'), 0o644); err != nil {
		return nil, err
	}
	return registry, nil
}

func ValidateRegistry(opts ValidateRegistryOptions) error {
	registryPath := strings.TrimSpace(opts.RegistryPath)
	if registryPath == "" {
		return fmt.Errorf("registry path is required")
	}
	body, err := os.ReadFile(registryPath)
	if err != nil {
		return err
	}
	var registry packservice.Registry
	if err := json.Unmarshal(body, &registry); err != nil {
		return fmt.Errorf("decode registry: %w", err)
	}

	expected := normalizeExpected(opts.ExpectedPackID)
	if err := validatePackIDs(registry.Packs, expected); err != nil {
		return err
	}

	distDir := strings.TrimSpace(opts.DistDir)
	for _, pack := range registry.Packs {
		if err := validateRegistryPack(pack, distDir); err != nil {
			return fmt.Errorf("pack %s: %w", pack.PackID, err)
		}
	}
	return nil
}

func validateRegistryPack(pack packservice.RegistryPack, distDir string) error {
	sourceProvider := strings.ToLower(strings.TrimSpace(pack.SourceProvider))
	if sourceProvider == "yahoo-finance" || sourceProvider == "eodhd-local-only" || sourceProvider == "proprietary-market-data-local-only" || sourceProvider == "marketparquet" {
		return fmt.Errorf("forbidden source provider %s", pack.SourceProvider)
	}
	required := map[string]string{
		"data_license":   strings.TrimSpace(pack.DataLicense),
		"license_url":    strings.TrimSpace(pack.LicenseURL),
		"archive_sha256": strings.TrimSpace(pack.ArchiveSHA256),
		"checksum":       strings.TrimSpace(pack.Checksum),
		"download_url":   strings.TrimSpace(pack.DownloadURL),
		"signature_url":  strings.TrimSpace(pack.SignatureURL),
	}
	for key, value := range required {
		if value == "" {
			return fmt.Errorf("missing required %s", key)
		}
	}
	if !pack.RedistributionAllowed {
		return fmt.Errorf("redistribution_allowed must be true for public packs")
	}
	if pack.GeneratedAt.IsZero() {
		return fmt.Errorf("generated_at is required")
	}
	if strings.TrimSpace(distDir) != "" {
		archivePath := filepath.Join(distDir, fmt.Sprintf("%s-%s.sfpack", pack.PackID, pack.Version))
		if _, err := os.Stat(archivePath); err != nil {
			return fmt.Errorf("archive missing at %s", archivePath)
		}
		signaturePath := archivePath + ".sig"
		if _, err := os.Stat(signaturePath); err != nil {
			return fmt.Errorf("signature missing at %s", signaturePath)
		}
	}
	return nil
}

func validatePackIDs(packs []packservice.RegistryPack, expected []string) error {
	if len(packs) != len(expected) {
		return fmt.Errorf("registry must contain exactly %d packs; got %d", len(expected), len(packs))
	}
	actual := make([]string, 0, len(packs))
	for _, pack := range packs {
		actual = append(actual, strings.TrimSpace(pack.PackID))
	}
	sort.Strings(actual)
	sort.Strings(expected)
	for i := range expected {
		if actual[i] != expected[i] {
			return fmt.Errorf("registry pack ids mismatch got=%v expected=%v", actual, expected)
		}
	}
	return nil
}

func normalizeExpected(input []string) []string {
	if len(input) == 0 {
		return append([]string(nil), defaultExpectedPackIDs...)
	}
	out := make([]string, 0, len(input))
	for _, value := range input {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	if len(out) == 0 {
		return append([]string(nil), defaultExpectedPackIDs...)
	}
	return out
}

func ensureRegistryParent(path string) error {
	parent := filepath.Dir(path)
	if parent == "" || parent == "." {
		return nil
	}
	return os.MkdirAll(parent, 0o755)
}
