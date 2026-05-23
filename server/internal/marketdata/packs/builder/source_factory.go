package builder

import (
	"fmt"
	"os"
	"strings"

	"sigma_finance/internal/marketdata/packs/sources"
	binancesource "sigma_finance/internal/marketdata/packs/sources/binance"
	ecbsource "sigma_finance/internal/marketdata/packs/sources/ecb"
)

func newSourceForProvider(provider string, baseURL string) (sources.CandleSource, error) {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case binancesource.SourceName:
		return binancesource.NewSource(binancesource.Config{
			BaseURL:             strings.TrimSpace(baseURL),
			CoinMarketCapAPIKey: strings.TrimSpace(os.Getenv("CMC_API_KEY")),
		}), nil
	case ecbsource.SourceName:
		return ecbsource.NewSource(ecbsource.Config{
			BaseURL: strings.TrimSpace(baseURL),
		}), nil
	default:
		return nil, fmt.Errorf("unsupported source_provider=%s", strings.TrimSpace(provider))
	}
}

