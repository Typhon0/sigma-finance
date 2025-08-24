package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"time"
)

// ITransactionService defines the interface for transaction management operations
type ITransactionService interface {
	GetByID(ctx context.Context, id uint) (model.Transaction, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Transaction, error)
	FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.Transaction, error)
	FindByAssetID(ctx context.Context, assetID int) ([]model.Transaction, error)
	FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) ([]model.Transaction, error)
	FindByDateRange(ctx context.Context, from, to time.Time) ([]model.Transaction, error)
	FindWithFilters(ctx context.Context, filter repository.TransactionFilter) ([]model.Transaction, error)
	CreateTransaction(ctx context.Context, input CreateTransactionInput) (model.Transaction, error)
	UpdateTransaction(ctx context.Context, id uint, input UpdateTransactionInput) (model.Transaction, error)
	DeleteTransaction(ctx context.Context, id uint) error
	RecordBuyTransaction(ctx context.Context, input BuyTransactionInput) (model.Transaction, error)
	RecordSellTransaction(ctx context.Context, input SellTransactionInput) (model.Transaction, error)
	CalculatePortfolioBalance(ctx context.Context, portfolioID int) (float64, error)
	GetByPortfolioID(ctx context.Context, portfolioID uint) ([]model.Transaction, error)
}

// TransactionService is the concrete implementation of ITransactionService
type TransactionService struct {
	uow repository.IUnitOfWork
}

// NewTransactionService creates a new transaction service instance
func NewTransactionService(uow repository.IUnitOfWork) *TransactionService {
	return &TransactionService{uow: uow}
}

// Input structs for transaction operations
type CreateTransactionInput struct {
	PortfolioID     int
	AssetID         int
	TransactionType string
	Quantity        float64
	PricePerUnit    float64
	TransactionDate *time.Time
	Notes           string
}

type UpdateTransactionInput struct {
	TransactionType string
	Quantity        float64
	PricePerUnit    float64
	TransactionDate *time.Time
	Notes           string
}

type BuyTransactionInput struct {
	PortfolioID  int
	AssetID      int
	Quantity     float64
	PricePerUnit float64
	Notes        string
}

type SellTransactionInput struct {
	PortfolioID  int
	AssetID      int
	Quantity     float64
	PricePerUnit float64
	Notes        string
}

// GetByID retrieves a single transaction by its ID
func (s *TransactionService) GetByID(ctx context.Context, id uint) (model.Transaction, error) {
	return s.uow.Transaction().GetByID(ctx, id)
}

// FindAll retrieves all transactions with optional query options
func (s *TransactionService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Transaction, error) {
	return s.uow.Transaction().FindAllBy(ctx, opts...)
}

// FindByPortfolioID retrieves all transactions for a specific portfolio
func (s *TransactionService) FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.Transaction, error) {
	return s.uow.Transaction().FindByPortfolioID(ctx, portfolioID)
}

// FindByAssetID retrieves all transactions for a specific asset
func (s *TransactionService) FindByAssetID(ctx context.Context, assetID int) ([]model.Transaction, error) {
	return s.uow.Transaction().FindByAssetID(ctx, assetID)
}

// FindByPortfolioAndAsset retrieves transactions for a specific portfolio and asset combination
func (s *TransactionService) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) ([]model.Transaction, error) {
	return s.uow.Transaction().FindByPortfolioAndAsset(ctx, portfolioID, assetID)
}

// FindByDateRange retrieves transactions within a specific date range
func (s *TransactionService) FindByDateRange(ctx context.Context, from, to time.Time) ([]model.Transaction, error) {
	return s.uow.Transaction().FindByDateRange(ctx, from, to)
}

// FindWithFilters retrieves transactions with multiple filter criteria
func (s *TransactionService) FindWithFilters(ctx context.Context, filter repository.TransactionFilter) ([]model.Transaction, error) {
	return s.uow.Transaction().FindWithFilters(ctx, filter)
}

// CreateTransaction creates a new transaction with validation
func (s *TransactionService) CreateTransaction(ctx context.Context, input CreateTransactionInput) (model.Transaction, error) {
	// Validate input
	if err := s.validateTransactionInput(input); err != nil {
		return model.Transaction{}, err
	}

	// Verify portfolio exists
	if _, err := s.uow.Portfolio().GetByID(ctx, uint(input.PortfolioID)); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return model.Transaction{}, fmt.Errorf("portfolio with ID %d not found", input.PortfolioID)
		}
		return model.Transaction{}, fmt.Errorf("failed to verify portfolio: %w", err)
	}

	// Verify asset exists
	if _, err := s.uow.Asset().GetByID(ctx, uint(input.AssetID)); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return model.Transaction{}, fmt.Errorf("asset with ID %d not found", input.AssetID)
		}
		return model.Transaction{}, fmt.Errorf("failed to verify asset: %w", err)
	}

	// Set transaction date if not provided
	transactionDate := time.Now()
	if input.TransactionDate != nil {
		transactionDate = *input.TransactionDate
	}

	// Create transaction
	newTransaction := model.Transaction{
		PortfolioID:     input.PortfolioID,
		AssetID:         input.AssetID,
		TransactionType: input.TransactionType,
		Quantity:        input.Quantity,
		PricePerUnit:    input.PricePerUnit,
		TransactionDate: transactionDate,
		Notes:           input.Notes,
	}

	createdTransaction, err := s.uow.Transaction().Create(ctx, &newTransaction)
	if err != nil {
		return model.Transaction{}, fmt.Errorf("failed to create transaction: %w", err)
	}

	return *createdTransaction, nil
}

// UpdateTransaction updates an existing transaction
func (s *TransactionService) UpdateTransaction(ctx context.Context, id uint, input UpdateTransactionInput) (model.Transaction, error) {
	// Validate input
	if err := s.validateUpdateTransactionInput(input); err != nil {
		return model.Transaction{}, err
	}

	// Get existing transaction
	transactionToUpdate, err := s.uow.Transaction().GetByID(ctx, id)
	if err != nil {
		return model.Transaction{}, err
	}

	// Apply updates
	transactionToUpdate.TransactionType = input.TransactionType
	transactionToUpdate.Quantity = input.Quantity
	transactionToUpdate.PricePerUnit = input.PricePerUnit
	transactionToUpdate.Notes = input.Notes

	if input.TransactionDate != nil {
		transactionToUpdate.TransactionDate = *input.TransactionDate
	}

	// Save changes
	err = s.uow.Transaction().Update(ctx, &transactionToUpdate)
	if err != nil {
		return model.Transaction{}, fmt.Errorf("failed to update transaction: %w", err)
	}

	return transactionToUpdate, nil
}

// DeleteTransaction removes a transaction
func (s *TransactionService) DeleteTransaction(ctx context.Context, id uint) error {
	return s.uow.Transaction().Delete(ctx, id)
}

// RecordBuyTransaction records a buy transaction and updates portfolio balance
func (s *TransactionService) RecordBuyTransaction(ctx context.Context, input BuyTransactionInput) (model.Transaction, error) {
	// Validate buy transaction input
	if err := s.validateBuyTransactionInput(input); err != nil {
		return model.Transaction{}, err
	}

	// Use Unit of Work to ensure atomicity
	var createdTransaction model.Transaction
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify portfolio exists
		if _, err := uow.Portfolio().GetByID(ctx, uint(input.PortfolioID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("portfolio with ID %d not found", input.PortfolioID)
			}
			return fmt.Errorf("failed to verify portfolio: %w", err)
		}

		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, uint(input.AssetID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %d not found", input.AssetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Create buy transaction
		newTransaction := model.Transaction{
			PortfolioID:     input.PortfolioID,
			AssetID:         input.AssetID,
			TransactionType: "BUY",
			Quantity:        input.Quantity,
			PricePerUnit:    input.PricePerUnit,
			TransactionDate: time.Now(),
			Notes:           input.Notes,
		}

		created, err := uow.Transaction().Create(ctx, &newTransaction)
		if err != nil {
			return fmt.Errorf("failed to create buy transaction: %w", err)
		}
		createdTransaction = *created

		// Update or create portfolio asset position
		err = s.updatePortfolioAssetPosition(ctx, uow, input.PortfolioID, input.AssetID, input.Quantity, input.PricePerUnit, true)
		if err != nil {
			return fmt.Errorf("failed to update portfolio position: %w", err)
		}

		return nil
	})

	if err != nil {
		return model.Transaction{}, err
	}

	return createdTransaction, nil
}

// RecordSellTransaction records a sell transaction and updates portfolio balance
func (s *TransactionService) RecordSellTransaction(ctx context.Context, input SellTransactionInput) (model.Transaction, error) {
	// Validate sell transaction input
	if err := s.validateSellTransactionInput(input); err != nil {
		return model.Transaction{}, err
	}

	// Use Unit of Work to ensure atomicity
	var createdTransaction model.Transaction
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify portfolio exists
		if _, err := uow.Portfolio().GetByID(ctx, uint(input.PortfolioID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("portfolio with ID %d not found", input.PortfolioID)
			}
			return fmt.Errorf("failed to verify portfolio: %w", err)
		}

		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, uint(input.AssetID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %d not found", input.AssetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Check if sufficient quantity exists in portfolio
		portfolioAsset, err := uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, input.PortfolioID, input.AssetID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return errors.New("no position found for this asset in the portfolio")
			}
			return fmt.Errorf("failed to check portfolio position: %w", err)
		}

		if portfolioAsset.Quantity < input.Quantity {
			return fmt.Errorf("insufficient quantity: have %.6f, trying to sell %.6f", portfolioAsset.Quantity, input.Quantity)
		}

		// Create sell transaction
		newTransaction := model.Transaction{
			PortfolioID:     input.PortfolioID,
			AssetID:         input.AssetID,
			TransactionType: "SELL",
			Quantity:        input.Quantity,
			PricePerUnit:    input.PricePerUnit,
			TransactionDate: time.Now(),
			Notes:           input.Notes,
		}

		created, err := uow.Transaction().Create(ctx, &newTransaction)
		if err != nil {
			return fmt.Errorf("failed to create sell transaction: %w", err)
		}
		createdTransaction = *created

		// Update portfolio asset position
		err = s.updatePortfolioAssetPosition(ctx, uow, input.PortfolioID, input.AssetID, input.Quantity, input.PricePerUnit, false)
		if err != nil {
			return fmt.Errorf("failed to update portfolio position: %w", err)
		}

		return nil
	})

	if err != nil {
		return model.Transaction{}, err
	}

	return createdTransaction, nil
}

// CalculatePortfolioBalance calculates the total balance of a portfolio based on current positions
func (s *TransactionService) CalculatePortfolioBalance(ctx context.Context, portfolioID int) (float64, error) {
	// Get all portfolio assets
	portfolioAssets, err := s.uow.PortfolioAsset().FindAllBy(ctx, repository.ByColumn("portfolio_id", portfolioID))
	if err != nil {
		return 0, fmt.Errorf("failed to get portfolio assets: %w", err)
	}

	var totalBalance float64
	for _, pa := range portfolioAssets {
		// For now, use average purchase price as current value
		// In a real system, you'd fetch current market prices
		assetValue := pa.Quantity * pa.AveragePurchasePrice
		totalBalance += assetValue
	}

	return totalBalance, nil
}

// GetByPortfolioID retrieves all transactions for a specific portfolio
func (s *TransactionService) GetByPortfolioID(ctx context.Context, portfolioID uint) ([]model.Transaction, error) {
	return s.uow.Transaction().FindByPortfolioID(ctx, int(portfolioID))
}

// Helper methods for validation and business logic

func (s *TransactionService) validateTransactionInput(input CreateTransactionInput) error {
	if input.PortfolioID <= 0 {
		return errors.New("portfolio ID must be positive")
	}
	if input.AssetID <= 0 {
		return errors.New("asset ID must be positive")
	}
	if input.TransactionType == "" {
		return errors.New("transaction type is required")
	}
	if input.TransactionType != "BUY" && input.TransactionType != "SELL" {
		return errors.New("transaction type must be BUY or SELL")
	}
	if input.Quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	if input.PricePerUnit <= 0 {
		return errors.New("price per unit must be positive")
	}
	return nil
}

func (s *TransactionService) validateUpdateTransactionInput(input UpdateTransactionInput) error {
	if input.TransactionType == "" {
		return errors.New("transaction type is required")
	}
	if input.TransactionType != "BUY" && input.TransactionType != "SELL" {
		return errors.New("transaction type must be BUY or SELL")
	}
	if input.Quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	if input.PricePerUnit <= 0 {
		return errors.New("price per unit must be positive")
	}
	return nil
}

func (s *TransactionService) validateBuyTransactionInput(input BuyTransactionInput) error {
	if input.PortfolioID <= 0 {
		return errors.New("portfolio ID must be positive")
	}
	if input.AssetID <= 0 {
		return errors.New("asset ID must be positive")
	}
	if input.Quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	if input.PricePerUnit <= 0 {
		return errors.New("price per unit must be positive")
	}
	return nil
}

func (s *TransactionService) validateSellTransactionInput(input SellTransactionInput) error {
	if input.PortfolioID <= 0 {
		return errors.New("portfolio ID must be positive")
	}
	if input.AssetID <= 0 {
		return errors.New("asset ID must be positive")
	}
	if input.Quantity <= 0 {
		return errors.New("quantity must be positive")
	}
	if input.PricePerUnit <= 0 {
		return errors.New("price per unit must be positive")
	}
	return nil
}

// updatePortfolioAssetPosition updates or creates a portfolio asset position
func (s *TransactionService) updatePortfolioAssetPosition(ctx context.Context, uow repository.IUnitOfWork, portfolioID, assetID int, quantity, price float64, isBuy bool) error {
	portfolioAsset, err := uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			// Asset not in portfolio, create a new entry
			if !isBuy {
				return errors.New("cannot sell an asset that is not in the portfolio")
			}
			newPortfolioAsset := model.PortfolioAsset{
				PortfolioID:          portfolioID,
				AssetID:              assetID,
				Quantity:             quantity,
				AveragePurchasePrice: price,
			}
			_, err := uow.PortfolioAsset().Create(ctx, &newPortfolioAsset)
			return err
		}
		return err
	}

	// Asset already in portfolio, update the position
	if isBuy {
		newTotalValue := (portfolioAsset.AveragePurchasePrice * portfolioAsset.Quantity) + (price * quantity)
		newQuantity := portfolioAsset.Quantity + quantity
		portfolioAsset.AveragePurchasePrice = newTotalValue / newQuantity
		portfolioAsset.Quantity = newQuantity
	} else { // isSell
		portfolioAsset.Quantity -= quantity
	}

	return uow.PortfolioAsset().Update(ctx, portfolioAsset)
}
