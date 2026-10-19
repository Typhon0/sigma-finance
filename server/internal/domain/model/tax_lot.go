package model

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// TaxLotStatus represents the active lifecycle status of an acquired tax lot
type TaxLotStatus string

const (
	TaxLotStatusOpen            TaxLotStatus = "OPEN"
	TaxLotStatusPartiallyClosed TaxLotStatus = "PARTIALLY_CLOSED"
	TaxLotStatusClosed          TaxLotStatus = "CLOSED"
)

// TaxLotMethod specifies the accounting lot selection strategy for sales
type TaxLotMethod string

const (
	TaxLotMethodFIFO       TaxLotMethod = "FIFO"        // First-In, First-Out (IRS Default)
	TaxLotMethodLIFO       TaxLotMethod = "LIFO"        // Last-In, First-Out
	TaxLotMethodHIFO       TaxLotMethod = "HIFO"        // Highest-In, First-Out (Tax Minimization)
	TaxLotMethodLowestCost TaxLotMethod = "LOWEST_COST" // Lowest Cost First (Gain Maximization)
	TaxLotMethodPMP        TaxLotMethod = "PMP"         // Prix Moyen Pondéré (France CGI Art. 150-0 D)
)

// TaxLot models an individual acquisition lot of a security for tax and capital gain tracking
type TaxLot struct {
	bun.BaseModel `bun:"table:sigma_finance.tax_lots"`

	ID                string          `bun:"id,pk"`
	PortfolioID       string          `bun:"portfolio_id,notnull"`
	PositionID        string          `bun:"position_id,notnull"`
	AssetID           string          `bun:"asset_id,notnull"`
	TransactionID     *string         `bun:"transaction_id"`
	AcquiredAt        time.Time       `bun:"acquired_at,notnull"`
	InitialQuantity   decimal.Decimal `bun:"initial_quantity,type:decimal(20,8),notnull"`
	RemainingQuantity decimal.Decimal `bun:"remaining_quantity,type:decimal(20,8),notnull"`
	CostBasisPerUnit  decimal.Decimal `bun:"cost_basis_per_unit,type:decimal(20,8),notnull"`
	TotalCostBasis    Money           `bun:"total_cost_basis,notnull"` // In cents
	Currency          Currency        `bun:"currency,notnull"`
	Status            TaxLotStatus    `bun:"status,notnull"`
	CreatedAt         time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt         time.Time       `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

// Implement Entity interface
func (l TaxLot) GetID() string             { return l.ID }
func (l *TaxLot) SetID(id string)          { l.ID = id }
func (l TaxLot) GetCreatedAt() time.Time   { return l.CreatedAt }
func (l *TaxLot) SetCreatedAt(t time.Time) { l.CreatedAt = t }
func (l TaxLot) GetUpdatedAt() time.Time   { return l.UpdatedAt }
func (l *TaxLot) SetUpdatedAt(t time.Time) { l.UpdatedAt = t }

// TaxLotMatch records a disposition match between a sell order and a specific tax lot
type TaxLotMatch struct {
	LotID             string          `json:"lot_id"`
	AcquiredAt        time.Time       `json:"acquired_at"`
	SoldAt            time.Time       `json:"sold_at"`
	Quantity          decimal.Decimal `json:"quantity"`
	CostBasisPerUnit  decimal.Decimal `json:"cost_basis_per_unit"`
	SellPricePerUnit  decimal.Decimal `json:"sell_price_per_unit"`
	CostBasis         Money           `json:"cost_basis"`         // In cents
	Proceeds          Money           `json:"proceeds"`           // In cents
	RealizedGainLoss  Money           `json:"realized_gain_loss"` // In cents (Proceeds - CostBasis)
	HoldingPeriodDays int             `json:"holding_period_days"`
	IsLongTerm        bool            `json:"is_long_term"` // Held > 365 days
	IsTaxExempt       bool            `json:"is_tax_exempt"`
}

// TaxLotAllocationResult aggregates the output of a lot matching engine run
type TaxLotAllocationResult struct {
	Method                TaxLotMethod    `json:"method"`
	Matches               []TaxLotMatch   `json:"matches"`
	TotalSoldQuantity     decimal.Decimal `json:"total_sold_quantity"`
	TotalCostBasis        Money           `json:"total_cost_basis"`
	TotalProceeds         Money           `json:"total_proceeds"`
	TotalRealizedGainLoss Money           `json:"total_realized_gain_loss"`
	ShortTermGainLoss     Money           `json:"short_term_gain_loss"`
	LongTermGainLoss      Money           `json:"long_term_gain_loss"`
	IsTaxExempt           bool            `json:"is_tax_exempt"`
}

// AllocateTaxLots matches a sell order of specified quantity and price against open lots
// according to the requested accounting strategy (FIFO, LIFO, HIFO, LOWEST_COST).
func AllocateTaxLots(
	openLots []*TaxLot,
	sellQuantity decimal.Decimal,
	sellPrice decimal.Decimal,
	sellDate time.Time,
	method TaxLotMethod,
) (*TaxLotAllocationResult, error) {
	if sellQuantity.LessThanOrEqual(decimal.Zero) {
		return nil, errors.New("sell quantity must be greater than zero")
	}
	if sellPrice.LessThan(decimal.Zero) {
		return nil, errors.New("sell price cannot be negative")
	}

	// Filter and clone eligible open lots with remaining quantity
	available := make([]*TaxLot, 0, len(openLots))
	totalAvailableQty := decimal.Zero
	for _, lot := range openLots {
		if lot.RemainingQuantity.GreaterThan(decimal.Zero) {
			available = append(available, lot)
			totalAvailableQty = totalAvailableQty.Add(lot.RemainingQuantity)
		}
	}

	if sellQuantity.GreaterThan(totalAvailableQty) {
		return nil, fmt.Errorf("insufficient quantity to sell: requested %s, available %s", sellQuantity.String(), totalAvailableQty.String())
	}

	// Compute weighted average cost (PMP) if method is PMP
	var pmpUnitCost decimal.Decimal
	if method == TaxLotMethodPMP && totalAvailableQty.GreaterThan(decimal.Zero) {
		totalCostCents := int64(0)
		for _, lot := range available {
			lotCost := lot.RemainingQuantity.Mul(lot.CostBasisPerUnit).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
			totalCostCents += lotCost
		}
		pmpUnitCost = decimal.NewFromInt(totalCostCents).Div(decimal.NewFromInt(100)).Div(totalAvailableQty)
	}

	// Sort according to accounting method
	sortLots(available, method)

	result := &TaxLotAllocationResult{
		Method:  method,
		Matches: make([]TaxLotMatch, 0),
	}

	remainingToSell := sellQuantity

	for _, lot := range available {
		if remainingToSell.IsZero() {
			break
		}

		takeQty := decimal.Min(lot.RemainingQuantity, remainingToSell)
		lot.RemainingQuantity = lot.RemainingQuantity.Sub(takeQty)
		if lot.RemainingQuantity.IsZero() {
			lot.Status = TaxLotStatusClosed
		} else {
			lot.Status = TaxLotStatusPartiallyClosed
		}

		unitCost := lot.CostBasisPerUnit
		if method == TaxLotMethodPMP && pmpUnitCost.GreaterThan(decimal.Zero) {
			unitCost = pmpUnitCost
		}

		// Calculate financials for this match (in cents)
		costCents := takeQty.Mul(unitCost).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
		proceedsCents := takeQty.Mul(sellPrice).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
		gainLossCents := proceedsCents - costCents

		holdingDays := int(sellDate.Sub(lot.AcquiredAt).Hours() / 24)
		isLongTerm := holdingDays > 365

		match := TaxLotMatch{
			LotID:             lot.ID,
			AcquiredAt:        lot.AcquiredAt,
			SoldAt:            sellDate,
			Quantity:          takeQty,
			CostBasisPerUnit:  unitCost,
			SellPricePerUnit:  sellPrice,
			CostBasis:         Money(costCents),
			Proceeds:          Money(proceedsCents),
			RealizedGainLoss:  Money(gainLossCents),
			HoldingPeriodDays: holdingDays,
			IsLongTerm:        isLongTerm,
		}

		result.Matches = append(result.Matches, match)
		result.TotalSoldQuantity = result.TotalSoldQuantity.Add(takeQty)
		result.TotalCostBasis += match.CostBasis
		result.TotalProceeds += match.Proceeds
		result.TotalRealizedGainLoss += match.RealizedGainLoss

		if isLongTerm {
			result.LongTermGainLoss += match.RealizedGainLoss
		} else {
			result.ShortTermGainLoss += match.RealizedGainLoss
		}

		remainingToSell = remainingToSell.Sub(takeQty)
	}

	return result, nil
}

// sortLots sorts lots in place according to accounting convention
func sortLots(lots []*TaxLot, method TaxLotMethod) {
	switch method {
	case TaxLotMethodFIFO, TaxLotMethodPMP:
		sort.SliceStable(lots, func(i, j int) bool {
			return lots[i].AcquiredAt.Before(lots[j].AcquiredAt)
		})
	case TaxLotMethodLIFO:
		sort.SliceStable(lots, func(i, j int) bool {
			return lots[i].AcquiredAt.After(lots[j].AcquiredAt)
		})
	case TaxLotMethodHIFO:
		sort.SliceStable(lots, func(i, j int) bool {
			return lots[i].CostBasisPerUnit.GreaterThan(lots[j].CostBasisPerUnit)
		})
	case TaxLotMethodLowestCost:
		sort.SliceStable(lots, func(i, j int) bool {
			return lots[i].CostBasisPerUnit.LessThan(lots[j].CostBasisPerUnit)
		})
	default:
		// Default to FIFO
		sort.SliceStable(lots, func(i, j int) bool {
			return lots[i].AcquiredAt.Before(lots[j].AcquiredAt)
		})
	}
}

// TaxLotDisposition is the persisted record of one lot-matched disposal.
//
// It carries the FISCAL realized gain/loss (lot-matched, per disposal) —
// the number tax authorities assess. It is deliberately a separate figure
// from the ECONOMIC realized P/L (average-cost, cumulative) stored on
// positions.realized_gain_loss; the two answer different questions and are
// never summed or substituted for one another.
type TaxLotDisposition struct {
	bun.BaseModel `bun:"table:sigma_finance.tax_lot_dispositions"`

	ID                string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	LotID             string          `bun:"lot_id,notnull"`
	PositionID        string          `bun:"position_id,notnull"`
	PortfolioID       string          `bun:"portfolio_id,notnull"`
	AssetID           string          `bun:"asset_id,notnull"`
	TransactionID     *string         `bun:"transaction_id"`
	AcquiredAt        time.Time       `bun:"acquired_at,notnull"`
	SoldAt            time.Time       `bun:"sold_at,notnull"`
	Quantity          decimal.Decimal `bun:"quantity,type:decimal(20,8),notnull"`
	CostBasisPerUnit  decimal.Decimal `bun:"cost_basis_per_unit,type:decimal(20,8),notnull"`
	SellPricePerUnit  decimal.Decimal `bun:"sell_price_per_unit,type:decimal(20,8),notnull"`
	CostBasis         Money           `bun:"cost_basis,notnull"`         // In cents
	Proceeds          Money           `bun:"proceeds,notnull"`           // In cents
	RealizedGainLoss  Money           `bun:"realized_gain_loss,notnull"` // Fiscal, lot-matched, in cents
	Method            TaxLotMethod    `bun:"method,notnull"`
	HoldingPeriodDays int             `bun:"holding_period_days,notnull"`
	IsLongTerm        bool            `bun:"is_long_term,notnull"`
	IsTaxExempt       bool            `bun:"is_tax_exempt,notnull,default:false"`
	CreatedAt         time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

// NewDispositionsFromAllocation converts an allocation result's matches into
// persistable disposition rows, carrying portfolio/position/asset/sell-transaction
// context onto each row.
func NewDispositionsFromAllocation(
	result *TaxLotAllocationResult,
	portfolioID, positionID, assetID string,
	sellTransactionID *string,
	isTaxExempt bool,
) []*TaxLotDisposition {
	if result == nil {
		return nil
	}
	dispositions := make([]*TaxLotDisposition, 0, len(result.Matches))
	for _, m := range result.Matches {
		match := m
		dispositions = append(dispositions, &TaxLotDisposition{
			LotID:             match.LotID,
			PositionID:        positionID,
			PortfolioID:       portfolioID,
			AssetID:           assetID,
			TransactionID:     sellTransactionID,
			AcquiredAt:        match.AcquiredAt,
			SoldAt:            match.SoldAt,
			Quantity:          match.Quantity,
			CostBasisPerUnit:  match.CostBasisPerUnit,
			SellPricePerUnit:  match.SellPricePerUnit,
			CostBasis:         match.CostBasis,
			Proceeds:          match.Proceeds,
			RealizedGainLoss:  match.RealizedGainLoss,
			Method:            result.Method,
			HoldingPeriodDays: match.HoldingPeriodDays,
			IsLongTerm:        match.IsLongTerm,
			IsTaxExempt:       isTaxExempt,
		})
	}
	return dispositions
}

// Implement Entity interface
func (d TaxLotDisposition) GetID() string             { return d.ID }
func (d *TaxLotDisposition) SetID(id string)          { d.ID = id }
func (d TaxLotDisposition) GetCreatedAt() time.Time   { return d.CreatedAt }
func (d *TaxLotDisposition) SetCreatedAt(t time.Time) { d.CreatedAt = t }
func (d TaxLotDisposition) GetUpdatedAt() time.Time   { return d.CreatedAt }
