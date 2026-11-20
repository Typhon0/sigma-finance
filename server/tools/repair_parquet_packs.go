//go:build tools
// +build tools

package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/parquet-go/parquet-go"
)

type packRowRaw struct {
	Symbol string `parquet:"symbol"`
	Open   []byte `parquet:"open"`
	Close  []byte `parquet:"close"`
}

func isCorruptedSliceHeader(raw []byte) bool {
	if len(raw) != 16 {
		return false
	}
	hasPointerMarker := raw[4] == 0xc0 || raw[5] == 0xc0 || raw[6] == 0xc0 || raw[7] == 0xc0
	hasLength16 := raw[8] == 0x10 && raw[9] == 0x00 && raw[10] == 0x00 && raw[11] == 0x00 && raw[12] == 0x00 && raw[13] == 0x00 && raw[14] == 0x00 && raw[15] == 0x00
	return hasPointerMarker && hasLength16
}

func inspectParquetFile(path string) (totalRows int, corruptedRows int, err error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return 0, 0, err
	}

	pf, err := parquet.OpenFile(f, stat.Size())
	if err != nil {
		return 0, 0, err
	}

	reader := parquet.NewGenericReader[packRowRaw](pf)
	defer reader.Close()

	batchSize := 2048
	rows := make([]packRowRaw, batchSize)
	for {
		n, readErr := reader.Read(rows)
		for i := 0; i < n; i++ {
			totalRows++
			if isCorruptedSliceHeader(rows[i].Close) || isCorruptedSliceHeader(rows[i].Open) {
				corruptedRows++
			}
		}
		if readErr == io.EOF || n == 0 {
			break
		}
		if readErr != nil {
			return totalRows, corruptedRows, readErr
		}
	}

	return totalRows, corruptedRows, nil
}

func main() {
	packsDir := flag.String("packs-dir", "data/market-data/packs", "path to market data packs directory")
	quarantine := flag.Bool("quarantine", false, "rename corrupted .parquet files to .parquet.corrupted so they are ignored")
	flag.Parse()

	absPacksDir, err := filepath.Abs(*packsDir)
	if err != nil {
		fmt.Printf("invalid packs dir: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("[repair-packs] Scanning packs in %s...\n", absPacksDir)
	var totalFiles int
	var corruptedFiles int
	var totalCandles int
	var corruptedCandles int

	err = filepath.Walk(absPacksDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() || !strings.HasSuffix(info.Name(), ".parquet") {
			return nil
		}

		totalFiles++
		rows, corrupted, inspectErr := inspectParquetFile(path)
		if inspectErr != nil {
			fmt.Printf("  [ERROR] inspecting %s: %v\n", path, inspectErr)
			return nil
		}

		totalCandles += rows
		corruptedCandles += corrupted

		if corrupted > 0 {
			corruptedFiles++
			relPath, _ := filepath.Rel(absPacksDir, path)
			fmt.Printf("  [CORRUPTED] %s (%d/%d rows corrupted by slice headers)\n", relPath, corrupted, rows)

			if *quarantine {
				quarantinePath := path + ".corrupted"
				if renameErr := os.Rename(path, quarantinePath); renameErr != nil {
					fmt.Printf("    failed to quarantine %s: %v\n", path, renameErr)
				} else {
					fmt.Printf("    quarantined -> %s\n", filepath.Base(quarantinePath))
				}
			}
		}
		return nil
	})

	if err != nil {
		fmt.Printf("[repair-packs] walk error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n[repair-packs] Scan complete:\n")
	fmt.Printf("  Total files inspected:     %d\n", totalFiles)
	fmt.Printf("  Corrupted files:           %d\n", corruptedFiles)
	fmt.Printf("  Total candle rows:         %d\n", totalCandles)
	fmt.Printf("  Corrupted candle rows:     %d\n", corruptedCandles)
	if corruptedFiles > 0 && !*quarantine {
		fmt.Printf("\nTip: run with -quarantine to rename corrupted .parquet files to .parquet.corrupted.\n")
	}
}
