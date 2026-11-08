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

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// getAssetWithDetails is a helper method to get asset with type-specific details
// loadInstrumentForAsset resolves the instrument an asset tracks, which is
// where the reference metrics (expense ratio, dividend yield, P/E) live.
//
// Returns nil without logging when there is no instrument - a manually entered
// holding has none, and that is normal, not a failure. A genuine lookup error
// is logged and also degrades to nil: the metrics are supplementary, and
// failing here would blank out a holding the user came to look at.
func (r *Resolver) loadInstrumentForAsset(ctx context.Context, asset *model.Asset) *model.Instrument {
	if asset == nil || asset.InstrumentID == nil || *asset.InstrumentID == "" {
		return nil
	}
	instrument, err := r.UOW.Instrument().GetByID(ctx, *asset.InstrumentID)
	if err != nil {
		if !errors.Is(err, repository.ErrNotFound) {
			log.Printf("[ERROR] [loadInstrumentForAsset] Instrument.GetByID failed for instrument %s: %v", *asset.InstrumentID, err)
		}
		return nil
	}
	return instrument
}

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
	instrument := r.loadInstrumentForAsset(ctx, asset)

	switch asset.Type {
	case "STOCK":
		stockDetails, stockErr := r.UOW.Stock().GetByID(ctx, asset.ID)
		if stockErr != nil {
			log.Printf("[ERROR] [getAssetWithDetails] Stock.GetByID failed for asset %s: %v", asset.ID, stockErr)
		}
		return mapStockToGQL(*asset, stockDetails, tags, dayChange, dayChangePercent, currentValue, instrument), nil

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
		return mapFundToGQL(*asset, fundDetails, tags, dayChange, dayChangePercent, currentValue, instrument), nil

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
	displayValueByPositionID := make(map[string]float64)
	quoteCurrencyByPositionID := make(map[string]model.Currency)
	analytics, analyticsErr := r.safeGetPortfolioAnalytics(ctx, portfolioID, displayCurrency)
	if analyticsErr == nil && analytics != nil {
		for _, pv := range analytics.PositionValuations {
			if pv.PositionID != "" {
				if pv.QuoteCurrency.IsValid() {
					quoteCurrencyByPositionID[pv.PositionID] = pv.QuoteCurrency
				}
				if pv.HasDisplayValue {
					displayValueByPositionID[pv.PositionID] = float64(pv.DisplayValue) / 100.0
				}
			}
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

	// Look up positions for this portfolio to resolve per-position account information
	positionsByAssetID := make(map[string][]model.Position)
	if r.UOW != nil {
		func() {
			defer func() { _ = recover() }()
			if posRepo := r.UOW.Position(); posRepo != nil {
				if positions, err := posRepo.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
					return q.Where("position.portfolio_id = ?", portfolioID).Relation("Account")
				}); err == nil {
					for _, pos := range positions {
						if pos.AssetID != "" {
							positionsByAssetID[pos.AssetID] = append(positionsByAssetID[pos.AssetID], pos)
						}
					}
				} else {
					log.Printf("[WARN] buildPortfolioAssets: failed to fetch positions with accounts: %v", err)
				}
			}
		}()
	}

	// Self-healing: if an asset has active positions in `positions` but is missing from `portfolio_asset`
	// (e.g. cache desync or after whole-asset removal), synthesize the holding so active holdings never vanish.
	knownAssetIDs := make(map[string]bool)
	for _, domPa := range pa {
		knownAssetIDs[domPa.AssetID] = true
	}
	for assetID, pList := range positionsByAssetID {
		if !knownAssetIDs[assetID] {
			hasActive := false
			totalQty := decimal.Zero
			var totalCost decimal.Decimal
			for _, p := range pList {
				if p.Quantity.GreaterThan(decimal.Zero) {
					hasActive = true
					totalQty = totalQty.Add(p.Quantity)
					if p.AverageCostBasis != nil {
						totalCost = totalCost.Add(p.Quantity.Mul(*p.AverageCostBasis))
					}
				}
			}
			if hasActive {
				q, _ := totalQty.Float64()
				var avgPrice float64
				if totalCost.GreaterThan(decimal.Zero) && totalQty.GreaterThan(decimal.Zero) {
					avg, _ := totalCost.Div(totalQty).Float64()
					avgPrice = avg
				}
				qc := model.CurrencyUSD
				if len(pList) > 0 && pList[0].QuoteCurrency.IsValid() {
					qc = pList[0].QuoteCurrency
				}
				syntheticPa := model.PortfolioAsset{
					PortfolioID:          portfolioID,
					AssetID:              assetID,
					Quantity:             q,
					AveragePurchasePrice: avgPrice,
					QuoteCurrency:        qc,
				}
				pa = append(pa, syntheticPa)
				knownAssetIDs[assetID] = true
				assetIDs = append(assetIDs, assetID)
			}
		}
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

		assetPositions := positionsByAssetID[domPa.AssetID]
		var activePositions []model.Position
		for _, pos := range assetPositions {
			if pos.Quantity.GreaterThan(decimal.Zero) {
				activePositions = append(activePositions, pos)
			}
		}

		// When positions exist in accounts, emit one entry per account holding so multi-account
		// portfolios show accurate breakdowns per account rather than merging them.
		if len(activePositions) > 0 {
			for _, pos := range activePositions {
				posQty, _ := pos.Quantity.Float64()
				avgPP := domPa.AveragePurchasePrice
				if pos.AverageCostBasis != nil {
					if cb, _ := pos.AverageCostBasis.Float64(); cb > 0 {
						avgPP = cb
					}
				}

				var currentVal *float64
				if convertedDisplayValue, ok := displayValueByPositionID[pos.ID]; ok {
					v := convertedDisplayValue
					currentVal = &v
				} else if cv := gqlAsset.GetCurrentValue(); cv != nil {
					quoteCurrency := pos.QuoteCurrency
					if !quoteCurrency.IsValid() {
						if inferred, ok := quoteCurrencyByPositionID[pos.ID]; ok && inferred.IsValid() {
							quoteCurrency = inferred
						} else {
							quoteCurrency = domPa.QuoteCurrency
						}
					}
					if !quoteCurrency.IsValid() || quoteCurrency == displayCurrency {
						v := posQty * (*cv)
						currentVal = &v
					}
				}

				quoteCurrencyStr := pos.QuoteCurrency.String()
				if quoteCurrencyStr == "" {
					quoteCurrencyStr = domPa.QuoteCurrency.String()
				}

				var accName *string
				var accID *string
				if pos.Account != nil && pos.Account.Name != "" {
					an := pos.Account.Name
					accName = &an
					ai := pos.AccountID
					accID = &ai
				}

				itemAsset := gqlAsset
				if c, ok := itemAsset.(*gqlModel.Crypto); ok {
					if accName != nil && *accName != "" && (c.Exchange == nil || *c.Exchange == "") {
						copyCrypto := *c
						copyCrypto.Exchange = accName
						itemAsset = &copyCrypto
					}
				}

				posID := pos.ID
				assets = append(assets, &gqlModel.PortfolioAsset{
					Asset:                itemAsset,
					InstrumentID:         domPa.InstrumentID,
					Quantity:             posQty,
					AveragePurchasePrice: &avgPP,
					CurrentValue:         currentVal,
					DayChange:            itemAsset.GetDayChange(),
					DayChangePercent:     itemAsset.GetDayChangePercent(),
					QuoteCurrency:        &quoteCurrencyStr,
					AccountName:          accName,
					AccountID:            accID,
					PositionID:           &posID,
				})
			}
		} else {
			if c, ok := gqlAsset.(*gqlModel.Crypto); ok {
				if len(assetPositions) > 0 && assetPositions[0].Account != nil && assetPositions[0].Account.Name != "" && (c.Exchange == nil || *c.Exchange == "") {
					copyCrypto := *c
					an := assetPositions[0].Account.Name
					copyCrypto.Exchange = &an
					gqlAsset = &copyCrypto
				}
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
			var accName *string
			var accID *string
			var posID *string
			if len(assetPositions) > 0 && assetPositions[0].Account != nil && assetPositions[0].Account.Name != "" {
				an := assetPositions[0].Account.Name
				accName = &an
				ai := assetPositions[0].AccountID
				accID = &ai
				pID := assetPositions[0].ID
				posID = &pID
			}

			assets = append(assets, &gqlModel.PortfolioAsset{
				Asset:                gqlAsset,
				InstrumentID:         domPa.InstrumentID,
				Quantity:             domPa.Quantity,
				AveragePurchasePrice: &avgPP,
				CurrentValue:         currentVal,
				DayChange:            gqlAsset.GetDayChange(),
				DayChangePercent:     gqlAsset.GetDayChangePercent(),
				QuoteCurrency:        &quoteCurrencyStr,
				AccountName:          accName,
				AccountID:            accID,
				PositionID:           posID,
			})
		}
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

	// 1. Collect unique position IDs and account IDs
	positionIDMap := make(map[string]struct{})
	accountIDMap := make(map[string]struct{})
	for _, tx := range txs {
		if tx == nil {
			continue
		}
		if tx.PositionID != nil && strings.TrimSpace(*tx.PositionID) != "" {
			positionIDMap[strings.TrimSpace(*tx.PositionID)] = struct{}{}
		}
		if tx.AccountID != nil && strings.TrimSpace(*tx.AccountID) != "" {
			accountIDMap[strings.TrimSpace(*tx.AccountID)] = struct{}{}
		}
	}

	if len(positionIDMap) == 0 && len(accountIDMap) == 0 {
		return []*gqlModel.Transaction{}
	}

	posMap := make(map[string]model.Position)
	assetIDMap := make(map[string]struct{})
	portfolioIDMap := make(map[string]struct{})

	// 2. Batch fetch positions
	if len(positionIDMap) > 0 {
		positionIDs := make([]string, 0, len(positionIDMap))
		for id := range positionIDMap {
			positionIDs = append(positionIDs, id)
		}
		positions, err := r.UOW.Position().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("id IN (?)", bun.In(positionIDs))
		})
		if err != nil {
			log.Printf("[ERROR] buildGraphQLTransactionsBatch: position batch lookup failed: %v", err)
		} else {
			for _, pos := range positions {
				posMap[pos.ID] = pos
				if strings.TrimSpace(pos.AssetID) != "" {
					assetIDMap[strings.TrimSpace(pos.AssetID)] = struct{}{}
				}
				if strings.TrimSpace(pos.PortfolioID) != "" {
					portfolioIDMap[strings.TrimSpace(pos.PortfolioID)] = struct{}{}
				}
			}
		}
	}

	// 3. Batch fetch accounts
	accountMap := make(map[string]model.Account)
	if len(accountIDMap) > 0 {
		accountIDs := make([]string, 0, len(accountIDMap))
		for id := range accountIDMap {
			accountIDs = append(accountIDs, id)
		}
		accounts, err := r.UOW.Account().FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("id IN (?)", bun.In(accountIDs))
		})
		if err != nil {
			log.Printf("[ERROR] buildGraphQLTransactionsBatch: account batch lookup failed: %v", err)
		} else {
			for _, acc := range accounts {
				accountMap[acc.ID] = acc
				if strings.TrimSpace(acc.PortfolioID) != "" {
					portfolioIDMap[strings.TrimSpace(acc.PortfolioID)] = struct{}{}
				}
			}
		}
	}

	// 4. Batch fetch assets with details (using optimized getAssetsWithDetailsBatch)
	prefetchedAssets := make(map[string]gqlModel.Asset)
	if len(assetIDMap) > 0 {
		assetIDs := make([]string, 0, len(assetIDMap))
		for id := range assetIDMap {
			assetIDs = append(assetIDs, id)
		}
		var batchErr error
		prefetchedAssets, batchErr = r.getAssetsWithDetailsBatch(ctx, assetIDs)
		if batchErr != nil {
			log.Printf("[ERROR] buildGraphQLTransactionsBatch: asset batch lookup failed: %v", batchErr)
			prefetchedAssets = make(map[string]gqlModel.Asset)
		}
	}

	// 5. Batch fetch portfolios
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

	// 6. Map all transactions in memory
	res := make([]*gqlModel.Transaction, 0, len(txs))
	for _, tx := range txs {
		if tx == nil {
			continue
		}
		mapped := mapTransactionToGQL(*tx)

		// Attach account if present
		if tx.AccountID != nil {
			if acc, ok := accountMap[*tx.AccountID]; ok {
				mapped.Account = mapAccountToGQL(acc)
			}
		}

		// Attach position & asset if present
		var portfolioID string
		if tx.PositionID != nil {
			posID := strings.TrimSpace(*tx.PositionID)
			if pos, posFound := posMap[posID]; posFound {
				portfolioID = pos.PortfolioID
				if gqlAsset, assetFound := prefetchedAssets[pos.AssetID]; assetFound {
					mapped.Asset = gqlAsset
				}
			}
		}

		// If no position portfolio, use account portfolio
		if portfolioID == "" && tx.AccountID != nil {
			if acc, ok := accountMap[*tx.AccountID]; ok {
				portfolioID = acc.PortfolioID
			}
		}

		// Assign portfolio (required by GraphQL schema)
		if port, portFound := portfolioMap[portfolioID]; portFound {
			mapped.Portfolio = mapPortfolioToGQL(port)
		} else {
			// Fallback placeholder portfolio
			mapped.Portfolio = &gqlModel.Portfolio{
				ID:   portfolioID,
				Name: "Portfolio",
			}
		}

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
