package graphql

import (
	"context"
	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"

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
		st, _ := r.UOW.Stock().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("asset_id IN (?)", bun.In(stockIDs))
		})
		for _, s := range st {
			stocks[s.AssetID] = s
		}
	}

	cryptos := make(map[string]model.Crypto)
	if len(cryptoIDs) > 0 {
		cr, _ := r.UOW.Crypto().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("asset_id IN (?)", bun.In(cryptoIDs))
		})
		for _, c := range cr {
			cryptos[c.AssetID] = c
		}
	}

	funds := make(map[string]model.Fund)
	if len(fundIDs) > 0 {
		fu, _ := r.UOW.Fund().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("asset_id IN (?)", bun.In(fundIDs))
		})
		for _, f := range fu {
			funds[f.AssetID] = f
		}
	}

	// 3. Fetch latest prices
	latestPrices, _ := r.UOW.AssetPrice().GetLatestPrices(ctx, assetIDs)
	priceMap := make(map[string]model.AssetPrice)
	for _, p := range latestPrices {
		priceMap[p.AssetID] = p
	}

	// Build map
	result := make(map[string]gqlModel.Asset)
	for _, a := range assets {
		var currentValue *float64
		if lp, ok := priceMap[a.ID]; ok {
			cv, _ := lp.Price.Float64()
			currentValue = &cv
		}

		// (Tags and DayChange stats are skipped in this batch for simplicity but would be added here if critical)
		// We use empty slices for tags in batch context to optimize perf.
		tags := []model.Tag{}
		var dayChange, dayChangePercent *float64

		switch a.Type {
		case "STOCK":
			var detailsPtr *model.Stock
			if details, ok := stocks[a.ID]; ok {
				detailsPtr = &details
			}
			result[a.ID] = mapStockToGQL(a, detailsPtr, tags, dayChange, dayChangePercent, currentValue)
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
			result[a.ID] = mapFundToGQL(a, detailsPtr, tags, dayChange, dayChangePercent, currentValue)
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
