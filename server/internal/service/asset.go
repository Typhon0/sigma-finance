package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"time"
)

type IAssetService interface {
	GetByID(ctx context.Context, id uint) (model.Asset, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Asset, error)
	CreateAsset(ctx context.Context, input CreateAssetInput) (model.Asset, error)
	UpdateAsset(ctx context.Context, id uint, input UpdateAssetInput) (model.Asset, error)
	DeleteAsset(ctx context.Context, id uint) error

	// Stock-specific operations
	CreateStockAsset(ctx context.Context, input CreateStockAssetInput) (model.Asset, model.Stock, error)
	GetStockByAssetID(ctx context.Context, assetID uint) (model.Stock, error)

	// Crypto-specific operations
	CreateCryptoAsset(ctx context.Context, input CreateCryptoAssetInput) (model.Asset, model.Crypto, error)
	GetCryptoByAssetID(ctx context.Context, assetID uint) (model.Crypto, error)

	// Asset type operations
	GetAssetTypes(ctx context.Context) ([]model.AssetType, error)
	GetAssetTypeByID(ctx context.Context, id uint) (model.AssetType, error)
}

type AssetService struct {
	uow repository.IUnitOfWork
}

func NewAssetService(uow repository.IUnitOfWork) *AssetService {
	return &AssetService{uow: uow}
}

type CreateAssetInput struct {
	Name      string
	AssetType string
	Value     float64
}

type UpdateAssetInput struct {
	Name      string
	AssetType string
	Value     float64
}

type CreateStockAssetInput struct {
	Name          string
	AssetTypeID   int
	CurrentValue  *float64
	PurchaseDate  *time.Time
	PurchasePrice *float64
	Ticker        string
	Quantity      float64
}

type CreateCryptoAssetInput struct {
	Name              string
	AssetTypeID       int
	CurrentValue      *float64
	PurchaseDate      *time.Time
	PurchasePrice     *float64
	WalletAddress     *string
	BlockchainNetwork *string
	Quantity          float64
}

func (s *AssetService) GetByID(ctx context.Context, id uint) (model.Asset, error) {
	return s.uow.Asset().GetByID(ctx, id)
}

func (s *AssetService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Asset, error) {
	return s.uow.Asset().FindAllBy(ctx, opts...)
}

func (s *AssetService) CreateAsset(ctx context.Context, input CreateAssetInput) (model.Asset, error) {
	if len(input.Name) < 3 {
		return model.Asset{}, errors.New("asset name must be at least 3 characters long")
	}
	newAsset := model.Asset{
		Name:         input.Name,
		CurrentValue: input.Value,
	}
	createdAsset, err := s.uow.Asset().Create(ctx, &newAsset)
	if err != nil {
		return model.Asset{}, fmt.Errorf("failed to create asset: %w", err)
	}
	return *createdAsset, nil
}

func (s *AssetService) UpdateAsset(ctx context.Context, id uint, input UpdateAssetInput) (model.Asset, error) {
	assetToUpdate, err := s.uow.Asset().GetByID(ctx, id)
	if err != nil {
		return model.Asset{}, err
	}
	assetToUpdate.Name = input.Name
	assetToUpdate.CurrentValue = input.Value
	err = s.uow.Asset().Update(ctx, &assetToUpdate)
	if err != nil {
		return model.Asset{}, fmt.Errorf("failed to update asset: %w", err)
	}
	return assetToUpdate, nil
}

func (s *AssetService) DeleteAsset(ctx context.Context, id uint) error {
	return s.uow.Asset().Delete(ctx, id)
}

// CreateStockAsset creates a new stock asset with stock-specific data
func (s *AssetService) CreateStockAsset(ctx context.Context, input CreateStockAssetInput) (model.Asset, model.Stock, error) {
	if len(input.Name) < 3 {
		return model.Asset{}, model.Stock{}, errors.New("asset name must be at least 3 characters long")
	}
	if len(input.Ticker) == 0 {
		return model.Asset{}, model.Stock{}, errors.New("ticker symbol is required")
	}
	if input.Quantity <= 0 {
		return model.Asset{}, model.Stock{}, errors.New("quantity must be positive")
	}

	var asset model.Asset
	var stock model.Stock

	// Use Unit of Work to ensure atomicity
	err := s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Verify asset type exists
		_, err := repos.AssetTypeRepo.GetByID(ctx, uint(input.AssetTypeID))
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset type with ID %d not found", input.AssetTypeID)
			}
			return fmt.Errorf("failed to verify asset type: %w", err)
		}

		// Create base asset
		newAsset := model.Asset{
			Name:         input.Name,
			AssetTypeID:  input.AssetTypeID,
			CurrentValue: 0,
		}
		if input.CurrentValue != nil {
			newAsset.CurrentValue = *input.CurrentValue
		}
		if input.PurchaseDate != nil {
			newAsset.PurchaseDate = *input.PurchaseDate
		}
		if input.PurchasePrice != nil {
			newAsset.PurchasePrice = *input.PurchasePrice
		}

		createdAsset, err := repos.AssetRepo.Create(ctx, &newAsset)
		if err != nil {
			return fmt.Errorf("failed to create asset: %w", err)
		}
		asset = *createdAsset

		// Create stock-specific data
		newStock := model.Stock{
			AssetID:     asset.ID,
			Ticker:      input.Ticker,
			Quantity:    input.Quantity,
			BuyingPrice: 0,
		}
		if input.PurchasePrice != nil {
			newStock.BuyingPrice = *input.PurchasePrice
		}

		createdStock, err := repos.StockRepo.Create(ctx, &newStock)
		if err != nil {
			return fmt.Errorf("failed to create stock data: %w", err)
		}
		stock = *createdStock

		return nil
	})

	if err != nil {
		return model.Asset{}, model.Stock{}, err
	}

	return asset, stock, nil
}

// GetStockByAssetID retrieves stock-specific data for an asset
func (s *AssetService) GetStockByAssetID(ctx context.Context, assetID uint) (model.Stock, error) {
	return s.uow.Stock().FindOneBy(ctx, repository.ByColumn("asset_id", assetID))
}

// CreateCryptoAsset creates a new crypto asset with crypto-specific data
func (s *AssetService) CreateCryptoAsset(ctx context.Context, input CreateCryptoAssetInput) (model.Asset, model.Crypto, error) {
	if len(input.Name) < 3 {
		return model.Asset{}, model.Crypto{}, errors.New("asset name must be at least 3 characters long")
	}
	if input.Quantity <= 0 {
		return model.Asset{}, model.Crypto{}, errors.New("quantity must be positive")
	}

	var asset model.Asset
	var crypto model.Crypto

	// Use Unit of Work to ensure atomicity
	err := s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Verify asset type exists
		_, err := repos.AssetTypeRepo.GetByID(ctx, uint(input.AssetTypeID))
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset type with ID %d not found", input.AssetTypeID)
			}
			return fmt.Errorf("failed to verify asset type: %w", err)
		}

		// Create base asset
		newAsset := model.Asset{
			Name:         input.Name,
			AssetTypeID:  input.AssetTypeID,
			CurrentValue: 0,
		}
		if input.CurrentValue != nil {
			newAsset.CurrentValue = *input.CurrentValue
		}
		if input.PurchaseDate != nil {
			newAsset.PurchaseDate = *input.PurchaseDate
		}
		if input.PurchasePrice != nil {
			newAsset.PurchasePrice = *input.PurchasePrice
		}

		createdAsset, err := repos.AssetRepo.Create(ctx, &newAsset)
		if err != nil {
			return fmt.Errorf("failed to create asset: %w", err)
		}
		asset = *createdAsset

		// Create crypto-specific data
		newCrypto := model.Crypto{
			AssetID:  asset.ID,
			Quantity: input.Quantity,
		}
		if input.WalletAddress != nil {
			newCrypto.WalletAddress = *input.WalletAddress
		}
		if input.BlockchainNetwork != nil {
			newCrypto.BlockchainNetwork = *input.BlockchainNetwork
		}

		createdCrypto, err := repos.CryptoRepo.Create(ctx, &newCrypto)
		if err != nil {
			return fmt.Errorf("failed to create crypto data: %w", err)
		}
		crypto = *createdCrypto

		return nil
	})

	if err != nil {
		return model.Asset{}, model.Crypto{}, err
	}

	return asset, crypto, nil
}

// GetCryptoByAssetID retrieves crypto-specific data for an asset
func (s *AssetService) GetCryptoByAssetID(ctx context.Context, assetID uint) (model.Crypto, error) {
	return s.uow.Crypto().FindOneBy(ctx, repository.ByColumn("asset_id", assetID))
}

// GetAssetTypes retrieves all available asset types
func (s *AssetService) GetAssetTypes(ctx context.Context) ([]model.AssetType, error) {
	return s.uow.AssetType().FindAllBy(ctx)
}

// GetAssetTypeByID retrieves a specific asset type by ID
func (s *AssetService) GetAssetTypeByID(ctx context.Context, id uint) (model.AssetType, error) {
	return s.uow.AssetType().GetByID(ctx, id)
}
