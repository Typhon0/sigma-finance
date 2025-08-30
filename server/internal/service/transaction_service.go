package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// TransactionService provides business logic for transaction management operations
type TransactionService struct {
	transactionRepo repository.ITransactionRepository
	positionRepo    repository.IPositionRepository
	assetRepo       repository.IAssetRepository
}

// NewTransactionService creates a new TransactionService instance
func NewTransactionService(
	transactionRepo repository.ITransactionRepository,
	positionRepo repository.IPositionRepository,
	assetRepo repository.IAssetRepository,
) *TransactionService {
	return &TransactionService{
		transactionRepo: transactionRepo,
		positionRepo:    positionRepo,
		assetRepo:       assetRepo,
	}
}

// ITransactionService defines the interface for transaction management operations
type ITransactionService interface {
	// Core CRUD operations
	RecordTransaction(ctx context.Context, req TransactionRequest) (*model.Transaction, error)
	GetTransaction(ctx context.Context, id uuid.UUID) (*model.Transaction, error)
	UpdateTransaction(ctx context.Context, id uuid.UUID, req UpdateTransactionRequest) (*model.Transaction, error)
	DeleteTransaction(ctx context.Context, id uuid.UUID) error

	// Query operations
	GetTransactionHistory(ctx context.Context, filter TransactionFilter) ([]*model.Transaction, error)
	GetUserTransactions(ctx context.Context, userID uuid.UUID, filter TransactionFilter) ([]*model.Transaction, error)
	GetPositionTransactions(ctx context.Context, positionID uuid.UUID) ([]*model.Transaction, error)

	// Cost basis and gains calculations
	CalculateCostBasis(ctx context.Context, positionID uuid.UUID) (*model.CostBasisInfo, error)
	CalculateRealizedGains(ctx context.Context, userID uuid.UUID, timeRange TimeRange) (*model.RealizedGains, error)
	GetTransactionSummary(ctx context.Context, userID uuid.UUID, timeRange TimeRange) ([]model.TransactionSummary, error)

	// Business logic operations
	ProcessBuyTransaction(ctx context.Context, req BuyTransactionRequest) (*TransactionResult, error)
	ProcessSellTransaction(ctx context.Context, req SellTransactionRequest) (*TransactionResult, error)
	ProcessCashTransaction(ctx context.Context, req CashTransactionRequest) (*model.Transaction, error)
}

// Request/Response structures

type TransactionRequest struct {
	UserID          uuid.UUID             `json:"user_id" validate:"required"`
	PositionID      *uuid.UUID            `json:"position_id,omitempty"`
	Type            model.TransactionType `json:"type" validate:"required"`
	Amount          model.Money           `json:"amount" validate:"required"`
	Quantity        *decimal.Decimal      `json:"quantity,omitempty"`
	PricePerUnit    *decimal.Decimal      `json:"price_per_unit,omitempty"`
	Fee             model.Money           `json:"fee"`
	Notes           *string               `json:"notes,omitempty"`
	TransactionDate time.Time             `json:"transaction_date" validate:"required"`
}

type UpdateTransactionRequest struct {
	Type            *model.TransactionType `json:"type,omitempty"`
	Amount          *model.Money           `json:"amount,omitempty"`
	Quantity        *decimal.Decimal       `json:"quantity,omitempty"`
	PricePerUnit    *decimal.Decimal       `json:"price_per_unit,omitempty"`
	Fee             *model.Money           `json:"fee,omitempty"`
	Notes           *string                `json:"notes,omitempty"`
	TransactionDate *time.Time             `json:"transaction_date,omitempty"`
}

type BuyTransactionRequest struct {
	UserID          uuid.UUID       `json:"user_id" validate:"required"`
	PortfolioID     uuid.UUID       `json:"portfolio_id" validate:"required"`
	AssetID         uuid.UUID       `json:"asset_id" validate:"required"`
	Quantity        decimal.Decimal `json:"quantity" validate:"required"`
	PricePerUnit    decimal.Decimal `json:"price_per_unit" validate:"required"`
	Fee             model.Money     `json:"fee"`
	Notes           *string         `json:"notes,omitempty"`
	TransactionDate time.Time       `json:"transaction_date" validate:"required"`
}

type SellTransactionRequest struct {
	UserID          uuid.UUID       `json:"user_id" validate:"required"`
	PositionID      uuid.UUID       `json:"position_id" validate:"required"`
	Quantity        decimal.Decimal `json:"quantity" validate:"required"`
	PricePerUnit    decimal.Decimal `json:"price_per_unit" validate:"required"`
	Fee             model.Money     `json:"fee"`
	Notes           *string         `json:"notes,omitempty"`
	TransactionDate time.Time       `json:"transaction_date" validate:"required"`
}

type CashTransactionRequest struct {
	UserID          uuid.UUID             `json:"user_id" validate:"required"`
	Type            model.TransactionType `json:"type" validate:"required"` // DEPOSIT, WITHDRAWAL, etc.
	Amount          model.Money           `json:"amount" validate:"required"`
	Fee             model.Money           `json:"fee"`
	Notes           *string               `json:"notes,omitempty"`
	TransactionDate time.Time             `json:"transaction_date" validate:"required"`
}

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

type TimeRange struct {
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

type TransactionResult struct {
	Transaction   *model.Transaction `json:"transaction"`
	Position      *model.Position    `json:"position"`
	RealizedGains *model.Money       `json:"realized_gains,omitempty"`
}

// RecordTransaction creates a new transaction with validation
func (s *TransactionService) RecordTransaction(ctx context.Context, req TransactionRequest) (*model.Transaction, error) {
	// Validate required fields
	if req.UserID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}

	// Create transaction model
	transaction := &model.Transaction{
		UserID:          req.UserID,
		PositionID:      req.PositionID,
		Type:            req.Type,
		Amount:          req.Amount,
		Fee:             req.Fee,
		TransactionDate: req.TransactionDate,
	}

	// Set optional fields
	if req.Quantity != nil {
		transaction.Quantity = req.Quantity
	}
	if req.PricePerUnit != nil {
		transaction.PricePerUnit = req.PricePerUnit
	}
	if req.Notes != nil && *req.Notes != "" {
		notes := *req.Notes
		transaction.Notes = &notes
	}

	// Validate the transaction
	if err := transaction.Validate(); err != nil {
		return nil, fmt.Errorf("transaction validation failed: %w", err)
	}

	// Create in repository
	createdTransaction, err := s.transactionRepo.Create(ctx, transaction)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	return createdTransaction, nil
}

// GetTransaction retrieves a transaction by ID
func (s *TransactionService) GetTransaction(ctx context.Context, id uuid.UUID) (*model.Transaction, error) {
	if id == uuid.Nil {
		return nil, errors.New("transaction ID is required")
	}

	transaction, err := s.transactionRepo.GetByUUID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	return transaction, nil
}

// UpdateTransaction updates an existing transaction
func (s *TransactionService) UpdateTransaction(ctx context.Context, id uuid.UUID, req UpdateTransactionRequest) (*model.Transaction, error) {
	if id == uuid.Nil {
		return nil, errors.New("transaction ID is required")
	}

	// Get existing transaction
	transaction, err := s.transactionRepo.GetByUUID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	// Update fields if provided
	if req.Type != nil {
		transaction.Type = *req.Type
	}
	if req.Amount != nil {
		transaction.Amount = *req.Amount
	}
	if req.Quantity != nil {
		transaction.Quantity = req.Quantity
	}
	if req.PricePerUnit != nil {
		transaction.PricePerUnit = req.PricePerUnit
	}
	if req.Fee != nil {
		transaction.Fee = *req.Fee
	}
	if req.Notes != nil {
		if *req.Notes == "" {
			transaction.Notes = nil
		} else {
			notes := *req.Notes
			transaction.Notes = &notes
		}
	}
	if req.TransactionDate != nil {
		transaction.TransactionDate = *req.TransactionDate
	}

	// Validate the updated transaction
	if err := transaction.Validate(); err != nil {
		return nil, fmt.Errorf("transaction validation failed: %w", err)
	}

	// Update in repository
	if err := s.transactionRepo.Update(ctx, transaction); err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	return transaction, nil
}

// DeleteTransaction removes a transaction
func (s *TransactionService) DeleteTransaction(ctx context.Context, id uuid.UUID) error {
	if id == uuid.Nil {
		return errors.New("transaction ID is required")
	}

	// Check if transaction exists
	_, err := s.transactionRepo.GetByUUID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get transaction: %w", err)
	}

	// TODO: Consider reversing the transaction's effect on positions
	// This would require additional business logic to handle cost basis adjustments

	// Note: The base repository Delete method uses uint, but we need UUID support
	// We'll need to use the repository's GetDB() method for custom deletion
	_, err = s.transactionRepo.GetDB().NewDelete().
		Model((*model.Transaction)(nil)).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete transaction: %w", err)
	}

	return nil
}

// GetTransactionHistory retrieves transactions with filtering
func (s *TransactionService) GetTransactionHistory(ctx context.Context, filter TransactionFilter) ([]*model.Transaction, error) {
	repoFilter := repository.TransactionFilter{
		UserID:          filter.UserID,
		PositionID:      filter.PositionID,
		PortfolioID:     filter.PortfolioID,
		AssetID:         filter.AssetID,
		TransactionType: filter.TransactionType,
		DateFrom:        filter.DateFrom,
		DateTo:          filter.DateTo,
		MinAmount:       filter.MinAmount,
		MaxAmount:       filter.MaxAmount,
		Limit:           filter.Limit,
		Offset:          filter.Offset,
	}

	transactions, err := s.transactionRepo.FindWithFilters(ctx, repoFilter)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction history: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Transaction, len(transactions))
	for i := range transactions {
		result[i] = &transactions[i]
	}

	return result, nil
}

// GetUserTransactions retrieves all transactions for a user
func (s *TransactionService) GetUserTransactions(ctx context.Context, userID uuid.UUID, filter TransactionFilter) ([]*model.Transaction, error) {
	if userID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}

	// Set user ID in filter
	filter.UserID = &userID

	return s.GetTransactionHistory(ctx, filter)
}

// GetPositionTransactions retrieves all transactions for a position
func (s *TransactionService) GetPositionTransactions(ctx context.Context, positionID uuid.UUID) ([]*model.Transaction, error) {
	if positionID == uuid.Nil {
		return nil, errors.New("position ID is required")
	}

	transactions, err := s.transactionRepo.FindByPositionID(ctx, positionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get position transactions: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Transaction, len(transactions))
	for i := range transactions {
		result[i] = &transactions[i]
	}

	return result, nil
}

// CalculateCostBasis calculates the cost basis for a position
func (s *TransactionService) CalculateCostBasis(ctx context.Context, positionID uuid.UUID) (*model.CostBasisInfo, error) {
	if positionID == uuid.Nil {
		return nil, errors.New("position ID is required")
	}

	calculation, err := s.transactionRepo.CalculateCostBasisForPosition(ctx, positionID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate cost basis: %w", err)
	}

	// Convert to domain model
	costBasisInfo := &model.CostBasisInfo{
		PositionID:          calculation.PositionID,
		TotalQuantity:       calculation.TotalQuantity,
		AverageCostBasis:    calculation.AverageCostBasis,
		TotalCostBasis:      calculation.TotalCostBasis,
		RealizedGainLoss:    calculation.RealizedGainLoss,
		TransactionCount:    calculation.TransactionCount,
		FirstPurchaseDate:   calculation.FirstPurchaseDate,
		LastTransactionDate: calculation.LastTransactionDate,
	}

	return costBasisInfo, nil
}

// CalculateRealizedGains calculates realized gains for a user within a time range
func (s *TransactionService) CalculateRealizedGains(ctx context.Context, userID uuid.UUID, timeRange TimeRange) (*model.RealizedGains, error) {
	if userID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}

	realizedGains, err := s.transactionRepo.CalculateRealizedGainsForUser(ctx, userID, timeRange.StartDate, timeRange.EndDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate realized gains: %w", err)
	}

	return realizedGains, nil
}

// GetTransactionSummary returns transaction summaries grouped by type
func (s *TransactionService) GetTransactionSummary(ctx context.Context, userID uuid.UUID, timeRange TimeRange) ([]model.TransactionSummary, error) {
	if userID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}

	summaries, err := s.transactionRepo.GetTransactionSummaryByType(ctx, userID, timeRange.StartDate, timeRange.EndDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction summary: %w", err)
	}

	return summaries, nil
}

// ProcessBuyTransaction handles a buy transaction with position updates
func (s *TransactionService) ProcessBuyTransaction(ctx context.Context, req BuyTransactionRequest) (*TransactionResult, error) {
	// Validate request
	if req.UserID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}
	if req.PortfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}
	if req.AssetID == uuid.Nil {
		return nil, errors.New("asset ID is required")
	}
	if req.Quantity.IsNegative() || req.Quantity.IsZero() {
		return nil, errors.New("quantity must be positive")
	}
	if req.PricePerUnit.IsNegative() || req.PricePerUnit.IsZero() {
		return nil, errors.New("price per unit must be positive")
	}

	// Calculate total amount
	totalAmount := req.Quantity.Mul(req.PricePerUnit).Mul(decimal.NewFromInt(100)) // Convert to cents
	amount := model.Money(totalAmount.IntPart())

	// Find or create position
	position, err := s.positionRepo.GetByPortfolioAndAsset(ctx, req.PortfolioID, req.AssetID)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	var positionID uuid.UUID
	if position == nil {
		// Create new position
		newPosition := &model.Position{
			PortfolioID:         req.PortfolioID,
			AssetID:             req.AssetID,
			Quantity:            decimal.Zero,
			OwnershipPercentage: decimal.NewFromInt(100),
		}

		createdPosition, err := s.positionRepo.Create(ctx, newPosition)
		if err != nil {
			return nil, fmt.Errorf("failed to create position: %w", err)
		}
		position = createdPosition
		positionID = createdPosition.ID
	} else {
		positionID = position.ID
	}

	// Create buy transaction
	transaction := &model.Transaction{
		UserID:          req.UserID,
		PositionID:      &positionID,
		Type:            model.TransactionTypeBuy,
		Amount:          amount,
		Quantity:        &req.Quantity,
		PricePerUnit:    &req.PricePerUnit,
		Fee:             req.Fee,
		TransactionDate: req.TransactionDate,
	}

	if req.Notes != nil && *req.Notes != "" {
		notes := *req.Notes
		transaction.Notes = &notes
	}

	// Validate and create transaction
	if err := transaction.Validate(); err != nil {
		return nil, fmt.Errorf("transaction validation failed: %w", err)
	}

	createdTransaction, err := s.transactionRepo.Create(ctx, transaction)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Update position cost basis
	if err := position.UpdateCostBasis(req.Quantity, req.PricePerUnit, amount); err != nil {
		return nil, fmt.Errorf("failed to update cost basis: %w", err)
	}

	// Save updated position
	if err := s.positionRepo.Update(ctx, position); err != nil {
		return nil, fmt.Errorf("failed to update position: %w", err)
	}

	return &TransactionResult{
		Transaction: createdTransaction,
		Position:    position,
	}, nil
}

// ProcessSellTransaction handles a sell transaction with position updates and realized gains calculation
func (s *TransactionService) ProcessSellTransaction(ctx context.Context, req SellTransactionRequest) (*TransactionResult, error) {
	// Validate request
	if req.UserID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}
	if req.PositionID == uuid.Nil {
		return nil, errors.New("position ID is required")
	}
	if req.Quantity.IsNegative() || req.Quantity.IsZero() {
		return nil, errors.New("quantity must be positive")
	}
	if req.PricePerUnit.IsNegative() || req.PricePerUnit.IsZero() {
		return nil, errors.New("price per unit must be positive")
	}

	// Get position
	position, err := s.positionRepo.GetByUUID(ctx, req.PositionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	// Check if sufficient quantity exists
	if req.Quantity.GreaterThan(position.Quantity) {
		return nil, fmt.Errorf("insufficient quantity: have %s, trying to sell %s",
			position.Quantity.String(), req.Quantity.String())
	}

	// Calculate realized gains
	realizedGains, err := position.CalculateRealizedGains(req.Quantity, req.PricePerUnit)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate realized gains: %w", err)
	}

	// Calculate total amount (negative for sell)
	totalAmount := req.Quantity.Mul(req.PricePerUnit).Mul(decimal.NewFromInt(100)) // Convert to cents
	amount := -model.Money(totalAmount.IntPart())                                  // Negative for sell

	// Create sell transaction
	transaction := &model.Transaction{
		UserID:          req.UserID,
		PositionID:      &req.PositionID,
		Type:            model.TransactionTypeSell,
		Amount:          amount,
		Quantity:        &req.Quantity,
		PricePerUnit:    &req.PricePerUnit,
		Fee:             req.Fee,
		TransactionDate: req.TransactionDate,
	}

	if req.Notes != nil && *req.Notes != "" {
		notes := *req.Notes
		transaction.Notes = &notes
	}

	// Validate and create transaction
	if err := transaction.Validate(); err != nil {
		return nil, fmt.Errorf("transaction validation failed: %w", err)
	}

	createdTransaction, err := s.transactionRepo.Create(ctx, transaction)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Update position cost basis (negative quantity for sell)
	if err := position.UpdateCostBasis(req.Quantity.Neg(), req.PricePerUnit, amount); err != nil {
		return nil, fmt.Errorf("failed to update cost basis: %w", err)
	}

	// Save updated position
	if err := s.positionRepo.Update(ctx, position); err != nil {
		return nil, fmt.Errorf("failed to update position: %w", err)
	}

	return &TransactionResult{
		Transaction:   createdTransaction,
		Position:      position,
		RealizedGains: &realizedGains,
	}, nil
}

// ProcessCashTransaction handles cash-only transactions (deposits, withdrawals, etc.)
func (s *TransactionService) ProcessCashTransaction(ctx context.Context, req CashTransactionRequest) (*model.Transaction, error) {
	// Validate request
	if req.UserID == uuid.Nil {
		return nil, errors.New("user ID is required")
	}

	// Create a temporary transaction to use the IsCashFlowTransaction method
	tempTransaction := &model.Transaction{Type: req.Type}
	if !tempTransaction.IsCashFlowTransaction() {
		return nil, fmt.Errorf("transaction type %s is not a cash flow transaction", req.Type)
	}

	// Create transaction
	transaction := &model.Transaction{
		UserID:          req.UserID,
		Type:            req.Type,
		Amount:          req.Amount,
		Fee:             req.Fee,
		TransactionDate: req.TransactionDate,
	}

	if req.Notes != nil && *req.Notes != "" {
		notes := *req.Notes
		transaction.Notes = &notes
	}

	// Validate and create transaction
	if err := transaction.Validate(); err != nil {
		return nil, fmt.Errorf("transaction validation failed: %w", err)
	}

	createdTransaction, err := s.transactionRepo.Create(ctx, transaction)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	return createdTransaction, nil
}
