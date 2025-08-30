package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// TransactionFilter defines the filter criteria for transaction queries
type TransactionFilter struct {
	UserID          *uuid.UUID             `json:"user_id,omitempty"`
	PositionID      *uuid.UUID             `json:"position_id,omitempty"`
	PortfolioID     *uuid.UUID             `json:"portfolio_id,omitempty"`
	AssetID         *uuid.UUID             `json:"asset_id,omitempty"`
	TransactionType *model.TransactionType `json:"transaction_type,omitempty"`
	DateFrom        *time.Time             `json:"date_from,omitempty"`
	DateTo          *time.Time             `json:"date_to,omitempty"`
	MinAmount       *model.Money           `json:"min_amount,omitempty"`
	MaxAmount       *model.Money           `json:"max_amount,omitempty"`
	Limit           *int                   `json:"limit,omitempty"`
	Offset          *int                   `json:"offset,omitempty"`
}

// CostBasisCalculation represents cost basis calculation results
type CostBasisCalculation struct {
	PositionID          uuid.UUID       `json:"position_id"`
	TotalQuantity       decimal.Decimal `json:"total_quantity"`
	AverageCostBasis    decimal.Decimal `json:"average_cost_basis"`
	TotalCostBasis      model.Money     `json:"total_cost_basis"`
	RealizedGainLoss    model.Money     `json:"realized_gain_loss"`
	TransactionCount    int             `json:"transaction_count"`
	FirstPurchaseDate   *time.Time      `json:"first_purchase_date,omitempty"`
	LastTransactionDate *time.Time      `json:"last_transaction_date,omitempty"`
}

// TaxLotSummary represents tax lot information for capital gains calculations
type TaxLotSummary struct {
	PositionID      uuid.UUID             `json:"position_id"`
	TransactionID   uuid.UUID             `json:"transaction_id"`
	TransactionDate time.Time             `json:"transaction_date"`
	Quantity        decimal.Decimal       `json:"quantity"`
	PricePerUnit    decimal.Decimal       `json:"price_per_unit"`
	TransactionType model.TransactionType `json:"transaction_type"`
	IsShortTerm     bool                  `json:"is_short_term"`
	DaysHeld        int                   `json:"days_held"`
}

// ITransactionRepository defines the interface for transaction-specific database operations.
// It extends the generic repository with domain-specific methods for complex queries.
type ITransactionRepository interface {
	IRepository[model.Transaction]

	// Enhanced CRUD operations
	GetByUUID(ctx context.Context, id uuid.UUID) (*model.Transaction, error)
	FindWithFilters(ctx context.Context, filter TransactionFilter) ([]model.Transaction, error)
	CountWithFilters(ctx context.Context, filter TransactionFilter) (int, error)

	// Position-based queries
	FindByPositionID(ctx context.Context, positionID uuid.UUID) ([]model.Transaction, error)
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]model.Transaction, error)

	// Cost basis calculation queries
	CalculateCostBasisForPosition(ctx context.Context, positionID uuid.UUID) (*CostBasisCalculation, error)
	GetTaxLotsForPosition(ctx context.Context, positionID uuid.UUID) ([]TaxLotSummary, error)
	CalculateRealizedGainsForUser(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) (*model.RealizedGains, error)

	// Performance and analytics queries
	GetTransactionSummaryByType(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) ([]model.TransactionSummary, error)
	GetCashFlowTransactions(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) ([]model.Transaction, error)
	GetCapitalGainsTransactions(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) ([]model.Transaction, error)

	// Batch operations
	CreateBatch(ctx context.Context, transactions []model.Transaction) error
	UpdateBatch(ctx context.Context, transactions []model.Transaction) error

	// Legacy methods for compatibility
	FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.Transaction, error)
	FindByAssetID(ctx context.Context, assetID int) ([]model.Transaction, error)
	FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) ([]model.Transaction, error)
	FindByDateRange(ctx context.Context, from, to time.Time) ([]model.Transaction, error)
	FindByTransactionType(ctx context.Context, transactionType string) ([]model.Transaction, error)
}

// TransactionRepository is the concrete implementation of ITransactionRepository
type TransactionRepository struct {
	*Repository[model.Transaction]
}

// NewTransactionRepository creates a new transaction repository instance
func NewTransactionRepository(db bun.IDB) *TransactionRepository {
	return &TransactionRepository{
		Repository: NewRepository[model.Transaction](db),
	}
}

// GetByUUID retrieves a transaction by its UUID
func (r *TransactionRepository) GetByUUID(ctx context.Context, id uuid.UUID) (*model.Transaction, error) {
	var transaction model.Transaction
	err := r.db.NewSelect().
		Model(&transaction).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

// FindWithFilters retrieves transactions with multiple filter criteria
func (r *TransactionRepository) FindWithFilters(ctx context.Context, filter TransactionFilter) ([]model.Transaction, error) {
	query := r.db.NewSelect().Model((*model.Transaction)(nil))

	// Apply filters
	query = r.applyTransactionFilters(query, filter)

	// Apply ordering - by transaction date descending for most recent first
	query = query.Order("transaction_date DESC, created_at DESC")

	// Apply pagination
	if filter.Limit != nil && *filter.Limit > 0 {
		query = query.Limit(*filter.Limit)
	}
	if filter.Offset != nil && *filter.Offset > 0 {
		query = query.Offset(*filter.Offset)
	}

	var transactions []model.Transaction
	err := query.Scan(ctx, &transactions)
	return transactions, err
}

// CountWithFilters returns the count of transactions matching the filter criteria
func (r *TransactionRepository) CountWithFilters(ctx context.Context, filter TransactionFilter) (int, error) {
	query := r.db.NewSelect().Model((*model.Transaction)(nil))
	query = r.applyTransactionFilters(query, filter)
	return query.Count(ctx)
}

// applyTransactionFilters applies filter criteria to a query
func (r *TransactionRepository) applyTransactionFilters(query *bun.SelectQuery, filter TransactionFilter) *bun.SelectQuery {
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}

	if filter.PositionID != nil {
		query = query.Where("position_id = ?", *filter.PositionID)
	}

	if filter.PortfolioID != nil {
		query = query.Join("JOIN sigma_finance.positions p ON p.id = transaction.position_id").
			Where("p.portfolio_id = ?", *filter.PortfolioID)
	}

	if filter.AssetID != nil {
		query = query.Join("JOIN sigma_finance.positions p ON p.id = transaction.position_id").
			Where("p.asset_id = ?", *filter.AssetID)
	}

	if filter.TransactionType != nil {
		query = query.Where("type = ?", *filter.TransactionType)
	}

	if filter.DateFrom != nil {
		query = query.Where("transaction_date >= ?", *filter.DateFrom)
	}

	if filter.DateTo != nil {
		query = query.Where("transaction_date <= ?", *filter.DateTo)
	}

	if filter.MinAmount != nil {
		query = query.Where("ABS(amount) >= ?", int64(*filter.MinAmount))
	}

	if filter.MaxAmount != nil {
		query = query.Where("ABS(amount) <= ?", int64(*filter.MaxAmount))
	}

	return query
}

// FindByPositionID retrieves all transactions for a specific position
func (r *TransactionRepository) FindByPositionID(ctx context.Context, positionID uuid.UUID) ([]model.Transaction, error) {
	return r.FindWithFilters(ctx, TransactionFilter{PositionID: &positionID})
}

// FindByUserID retrieves all transactions for a specific user
func (r *TransactionRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]model.Transaction, error) {
	return r.FindWithFilters(ctx, TransactionFilter{UserID: &userID})
}

// CalculateCostBasisForPosition calculates the cost basis for a specific position
func (r *TransactionRepository) CalculateCostBasisForPosition(ctx context.Context, positionID uuid.UUID) (*CostBasisCalculation, error) {
	var result struct {
		TotalQuantity       decimal.Decimal `bun:"total_quantity"`
		WeightedCostSum     decimal.Decimal `bun:"weighted_cost_sum"`
		TotalCostBasis      int64           `bun:"total_cost_basis"`
		RealizedGainLoss    int64           `bun:"realized_gain_loss"`
		TransactionCount    int             `bun:"transaction_count"`
		FirstPurchaseDate   *time.Time      `bun:"first_purchase_date"`
		LastTransactionDate *time.Time      `bun:"last_transaction_date"`
	}

	err := r.db.NewSelect().
		ColumnExpr("COALESCE(SUM(CASE WHEN type IN ('BUY', 'TRANSFER_IN') THEN quantity WHEN type IN ('SELL', 'TRANSFER_OUT') THEN -quantity ELSE 0 END), 0) as total_quantity").
		ColumnExpr("COALESCE(SUM(CASE WHEN type IN ('BUY', 'TRANSFER_IN') AND quantity IS NOT NULL AND price_per_unit IS NOT NULL THEN quantity * price_per_unit ELSE 0 END), 0) as weighted_cost_sum").
		ColumnExpr("COALESCE(SUM(CASE WHEN type IN ('BUY', 'TRANSFER_IN') THEN ABS(amount) ELSE 0 END), 0) as total_cost_basis").
		ColumnExpr("COALESCE(SUM(CASE WHEN type IN ('SELL', 'TRANSFER_OUT') THEN amount ELSE 0 END), 0) as realized_gain_loss").
		ColumnExpr("COUNT(*) as transaction_count").
		ColumnExpr("MIN(CASE WHEN type IN ('BUY', 'TRANSFER_IN') THEN transaction_date END) as first_purchase_date").
		ColumnExpr("MAX(transaction_date) as last_transaction_date").
		Model((*model.Transaction)(nil)).
		Where("position_id = ?", positionID).
		Scan(ctx, &result)
	if err != nil {
		return nil, err
	}

	calculation := &CostBasisCalculation{
		PositionID:          positionID,
		TotalQuantity:       result.TotalQuantity,
		TotalCostBasis:      model.Money(result.TotalCostBasis),
		RealizedGainLoss:    model.Money(result.RealizedGainLoss),
		TransactionCount:    result.TransactionCount,
		FirstPurchaseDate:   result.FirstPurchaseDate,
		LastTransactionDate: result.LastTransactionDate,
	}

	// Calculate average cost basis
	if !result.TotalQuantity.IsZero() && result.TotalCostBasis > 0 {
		calculation.AverageCostBasis = decimal.NewFromInt(result.TotalCostBasis).
			Div(decimal.NewFromInt(100)). // Convert from cents to dollars
			Div(result.TotalQuantity)     // Divide by quantity
	}

	return calculation, nil
}

// GetTaxLotsForPosition retrieves tax lot information for capital gains calculations
func (r *TransactionRepository) GetTaxLotsForPosition(ctx context.Context, positionID uuid.UUID) ([]TaxLotSummary, error) {
	var taxLots []struct {
		TransactionID   uuid.UUID             `bun:"id"`
		TransactionDate time.Time             `bun:"transaction_date"`
		Quantity        decimal.Decimal       `bun:"quantity"`
		PricePerUnit    decimal.Decimal       `bun:"price_per_unit"`
		TransactionType model.TransactionType `bun:"type"`
	}

	err := r.db.NewSelect().
		Model(&taxLots).
		Where("position_id = ?", positionID).
		Where("type IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT')").
		Where("quantity IS NOT NULL AND price_per_unit IS NOT NULL").
		Order("transaction_date ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	// Convert to TaxLotSummary with short/long term classification
	result := make([]TaxLotSummary, len(taxLots))
	now := time.Now()

	for i, lot := range taxLots {
		daysHeld := int(now.Sub(lot.TransactionDate).Hours() / 24)
		isShortTerm := daysHeld <= 365 // Short-term if held for 1 year or less

		result[i] = TaxLotSummary{
			PositionID:      positionID,
			TransactionID:   lot.TransactionID,
			TransactionDate: lot.TransactionDate,
			Quantity:        lot.Quantity,
			PricePerUnit:    lot.PricePerUnit,
			TransactionType: lot.TransactionType,
			IsShortTerm:     isShortTerm,
			DaysHeld:        daysHeld,
		}
	}

	return result, nil
}

// CalculateRealizedGainsForUser calculates realized gains for a user within a date range
func (r *TransactionRepository) CalculateRealizedGainsForUser(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) (*model.RealizedGains, error) {
	var result struct {
		TotalRealized    int64 `bun:"total_realized"`
		TransactionCount int   `bun:"transaction_count"`
	}

	err := r.db.NewSelect().
		ColumnExpr("COALESCE(SUM(amount), 0) as total_realized").
		ColumnExpr("COUNT(*) as transaction_count").
		Model((*model.Transaction)(nil)).
		Where("user_id = ?", userID).
		Where("type = 'SELL'").
		Where("transaction_date >= ? AND transaction_date <= ?", dateFrom, dateTo).
		Scan(ctx, &result)
	if err != nil {
		return nil, err
	}

	// For now, we'll classify all as short-term gains
	// A more sophisticated implementation would track holding periods
	return &model.RealizedGains{
		UserID:           userID,
		TotalRealized:    model.Money(result.TotalRealized),
		ShortTermGains:   model.Money(result.TotalRealized),
		LongTermGains:    0,
		TransactionCount: result.TransactionCount,
		StartDate:        dateFrom,
		EndDate:          dateTo,
	}, nil
}

// GetTransactionSummaryByType returns transaction summaries grouped by type
func (r *TransactionRepository) GetTransactionSummaryByType(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) ([]model.TransactionSummary, error) {
	var summaries []struct {
		TransactionType model.TransactionType `bun:"type"`
		Count           int                   `bun:"count"`
		TotalAmount     int64                 `bun:"total_amount"`
		TotalQuantity   decimal.Decimal       `bun:"total_quantity"`
		AveragePrice    decimal.Decimal       `bun:"average_price"`
	}

	err := r.db.NewSelect().
		ColumnExpr("type").
		ColumnExpr("COUNT(*) as count").
		ColumnExpr("SUM(ABS(amount)) as total_amount").
		ColumnExpr("COALESCE(SUM(quantity), 0) as total_quantity").
		ColumnExpr("COALESCE(AVG(price_per_unit), 0) as average_price").
		Model((*model.Transaction)(nil)).
		Where("user_id = ?", userID).
		Where("transaction_date >= ? AND transaction_date <= ?", dateFrom, dateTo).
		Group("type").
		Order("type").
		Scan(ctx, &summaries)
	if err != nil {
		return nil, err
	}

	// Convert to result format
	result := make([]model.TransactionSummary, len(summaries))
	for i, summary := range summaries {
		result[i] = model.TransactionSummary{
			TransactionType: summary.TransactionType,
			Count:           summary.Count,
			TotalAmount:     model.Money(summary.TotalAmount),
			TotalQuantity:   summary.TotalQuantity,
			AveragePrice:    summary.AveragePrice,
		}
	}

	return result, nil
}

// GetCashFlowTransactions retrieves transactions that affect cash flow
func (r *TransactionRepository) GetCashFlowTransactions(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) ([]model.Transaction, error) {
	cashFlowTypes := []model.TransactionType{
		model.TransactionTypeDeposit,
		model.TransactionTypeWithdrawal,
		model.TransactionTypeTransferIn,
		model.TransactionTypeTransferOut,
		model.TransactionTypeDividend,
		model.TransactionTypeInterest,
		model.TransactionTypeFee,
	}

	var transactions []model.Transaction
	err := r.db.NewSelect().
		Model(&transactions).
		Where("user_id = ?", userID).
		Where("type IN (?)", bun.In(cashFlowTypes)).
		Where("transaction_date >= ? AND transaction_date <= ?", dateFrom, dateTo).
		Order("transaction_date DESC").
		Scan(ctx)

	return transactions, err
}

// GetCapitalGainsTransactions retrieves transactions that generate capital gains
func (r *TransactionRepository) GetCapitalGainsTransactions(ctx context.Context, userID uuid.UUID, dateFrom, dateTo time.Time) ([]model.Transaction, error) {
	return r.FindWithFilters(ctx, TransactionFilter{
		UserID:          &userID,
		TransactionType: &[]model.TransactionType{model.TransactionTypeSell}[0],
		DateFrom:        &dateFrom,
		DateTo:          &dateTo,
	})
}

// CreateBatch creates multiple transactions in a single operation
func (r *TransactionRepository) CreateBatch(ctx context.Context, transactions []model.Transaction) error {
	if len(transactions) == 0 {
		return nil
	}

	// Set timestamps
	now := time.Now()
	for i := range transactions {
		transactions[i].CreatedAt = now
	}

	_, err := r.db.NewInsert().
		Model(&transactions).
		Exec(ctx)

	return err
}

// UpdateBatch updates multiple transactions in a single operation
func (r *TransactionRepository) UpdateBatch(ctx context.Context, transactions []model.Transaction) error {
	if len(transactions) == 0 {
		return nil
	}

	// Use bulk update with ON CONFLICT for better performance
	_, err := r.db.NewInsert().
		Model(&transactions).
		On("CONFLICT (id) DO UPDATE").
		Set("type = EXCLUDED.type").
		Set("amount = EXCLUDED.amount").
		Set("quantity = EXCLUDED.quantity").
		Set("price_per_unit = EXCLUDED.price_per_unit").
		Set("fee = EXCLUDED.fee").
		Set("notes = EXCLUDED.notes").
		Set("transaction_date = EXCLUDED.transaction_date").
		Exec(ctx)

	return err
}

// Legacy methods for compatibility

// FindByPortfolioID retrieves all transactions for a specific portfolio (legacy)
func (r *TransactionRepository) FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.Transaction, error) {
	// Convert int to UUID - this is a compatibility method
	// In practice, you'd need proper UUID conversion logic
	return []model.Transaction{}, nil
}

// FindByAssetID retrieves all transactions for a specific asset (legacy)
func (r *TransactionRepository) FindByAssetID(ctx context.Context, assetID int) ([]model.Transaction, error) {
	// Convert int to UUID - this is a compatibility method
	// In practice, you'd need proper UUID conversion logic
	return []model.Transaction{}, nil
}

// FindByPortfolioAndAsset retrieves transactions for a specific portfolio and asset combination (legacy)
func (r *TransactionRepository) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) ([]model.Transaction, error) {
	// Convert int to UUID - this is a compatibility method
	// In practice, you'd need proper UUID conversion logic
	return []model.Transaction{}, nil
}

// FindByDateRange retrieves transactions within a specific date range (legacy)
func (r *TransactionRepository) FindByDateRange(ctx context.Context, from, to time.Time) ([]model.Transaction, error) {
	return r.FindWithFilters(ctx, TransactionFilter{
		DateFrom: &from,
		DateTo:   &to,
	})
}

// FindByTransactionType retrieves transactions of a specific type (legacy)
func (r *TransactionRepository) FindByTransactionType(ctx context.Context, transactionType string) ([]model.Transaction, error) {
	transType := model.TransactionType(transactionType)
	return r.FindWithFilters(ctx, TransactionFilter{
		TransactionType: &transType,
	})
}
