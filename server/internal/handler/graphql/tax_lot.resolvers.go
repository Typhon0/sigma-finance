package graphql

import (
	"context"
	"fmt"
	"log"
	"time"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/handler/middleware"
)

// TaxLotsByPosition is the resolver for the taxLotsByPosition field.
func (r *queryResolver) TaxLotsByPosition(ctx context.Context, positionID string) ([]*gqlModel.TaxLot, error) {
	log.Printf("[INFO] [graphql] TaxLotsByPosition: started positionID=%s", positionID)
	authUser, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}

	position, err := r.UOW.Position().GetByID(ctx, positionID)
	if err != nil {
		return nil, fmt.Errorf("position not found: %w", err)
	}

	if err := r.PortfolioService.ValidatePortfolioOwnership(ctx, position.PortfolioID, authUser.ID); err != nil {
		return nil, err
	}

	lots, err := r.UOW.TaxLot().FindByPositionID(ctx, positionID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tax lots: %w", err)
	}

	// Fetch current price for this asset if available
	var currentPrice *float64
	if priceRecord, priceErr := r.UOW.AssetPrice().GetLatestPrice(ctx, position.AssetID); priceErr == nil && priceRecord != nil {
		p := priceRecord.Price.InexactFloat64()
		currentPrice = &p
	}

	now := time.Now()
	result := make([]*gqlModel.TaxLot, len(lots))
	for i, lot := range lots {
		initQty := lot.InitialQuantity.InexactFloat64()
		remQty := lot.RemainingQuantity.InexactFloat64()
		costPerUnit := lot.CostBasisPerUnit.InexactFloat64()
		totalCost := float64(lot.TotalCostBasis) / 100.0 // cents to dollars

		holdingDays := int(now.Sub(lot.AcquiredAt).Hours() / 24)
		if holdingDays < 0 {
			holdingDays = 0
		}
		isLongTerm := holdingDays > 365

		var curVal *float64
		var gainLoss *float64
		var gainLossPct *float64

		if currentPrice != nil && remQty > 0 {
			cv := remQty * (*currentPrice)
			curVal = &cv
			// Proportional remaining cost basis
			var remainingCost float64
			if initQty > 0 {
				remainingCost = totalCost * (remQty / initQty)
			} else {
				remainingCost = remQty * costPerUnit
			}
			gl := cv - remainingCost
			gainLoss = &gl
			if remainingCost > 0 {
				glp := (gl / remainingCost) * 100.0
				gainLossPct = &glp
			}
		}

		result[i] = &gqlModel.TaxLot{
			ID:                        lot.ID,
			PortfolioID:               lot.PortfolioID,
			PositionID:                lot.PositionID,
			AssetID:                   lot.AssetID,
			TransactionID:             lot.TransactionID,
			AcquiredAt:                lot.AcquiredAt,
			InitialQuantity:           initQty,
			RemainingQuantity:         remQty,
			CostBasisPerUnit:          costPerUnit,
			TotalCostBasis:            totalCost,
			Currency:                  string(lot.Currency),
			Status:                    string(lot.Status),
			HoldingPeriodDays:         int32(holdingDays),
			IsLongTerm:                isLongTerm,
			CurrentPrice:              currentPrice,
			CurrentValue:              curVal,
			UnrealizedGainLoss:        gainLoss,
			UnrealizedGainLossPercent: gainLossPct,
		}
	}

	return result, nil
}

// TaxHarvestOpportunities is the resolver for the taxHarvestOpportunities field.
func (r *queryResolver) TaxHarvestOpportunities(ctx context.Context, portfolioID string) ([]*gqlModel.TaxHarvestOpportunity, error) {
	log.Printf("[INFO] [graphql] TaxHarvestOpportunities: started portfolioID=%s", portfolioID)
	authUser, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}

	if err := r.PortfolioService.ValidatePortfolioOwnership(ctx, portfolioID, authUser.ID); err != nil {
		return nil, err
	}

	lots, err := r.UOW.TaxLot().FindByPortfolioID(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch portfolio tax lots: %w", err)
	}

	// Group open lots with losses by positionID
	lossByPos := make(map[string]float64)
	countByPos := make(map[string]int)
	assetIDByPos := make(map[string]string)

	for _, lot := range lots {
		if lot.Status == model.TaxLotStatusClosed || lot.RemainingQuantity.IsZero() {
			continue
		}
		assetIDByPos[lot.PositionID] = lot.AssetID

		priceRecord, priceErr := r.UOW.AssetPrice().GetLatestPrice(ctx, lot.AssetID)
		if priceErr == nil && priceRecord != nil {
			curPrice := priceRecord.Price.InexactFloat64()
			remQty := lot.RemainingQuantity.InexactFloat64()
			costPerUnit := lot.CostBasisPerUnit.InexactFloat64()
			if curPrice < costPerUnit {
				loss := (costPerUnit - curPrice) * remQty
				lossByPos[lot.PositionID] += loss
				countByPos[lot.PositionID]++
			}
		}
	}

	opportunities := make([]*gqlModel.TaxHarvestOpportunity, 0, len(lossByPos))
	for posID, harvestable := range lossByPos {
		if harvestable <= 0 {
			continue
		}
		assetID := assetIDByPos[posID]
		symbol := "ASSET"
		name := "Asset"
		if asset, err := r.UOW.Asset().GetByID(ctx, assetID); err == nil && asset != nil {
			if asset.Symbol != nil {
				symbol = *asset.Symbol
			}
			name = asset.Name
		}

		opportunities = append(opportunities, &gqlModel.TaxHarvestOpportunity{
			PositionID:        posID,
			Symbol:            symbol,
			Name:              name,
			HarvestableLoss:   harvestable,
			EligibleLotsCount: int32(countByPos[posID]),
		})
	}

	return opportunities, nil
}

// DispositionsByPosition is the resolver for the dispositionsByPosition field.
// Returns the fiscal (lot-matched) realized gain/loss records for a position.
func (r *queryResolver) DispositionsByPosition(ctx context.Context, positionID string) ([]*gqlModel.TaxLotDisposition, error) {
	log.Printf("[INFO] [graphql] DispositionsByPosition: started positionID=%s", positionID)
	authUser, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}

	position, err := r.UOW.Position().GetByID(ctx, positionID)
	if err != nil {
		return nil, fmt.Errorf("position not found: %w", err)
	}

	if err := r.PortfolioService.ValidatePortfolioOwnership(ctx, position.PortfolioID, authUser.ID); err != nil {
		return nil, err
	}

	dispositions, err := r.UOW.TaxLotDisposition().FindByPositionID(ctx, positionID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tax lot dispositions: %w", err)
	}

	result := make([]*gqlModel.TaxLotDisposition, len(dispositions))
	for i, d := range dispositions {
		result[i] = mapDispositionToGQL(d)
	}
	return result, nil
}

// RealizedGains is the resolver for the realizedGains field: a fiscal
// (lot-matched) realized gains summary for a portfolio over a window.
// This is deliberately NOT the economic average-cost P/L.
func (r *queryResolver) RealizedGains(ctx context.Context, portfolioID string, dateFrom time.Time, dateTo time.Time) (*gqlModel.RealizedGainsSummary, error) {
	log.Printf("[INFO] [graphql] RealizedGains: started portfolioID=%s from=%s to=%s", portfolioID, dateFrom.Format(time.RFC3339), dateTo.Format(time.RFC3339))
	authUser, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}

	if err := r.PortfolioService.ValidatePortfolioOwnership(ctx, portfolioID, authUser.ID); err != nil {
		return nil, err
	}

	dispositions, err := r.UOW.TaxLotDisposition().FindByPortfolioAndDateRange(ctx, portfolioID, dateFrom, dateTo)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch dispositions: %w", err)
	}

	portfolio, err := r.UOW.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch portfolio: %w", err)
	}

	user, err := r.UserService.GetByID(ctx, authUser.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}

	isExempt := portfolio.TaxWrapper == model.TaxWrapperPEA
	jurisdiction := user.TaxJurisdiction
	if jurisdiction == "" {
		jurisdiction = "FR"
	}

	summary := &gqlModel.RealizedGainsSummary{
		PortfolioID:     portfolioID,
		DateFrom:        dateFrom,
		DateTo:          dateTo,
		TaxWrapper:      string(portfolio.TaxWrapper),
		TaxJurisdiction: jurisdiction,
		IsTaxExempt:     isExempt,
	}
	txIDs := make(map[string]struct{})
	for _, d := range dispositions {
		if !d.IsTaxExempt {
			gain := float64(d.RealizedGainLoss) / 100.0
			summary.TotalRealized += gain
			if d.IsLongTerm {
				summary.LongTermGains += gain
			} else {
				summary.ShortTermGains += gain
			}
		}
		if d.TransactionID != nil {
			txIDs[*d.TransactionID] = struct{}{}
		}
	}
	summary.DispositionCount = int32(len(dispositions))
	summary.TransactionCount = int32(len(txIDs))
	return summary, nil
}

// mapDispositionToGQL converts a model.TaxLotDisposition to its GraphQL shape.
func mapDispositionToGQL(d *model.TaxLotDisposition) *gqlModel.TaxLotDisposition {
	return &gqlModel.TaxLotDisposition{
		ID:                d.ID,
		LotID:             d.LotID,
		PositionID:        d.PositionID,
		PortfolioID:       d.PortfolioID,
		AssetID:           d.AssetID,
		TransactionID:     d.TransactionID,
		AcquiredAt:        d.AcquiredAt,
		SoldAt:            d.SoldAt,
		Quantity:          d.Quantity.InexactFloat64(),
		CostBasisPerUnit:  d.CostBasisPerUnit.InexactFloat64(),
		SellPricePerUnit:  d.SellPricePerUnit.InexactFloat64(),
		CostBasis:         float64(d.CostBasis) / 100.0,
		Proceeds:          float64(d.Proceeds) / 100.0,
		RealizedGainLoss:  float64(d.RealizedGainLoss) / 100.0,
		Method:            string(d.Method),
		HoldingPeriodDays: int32(d.HoldingPeriodDays),
		IsLongTerm:        d.IsLongTerm,
		IsTaxExempt:       d.IsTaxExempt,
	}
}
