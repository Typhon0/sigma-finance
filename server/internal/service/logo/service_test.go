package logo

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractDomain(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"https://www.apple.com", "apple.com"},
		{"http://apple.com/about", "apple.com"},
		{"microsoft.com", "microsoft.com"},
		{"www.nvidia.com/en-us", "nvidia.com"},
		{"", ""},
	}

	for _, tt := range tests {
		actual := extractDomain(tt.input)
		assert.Equal(t, tt.expected, actual)
	}
}

func TestSanitizeIdentifier(t *testing.T) {
	assert.Equal(t, "AAPL", sanitizeIdentifier("aapl"))
	assert.Equal(t, "BRK_B", sanitizeIdentifier("BRK.B"))
	assert.Equal(t, "0X1234", sanitizeIdentifier("0x1234"))
	assert.Equal(t, "BTC", sanitizeIdentifier("  btc  "))
}

func TestIsPrivateIP(t *testing.T) {
	assert.True(t, isPrivateIP(net.ParseIP("127.0.0.1")))
	assert.True(t, isPrivateIP(net.ParseIP("10.0.0.1")))
	assert.True(t, isPrivateIP(net.ParseIP("192.168.1.1")))
	assert.True(t, isPrivateIP(net.ParseIP("172.16.0.5")))
	assert.True(t, isPrivateIP(net.ParseIP("169.254.1.1")))
	assert.False(t, isPrivateIP(net.ParseIP("8.8.8.8")))
	assert.False(t, isPrivateIP(net.ParseIP("1.1.1.1")))
}

func TestLogoService_DiskCache(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "logo-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	svc := NewService(tmpDir, nil, nil)

	// Initially not in cache
	path, mime, found := svc.GetCachedPath("stocks", "AAPL")
	assert.False(t, found)
	assert.Empty(t, path)
	assert.Empty(t, mime)

	// Manually write sample SVG
	svgContent := []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>`)
	cryptoDir := filepath.Join(tmpDir, "crypto")
	require.NoError(t, os.MkdirAll(cryptoDir, 0755))
	require.NoError(t, os.WriteFile(filepath.Join(cryptoDir, "BTC.svg"), svgContent, 0644))

	path, mime, found = svc.GetCachedPath("crypto", "BTC")
	assert.True(t, found)
	assert.Equal(t, "image/svg+xml", mime)
	assert.Contains(t, path, "BTC.svg")

	data, mimeType, err := svc.GetLogo(context.Background(), "crypto", "BTC")
	require.NoError(t, err)
	assert.Equal(t, "image/svg+xml", mimeType)
	assert.Equal(t, svgContent, data)
}

func TestLogoService_FetchAndCache(t *testing.T) {
	// Mock upstream HTTP server returning 1x1 transparent PNG
	png1x1 := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
		0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
		0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
		0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(png1x1)
	}))
	defer server.Close()

	tmpDir, err := os.MkdirTemp("", "logo-fetch-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	s := &service{
		storageDir: tmpDir,
		httpClient: server.Client(),
	}

	data, mime, err := s.fetchAndValidateImage(context.Background(), server.URL)
	require.NoError(t, err)
	assert.Equal(t, "image/png", mime)
	assert.Equal(t, png1x1, data)

	// Save to disk
	s.saveToDiskCache("stocks", "AAPL", data, mime)

	cachedPath, cachedMime, found := s.GetCachedPath("stocks", "AAPL")
	assert.True(t, found)
	assert.Equal(t, "image/png", cachedMime)
	assert.FileExists(t, cachedPath)
}

func TestLogoService_CandidateURLsAndAliases(t *testing.T) {
	s := &service{
		storageDir: t.TempDir(),
	}

	// Crypto: XDG should resolve candidate URLs for DOGE and include CoinCap
	cryptoURLs := s.resolveCandidateURLs(context.Background(), "crypto", "DOGE")
	require.NotEmpty(t, cryptoURLs)
	assert.Contains(t, cryptoURLs[0], "coincap.io/assets/icons/doge@2x.png")

	// Stock with exchange suffix: MC.PA should include exact symbol MC.PA and lvmh.com domain
	stockURLs := s.resolveCandidateURLs(context.Background(), "stocks", "MC.PA")
	require.NotEmpty(t, stockURLs)
	assert.Contains(t, stockURLs[0], "lvmh.com")
	var hasDomain bool
	for _, u := range stockURLs {
		if strings.Contains(u, "lvmh.com") {
			hasDomain = true
			break
		}
	}
	assert.True(t, hasDomain, "Should include verified company domain lvmh.com")

	// Alias check in GetCachedPath
	// If DOGE is cached, querying XDG should hit the DOGE cache
	dogePath := filepath.Join(s.storageDir, "crypto", "DOGE.png")
	require.NoError(t, os.MkdirAll(filepath.Dir(dogePath), 0755))
	require.NoError(t, os.WriteFile(dogePath, []byte("fake-doge"), 0644))

	path, mime, found := s.GetCachedPath("crypto", "XDG")
	assert.True(t, found)
	assert.Equal(t, dogePath, path)
	assert.Equal(t, "image/png", mime)
}
