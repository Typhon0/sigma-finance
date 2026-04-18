package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// Position represents a user's holding of a specific asset within a portfolio
type Position struct {
	bun.BaseModel `bun:"table:sigma_finance.positions"`

	ID                  string           `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	PortfolioID         string           `bun:"portfolio_id,notnull"`
	AssetID             string           `bun:"asset_id,notnull"`
	Quantity            decimal.Decimal  `bun:"quantity,type:decimal(20,8),notnull,default:0"`
	OwnershipPercentage decimal.Decimal  `bun:"ownership_percentage,type:decimal(5,2),default:100.00"`
	AverageCostBasis    *decimal.Decimal `bun:"average_cost_basis,type:decimal(20,8)"` // Cost per unit
	TotalCostBasis      *Money           `bun:"total_cost_basis"`                      // Total cost in cents
	Notes               *string          `bun:"notes"`
	CreatedAt           time.Time        `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt           time.Time        `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	Portfolio *Portfolio `bun:"rel:belongs-to,join:portfolio_id=id"`
	Asset     *Asset     `bun:"rel:belongs-to,join:asset_id=id"`
}

// PositionValue represents the calculated value of a position
type PositionValue struct {
	Position                     *Position        `json:"position"`
	CurrentPrice                 *decimal.Decimal `json:"current_price,omitempty"`
	CurrentValue                 Money            `json:"current_value"`
	UnrealizedGainLoss           Money            `json:"unrealized_gain_loss"`
	UnrealizedGainLossPercentage *decimal.Decimal `json:"unrealized_gain_loss_percentage,omitempty"`
	LastUpdated                  time.Time        `json:"last_updated"`
}

// CostBasisInfo represents detailed cost basis information
type CostBasisInfo struct {
	PositionID          string          `json:"position_id"`
	TotalQuantity       decimal.Decimal `json:"total_quantity"`
	AverageCostBasis    decimal.Decimal `json:"average_cost_basis"`
	TotalCostBasis      Money           `json:"total_cost_basis"`
	RealizedGainLoss    Money           `json:"realized_gain_loss"`
	TransactionCount    int             `json:"transaction_count"`
	FirstPurchaseDate   *time.Time      `json:"first_purchase_date,omitempty"`
	LastTransactionDate *time.Time      `json:"last_transaction_date,omitempty"`
}

// Validation methods

// Validate performs comprehensive validation of the position
func (p *Position) Validate() error {
	if p.PortfolioID == "" {
		return errors.New("portfolio ID is required")
	}

	if p.AssetID == "" {
		return errors.New("asset ID is required")
	}

	// Validate quantity
	if p.Quantity.IsNegative() {
		return errors.New("quantity cannot be negative")
	}

	// Validate ownership percentage
	if err := p.validateOwnershipPercentage(); err != nil {
		return err
	}

	// Validate cost basis consistency
	if err := p.validateCostBasis(); err != nil {
		return err
	}

	return nil
}

// validateOwnershipPercentage validates the ownership percentage
func (p *Position) validateOwnershipPercentage() error {
	if p.OwnershipPercentage.IsNegative() || p.OwnershipPercentage.IsZero() {
		return errors.New("ownership percentage must be greater than 0")
	}

	if p.OwnershipPercentage.GreaterThan(decimal.NewFromInt(100)) {
		return errors.New("ownership percentage cannot exceed 100%")
	}

	// Round to 2 decimal places
	p.OwnershipPercentage = p.OwnershipPercentage.Round(2)

	return nil
}

// validateCostBasis validates cost basis consistency
func (p *Position) validateCostBasis() error {
	// If we have quantity but no cost basis, that's okay (could be a gift, inheritance, etc.)
	if p.Quantity.IsZero() {
		// If quantity is zero, cost basis should also be zero or nil
		if p.TotalCostBasis != nil && *p.TotalCostBasis != 0 {
			return errors.New("total cost basis must be zero when quantity is zero")
		}
		if p.AverageCostBasis != nil && !p.AverageCostBasis.IsZero() {
			return errors.New("average cost basis must be zero when quantity is zero")
		}
		return nil
	}

	// If we have both average cost basis and total cost basis, they should be consistent
	if p.AverageCostBasis != nil && p.TotalCostBasis != nil {
		expectedTotal := p.AverageCostBasis.Mul(p.Quantity).Mul(decimal.NewFromInt(100)) // Convert to cents
		actualTotal := decimal.NewFromInt(int64(*p.TotalCostBasis))

		// Allow for small rounding differences (within 1 cent)
		if expectedTotal.Sub(actualTotal).Abs().GreaterThan(decimal.NewFromInt(1)) {
			return fmt.Errorf("cost basis inconsistency: average cost basis (%s) * quantity (%s) != total cost basis (%d cents)",
				p.AverageCostBasis.String(), p.Quantity.String(), *p.TotalCostBasis)
		}
	}

	// Validate that cost basis values are reasonable
	if p.AverageCostBasis != nil && p.AverageCostBasis.IsNegative() {
		return errors.New("average cost basis cannot be negative")
	}

	if p.TotalCostBasis != nil && *p.TotalCostBasis < 0 {
		return errors.New("total cost basis cannot be negative")
	}

	return nil
}

// Business logic methods

// UpdateCostBasis updates the position's cost basis after a transaction
func (p *Position) UpdateCostBasis(transactionQuantity decimal.Decimal, transactionPrice decimal.Decimal, transactionAmount Money) error {
	if transactionQuantity.IsZero() {
		return errors.New("transaction quantity cannot be zero")
	}

	if transactionQuantity.IsPositive() {
		// Buy transaction - add to position
		return p.addToCostBasis(transactionQuantity, transactionPrice, transactionAmount)
	} else {
		// Sell transaction - reduce position
		return p.reduceFromCostBasis(transactionQuantity.Abs(), transactionPrice, transactionAmount)
	}
}

// addToCostBasis handles buy transactions
func (p *Position) addToCostBasis(quantity decimal.Decimal, price decimal.Decimal, amount Money) error {
	newQuantity := p.Quantity.Add(quantity)

	if p.Quantity.IsZero() {
		// First purchase
		p.Quantity = newQuantity
		p.AverageCostBasis = &price
		p.TotalCostBasis = &amount
	} else {
		// Additional purchase - calculate weighted average
		currentTotalCost := decimal.NewFromInt(0)
		if p.TotalCostBasis != nil {
			currentTotalCost = decimal.NewFromInt(int64(*p.TotalCostBasis))
		}

		newTotalCost := currentTotalCost.Add(decimal.NewFromInt(int64(amount)))
		newTotalCostMoney := Money(newTotalCost.IntPart())

		newAverageCost := newTotalCost.Div(newQuantity).Div(decimal.NewFromInt(100)) // Divide by quantity then convert from cents to dollars

		p.Quantity = newQuantity
		p.AverageCostBasis = &newAverageCost
		p.TotalCostBasis = &newTotalCostMoney
	}

	return p.validateCostBasis()
}

// reduceFromCostBasis handles sell transactions
func (p *Position) reduceFromCostBasis(quantity decimal.Decimal, price decimal.Decimal, amount Money) error {
	if quantity.GreaterThan(p.Quantity) {
		return fmt.Errorf("cannot sell %s units, only %s available", quantity.String(), p.Quantity.String())
	}

	newQuantity := p.Quantity.Sub(quantity)

	if newQuantity.IsZero() {
		// Selling entire position
		p.Quantity = decimal.Zero
		p.AverageCostBasis = nil
		p.TotalCostBasis = nil
	} else {
		// Partial sale - reduce total cost basis proportionally
		if p.TotalCostBasis != nil {
			currentTotalCost := decimal.NewFromInt(int64(*p.TotalCostBasis))
			soldProportion := quantity.Div(p.Quantity)
			soldCost := currentTotalCost.Mul(soldProportion)
			newTotalCost := currentTotalCost.Sub(soldCost)
			newTotalCostMoney := Money(newTotalCost.IntPart())

			p.Quantity = newQuantity
			p.TotalCostBasis = &newTotalCostMoney
			// Average cost basis remains the same for partial sales
		} else {
			p.Quantity = newQuantity
		}
	}

	return p.validateCostBasis()
}

// CalculateValue calculates the current value of the position
func (p *Position) CalculateValue(currentPrice *decimal.Decimal) *PositionValue {
	value := &PositionValue{
		Position:    p,
		LastUpdated: time.Now(),
	}

	if currentPrice != nil {
		value.CurrentPrice = currentPrice
		// Calculate current value: quantity * price * ownership percentage
		currentValueDecimal := p.Quantity.Mul(*currentPrice).Mul(p.OwnershipPercentage.Div(decimal.NewFromInt(100)))
		value.CurrentValue = Money(currentValueDecimal.Mul(decimal.NewFromInt(100)).IntPart()) // Convert to cents
	}

	// Calculate unrealized gain/loss if we have cost basis
	if p.TotalCostBasis != nil && currentPrice != nil {
		value.UnrealizedGainLoss = value.CurrentValue - *p.TotalCostBasis

		if *p.TotalCostBasis != 0 {
			gainLossPercentage := decimal.NewFromInt(int64(value.UnrealizedGainLoss)).Div(decimal.NewFromInt(int64(*p.TotalCostBasis))).Mul(decimal.NewFromInt(100))
			value.UnrealizedGainLossPercentage = &gainLossPercentage
		}
	}

	return value
}

// CalculateRealizedGains calculates realized gains from a sale
func (p *Position) CalculateRealizedGains(soldQuantity decimal.Decimal, salePrice decimal.Decimal) (Money, error) {
	if soldQuantity.GreaterThan(p.Quantity) {
		return 0, fmt.Errorf("cannot sell %s units, only %s available", soldQuantity.String(), p.Quantity.String())
	}

	if p.AverageCostBasis == nil {
		// No cost basis recorded, assume zero cost (gift, inheritance, etc.)
		saleAmount := soldQuantity.Mul(salePrice).Mul(decimal.NewFromInt(100)) // Convert to cents
		return Money(saleAmount.IntPart()), nil
	}

	// Calculate cost basis of sold shares
	soldCostBasis := soldQuantity.Mul(*p.AverageCostBasis).Mul(decimal.NewFromInt(100)) // Convert to cents
	saleAmount := soldQuantity.Mul(salePrice).Mul(decimal.NewFromInt(100))              // Convert to cents

	realizedGain := Money(saleAmount.IntPart()) - Money(soldCostBasis.IntPart())
	return realizedGain, nil
}

// GetEffectiveQuantity returns the quantity adjusted for ownership percentage
func (p *Position) GetEffectiveQuantity() decimal.Decimal {
	return p.Quantity.Mul(p.OwnershipPercentage.Div(decimal.NewFromInt(100)))
}

// IsEmpty returns true if the position has no quantity
func (p *Position) IsEmpty() bool {
	return p.Quantity.IsZero()
}

// Implement Entity interface
func (p Position) GetID() string             { return p.ID }
func (p *Position) SetID(id string)          { p.ID = id }
func (p Position) GetCreatedAt() time.Time   { return p.CreatedAt }
func (p *Position) SetCreatedAt(t time.Time) { p.CreatedAt = t }
func (p Position) GetUpdatedAt() time.Time   { return p.UpdatedAt }
func (p *Position) SetUpdatedAt(t time.Time) { p.UpdatedAt = t }
