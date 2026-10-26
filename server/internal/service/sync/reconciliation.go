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
		asset, err := uow.Asset().GetBySymbol(ctx, symbol)
		if err != nil || asset == nil {
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

	for _, h := range holdings {
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
	}

	return imported, updated, warnings, activeAssetIDs, nil
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

// ReconcileResidualTaxLots creates baseline opening tax lots for any residual quantities
// where the authoritative FetchHoldings quantity exceeds historical buy transactions / open lots.
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

		// Calculate total quantity currently tracked in active tax lots
		// and collect transaction IDs that already have a tax lot.
		existingLots, _ := uow.TaxLot().FindByPositionID(ctx, pos.ID)
		totalRemainingInLots := decimal.Zero
		allocatedLotTxIDs := make(map[string]bool)
		for _, lot := range existingLots {
			if lot.Status != model.TaxLotStatusClosed {
				totalRemainingInLots = totalRemainingInLots.Add(lot.RemainingQuantity)
			}
			if lot.TransactionID != nil {
				allocatedLotTxIDs[*lot.TransactionID] = true
			}
		}

		// Retrieve historical buy transactions to find earliest cost basis and unallocated tx quantity
		txs, _ := uow.Transaction().FindByPositionID(ctx, pos.ID)
		unallocatedTxQty := decimal.Zero
		var earliestBuy *model.Transaction
		for _, tx := range txs {
			if tx.Type == model.TransactionTypeBuy && tx.Quantity != nil {
				if earliestBuy == nil || tx.ExecutedAt.Before(earliestBuy.ExecutedAt) {
					earliestBuy = &tx
				}
				// Only count buy transactions that don't already have a tax lot
				if !allocatedLotTxIDs[tx.ID] {
					unallocatedTxQty = unallocatedTxQty.Add(*tx.Quantity)
				}
			}
		}

		// Accounted quantity is all open tax lots (including existing baseline lots) plus unallocated buy transactions
		accountedQuantity := totalRemainingInLots.Add(unallocatedTxQty)

		if h.Quantity.GreaterThan(accountedQuantity) {
			residualQuantity := h.Quantity.Sub(accountedQuantity)

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
		}
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
			return asset, false, nil
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

	// 3. Try InstrumentSearchService if available
	if instrumentService != nil && holding.Symbol != "" {
		searchRes, err := instrumentService.SearchLocal(ctx, holding.Symbol, service.InstrumentSearchFilter{Limit: 1}, nil)
		if err == nil && searchRes != nil && len(searchRes.LocalResults) > 0 {
			inst := searchRes.LocalResults[0].Instrument
			if inst != nil {
				asset, err := uow.Asset().GetByInstrumentID(ctx, inst.ID)
				if err == nil && asset != nil {
					return asset, false, nil
				}
				// Instrument matched in catalog, but Asset entity not yet created -> provision real tradeable asset
				return createAssetFromInstrument(ctx, uow, inst)
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

	created, err := uow.Asset().Create(ctx, placeholder)
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

	created, err := uow.Asset().Create(ctx, newAsset)
	if err != nil {
		return nil, false, fmt.Errorf("failed to create asset from matched instrument %s: %w", sym, err)
	}

	return created, false, nil
}
