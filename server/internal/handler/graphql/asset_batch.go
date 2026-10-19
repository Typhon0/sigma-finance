package graphql

import (
	"context"
	"log"
	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"

	"github.com/uptrace/bun"
)

// getAssetsWithDetailsBatch batches queries for all assets to avoid N+1
func (r *Resolver) getAssetsWithDetailsBatch(ctx context.Context, assetIDs []string) (map[string]gqlModel.Asset, error) {
	if len(assetIDs) == 0 {
		return map[string]gqlModel.Asset{}, nil
	}

	// 1. Fetch base assets
	assets, err := r.UOW.Asset().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("id IN (?)", bun.In(assetIDs))
	})
	if err != nil {
		return nil, err
	}

	// Group by type for specific table fetches
	stockIDs := []string{}
	cryptoIDs := []string{}
	fundIDs := []string{}

	for _, a := range assets {
		switch a.Type {
		case "STOCK":
			stockIDs = append(stockIDs, a.ID)
		case "CRYPTO":
			cryptoIDs = append(cryptoIDs, a.ID)
		case "FUND":
			fundIDs = append(fundIDs, a.ID)
		}
	}

	// 2. Fetch specific details
	stocks := make(map[string]model.Stock)
	if len(stockIDs) > 0 {
		st, stockErr := r.UOW.Stock().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("asset_id IN (?)", bun.In(stockIDs))
		})
		if stockErr != nil {
			log.Printf("[ERROR] [getAssetsWithDetailsBatch] Stock.FindAllBy failed for %d stocks: %v", len(stockIDs), stockErr)
		}
		for _, s := range st {
			stocks[s.AssetID] = s
		}
	}

	cryptos := make(map[string]model.Crypto)
	if len(cryptoIDs) > 0 {
		cr, cryptoErr := r.UOW.Crypto().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("asset_id IN (?)", bun.In(cryptoIDs))
		})
		if cryptoErr != nil {
			log.Printf("[ERROR] [getAssetsWithDetailsBatch] Crypto.FindAllBy failed for %d cryptos: %v", len(cryptoIDs), cryptoErr)
		}
		for _, c := range cr {
			cryptos[c.AssetID] = c
		}
	}

	funds := make(map[string]model.Fund)
	if len(fundIDs) > 0 {
		fu, fundErr := r.UOW.Fund().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("asset_id IN (?)", bun.In(fundIDs))
		})
		if fundErr != nil {
			log.Printf("[ERROR] [getAssetsWithDetailsBatch] Fund.FindAllBy failed for %d funds: %v", len(fundIDs), fundErr)
		}
		for _, f := range fu {
			funds[f.AssetID] = f
		}
	}

	// 3. Fetch latest prices and price statistics in batch
	latestPrices, priceErr := r.UOW.AssetPrice().GetLatestPrices(ctx, assetIDs)
	if priceErr != nil {
		log.Printf("[ERROR] [getAssetsWithDetailsBatch] GetLatestPrices failed for %d assets: %v", len(assetIDs), priceErr)
	}
	priceMap := make(map[string]model.AssetPrice)
	for _, p := range latestPrices {
		priceMap[p.AssetID] = p
	}
	if len(priceMap) == 0 && len(assetIDs) > 0 {
		log.Printf("[WARN] [getAssetsWithDetailsBatch] WARNING: No prices found in asset_prices for %d assets (priceErr=%v)", len(assetIDs), priceErr)
	} else if len(assetIDs) > 0 {
		log.Printf("[INFO] [getAssetsWithDetailsBatch] Loaded %d prices for %d assets", len(priceMap), len(assetIDs))
	}

	// 4. Load the instruments these assets track, in one query.
	//
	// TER, dividend yield and P/E are instrument-level facts. Fetching them
	// per asset would make every portfolio page an N+1, and the alternative -
	// leaving them to the client - is what produced the hardcoded ETF expense
	// ratio table. Assets with no instrument (manual holdings) are simply
	// absent from the map.
	instrumentIDs := make([]string, 0, len(assets))
	for _, a := range assets {
		if a.InstrumentID != nil && *a.InstrumentID != "" {
			instrumentIDs = append(instrumentIDs, *a.InstrumentID)
		}
	}
	instruments := map[string]model.Instrument{}
	if len(instrumentIDs) > 0 {
		found, instrumentErr := r.UOW.Instrument().FindByIDs(ctx, instrumentIDs)
		if instrumentErr != nil {
			// Non-fatal: reference metrics are supplementary, and failing the
			// whole batch would blank out the holdings a user came to look at.
			log.Printf("[ERROR] [getAssetsWithDetailsBatch] Instrument.FindByIDs failed for %d instruments: %v", len(instrumentIDs), instrumentErr)
		} else {
			instruments = found
		}
	}

	// 5. Batch fetch price statistics for all tradeable assets
	tradeableAssetIDs := []string{}
	for _, a := range assets {
		if a.Type.IsTradeable() {
			tradeableAssetIDs = append(tradeableAssetIDs, a.ID)
		}
	}
	var statsMap map[string]*repository.PriceStatistics
	if len(tradeableAssetIDs) > 0 {
		var statsErr error
		statsMap, statsErr = r.UOW.AssetPrice().GetPriceStatisticsBatch(ctx, tradeableAssetIDs)
		if statsErr != nil {
			log.Printf("[ERROR] [getAssetsWithDetailsBatch] GetPriceStatisticsBatch failed for %d assets: %v", len(tradeableAssetIDs), statsErr)
		}
	}

	// Build map
	result := make(map[string]gqlModel.Asset)
	for _, a := range assets {
		var currentValue *float64
		if lp, ok := priceMap[a.ID]; ok {
			cv, _ := lp.Price.Float64()
			currentValue = &cv
		}

		// (Tags are skipped in this batch for simplicity but would be added here if critical)
		// We use empty slices for tags in batch context to optimize perf.
		tags := []model.Tag{}
		var dayChange, dayChangePercent *float64
		if stats, ok := statsMap[a.ID]; ok && stats != nil {
			dc, _ := stats.Change.Float64()
			dcp, _ := stats.ChangePercent.Float64()
			dayChange = &dc
			dayChangePercent = &dcp
		}

		switch a.Type {
		case "STOCK":
			var detailsPtr *model.Stock
			if details, ok := stocks[a.ID]; ok {
				detailsPtr = &details
			}
			result[a.ID] = mapStockToGQL(a, detailsPtr, tags, dayChange, dayChangePercent, currentValue, instrumentFor(a, instruments))
		case "CRYPTO":
			var detailsPtr *model.Crypto
			if details, ok := cryptos[a.ID]; ok {
				detailsPtr = &details
			}
			result[a.ID] = mapCryptoToGQL(a, detailsPtr, tags, dayChange, dayChangePercent, currentValue)
		case "FUND":
			var detailsPtr *model.Fund
			if details, ok := funds[a.ID]; ok {
				detailsPtr = &details
			}
			result[a.ID] = mapFundToGQL(a, detailsPtr, tags, dayChange, dayChangePercent, currentValue, instrumentFor(a, instruments))
		case "BANK_ACCOUNT":
			result[a.ID] = mapBankAccountToGQL(a, tags, dayChange, dayChangePercent, currentValue)
		case "REAL_ESTATE":
			result[a.ID] = mapRealEstateToGQL(a, tags, dayChange, dayChangePercent, currentValue)
		case "LIFE_INSURANCE":
			result[a.ID] = mapLifeInsuranceToGQL(a, tags, dayChange, dayChangePercent, currentValue)
		case "WATCH":
			result[a.ID] = mapWatchToGQL(a, tags, dayChange, dayChangePercent, currentValue)
		case "LOAN":
			result[a.ID] = mapLoanToGQL(a, tags, dayChange, dayChangePercent, currentValue)
		}
	}

	return result, nil
}
