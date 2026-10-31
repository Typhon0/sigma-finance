package logo

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"sigma_finance/internal/infrastructure/trustwallet"
	"sigma_finance/internal/repository"
)

const (
	MaxLogoSizeBytes = 2 * 1024 * 1024 // 2MB
	HTTPTimeout      = 5 * time.Second
)

var (
	safeFileNameRegex   = regexp.MustCompile(`[^a-zA-Z0-9_\-]`)
	krakenCryptoAliases = map[string]string{
		"XDG":  "DOGE",
		"XXBT": "BTC",
		"XBT":  "BTC",
		"XETH": "ETH",
		"XXLM": "XLM",
		"XXRP": "XRP",
		"XLTC": "LTC",
		"XETC": "ETC",
		"XMLN": "MLN",
		"XREP": "REP",
		"XZEC": "ZEC",
	}
)

type Service interface {
	GetLogo(ctx context.Context, assetType, identifier string) ([]byte, string, error)
	GetCachedPath(assetType, identifier string) (string, string, bool)
}

type service struct {
	storageDir        string
	twClient          *trustwallet.Client
	instrumentRepo    repository.IInstrumentRepository
	httpClient        *http.Client
	symbolToTwImageMu sync.RWMutex
	symbolToTwImage   map[string]string
}

func NewService(storageDir string, twClient *trustwallet.Client, instrumentRepo repository.IInstrumentRepository) Service {
	if storageDir == "" {
		storageDir = "./data/logos"
	}

	_ = os.MkdirAll(filepath.Join(storageDir, "crypto"), 0755)
	_ = os.MkdirAll(filepath.Join(storageDir, "stocks"), 0755)
	_ = os.MkdirAll(filepath.Join(storageDir, "funds"), 0755)

	// Safe HTTP transport with SSRF protection
	safeTransport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}
			ips, err := net.LookupIP(host)
			if err != nil {
				return nil, err
			}
			for _, ip := range ips {
				if isPrivateIP(ip) {
					return nil, fmt.Errorf("access to private IP %s is prohibited", ip.String())
				}
			}
			dialer := &net.Dialer{Timeout: HTTPTimeout}
			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
		},
	}

	client := &http.Client{
		Timeout:   HTTPTimeout,
		Transport: safeTransport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("stopped after 5 redirects")
			}
			return nil
		},
	}

	s := &service{
		storageDir:      storageDir,
		twClient:        twClient,
		instrumentRepo:  instrumentRepo,
		httpClient:      client,
		symbolToTwImage: make(map[string]string),
	}

	s.warmTrustWalletSymbolMap()

	return s
}

func isPrivateIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsLinkLocalMulticast() || ip.IsLinkLocalUnicast() {
		return true
	}
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"169.254.0.0/16",
		"fc00::/7",
	}
	for _, cidr := range privateRanges {
		_, block, _ := net.ParseCIDR(cidr)
		if block != nil && block.Contains(ip) {
			return true
		}
	}
	return false
}

func (s *service) warmTrustWalletSymbolMap() {
	if s.twClient == nil {
		return
	}
	assets, err := s.twClient.ListAssets(context.Background(), "active", 1, 10000)
	if err != nil || len(assets) == 0 {
		return
	}
	s.symbolToTwImageMu.Lock()
	defer s.symbolToTwImageMu.Unlock()
	for _, a := range assets {
		if a.ImageURL != nil && *a.ImageURL != "" {
			sym := strings.ToUpper(strings.TrimSpace(a.Symbol))
			if _, exists := s.symbolToTwImage[sym]; !exists {
				s.symbolToTwImage[sym] = *a.ImageURL
			}
		}
	}
}

func sanitizeIdentifier(id string) string {
	clean := strings.TrimSpace(id)
	clean = safeFileNameRegex.ReplaceAllString(clean, "_")
	if len(clean) > 64 {
		clean = clean[:64]
	}
	return strings.ToUpper(clean)
}

func (s *service) GetCachedPath(assetType, identifier string) (string, string, bool) {
	normType := strings.ToLower(strings.TrimSpace(assetType))
	if normType == "fund" {
		normType = "stocks"
	}
	if normType != "crypto" && normType != "stocks" {
		normType = "stocks"
	}

	rawID := strings.TrimSpace(identifier)
	if normType == "crypto" {
		if alias, ok := krakenCryptoAliases[strings.ToUpper(rawID)]; ok {
			rawID = alias
		}
	}

	safeID := sanitizeIdentifier(rawID)
	if safeID == "" {
		return "", "", false
	}

	typeDir := filepath.Join(s.storageDir, normType)
	extensions := []struct {
		ext  string
		mime string
	}{
		{".svg", "image/svg+xml"},
		{".png", "image/png"},
		{".webp", "image/webp"},
		{".jpg", "image/jpeg"},
		{".jpeg", "image/jpeg"},
		{".ico", "image/x-icon"},
	}

	for _, e := range extensions {
		filePath := filepath.Join(typeDir, safeID+e.ext)
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() && info.Size() > 0 {
			return filePath, e.mime, true
		}
	}

	return "", "", false
}

func (s *service) GetLogo(ctx context.Context, assetType, identifier string) ([]byte, string, error) {
	normType := strings.ToLower(strings.TrimSpace(assetType))
	cleanSymbol := strings.ToUpper(strings.TrimSpace(identifier))
	if normType == "crypto" {
		if alias, ok := krakenCryptoAliases[cleanSymbol]; ok {
			cleanSymbol = alias
		}
	}

	// 1. Check local disk cache
	if path, mime, ok := s.GetCachedPath(normType, cleanSymbol); ok {
		data, err := os.ReadFile(path)
		if err == nil && len(data) > 0 {
			return data, mime, nil
		}
	}

	// 2. Discover potential logo candidate URLs
	candidateURLs := s.resolveCandidateURLs(ctx, normType, cleanSymbol)
	if len(candidateURLs) == 0 {
		return nil, "", fmt.Errorf("no logo candidate found for %s:%s", assetType, identifier)
	}

	// 3. Try candidates sequentially
	for _, targetURL := range candidateURLs {
		data, mime, err := s.fetchAndValidateImage(ctx, targetURL)
		if err != nil || len(data) == 0 {
			continue
		}

		// 4. Save to local disk cache
		s.saveToDiskCache(normType, cleanSymbol, data, mime)
		return data, mime, nil
	}

	return nil, "", fmt.Errorf("all logo sources failed for %s:%s", assetType, identifier)
}

func (s *service) resolveCandidateURLs(ctx context.Context, assetType, symbol string) []string {
	var urls []string

	if assetType == "crypto" {
		lowerSym := strings.ToLower(symbol)

		// Priority 1: Check TrustWallet catalog mapping
		s.symbolToTwImageMu.RLock()
		twURL, hasTw := s.symbolToTwImage[symbol]
		s.symbolToTwImageMu.RUnlock()
		if hasTw && twURL != "" {
			urls = append(urls, twURL)
		}

		// Priority 2: CoinCap high-resolution CDN (covers almost all altcoins: FLR, SUI, AAVE, XLM, FIL, RNDR, KAS, TIA, etc.)
		urls = append(urls, fmt.Sprintf("https://assets.coincap.io/assets/icons/%s@2x.png", lowerSym))

		// Priority 3: NVSTly verified crypto icons
		urls = append(urls, fmt.Sprintf("https://raw.githubusercontent.com/nvstly/icons/main/crypto_icons/%s.png", symbol))

		// Priority 4: TrustWallet native blockchain info
		urls = append(urls,
			fmt.Sprintf("https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/%s/info/logo.png", lowerSym),
		)

		// Priority 5: jsdelivr / spothq cryptocurrency icons
		urls = append(urls, fmt.Sprintf("https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/%s.png", lowerSym))
	} else {
		// Stocks / ETFs / Funds
		baseSym := strings.Split(symbol, ".")[0]

		// Priority 1: NVSTly ticker icons repository (covers thousands of NYSE, NASDAQ, and world tickers)
		urls = append(urls, fmt.Sprintf("https://raw.githubusercontent.com/nvstly/icons/main/ticker_icons/%s.png", symbol))
		if baseSym != symbol {
			urls = append(urls, fmt.Sprintf("https://raw.githubusercontent.com/nvstly/icons/main/ticker_icons/%s.png", baseSym))
		}

		// Priority 2: FinancialModelingPrep stock image API
		urls = append(urls, fmt.Sprintf("https://financialmodelingprep.com/image-stock/%s.png", symbol))
		if baseSym != symbol {
			urls = append(urls, fmt.Sprintf("https://financialmodelingprep.com/image-stock/%s.png", baseSym))
		}

		// Priority 3: TradingView SVG CDN
		urls = append(urls, fmt.Sprintf("https://s3-symbol-logo.tradingview.com/%s.svg", strings.ToLower(symbol)))
		if baseSym != symbol {
			urls = append(urls, fmt.Sprintf("https://s3-symbol-logo.tradingview.com/%s.svg", strings.ToLower(baseSym)))
		}

		// Priority 4: In-database instrument website domain
		if s.instrumentRepo != nil {
			results, err := s.instrumentRepo.SearchLocalInstruments(ctx, symbol, repository.InstrumentSearchFilter{Limit: 5})
			if err == nil {
				for _, row := range results {
					if strings.EqualFold(row.Instrument.Symbol, symbol) || strings.EqualFold(row.Instrument.Symbol, baseSym) {
						if row.Instrument.ImageURL != nil && *row.Instrument.ImageURL != "" {
							urls = append(urls, *row.Instrument.ImageURL)
						}
						if row.Instrument.Website != nil && *row.Instrument.Website != "" {
							domain := extractDomain(*row.Instrument.Website)
							if domain != "" {
								urls = append(urls,
									fmt.Sprintf("https://logo.clearbit.com/%s", domain),
									fmt.Sprintf("https://www.google.com/s2/favicons?domain=%s&sz=128", domain),
								)
							}
						}
						break
					}
				}
			}
		}

		// Priority 5: Fallback domain guess for major symbols
		urls = append(urls,
			fmt.Sprintf("https://logo.clearbit.com/%s.com", strings.ToLower(baseSym)),
			fmt.Sprintf("https://www.google.com/s2/favicons?domain=%s.com&sz=128", strings.ToLower(baseSym)),
		)
	}

	return urls
}

func extractDomain(rawURL string) string {
	u := strings.TrimSpace(rawURL)
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "https://" + u
	}
	parsed, err := url.Parse(u)
	if err != nil {
		return ""
	}
	host := parsed.Hostname()
	host = strings.TrimPrefix(host, "www.")
	return host
}

func (s *service) fetchAndValidateImage(ctx context.Context, imgURL string) ([]byte, string, error) {
	parsedURL, err := url.Parse(imgURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return nil, "", errors.New("invalid url")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imgURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "SigmaFinance/1.0 (AssetLogoFetcher)")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("status code %d", resp.StatusCode)
	}

	limited := io.LimitReader(resp.Body, MaxLogoSizeBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, "", err
	}
	if len(data) == 0 {
		return nil, "", errors.New("empty response body")
	}
	if len(data) > MaxLogoSizeBytes {
		return nil, "", errors.New("image exceeds max size limit")
	}

	// Detect MIME type
	mimeType := http.DetectContentType(data)
	if strings.HasPrefix(mimeType, "text/xml") || strings.HasPrefix(mimeType, "text/plain") {
		// Check if it's SVG
		trimmed := strings.TrimSpace(string(data[:min(len(data), 512)]))
		if strings.Contains(trimmed, "<svg") {
			mimeType = "image/svg+xml"
		}
	}

	// Validate that it is a supported image
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, "", fmt.Errorf("unsupported content type: %s", mimeType)
	}

	return data, mimeType, nil
}

func (s *service) saveToDiskCache(assetType, symbol string, data []byte, mimeType string) {
	normType := strings.ToLower(strings.TrimSpace(assetType))
	if normType == "fund" {
		normType = "stocks"
	}
	if normType != "crypto" && normType != "stocks" {
		normType = "stocks"
	}

	safeID := sanitizeIdentifier(symbol)
	if safeID == "" {
		return
	}

	ext := ".png"
	switch {
	case strings.Contains(mimeType, "svg"):
		ext = ".svg"
	case strings.Contains(mimeType, "webp"):
		ext = ".webp"
	case strings.Contains(mimeType, "jpeg") || strings.Contains(mimeType, "jpg"):
		ext = ".jpg"
	case strings.Contains(mimeType, "icon") || strings.Contains(mimeType, "ico"):
		ext = ".ico"
	}

	targetDir := filepath.Join(s.storageDir, normType)
	_ = os.MkdirAll(targetDir, 0755)
	targetPath := filepath.Join(targetDir, safeID+ext)
	tmpPath := targetPath + ".tmp"

	if err := os.WriteFile(tmpPath, data, 0644); err == nil {
		_ = os.Rename(tmpPath, targetPath)
	}
}
