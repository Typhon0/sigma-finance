package ciutil

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type FixtureServerData struct {
	ECBCSV       []byte
	BinanceZips  map[string][]byte
	BinanceSums  map[string]string
	HealthBody   []byte
	AllowedPairs map[string]struct{}
}

func LoadDefaultFixtureServerData() (*FixtureServerData, error) {
	baseDir, err := fixtureRootDir()
	if err != nil {
		return nil, err
	}

	ecbPath := filepath.Join(baseDir, "ciutil", "testdata", "ecb_rates_3d.csv")
	ecbBody, err := os.ReadFile(ecbPath)
	if err != nil {
		return nil, fmt.Errorf("read ECB fixture: %w", err)
	}

	btcCSVPath := filepath.Join(baseDir, "ciutil", "testdata", "binance_btcusdt_3d.csv")
	btcCSV, err := os.ReadFile(btcCSVPath)
	if err != nil {
		return nil, fmt.Errorf("read BTC fixture: %w", err)
	}
	ethCSVPath := filepath.Join(baseDir, "ciutil", "testdata", "binance_ethusdt_3d.csv")
	ethCSV, err := os.ReadFile(ethCSVPath)
	if err != nil {
		return nil, fmt.Errorf("read ETH fixture: %w", err)
	}

	symbolContent := map[string][]byte{
		"BTCUSDT": btcCSV,
		"ETHUSDT": ethCSV,
	}

	symbolMonths := []string{"BTCUSDT-2024-01", "ETHUSDT-2024-01"}
	zips := make(map[string][]byte, len(symbolMonths))
	sums := make(map[string]string, len(symbolMonths))
	allowedPairs := make(map[string]struct{}, len(symbolMonths))
	for _, pair := range symbolMonths {
		parts := strings.Split(pair, "-")
		if len(parts) != 3 {
			return nil, fmt.Errorf("invalid fixture pair %q", pair)
		}
		symbol := parts[0]
		yearMonth := parts[1] + "-" + parts[2]
		content, ok := symbolContent[symbol]
		if !ok {
			return nil, fmt.Errorf("missing fixture CSV for symbol %s", symbol)
		}
		archiveRel := monthlyArchivePath(symbol, yearMonth)
		archiveName := fmt.Sprintf("%s-1d-%s.csv", symbol, yearMonth)
		zipBody, zipErr := csvToZip(archiveName, content)
		if zipErr != nil {
			return nil, zipErr
		}
		zips[archiveRel] = zipBody
		sum := sha256.Sum256(zipBody)
		sums[archiveRel] = hex.EncodeToString(sum[:])
		allowedPairs[symbol+"-"+yearMonth] = struct{}{}
	}

	return &FixtureServerData{
		ECBCSV:       ecbBody,
		BinanceZips:  zips,
		BinanceSums:  sums,
		HealthBody:   []byte("ok"),
		AllowedPairs: allowedPairs,
	}, nil
}

func NewFixtureHandler(data *FixtureServerData) (http.Handler, error) {
	if data == nil {
		return nil, fmt.Errorf("fixture data is required")
	}
	if len(data.ECBCSV) == 0 {
		return nil, fmt.Errorf("ECB fixture is required")
	}
	if len(data.BinanceZips) == 0 {
		return nil, fmt.Errorf("Binance fixture archives are required")
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case path == "/healthz":
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			_, _ = w.Write(data.HealthBody)
			return
		case strings.HasPrefix(path, "/service/data/EXR/"):
			w.Header().Set("Content-Type", "text/csv")
			_, _ = w.Write(data.ECBCSV)
			return
		case strings.HasPrefix(path, "/data/spot/monthly/klines/"):
			if strings.HasSuffix(path, ".CHECKSUM") {
				archivePath := strings.TrimSuffix(path, ".CHECKSUM")
				sum, ok := data.BinanceSums[archivePath]
				if !ok {
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				_, _ = w.Write([]byte(sum + "  archive.zip\n"))
				return
			}
			body, ok := data.BinanceZips[path]
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "application/zip")
			_, _ = w.Write(body)
			return
		default:
			http.NotFound(w, r)
			return
		}
	}), nil
}

func monthlyArchivePath(symbol string, yearMonth string) string {
	file := fmt.Sprintf("%s-1d-%s.zip", symbol, yearMonth)
	return "/data/spot/monthly/klines/" + symbol + "/1d/" + file
}

func csvToZip(entryName string, body []byte) ([]byte, error) {
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)
	fileWriter, err := zipWriter.Create(entryName)
	if err != nil {
		return nil, fmt.Errorf("create zip entry: %w", err)
	}
	if _, err := fileWriter.Write(body); err != nil {
		return nil, fmt.Errorf("write zip entry: %w", err)
	}
	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("close zip writer: %w", err)
	}
	return buf.Bytes(), nil
}

func fixtureRootDir() (string, error) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		return "", fmt.Errorf("resolve fixture root failed")
	}
	base := filepath.Dir(currentFile)
	return filepath.Join(base, ".."), nil
}
