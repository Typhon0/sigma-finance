package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/shopspring/decimal"
)

// ReconcileBalances reconciles cash balances under an account as AssetTypeBankAccount positions.
func ReconcileBalances(ctx context.Context, uow repository.IUnitOfWork, conn *model.SyncConnection, account *model.Account, balances []RawBalance) (int, int, error) {
	imported := 0
	updated := 0

	activeCashCurrencies := make(map[model.Currency]bool)

	for _, bal := range balances {
		if !bal.Currency.IsValid() {
			continue
		}
		activeCashCurrencies[bal.Currency] = true

		symbol := fmt.Sprintf("%s_CASH_%s", bal.Currency, account.ID)
		var asset *model.Asset
		existingAssets, err := uow.Asset().FindWithFilters(ctx, repository.AssetFilter{Symbol: &symbol})
		if err == nil && len(existingAssets) > 0 {
			asset = &existingAssets[0]
		}
		if asset == nil {
			metaBytes, _ := json.Marshal(map[string]interface{}{
				"account_id": account.ID,
				"currency":   string(bal.Currency),
				"is_cash":    true,
			})

			newAsset := &model.Asset{
				Symbol:      &symbol,
				Name:        fmt.Sprintf("%s Cash (%s)", conn.InstitutionName, bal.Currency),
				Type:        model.AssetTypeBankAccount,
				IsTradeable: false,
				Metadata:    metaBytes,
			}
			createdAsset, createErr := uow.Asset().Create(ctx, newAsset)
			if createErr != nil {
				return imported, updated, fmt.Errorf("failed to create cash asset: %w", createErr)
			}
			asset = createdAsset
			imported++
		}

		// Update latest asset price to reflect current balance
		_ = uow.AssetPrice().UpsertPrices(ctx, []model.AssetPrice{
			{
				AssetID:   asset.ID,
				Price:     bal.Amount,
				Timestamp: time.Now(),
				Source:    "sync",
			},
		})

		// Reconcile position
		pos, posErr := uow.Position().GetByAccountAndAsset(ctx, account.ID, asset.ID)
		cents := model.Money(bal.Amount.Mul(decimal.NewFromInt(100)).Round(0).IntPart())

		var avgCost *decimal.Decimal
		var totalCost *model.Money

		zeroCost := decimal.Zero
		zeroMoney := model.NewZeroMoney(bal.Currency)

		if bal.Amount.IsZero() {
			avgCost = nil
			totalCost = nil
		} else if bal.Amount.IsNegative() {
			avgCost = &zeroCost
			totalCost = &zeroMoney
		} else {
			avgCost = &bal.Amount
			totalCost = &cents
		}

		if posErr != nil || pos == nil {
			qty := decimal.NewFromInt(1)
			if bal.Amount.IsZero() {
				qty = decimal.Zero
			}
			newPos := &model.Position{
				PortfolioID:         conn.PortfolioID,
				AccountID:           account.ID,
				AssetID:             asset.ID,
				Quantity:            qty,
				OwnershipPercentage: decimal.NewFromInt(100),
				QuoteCurrency:       bal.Currency,
				AverageCostBasis:    avgCost,
				TotalCostBasis:      totalCost,
			}
			_, err = uow.Position().Create(ctx, newPos)
			if err != nil {
				return imported, updated, fmt.Errorf("failed to create cash position: %w", err)
			}
			imported++
		} else {
			if bal.Amount.IsZero() {
				pos.Quantity = decimal.Zero
			} else {
				pos.Quantity = decimal.NewFromInt(1)
			}
			pos.AverageCostBasis = avgCost
			pos.TotalCostBasis = totalCost
			pos.QuoteCurrency = bal.Currency
			if err := uow.Position().Update(ctx, pos); err != nil {
				return imported, updated, fmt.Errorf("failed to update cash position: %w", err)
			}
			updated++
		}
	}

	// Multi-Currency Cash Liquidation: reconcile missing cash currency positions
	existingPositions, err := uow.Position().GetPortfolioPositions(ctx, conn.PortfolioID)
	if err == nil {
		for _, pos := range existingPositions {
			if pos.AccountID != account.ID {
				continue
			}

			asset := pos.Asset
			if asset == nil {
				asset, _ = uow.Asset().GetByID(ctx, pos.AssetID)
			}
			if asset != nil && asset.Type == model.AssetTypeBankAccount {
				curr := pos.QuoteCurrency
				if curr == "" && asset.Symbol != nil {
					parts := strings.Split(*asset.Symbol, "_")
					if len(parts) > 0 {
						curr = model.Currency(parts[0])
					}
				}
				if !activeCashCurrencies[curr] && !pos.Quantity.IsZero() {
					pos.Quantity = decimal.Zero
					pos.AverageCostBasis = nil
					pos.TotalCostBasis = nil
					if err := uow.Position().Update(ctx, &pos); err != nil {
						return imported, updated, fmt.Errorf("failed to liquidate cash position: %w", err)
					}
					updated++
				}
			}
		}
	}

	return imported, updated, nil
}

// ReconcileHoldings reconciles stock/crypto holdings against the positions in the database.
func ReconcileHoldings(
	ctx context.Context,
	uow repository.IUnitOfWork,
	instrumentService service.InstrumentService,
	conn *model.SyncConnection,
	account *model.Account,
	holdings []RawHolding,
) (imported int, updated int, warnings []string, activeAssetIDs map[string]bool, err error) {
	activeAssetIDs = make(map[string]bool)

	// Defensively aggregate holdings by symbol to prevent separate lots from overwriting each other
	aggregatedHoldings := make(map[string]RawHolding)
	var holdingOrder []string
	for _, h := range holdings {
		sym := strings.ToUpper(strings.TrimSpace(h.Symbol))
		if existing, ok := aggregatedHoldings[sym]; ok {
			existing.Quantity = existing.Quantity.Add(h.Quantity)
			if h.TotalCostBasis != nil {
				if existing.TotalCostBasis != nil {
					total := *existing.TotalCostBasis + *h.TotalCostBasis
					existing.TotalCostBasis = &total
				} else {
					existing.TotalCostBasis = h.TotalCostBasis
				}
			}
			aggregatedHoldings[sym] = existing
		} else {
			aggregatedHoldings[sym] = h
			holdingOrder = append(holdingOrder, sym)
		}
	}

	for _, sym := range holdingOrder {
		h := aggregatedHoldings[sym]
		asset, isUnmapped, resolveErr := resolveOrCreateAsset(ctx, uow, instrumentService, h)
		if resolveErr != nil {
			return imported, updated, warnings, activeAssetIDs, fmt.Errorf("failed to resolve asset for %s: %w", h.Symbol, resolveErr)
		}

		activeAssetIDs[asset.ID] = true

		if isUnmapped {
			warn := fmt.Sprintf("Warning: unmatched instrument %s created as UNMAPPED placeholder", h.Symbol)
			log.Printf("[WARN] [SyncService] %s", warn)
			warnings = append(warnings, warn)
		}

		pos, posErr := uow.Position().GetByAccountAndAsset(ctx, account.ID, asset.ID)
		if posErr != nil || pos == nil {
			newPos := &model.Position{
				PortfolioID:         conn.PortfolioID,
				AccountID:           account.ID,
				AssetID:             asset.ID,
				Quantity:            h.Quantity,
				OwnershipPercentage: decimal.NewFromInt(100),
				QuoteCurrency:       h.Currency,
				AverageCostBasis:    h.CostBasisPerUnit,
				TotalCostBasis:      h.TotalCostBasis,
			}
			_, createErr := uow.Position().Create(ctx, newPos)
			if createErr != nil {
				return imported, updated, warnings, activeAssetIDs, fmt.Errorf("failed to create position for %s: %w", h.Symbol, createErr)
			}
			imported++
		} else {
			pos.Quantity = h.Quantity
			if h.CostBasisPerUnit != nil {
				pos.AverageCostBasis = h.CostBasisPerUnit
			}
			if h.TotalCostBasis != nil {
				pos.TotalCostBasis = h.TotalCostBasis
			}
			if h.Currency.IsValid() {
				pos.QuoteCurrency = h.Currency
			}
			if updateErr := uow.Position().Update(ctx, pos); updateErr != nil {
				return imported, updated, warnings, activeAssetIDs, fmt.Errorf("failed to update position for %s: %w", h.Symbol, updateErr)
			}
			updated++
		}

		// Keep portfolio_asset synchronized with holding quantities
		syncPortfolioAssetForHolding(ctx, uow, conn.PortfolioID, asset, h.Quantity, h.CostBasisPerUnit, h.Currency)

		// Trigger historical backfill asynchronously if asset has an instrument
		if instrumentService != nil && asset.InstrumentID != nil && *asset.InstrumentID != "" {
			backfillFrom := time.Now().UTC().AddDate(-5, 0, 0)
			var uid *string
			if conn.UserID != "" {
				uid = &conn.UserID
			}
			go func(pID, aID, instID string, from time.Time, u *string) {
				bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()
				_, _ = instrumentService.EnqueueHistoricalBackfillJob(bgCtx, pID, aID, instID, from, u)
			}(conn.PortfolioID, asset.ID, *asset.InstrumentID, backfillFrom, uid)
		}
	}

	return imported, updated, warnings, activeAssetIDs, nil
}

func syncPortfolioAssetForHolding(ctx context.Context, uow repository.IUnitOfWork, portfolioID string, asset *model.Asset, fallbackQuantity decimal.Decimal, fallbackCostBasis *decimal.Decimal, fallbackCurrency model.Currency) {
	if uow == nil {
		return
	}
	defer func() {
		// Guard against mock UOWs in unit tests that do not implement PortfolioAsset
		_ = recover()
	}()

	paRepo := uow.PortfolioAsset()
	if paRepo == nil {
		return
	}

	totalQty := decimal.Zero
	var totalCost decimal.Decimal
	hasPositions := false

	if posRepo := uow.Position(); posRepo != nil {
		positions, err := posRepo.GetPortfolioPositions(ctx, portfolioID)
		if err == nil {
			for _, p := range positions {
				if p.AssetID == asset.ID && p.Quantity.GreaterThan(decimal.Zero) {
					hasPositions = true
					totalQty = totalQty.Add(p.Quantity)
					if p.AverageCostBasis != nil {
						totalCost = totalCost.Add(p.Quantity.Mul(*p.AverageCostBasis))
					}
				}
			}
		}
	}

	if !hasPositions {
		totalQty = fallbackQuantity
		if fallbackCostBasis != nil {
			totalCost = fallbackQuantity.Mul(*fallbackCostBasis)
		}
	}

	q, _ := totalQty.Float64()
	var avgPrice float64
	if !totalQty.IsZero() && totalCost.GreaterThan(decimal.Zero) {
		avg, _ := totalCost.Div(totalQty).Float64()
		avgPrice = avg
	} else if fallbackCostBasis != nil {
		avgPrice, _ = fallbackCostBasis.Float64()
	}

	currency := fallbackCurrency
	if !currency.IsValid() {
		currency = model.CurrencyUSD
	}

	pa, err := paRepo.FindByPortfolioAndAsset(ctx, portfolioID, asset.ID)
	if err != nil || pa == nil {
		newPA := &model.PortfolioAsset{
			PortfolioID:          portfolioID,
			AssetID:              asset.ID,
			InstrumentID:         asset.InstrumentID,
			Quantity:             q,
			AveragePurchasePrice: avgPrice,
			QuoteCurrency:        currency,
		}
		_, _ = paRepo.Create(ctx, newPA)
	} else {
		pa.Quantity = q
		if avgPrice > 0 {
			pa.AveragePurchasePrice = avgPrice
		}
		if currency.IsValid() {
			pa.QuoteCurrency = currency
		}
		_ = paRepo.Update(ctx, pa)
	}
}

// ReconcileLiquidatedPositions sets Quantity to 0 for positions previously held in this account
// that are absent from the external holding snapshot.
func ReconcileLiquidatedPositions(ctx context.Context, uow repository.IUnitOfWork, conn *model.SyncConnection, activeAssetIDs map[string]bool) (int, error) {
	positions, err := uow.Position().GetPortfolioPositions(ctx, conn.PortfolioID)
	if err != nil {
		return 0, fmt.Errorf("failed to list positions for liquidation check: %w", err)
	}

	liquidatedCount := 0
	for _, pos := range positions {
		if conn.AccountID == nil || pos.AccountID != *conn.AccountID {
			continue
		}
		if activeAssetIDs[pos.AssetID] {
			continue
		}

		// Check if asset is a bank account cash position (which is handled separately by balance reconciliation)
		asset, _ := uow.Asset().GetByID(ctx, pos.AssetID)
		if asset != nil && asset.Type == model.AssetTypeBankAccount {
			continue
		}

		if !pos.Quantity.IsZero() {
			pos.Quantity = decimal.Zero
			pos.AverageCostBasis = nil
			pos.TotalCostBasis = nil
			if updateErr := uow.Position().Update(ctx, &pos); updateErr != nil {
				return liquidatedCount, fmt.Errorf("failed to set liquidated position quantity to zero: %w", updateErr)
			}
			if asset != nil {
				syncPortfolioAssetForHolding(ctx, uow, conn.PortfolioID, asset, decimal.Zero, nil, pos.QuoteCurrency)
			}
			liquidatedCount++
		}
	}

	return liquidatedCount, nil
}

// ReconcileTransactions ingests trades and cash movements with deduplication on (account_id, external_id).
func ReconcileTransactions(ctx context.Context, uow repository.IUnitOfWork, conn *model.SyncConnection, txs []RawTransaction) (int, int, error) {
	imported := 0
	updated := 0

	for _, rawTx := range txs {
		if rawTx.ExternalID != "" && conn.AccountID != nil {
			existing, err := uow.Transaction().FindByAccountAndExternalID(ctx, *conn.AccountID, rawTx.ExternalID)
			if err == nil && existing != nil {
				// Deduplicated: transaction already exists
				continue
			}
		}

		var posID *string
		var assetID string
		if rawTx.Symbol != "" && conn.AccountID != nil {
			asset, _ := uow.Asset().GetBySymbol(ctx, rawTx.Symbol)
			if asset != nil {
				assetID = asset.ID
				pos, _ := uow.Position().GetByAccountAndAsset(ctx, *conn.AccountID, asset.ID)
				if pos != nil {
					posID = &pos.ID
				}
			}
		}

		if posID == nil && rawTx.ISIN != "" && conn.AccountID != nil {
			inst, err := uow.Instrument().GetByGlobalIdentifier(ctx, "isin", rawTx.ISIN)
			if err == nil && inst != nil {
				asset, err := uow.Asset().GetByInstrumentID(ctx, inst.ID)
				if err != nil || asset == nil {
					if inst.NormalizedSymbol != "" {
						asset, _ = uow.Asset().GetBySymbol(ctx, inst.NormalizedSymbol)
					}
				}
				if asset != nil {
					assetID = asset.ID
					pos, _ := uow.Position().GetByAccountAndAsset(ctx, *conn.AccountID, asset.ID)
					if pos != nil {
						posID = &pos.ID
					}
				}
			}
		}

		var notes *string
		if rawTx.Notes != "" {
			notes = &rawTx.Notes
		}
		var extID *string
		if rawTx.ExternalID != "" {
			extID = &rawTx.ExternalID
		}

		newTx := &model.Transaction{
			UserID:            conn.UserID,
			AccountID:         conn.AccountID,
			PositionID:        posID,
			Type:              rawTx.Type,
			Amount:            rawTx.Amount,
			Quantity:          rawTx.Quantity,
			UnitPriceAmount:   rawTx.UnitPriceAmount,
			UnitPriceCurrency: rawTx.UnitPriceCurrency,
			FeesAmount:        rawTx.FeesAmount,
			FeesCurrency:      rawTx.FeesCurrency,
			Notes:             notes,
			ExternalID:        extID,
			ExecutedAt:        rawTx.ExecutedAt,
		}

		createdTx, createErr := uow.Transaction().Create(ctx, newTx)
		if createErr != nil {
			return imported, updated, fmt.Errorf("failed to ingest transaction %s: %w", rawTx.ExternalID, createErr)
		}
		imported++

		// If this is a BUY transaction with a quantity and position, create a corresponding tax lot
		if rawTx.Type == model.TransactionTypeBuy && posID != nil && rawTx.Quantity != nil && rawTx.Quantity.IsPositive() {
			costBasis := decimal.Zero
			if rawTx.UnitPriceAmount != nil {
				costBasis = *rawTx.UnitPriceAmount
			} else if rawTx.Amount > 0 {
				costBasis = decimal.NewFromInt(int64(rawTx.Amount)).Div(decimal.NewFromInt(100)).Div(*rawTx.Quantity)
			}

			lot := &model.TaxLot{
				PortfolioID:       conn.PortfolioID,
				PositionID:        *posID,
				AssetID:           assetID,
				TransactionID:     &createdTx.ID,
				AcquiredAt:        rawTx.ExecutedAt,
				InitialQuantity:   *rawTx.Quantity,
				RemainingQuantity: *rawTx.Quantity,
				CostBasisPerUnit:  costBasis,
				TotalCostBasis:    rawTx.Amount,
				Currency:          rawTx.UnitPriceCurrency,
				Status:            model.TaxLotStatusOpen,
			}
			_, _ = uow.TaxLot().Create(ctx, lot)
		}
	}

	return imported, updated, nil
}

// ReconcileResidualTaxLots keeps each position's baseline opening tax lot in step
// with the holding it exists for: it covers exactly the quantity that the
// imported transactions do not explain, and disappears once they do.
//
// The baseline lot is derived, never authoritative. The history owns the buy
// dates and cost basis, so once transactions explain the holding the placeholder
// is removed instead of being counted on top of them: otherwise every position
// imported before its history was complete would report a fabricated
// acquisition date (the sync date) and roughly twice its real lot quantity.
func ReconcileResidualTaxLots(ctx context.Context, uow repository.IUnitOfWork, conn *model.SyncConnection, holdings []RawHolding) error {
	if conn.AccountID == nil {
		return nil
	}

	for _, h := range holdings {
		if !h.Quantity.IsPositive() {
			continue
		}

		asset, err := uow.Asset().GetBySymbol(ctx, h.Symbol)
		if err != nil || asset == nil {
			continue
		}

		pos, posErr := uow.Position().GetByAccountAndAsset(ctx, *conn.AccountID, asset.ID)
		if posErr != nil || pos == nil {
			continue
		}

		// Coverage the history provides on its own: remaining quantity of lots
		// tied to a transaction, plus buy transactions that have no lot yet.
		// Synthetic lots (no transaction ID) are excluded on purpose: they are
		// what this function recomputes.
		existingLots, _ := uow.TaxLot().FindByPositionID(ctx, pos.ID)
		historyTracked := decimal.Zero
		allocatedLotTxIDs := make(map[string]bool)
		syntheticLots := make([]*model.TaxLot, 0)
		for _, lot := range existingLots {
			if lot.TransactionID == nil {
				if lot.Status != model.TaxLotStatusClosed {
					syntheticLots = append(syntheticLots, lot)
				}
				continue
			}
			allocatedLotTxIDs[*lot.TransactionID] = true
			if lot.Status != model.TaxLotStatusClosed {
				historyTracked = historyTracked.Add(lot.RemainingQuantity)
			}
		}

		// Retrieve historical buy transactions to find earliest cost basis and unallocated tx quantity
		txs, _ := uow.Transaction().FindByPositionID(ctx, pos.ID)
		var earliestBuy *model.Transaction
		for i := range txs {
			tx := txs[i]
			if tx.Type != model.TransactionTypeBuy || tx.Quantity == nil {
				continue
			}
			if earliestBuy == nil || tx.ExecutedAt.Before(earliestBuy.ExecutedAt) {
				earliestBuy = &txs[i]
			}
			// Only count buy transactions that don't already have a tax lot
			if !allocatedLotTxIDs[tx.ID] {
				historyTracked = historyTracked.Add(*tx.Quantity)
			}
		}

		residualQuantity := h.Quantity.Sub(historyTracked)

		if !residualQuantity.IsPositive() {
			for _, lot := range syntheticLots {
				if delErr := deleteSyntheticTaxLot(ctx, uow, lot); delErr != nil {
					return delErr
				}
			}
			continue
		}

		// Determine earliest cost basis
		costBasisPerUnit := decimal.Zero
		if h.CostBasisPerUnit != nil && h.CostBasisPerUnit.IsPositive() {
			costBasisPerUnit = *h.CostBasisPerUnit
		} else if earliestBuy != nil && earliestBuy.UnitPriceAmount != nil {
			costBasisPerUnit = *earliestBuy.UnitPriceAmount
		}

		acquiredAt := time.Now()
		if earliestBuy != nil {
			acquiredAt = earliestBuy.ExecutedAt
		}

		totalCostCents := model.Money(costBasisPerUnit.Mul(residualQuantity).Mul(decimal.NewFromInt(100)).Round(0).IntPart())
		currency := pos.QuoteCurrency
		if !currency.IsValid() && earliestBuy != nil {
			currency = earliestBuy.UnitPriceCurrency
		}
		if !currency.IsValid() {
			currency = model.CurrencyUSD
		}

		if len(syntheticLots) == 0 {
			baselineLot := &model.TaxLot{
				PortfolioID:       conn.PortfolioID,
				PositionID:        pos.ID,
				AssetID:           pos.AssetID,
				TransactionID:     nil, // Baseline opening tax lot without transaction ID
				AcquiredAt:        acquiredAt,
				InitialQuantity:   residualQuantity,
				RemainingQuantity: residualQuantity,
				CostBasisPerUnit:  costBasisPerUnit,
				TotalCostBasis:    totalCostCents,
				Currency:          currency,
				Status:            model.TaxLotStatusOpen,
			}
			if _, createErr := uow.TaxLot().Create(ctx, baselineLot); createErr != nil {
				return fmt.Errorf("failed to create baseline tax lot for %s: %w", h.Symbol, createErr)
			}
			continue
		}

		// A single placeholder survives and tracks the residual, so repeated
		// syncs cannot stack baseline lots on top of each other.
		baselineLot := syntheticLots[0]
		baselineLot.AcquiredAt = acquiredAt
		baselineLot.InitialQuantity = residualQuantity
		baselineLot.RemainingQuantity = residualQuantity
		baselineLot.CostBasisPerUnit = costBasisPerUnit
		baselineLot.TotalCostBasis = totalCostCents
		baselineLot.Currency = currency
		baselineLot.Status = model.TaxLotStatusOpen
		if updateErr := uow.TaxLot().Update(ctx, baselineLot); updateErr != nil {
			return fmt.Errorf("failed to update baseline tax lot for %s: %w", h.Symbol, updateErr)
		}
		for _, duplicate := range syntheticLots[1:] {
			if delErr := deleteSyntheticTaxLot(ctx, uow, duplicate); delErr != nil {
				return delErr
			}
		}
	}

	return nil
}

// deleteSyntheticTaxLot removes a reconciler-owned opening lot unless a sale was
// already matched against it: dispositions cascade with their lot, so deleting a
// used one would erase recorded capital gain. A used lot is reported and left in
// place rather than silently rewritten.
func deleteSyntheticTaxLot(ctx context.Context, uow repository.IUnitOfWork, lot *model.TaxLot) error {
	dispositions, err := uow.TaxLotDisposition().FindByPositionID(ctx, lot.PositionID)
	if err != nil {
		log.Printf("[WARN] [SyncService] keeping opening tax lot %s: could not check its dispositions: %v", lot.ID, err)
		return nil
	}
	for _, disposition := range dispositions {
		if disposition.LotID == lot.ID {
			log.Printf("[WARN] [SyncService] keeping opening tax lot %s: a disposal is matched against it", lot.ID)
			return nil
		}
	}

	if err := uow.TaxLot().Delete(ctx, lot.ID); err != nil {
		return fmt.Errorf("failed to remove stale opening tax lot %s: %w", lot.ID, err)
	}
	return nil
}

// resolveOrCreateAsset attempts to find an asset matching the holding in the catalog or database,
// falling back to creating an UNMAPPED placeholder asset.
func resolveOrCreateAsset(
	ctx context.Context,
	uow repository.IUnitOfWork,
	instrumentService service.InstrumentService,
	holding RawHolding,
) (*model.Asset, bool, error) {
	// 1. Try finding by Symbol in Asset repository
	if holding.Symbol != "" {
		asset, err := uow.Asset().GetBySymbol(ctx, holding.Symbol)
		if err == nil && asset != nil {
			if !holding.AssetType.IsValid() || asset.Type == holding.AssetType {
				return asset, false, nil
			}
		}
	}

	// 2. Try finding by ISIN via Instrument Catalog
	if holding.ISIN != "" {
		inst, err := uow.Instrument().GetByGlobalIdentifier(ctx, "isin", holding.ISIN)
		if err == nil && inst != nil {
			asset, err := uow.Asset().GetByInstrumentID(ctx, inst.ID)
			if err == nil && asset != nil {
				return asset, false, nil
			}
			// Instrument matched in catalog, but Asset entity not yet created -> provision real tradeable asset
			return createAssetFromInstrument(ctx, uow, inst)
		}
	}

	// 3. Try InstrumentSearchService (Local + Online Discovery) if available
	if instrumentService != nil && holding.Symbol != "" {
		var assetTypes []model.InstrumentAssetType
		if holding.AssetType == model.AssetTypeCrypto {
			assetTypes = []model.InstrumentAssetType{model.InstrumentAssetTypeCrypto}
		} else if holding.AssetType == model.AssetTypeStock {
			assetTypes = []model.InstrumentAssetType{
				model.InstrumentAssetTypeStock,
				model.InstrumentAssetTypeETF,
				model.InstrumentAssetTypeFund,
			}
		}

		filter := service.InstrumentSearchFilter{
			AssetTypes: assetTypes,
			Limit:      5,
		}

		// 3a. Search Local Catalog
		searchRes, err := instrumentService.SearchLocal(ctx, holding.Symbol, filter, nil)
		if err == nil && searchRes != nil {
			for _, res := range searchRes.LocalResults {
				inst := res.Instrument
				if inst == nil {
					continue
				}
				if holding.AssetType == model.AssetTypeCrypto && inst.AssetType != model.InstrumentAssetTypeCrypto {
					continue
				}
				if strings.EqualFold(inst.NormalizedSymbol, holding.Symbol) || (res.MatchedAlias != nil && strings.EqualFold(*res.MatchedAlias, holding.Symbol)) {
					asset, err := uow.Asset().GetByInstrumentID(ctx, inst.ID)
					if err == nil && asset != nil {
						return asset, false, nil
					}
					return createAssetFromInstrument(ctx, uow, inst)
				}
			}
		}

		// 3b. Search Online Discovery (e.g. CoinMarketCap API for Crypto)
		onlineRes, err := instrumentService.SearchOnline(ctx, holding.Symbol, filter, nil)
		if err == nil && onlineRes != nil {
			for _, disc := range onlineRes.OnlineResults {
				if holding.AssetType == model.AssetTypeCrypto && disc.AssetType != model.InstrumentAssetTypeCrypto {
					continue
				}
				if strings.EqualFold(disc.Symbol, holding.Symbol) {
					details, persistErr := instrumentService.PersistDiscoveredInstrument(ctx, service.PersistDiscoveredInstrumentInput{
						Instrument: disc,
					}, nil)
					if persistErr == nil && details != nil && details.Instrument != nil {
						asset, err := uow.Asset().GetByInstrumentID(ctx, details.Instrument.ID)
						if err == nil && asset != nil {
							return asset, false, nil
						}
						return createAssetFromInstrument(ctx, uow, details.Instrument)
					}
				}
			}
		}
	}

	// 4. Fallback: Unmatched instrument -> Provision UNMAPPED placeholder asset
	unmappedSource := "UNMAPPED"
	name := holding.Name
	if name == "" {
		name = fmt.Sprintf("%s (UNMAPPED)", holding.Symbol)
	}

	metaBytes, _ := json.Marshal(map[string]interface{}{
		"unmapped":   true,
		"raw_symbol": holding.Symbol,
		"isin":       holding.ISIN,
	})

	assetType := holding.AssetType
	if !assetType.IsValid() {
		assetType = model.AssetTypeStock
	}

	placeholder := &model.Asset{
		Symbol:           &holding.Symbol,
		Name:             name,
		Type:             assetType,
		IsTradeable:      true,
		MarketDataSource: &unmappedSource,
		Metadata:         metaBytes,
	}

	created, err := uow.Asset().UpsertTradeable(ctx, placeholder)
	if err != nil {
		return nil, false, fmt.Errorf("failed to create unmapped placeholder asset: %w", err)
	}

	return created, true, nil
}

// createAssetFromInstrument provisions and persists a tradeable Asset linked to a matched catalog Instrument.
func createAssetFromInstrument(ctx context.Context, uow repository.IUnitOfWork, inst *model.Instrument) (*model.Asset, bool, error) {
	assetType := model.AssetTypeStock
	switch inst.AssetType {
	case model.InstrumentAssetTypeCrypto:
		assetType = model.AssetTypeCrypto
	case model.InstrumentAssetTypeFund, model.InstrumentAssetTypeETF:
		assetType = model.AssetTypeFund
	}

	instID := inst.ID
	sym := inst.NormalizedSymbol
	name := inst.NormalizedName
	if name == "" {
		name = sym
	}

	newAsset := &model.Asset{
		InstrumentID:     &instID,
		Symbol:           &sym,
		Name:             name,
		Type:             assetType,
		IsTradeable:      true,
		MarketDataSource: &inst.ProviderSource,
	}

	created, err := uow.Asset().UpsertTradeable(ctx, newAsset)
	if err != nil {
		return nil, false, fmt.Errorf("failed to create asset from matched instrument %s: %w", sym, err)
	}

	return created, false, nil
}
