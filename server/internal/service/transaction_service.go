package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"time"

	"github.com/shopspring/decimal"
)

// TransactionService provides business logic for transaction management operations
type TransactionService struct {
	uow repository.IUnitOfWork
}

// NewTransactionService creates a new TransactionService instance
func NewTransactionService(uow repository.IUnitOfWork) *TransactionService {
	return &TransactionService{
		uow: uow,
	}
}

// ITransactionService defines the interface for transaction management operations
type ITransactionService interface {
	// Core CRUD operations
	RecordTransaction(ctx context.Context, req TransactionRequest) (*model.Transaction, error)
	GetTransaction(ctx context.Context, id string) (*model.Transaction, error)
	UpdateTransaction(ctx context.Context, id string, req UpdateTransactionRequest) (*model.Transaction, error)
	DeleteTransaction(ctx context.Context, id string) error

	// Query operations
	GetTransactionHistory(ctx context.Context, filter TransactionFilter) ([]*model.Transaction, error)
	GetUserTransactions(ctx context.Context, userID string, filter TransactionFilter) ([]*model.Transaction, error)
	GetPositionTransactions(ctx context.Context, positionID string) ([]*model.Transaction, error)

	// Cost basis and gains calculations
	CalculateCostBasis(ctx context.Context, positionID string) (*model.CostBasisInfo, error)
	CalculateRealizedGains(ctx context.Context, userID string, timeRange TimeRange) (*model.RealizedGains, error)
	GetTransactionSummary(ctx context.Context, userID string, timeRange TimeRange) ([]model.TransactionSummary, error)

	// Business logic operations
	ProcessBuyTransaction(ctx context.Context, req BuyTransactionRequest) (*TransactionResult, error)
	ProcessSellTransaction(ctx context.Context, req SellTransactionRequest) (*TransactionResult, error)
	ProcessCashTransaction(ctx context.Context, req CashTransactionRequest) (*model.Transaction, error)
}

// Request/Response structures

type TransactionRequest struct {
	UserID          string                `json:"user_id" validate:"required"`
	PositionID      *string               `json:"position_id,omitempty"`
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
	UserID          string          `json:"user_id" validate:"required"`
	PortfolioID     string          `json:"portfolio_id" validate:"required"`
	AssetID         string          `json:"asset_id" validate:"required"`
	Quantity        decimal.Decimal `json:"quantity" validate:"required"`
	PricePerUnit    decimal.Decimal `json:"price_per_unit" validate:"required"`
	Fee             model.Money     `json:"fee"`
	Notes           *string         `json:"notes,omitempty"`
	TransactionDate time.Time       `json:"transaction_date" validate:"required"`
}

type SellTransactionRequest struct {
	UserID          string          `json:"user_id" validate:"required"`
	PositionID      string          `json:"position_id" validate:"required"`
	Quantity        decimal.Decimal `json:"quantity" validate:"required"`
	PricePerUnit    decimal.Decimal `json:"price_per_unit" validate:"required"`
	Fee             model.Money     `json:"fee"`
	Notes           *string         `json:"notes,omitempty"`
	TransactionDate time.Time       `json:"transaction_date" validate:"required"`
}

type CashTransactionRequest struct {
	UserID          string                `json:"user_id" validate:"required"`
	Type            model.TransactionType `json:"type" validate:"required"` // DEPOSIT, WITHDRAWAL, etc.
	Amount          model.Money           `json:"amount" validate:"required"`
	Fee             model.Money           `json:"fee"`
	Notes           *string               `json:"notes,omitempty"`
	TransactionDate time.Time             `json:"transaction_date" validate:"required"`
}

type TransactionFilter struct {
	UserID          *string                `json:"user_id,omitempty"`
	PositionID      *string                `json:"position_id,omitempty"`
	PortfolioID     *string                `json:"portfolio_id,omitempty"`
	AssetID         *string                `json:"asset_id,omitempty"`
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
	if req.UserID == "" {
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
	createdTransaction, err := s.uow.Transaction().Create(ctx, transaction)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	return createdTransaction, nil
}

// GetTransaction retrieves a transaction by ID
func (s *TransactionService) GetTransaction(ctx context.Context, id string) (*model.Transaction, error) {
	if id == "" {
		return nil, errors.New("transaction ID is required")
	}

	transaction, err := s.uow.Transaction().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	return transaction, nil
}

// UpdateTransaction updates an existing transaction
func (s *TransactionService) UpdateTransaction(ctx context.Context, id string, req UpdateTransactionRequest) (*model.Transaction, error) {
	if id == "" {
		return nil, errors.New("transaction ID is required")
	}

	// Get existing transaction
	transaction, err := s.uow.Transaction().GetByID(ctx, id)
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
	if err := s.uow.Transaction().Update(ctx, transaction); err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	return transaction, nil
}

// DeleteTransaction removes a transaction
func (s *TransactionService) DeleteTransaction(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("transaction ID is required")
	}

	tx, err := s.uow.Transaction().GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get transaction: %w", err)
	}

	if tx.PositionID != nil {
		return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
			pos, err := uow.Position().GetByID(ctx, *tx.PositionID)
			if err != nil {
				return fmt.Errorf("failed to get position: %w", err)
			}

			allTxns, err := uow.Transaction().FindByPositionID(ctx, *tx.PositionID)
			if err != nil {
				return fmt.Errorf("failed to get position transactions: %w", err)
			}

			pos.Quantity = decimal.Zero
			pos.AverageCostBasis = nil
			pos.TotalCostBasis = nil

			for _, t := range allTxns {
				if t.ID == id {
					continue
				}

				if t.Quantity == nil || t.PricePerUnit == nil {
					continue
				}

				signedQty, signedAmt := getSignedTransactionValues(&t)
				if err := pos.UpdateCostBasis(signedQty, *t.PricePerUnit, signedAmt); err != nil {
					return fmt.Errorf("failed to replay transaction %s: %w", t.ID, err)
				}
			}

			if err := uow.Position().Update(ctx, pos); err != nil {
				return fmt.Errorf("failed to update position: %w", err)
			}

			return uow.Transaction().Delete(ctx, id)
		})
	}

	return s.uow.Transaction().Delete(ctx, id)
}

func getSignedTransactionValues(t *model.Transaction) (decimal.Decimal, model.Money) {
	switch t.Type {
	case model.TransactionTypeSell, model.TransactionTypeTransferOut:
		return t.Quantity.Neg(), -t.Amount
	default:
		return *t.Quantity, t.Amount
	}
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

	transactions, err := s.uow.Transaction().FindWithFilters(ctx, repoFilter)
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
func (s *TransactionService) GetUserTransactions(ctx context.Context, userID string, filter TransactionFilter) ([]*model.Transaction, error) {
	if userID == "" {
		return nil, errors.New("user ID is required")
	}

	// Set user ID in filter
	filter.UserID = &userID

	return s.GetTransactionHistory(ctx, filter)
}

// GetPositionTransactions retrieves all transactions for a position
func (s *TransactionService) GetPositionTransactions(ctx context.Context, positionID string) ([]*model.Transaction, error) {
	if positionID == "" {
		return nil, errors.New("position ID is required")
	}

	transactions, err := s.uow.Transaction().FindByPositionID(ctx, positionID)
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
func (s *TransactionService) CalculateCostBasis(ctx context.Context, positionID string) (*model.CostBasisInfo, error) {
	if positionID == "" {
		return nil, errors.New("position ID is required")
	}

	calculation, err := s.uow.Transaction().CalculateCostBasisForPosition(ctx, positionID)
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
func (s *TransactionService) CalculateRealizedGains(ctx context.Context, userID string, timeRange TimeRange) (*model.RealizedGains, error) {
	if userID == "" {
		return nil, errors.New("user ID is required")
	}

	realizedGains, err := s.uow.Transaction().CalculateRealizedGainsForUser(ctx, userID, timeRange.StartDate, timeRange.EndDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate realized gains: %w", err)
	}

	return realizedGains, nil
}

// GetTransactionSummary returns transaction summaries grouped by type
func (s *TransactionService) GetTransactionSummary(ctx context.Context, userID string, timeRange TimeRange) ([]model.TransactionSummary, error) {
	if userID == "" {
		return nil, errors.New("user ID is required")
	}

	summaries, err := s.uow.Transaction().GetTransactionSummaryByType(ctx, userID, timeRange.StartDate, timeRange.EndDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction summary: %w", err)
	}

	return summaries, nil
}

// ProcessBuyTransaction handles a buy transaction with position updates
func (s *TransactionService) ProcessBuyTransaction(ctx context.Context, req BuyTransactionRequest) (*TransactionResult, error) {
	if req.UserID == "" {
		return nil, errors.New("user ID is required")
	}
	if req.PortfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}
	if req.AssetID == "" {
		return nil, errors.New("asset ID is required")
	}
	if req.Quantity.IsNegative() || req.Quantity.IsZero() {
		return nil, errors.New("quantity must be positive")
	}
	if req.PricePerUnit.IsNegative() || req.PricePerUnit.IsZero() {
		return nil, errors.New("price per unit must be positive")
	}

	totalAmount := req.Quantity.Mul(req.PricePerUnit).Mul(decimal.NewFromInt(100))
	amount := model.Money(totalAmount.IntPart())

	var result *TransactionResult
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		position, err := uow.Position().GetByPortfolioAndAsset(ctx, req.PortfolioID, req.AssetID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to get position: %w", err)
		}

		var positionID string
		if position == nil {
			newPosition := &model.Position{
				PortfolioID:         req.PortfolioID,
				AssetID:             req.AssetID,
				Quantity:            decimal.Zero,
				OwnershipPercentage: decimal.NewFromInt(100),
			}

			createdPosition, err := uow.Position().Create(ctx, newPosition)
			if err != nil {
				return fmt.Errorf("failed to create position: %w", err)
			}
			position = createdPosition
			positionID = createdPosition.ID
		} else {
			positionID = position.ID
		}

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

		if err := transaction.Validate(); err != nil {
			return fmt.Errorf("transaction validation failed: %w", err)
		}

		createdTransaction, err := uow.Transaction().Create(ctx, transaction)
		if err != nil {
			return fmt.Errorf("failed to create transaction: %w", err)
		}

		if err := position.UpdateCostBasis(req.Quantity, req.PricePerUnit, amount); err != nil {
			return fmt.Errorf("failed to update cost basis: %w", err)
		}

		if err := uow.Position().Update(ctx, position); err != nil {
			return fmt.Errorf("failed to update position: %w", err)
		}

		result = &TransactionResult{
			Transaction: createdTransaction,
			Position:    position,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ProcessSellTransaction handles a sell transaction with position updates and realized gains calculation
func (s *TransactionService) ProcessSellTransaction(ctx context.Context, req SellTransactionRequest) (*TransactionResult, error) {
	if req.UserID == "" {
		return nil, errors.New("user ID is required")
	}
	if req.PositionID == "" {
		return nil, errors.New("position ID is required")
	}
	if req.Quantity.IsNegative() || req.Quantity.IsZero() {
		return nil, errors.New("quantity must be positive")
	}
	if req.PricePerUnit.IsNegative() || req.PricePerUnit.IsZero() {
		return nil, errors.New("price per unit must be positive")
	}

	totalAmount := req.Quantity.Mul(req.PricePerUnit).Mul(decimal.NewFromInt(100))
	amount := -model.Money(totalAmount.IntPart())

	var result *TransactionResult
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		position, err := uow.Position().GetByID(ctx, req.PositionID)
		if err != nil {
			return fmt.Errorf("failed to get position: %w", err)
		}

		if req.Quantity.GreaterThan(position.Quantity) {
			return fmt.Errorf("insufficient quantity: have %s, trying to sell %s",
				position.Quantity.String(), req.Quantity.String())
		}

		realizedGains, err := position.CalculateRealizedGains(req.Quantity, req.PricePerUnit)
		if err != nil {
			return fmt.Errorf("failed to calculate realized gains: %w", err)
		}

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

		if err := transaction.Validate(); err != nil {
			return fmt.Errorf("transaction validation failed: %w", err)
		}

		createdTransaction, err := uow.Transaction().Create(ctx, transaction)
		if err != nil {
			return fmt.Errorf("failed to create transaction: %w", err)
		}

		if err := position.UpdateCostBasis(req.Quantity.Neg(), req.PricePerUnit, amount); err != nil {
			return fmt.Errorf("failed to update cost basis: %w", err)
		}

		if err := uow.Position().Update(ctx, position); err != nil {
			return fmt.Errorf("failed to update position: %w", err)
		}

		result = &TransactionResult{
			Transaction:   createdTransaction,
			Position:      position,
			RealizedGains: &realizedGains,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ProcessCashTransaction handles cash-only transactions (deposits, withdrawals, etc.)
func (s *TransactionService) ProcessCashTransaction(ctx context.Context, req CashTransactionRequest) (*model.Transaction, error) {
	// Validate request
	if req.UserID == "" {
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

	createdTransaction, err := s.uow.Transaction().Create(ctx, transaction)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	return createdTransaction, nil
}
