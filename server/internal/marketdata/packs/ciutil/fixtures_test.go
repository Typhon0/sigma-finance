package ciutil

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewFixtureHandlerServesBinanceAndECBFixtures(t *testing.T) {
	data, err := LoadDefaultFixtureServerData()
	if err != nil {
		t.Fatalf("load default fixture data: %v", err)
	}
	handler, err := NewFixtureHandler(data)
	if err != nil {
		t.Fatalf("new fixture handler: %v", err)
	}
	server := httptest.NewServer(handler)
	defer server.Close()

	archivePath := "/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip"
	resp, err := http.Get(server.URL + archivePath) //nolint:gosec
	if err != nil {
		t.Fatalf("get archive: %v", err)
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		t.Fatalf("read archive body: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for archive, got %d", resp.StatusCode)
	}
	assertCSVRowsInZip(t, body, 3)

	checksumResp, err := http.Get(server.URL + archivePath + ".CHECKSUM") //nolint:gosec
	if err != nil {
		t.Fatalf("get checksum: %v", err)
	}
	checksumBody, err := io.ReadAll(checksumResp.Body)
	checksumResp.Body.Close()
	if err != nil {
		t.Fatalf("read checksum body: %v", err)
	}
	if checksumResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for checksum, got %d", checksumResp.StatusCode)
	}
	sum := sha256.Sum256(body)
	if !strings.Contains(string(checksumBody), hex.EncodeToString(sum[:])) {
		t.Fatalf("checksum body missing digest: %s", string(checksumBody))
	}

	ecbResp, err := http.Get(server.URL + "/service/data/EXR/D.USD+GBP.EUR.SP00.A?startPeriod=2026-05-09&endPeriod=2026-05-10&format=csvdata") //nolint:gosec
	if err != nil {
		t.Fatalf("get ECB fixture: %v", err)
	}
	ecbBody, err := io.ReadAll(ecbResp.Body)
	ecbResp.Body.Close()
	if err != nil {
		t.Fatalf("read ECB body: %v", err)
	}
	if ecbResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for ECB fixture, got %d", ecbResp.StatusCode)
	}
	if !strings.Contains(string(ecbBody), "TIME_PERIOD") {
		t.Fatalf("expected ECB CSV header, got: %s", string(ecbBody))
	}
	if !strings.Contains(string(ecbBody), "2026-05-11,USD,EUR") {
		t.Fatalf("expected 3-day ECB fixture including 2026-05-11 row")
	}
}

func TestLoadDefaultFixtureServerDataContainsBTCAndETHThreeDayFixtures(t *testing.T) {
	data, err := LoadDefaultFixtureServerData()
	if err != nil {
		t.Fatalf("load default fixture data: %v", err)
	}
	btcPath := "/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip"
	ethPath := "/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2024-01.zip"
	btcZip, ok := data.BinanceZips[btcPath]
	if !ok {
		t.Fatalf("missing BTC fixture archive %s", btcPath)
	}
	ethZip, ok := data.BinanceZips[ethPath]
	if !ok {
		t.Fatalf("missing ETH fixture archive %s", ethPath)
	}
	assertCSVRowsInZip(t, btcZip, 3)
	assertCSVRowsInZip(t, ethZip, 3)
}

func assertCSVRowsInZip(t *testing.T, body []byte, expected int) {
	t.Helper()
	readerAt := bytes.NewReader(body)
	zipReader, err := zip.NewReader(readerAt, int64(len(body)))
	if err != nil {
		t.Fatalf("open zip: %v", err)
	}
	if len(zipReader.File) != 1 {
		t.Fatalf("expected single CSV in archive, got %d", len(zipReader.File))
	}
	file, err := zipReader.File[0].Open()
	if err != nil {
		t.Fatalf("open zipped CSV: %v", err)
	}
	defer file.Close()
	content, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("read zipped CSV: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	if len(lines) != expected {
		t.Fatalf("expected %d CSV rows, got %d", expected, len(lines))
	}
}
