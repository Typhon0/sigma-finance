package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sort"
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
}

// Request/Response structures

type UpdateTransactionRequest struct {
	Type              *model.TransactionType `json:"type,omitempty"`
	Amount            *model.Money           `json:"amount,omitempty"`
	Quantity          *decimal.Decimal       `json:"quantity,omitempty"`
	UnitPriceAmount   *decimal.Decimal       `json:"unit_price_amount,omitempty"`
	UnitPriceCurrency *model.Currency        `json:"unit_price_currency,omitempty"`
	FeesAmount        *model.Money           `json:"fees_amount,omitempty"`
	FeesCurrency      *model.Currency        `json:"fees_currency,omitempty"`
	Notes             *string                `json:"notes,omitempty"`
	ExecutedAt        *time.Time             `json:"executed_at,omitempty"`
}

type TransactionFilter struct {
	UserID          *string                `json:"user_id,omitempty"`
	PositionID      *string                `json:"position_id,omitempty"`
	AccountID       *string                `json:"account_id,omitempty"`
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

	log.Printf("[INFO] [TransactionService] UpdateTransaction: started tx=%s", id)
	// Get existing transaction
	transaction, err := s.uow.Transaction().GetByID(ctx, id)
	if err != nil {
		log.Printf("[WARN] [TransactionService] UpdateTransaction: ERROR: transaction not found tx=%s: %v", id, err)
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
	if req.UnitPriceAmount != nil {
		transaction.UnitPriceAmount = req.UnitPriceAmount
	}
	if req.UnitPriceCurrency != nil {
		transaction.UnitPriceCurrency = *req.UnitPriceCurrency
	}
	if req.FeesAmount != nil {
		transaction.FeesAmount = *req.FeesAmount
	}
	if req.FeesCurrency != nil {
		transaction.FeesCurrency = *req.FeesCurrency
	}
	if req.Notes != nil {
		if *req.Notes == "" {
			transaction.Notes = nil
		} else {
			notes := *req.Notes
			transaction.Notes = &notes
		}
	}
	if req.ExecutedAt != nil {
		transaction.ExecutedAt = *req.ExecutedAt
	}

	// Validate the updated transaction
	if err := transaction.Validate(); err != nil {
		return nil, fmt.Errorf("transaction validation failed: %w", err)
	}

	// Update in repository
	if err := s.uow.Transaction().Update(ctx, transaction); err != nil {
		log.Printf("[ERROR] [TransactionService] UpdateTransaction: ERROR: update failed tx=%s: %v", id, err)
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	log.Printf("[INFO] [TransactionService] UpdateTransaction: completed tx=%s", id)
	return transaction, nil
}

// DeleteTransaction removes a transaction
func (s *TransactionService) DeleteTransaction(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("transaction ID is required")
	}

	tx, err := s.uow.Transaction().GetByID(ctx, id)
	if err != nil {
		log.Printf("[WARN] [TransactionService] DeleteTransaction: transaction not found tx=%s", id)
		return fmt.Errorf("failed to get transaction: %w", err)
	}

	log.Printf("[INFO] [TransactionService] DeleteTransaction: started tx=%s user=%s type=%s", id, tx.UserID, tx.Type)
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

			// Sort chronologically (executed_at ASC, created_at ASC) so sales replay after their buys
			sort.SliceStable(allTxns, func(i, j int) bool {
				if allTxns[i].ExecutedAt.Equal(allTxns[j].ExecutedAt) {
					return allTxns[i].CreatedAt.Before(allTxns[j].CreatedAt)
				}
				return allTxns[i].ExecutedAt.Before(allTxns[j].ExecutedAt)
			})

			pos.Quantity = decimal.Zero
			pos.AverageCostBasis = nil
			pos.TotalCostBasis = nil

			for _, t := range allTxns {
				if t.ID == id {
					continue
				}

				if t.Quantity == nil || t.UnitPriceAmount == nil {
					continue
				}

				signedQty, signedAmt := getSignedTransactionValues(&t)
				if err := pos.UpdateCostBasis(signedQty, *t.UnitPriceAmount, signedAmt); err != nil {
					return fmt.Errorf("failed to replay transaction %s: %w", t.ID, err)
				}
			}

			if err := uow.Position().Update(ctx, pos); err != nil {
				return fmt.Errorf("failed to update position: %w", err)
			}

			if err := uow.Transaction().Delete(ctx, id); err != nil {
				log.Printf("[ERROR] [TransactionService] DeleteTransaction: ERROR: delete failed tx=%s: %v", id, err)
				return err
			}
			log.Printf("[INFO] [TransactionService] DeleteTransaction: completed with position recalculation tx=%s", id)
			return nil
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
		AccountID:       filter.AccountID,
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

// ConsumeTaxLotsForSale matches a sale against the position's open lots,
// persists the reduced lots and the fiscal dispositions, and returns the
// allocation result (nil when the position has no open lots).
//
// It is the single place where a sale consumes lots, so a manually recorded
// trade and a synced one leave the same tax-lot state behind.
func ConsumeTaxLotsForSale(
	ctx context.Context,
	uow repository.IUnitOfWork,
	position *model.Position,
	quantity, unitPrice decimal.Decimal,
	executedAt time.Time,
	sellTransactionID string,
	userID string,
) (*model.TaxLotAllocationResult, error) {
	if position == nil {
		return nil, errors.New("position is required")
	}
	if quantity.LessThanOrEqual(decimal.Zero) {
		return nil, errors.New("sell quantity must be greater than zero")
	}

	taxMethod := model.TaxLotMethodFIFO
	if userID != "" {
		if user, uErr := uow.User().GetByID(ctx, userID); uErr == nil && user != nil && user.TaxJurisdiction == "FR" {
			taxMethod = model.TaxLotMethodPMP
		}
	}

	isTaxExempt := resolveTaxExempt(ctx, uow, position)

	openLots, err := uow.TaxLot().FindOpenByPositionID(ctx, position.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load open tax lots: %w", err)
	}
	if len(openLots) == 0 {
		return nil, nil
	}

	result, err := model.AllocateTaxLots(openLots, quantity, unitPrice, executedAt, taxMethod)
	if err != nil {
		return nil, fmt.Errorf("failed to allocate tax lots for sale: %w", err)
	}
	result.IsTaxExempt = isTaxExempt

	if err := uow.TaxLot().UpdateBatch(ctx, openLots); err != nil {
		return nil, fmt.Errorf("failed to update tax lots: %w", err)
	}

	var txID *string
	if sellTransactionID != "" {
		id := sellTransactionID
		txID = &id
	}
	dispositions := model.NewDispositionsFromAllocation(result, position.PortfolioID, position.ID, position.AssetID, txID, isTaxExempt)
	if err := uow.TaxLotDisposition().CreateBatch(ctx, dispositions); err != nil {
		return nil, fmt.Errorf("failed to persist tax lot dispositions: %w", err)
	}

	return result, nil
}

// resolveTaxExempt reads the effective tax wrapper with the same account-first,
// portfolio-second fallback the sale path has always used.
func resolveTaxExempt(ctx context.Context, uow repository.IUnitOfWork, position *model.Position) bool {
	wrapper := position.EffectiveTaxWrapper()
	if wrapper == "" || wrapper == model.TaxWrapperStandardTaxable {
		if position.AccountID != "" {
			if acc, aErr := uow.Account().GetByID(ctx, position.AccountID); aErr == nil && acc != nil {
				wrapper = acc.TaxWrapper
			}
		}
		if (wrapper == "" || wrapper == model.TaxWrapperStandardTaxable) && position.PortfolioID != "" {
			if portfolio, pErr := uow.Portfolio().GetByID(ctx, position.PortfolioID); pErr == nil && portfolio != nil && wrapper == "" {
				wrapper = portfolio.TaxWrapper
			}
		}
	}
	return wrapper.IsTaxExempt()
}
