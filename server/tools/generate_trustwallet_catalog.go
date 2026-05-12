package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type trustWalletInfo struct {
	Name    string `json:"name"`
	Symbol  string `json:"symbol"`
	Status  string `json:"status"`
	ID      string `json:"id"`
	Type    string `json:"type"`
	Website string `json:"website"`
}

type bundledRecord struct {
	ExternalID    string            `json:"externalId"`
	Symbol        string            `json:"symbol"`
	Name          string            `json:"name"`
	MarketCapRank *int              `json:"marketCapRank,omitempty"`
	ImageURL      *string           `json:"imageUrl,omitempty"`
	Platforms     map[string]string `json:"platforms,omitempty"`
	Status        string            `json:"status,omitempty"`
}

func main() {
	assetsRoot := flag.String("assets-root", "/tmp/trustwallet-assets", "Path to trustwallet/assets checkout")
	outPath := flag.String("out", "server/internal/infrastructure/trustwallet/catalog.json", "Output catalog path")
	flag.Parse()

	records, err := buildCatalog(*assetsRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to build catalog: %v\n", err)
		os.Exit(1)
	}

	bytes, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to marshal catalog: %v\n", err)
		os.Exit(1)
	}
	bytes = append(bytes, '\n')

	if err := os.MkdirAll(filepath.Dir(*outPath), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "failed to create output directory: %v\n", err)
		os.Exit(1)
	}
	if err := os.WriteFile(*outPath, bytes, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "failed to write output: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("generated %d records into %s\n", len(records), *outPath)
}

func buildCatalog(assetsRoot string) ([]bundledRecord, error) {
	blockchainsDir := filepath.Join(assetsRoot, "blockchains")
	entries, err := os.ReadDir(blockchainsDir)
	if err != nil {
		return nil, err
	}

	recordsByID := make(map[string]bundledRecord, 8192)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		chain := strings.ToLower(strings.TrimSpace(entry.Name()))
		if chain == "" {
			continue
		}

		if err := collectNativeCoin(assetsRoot, chain, recordsByID); err != nil {
			return nil, err
		}
		if err := collectTokenAssets(assetsRoot, chain, recordsByID); err != nil {
			return nil, err
		}
	}

	records := make([]bundledRecord, 0, len(recordsByID))
	for _, record := range recordsByID {
		records = append(records, record)
	}
	sort.Slice(records, func(i, j int) bool {
		return records[i].ExternalID < records[j].ExternalID
	})
	return records, nil
}

func collectNativeCoin(assetsRoot string, chain string, records map[string]bundledRecord) error {
	path := filepath.Join(assetsRoot, "blockchains", chain, "info", "info.json")
	info, err := readInfo(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	symbol := strings.ToUpper(strings.TrimSpace(info.Symbol))
	name := strings.TrimSpace(info.Name)
	status := normalizeStatus(info.Status)
	if symbol == "" || name == "" {
		return nil
	}

	externalID := chain + ":coin"
	logo := fmt.Sprintf("https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/%s/info/logo.png", chain)
	records[externalID] = bundledRecord{
		ExternalID: externalID,
		Symbol:     symbol,
		Name:       name,
		ImageURL:   &logo,
		Status:     status,
	}
	return nil
}

func collectTokenAssets(assetsRoot string, chain string, records map[string]bundledRecord) error {
	assetsDir := filepath.Join(assetsRoot, "blockchains", chain, "assets")
	err := filepath.WalkDir(assetsDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			if os.IsNotExist(walkErr) {
				return nil
			}
			return walkErr
		}
		if d.IsDir() || strings.ToLower(d.Name()) != "info.json" {
			return nil
		}

		info, err := readInfo(path)
		if err != nil {
			return err
		}

		symbol := strings.ToUpper(strings.TrimSpace(info.Symbol))
		name := strings.TrimSpace(info.Name)
		status := normalizeStatus(info.Status)
		assetID := strings.TrimSpace(info.ID)
		if assetID == "" {
			assetID = filepath.Base(filepath.Dir(path))
		}
		if symbol == "" || name == "" || assetID == "" {
			return nil
		}
		if strings.Contains(assetID, " ") {
			return nil
		}

		externalID := chain + ":" + assetID
		logo := fmt.Sprintf("https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/%s/assets/%s/logo.png", chain, assetID)
		records[externalID] = bundledRecord{
			ExternalID: externalID,
			Symbol:     symbol,
			Name:       name,
			ImageURL:   &logo,
			Platforms: map[string]string{
				chain: assetID,
			},
			Status: status,
		}
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func readInfo(path string) (*trustWalletInfo, error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var info trustWalletInfo
	if err := json.Unmarshal(bytes, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func normalizeStatus(status string) string {
	normalized := strings.ToLower(strings.TrimSpace(status))
	if normalized == "" {
		return "active"
	}
	return normalized
}
