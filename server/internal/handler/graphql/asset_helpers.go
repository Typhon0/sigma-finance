package graphql

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/uptrace/bun"
)

// getAssetWithDetails is a helper method to get asset with type-specific details
func (r *Resolver) getAssetWithDetails(ctx context.Context, assetID string) (gqlModel.Asset, error) {
	// Get base asset
	asset, err := r.AssetService.GetAsset(ctx, assetID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil // GraphQL convention: return nil for not found
		}
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	// Get tags (non-fatal: continue with empty tags on error)
	tags, tagErr := r.TagService.GetAssetTags(ctx, asset.ID)
	if tagErr != nil {
		log.Printf("[ERROR] [getAssetWithDetails] TagService.GetAssetTags failed for asset %s: %v", asset.ID, tagErr)
	}

	// Fetch latest price for CurrentValue
	var currentValue *float64
	latestPrice, err := r.UOW.AssetPrice().GetLatestPrice(ctx, asset.ID)
	if err == nil && latestPrice != nil {
		cv, _ := latestPrice.Price.Float64()
		currentValue = &cv
	}

	// Compute day change for tradeable assets
	var dayChange, dayChangePercent *float64
	if asset.IsTradeable {
		stats, err := r.UOW.AssetPrice().GetPriceStatistics(ctx, asset.ID)
		if err == nil && stats != nil {
			dc, _ := stats.Change.Float64()
			dcp, _ := stats.ChangePercent.Float64()
			dayChange = &dc
			dayChangePercent = &dcp
		}
	}

	// Determine asset type and return appropriate concrete type
	switch asset.Type {
	case "STOCK":
		stockDetails, stockErr := r.UOW.Stock().GetByID(ctx, asset.ID)
		if stockErr != nil {
			log.Printf("[ERROR] [getAssetWithDetails] Stock.GetByID failed for asset %s: %v", asset.ID, stockErr)
		}
		return mapStockToGQL(*asset, stockDetails, tags, dayChange, dayChangePercent, currentValue), nil

	case "CRYPTO":
		cryptoDetails, cryptoErr := r.UOW.Crypto().GetByID(ctx, asset.ID)
		if cryptoErr != nil {
			log.Printf("[ERROR] [getAssetWithDetails] Crypto.GetByID failed for asset %s: %v", asset.ID, cryptoErr)
		}
		return mapCryptoToGQL(*asset, cryptoDetails, tags, dayChange, dayChangePercent, currentValue), nil

	case "FUND":
		fundDetails, fundErr := r.UOW.Fund().GetByID(ctx, asset.ID)
		if fundErr != nil {
			log.Printf("[ERROR] [getAssetWithDetails] Fund.GetByID failed for asset %s: %v", asset.ID, fundErr)
		}
		return mapFundToGQL(*asset, fundDetails, tags, dayChange, dayChangePercent, currentValue), nil

	case "BANK_ACCOUNT":
		return mapBankAccountToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "REAL_ESTATE":
		return mapRealEstateToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "LIFE_INSURANCE":
		return mapLifeInsuranceToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "WATCH":
		return mapWatchToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "LOAN":
		return mapLoanToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	default:
		// Unsupported asset type: return nil without error so callers can skip gracefully
		return nil, nil
	}
}

// buildPortfolioAssets resolves all assets for a portfolio, skipping any whose
// details cannot be loaded. This prevents a nil Asset from violating the
// GraphQL schema's `asset: Asset!` (non-null) constraint, which would
// cascade-null the entire portfolios response.
func (r *Resolver) buildPortfolioAssets(ctx context.Context, portfolioID string) []*gqlModel.PortfolioAsset {
	pa, err := r.PortfolioService.GetPortfolioAssets(ctx, portfolioID)
	if err != nil || len(pa) == 0 {
		return nil
	}

	displayCurrency, displayCurrencyErr := r.getDisplayCurrencyFromContext(ctx)
	if displayCurrencyErr != nil || !displayCurrency.IsValid() {
		displayCurrency = model.CurrencyUSD
	}

	displayValueByAssetID := make(map[string]float64)
	quoteCurrencyByAssetID := make(map[string]model.Currency)
	analytics, analyticsErr := r.safeGetPortfolioAnalytics(ctx, portfolioID, displayCurrency)
	if analyticsErr == nil && analytics != nil {
		for _, pv := range analytics.PositionValuations {
			if pv.QuoteCurrency.IsValid() {
				quoteCurrencyByAssetID[pv.AssetID] = pv.QuoteCurrency
			}
			if !pv.HasDisplayValue {
				continue
			}
			displayValueByAssetID[pv.AssetID] += float64(pv.DisplayValue) / 100.0
		}
	}

	var assetIDs []string
	for _, domPa := range pa {
		assetIDs = append(assetIDs, domPa.AssetID)
	}

	prefetchedAssets, batchErr := r.getAssetsWithDetailsBatch(ctx, assetIDs)
	if batchErr != nil {
		log.Printf("[ERROR] buildPortfolioAssets: batch fetch failed for portfolio %s: %v", portfolioID, batchErr)
		// Fallback to empty map on error to let loop skip gracefully
		prefetchedAssets = make(map[string]gqlModel.Asset)
	}

	var assets []*gqlModel.PortfolioAsset
	for _, domPa := range pa {
		gqlAsset, ok := prefetchedAssets[domPa.AssetID]
		if !ok || gqlAsset == nil {
			log.Printf("[WARN] buildPortfolioAssets: skipping asset %s in portfolio %s: not found in batch", domPa.AssetID, portfolioID)
			continue
		}
		avgPP := domPa.AveragePurchasePrice
		var currentVal *float64
		if convertedDisplayValue, ok := displayValueByAssetID[domPa.AssetID]; ok {
			v := convertedDisplayValue
			currentVal = &v
		} else if cv := gqlAsset.GetCurrentValue(); cv != nil {
			quoteCurrency := domPa.QuoteCurrency
			if !quoteCurrency.IsValid() {
				if inferred, ok := quoteCurrencyByAssetID[domPa.AssetID]; ok && inferred.IsValid() {
					quoteCurrency = inferred
				}
			}
			// Only fall back to raw quote value if it is already in display currency.
			// This avoids showing USD values with a EUR symbol when FX conversion is unavailable.
			if !quoteCurrency.IsValid() || quoteCurrency == displayCurrency {
				v := domPa.Quantity * (*cv)
				currentVal = &v
			}
		}
		quoteCurrencyStr := domPa.QuoteCurrency.String()
		assets = append(assets, &gqlModel.PortfolioAsset{
			Asset:                gqlAsset,
			InstrumentID:         domPa.InstrumentID,
			Quantity:             domPa.Quantity,
			AveragePurchasePrice: &avgPP,
			CurrentValue:         currentVal,
			DayChange:            gqlAsset.GetDayChange(),
			DayChangePercent:     gqlAsset.GetDayChangePercent(),
			QuoteCurrency:        &quoteCurrencyStr,
		})
	}
	return assets
}

func (r *Resolver) safeGetPortfolioAnalytics(ctx context.Context, portfolioID string, displayCurrency model.Currency) (analytics *service.PortfolioValuation, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			analytics = nil
			err = fmt.Errorf("portfolio analytics unavailable: %v", recovered)
		}
	}()

	return r.PortfolioService.GetPortfolioAnalytics(ctx, portfolioID, displayCurrency)
}

func (r *Resolver) buildGraphQLTransactionsBatch(ctx context.Context, txs []*model.Transaction) []*gqlModel.Transaction {
	if len(txs) == 0 {
		return []*gqlModel.Transaction{}
	}

	// 1. Collect unique position IDs
	positionIDMap := make(map[string]struct{})
	for _, tx := range txs {
		if tx != nil && tx.PositionID != nil && strings.TrimSpace(*tx.PositionID) != "" {
			positionIDMap[strings.TrimSpace(*tx.PositionID)] = struct{}{}
		}
	}

	if len(positionIDMap) == 0 {
		return []*gqlModel.Transaction{}
	}

	positionIDs := make([]string, 0, len(positionIDMap))
	for id := range positionIDMap {
		positionIDs = append(positionIDs, id)
	}

	// 2. Batch fetch positions
	positions, err := r.UOW.Position().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("id IN (?)", bun.In(positionIDs))
	})
	if err != nil {
		log.Printf("[ERROR] buildGraphQLTransactionsBatch: position batch lookup failed: %v", err)
		return []*gqlModel.Transaction{}
	}

	posMap := make(map[string]model.Position, len(positions))
	assetIDMap := make(map[string]struct{})
	portfolioIDMap := make(map[string]struct{})
	for _, pos := range positions {
		posMap[pos.ID] = pos
		if strings.TrimSpace(pos.AssetID) != "" {
			assetIDMap[strings.TrimSpace(pos.AssetID)] = struct{}{}
		}
		if strings.TrimSpace(pos.PortfolioID) != "" {
			portfolioIDMap[strings.TrimSpace(pos.PortfolioID)] = struct{}{}
		}
	}

	// 3. Batch fetch assets with details (using optimized getAssetsWithDetailsBatch)
	assetIDs := make([]string, 0, len(assetIDMap))
	for id := range assetIDMap {
		assetIDs = append(assetIDs, id)
	}
	prefetchedAssets, batchErr := r.getAssetsWithDetailsBatch(ctx, assetIDs)
	if batchErr != nil {
		log.Printf("[ERROR] buildGraphQLTransactionsBatch: asset batch lookup failed: %v", batchErr)
		prefetchedAssets = make(map[string]gqlModel.Asset)
	}

	// 4. Batch fetch portfolios
	portfolioIDs := make([]string, 0, len(portfolioIDMap))
	for id := range portfolioIDMap {
		portfolioIDs = append(portfolioIDs, id)
	}
	portfolios, portErr := r.UOW.Portfolio().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("id IN (?)", bun.In(portfolioIDs))
	})
	if portErr != nil {
		log.Printf("[ERROR] buildGraphQLTransactionsBatch: portfolio batch lookup failed: %v", portErr)
		portfolios = []model.Portfolio{}
	}

	portfolioMap := make(map[string]model.Portfolio, len(portfolios))
	for _, port := range portfolios {
		portfolioMap[port.ID] = port
	}

	// 5. Map all transactions in memory
	res := make([]*gqlModel.Transaction, 0, len(txs))
	for _, tx := range txs {
		if tx == nil || tx.PositionID == nil {
			continue
		}
		posID := strings.TrimSpace(*tx.PositionID)
		pos, posFound := posMap[posID]
		if !posFound {
			continue
		}
		gqlAsset, assetFound := prefetchedAssets[pos.AssetID]
		if !assetFound || gqlAsset == nil {
			continue
		}
		port, portFound := portfolioMap[pos.PortfolioID]
		if !portFound {
			continue
		}

		mapped := mapTransactionToGQL(*tx)
		mapped.Asset = gqlAsset
		mapped.Portfolio = mapPortfolioToGQL(port)
		res = append(res, mapped)
	}

	return res
}

func (r *Resolver) buildGraphQLTransaction(ctx context.Context, tx *model.Transaction) *gqlModel.Transaction {
	if tx == nil {
		return nil
	}
	batch := r.buildGraphQLTransactionsBatch(ctx, []*model.Transaction{tx})
	if len(batch) > 0 {
		return batch[0]
	}
	return nil
}
