package model

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestAssetType_IsValid(t *testing.T) {
	tests := []struct {
		assetType AssetType
		expected  bool
	}{
		{AssetTypeStock, true},
		{AssetTypeCrypto, true},
		{AssetTypeBankAccount, true},
		{AssetTypeRealEstate, true},
		{AssetTypeLifeInsurance, true},
		{AssetTypeWatch, true},
		{AssetTypeOtherValuable, true},
		{AssetType("INVALID"), false},
		{AssetType(""), false},
	}

	for _, tt := range tests {
		t.Run(string(tt.assetType), func(t *testing.T) {
			if got := tt.assetType.IsValid(); got != tt.expected {
				t.Errorf("AssetType.IsValid() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestAssetType_IsTradeable(t *testing.T) {
	tests := []struct {
		assetType AssetType
		expected  bool
	}{
		{AssetTypeStock, true},
		{AssetTypeCrypto, true},
		{AssetTypeBankAccount, false},
		{AssetTypeRealEstate, false},
		{AssetTypeLifeInsurance, false},
		{AssetTypeWatch, false},
		{AssetTypeOtherValuable, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.assetType), func(t *testing.T) {
			if got := tt.assetType.IsTradeable(); got != tt.expected {
				t.Errorf("AssetType.IsTradeable() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestAsset_Validate(t *testing.T) {
	tests := []struct {
		name    string
		asset   *Asset
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid stock asset",
			asset: &Asset{
				ID:          uuid.New(),
				Type:        AssetTypeStock,
				Symbol:      stringPtr("AAPL"),
				Name:        "Apple Inc.",
				IsTradeable: true,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
			wantErr: false,
		},
		{
			name: "valid crypto asset",
			asset: &Asset{
				ID:          uuid.New(),
				Type:        AssetTypeCrypto,
				Symbol:      stringPtr("BTC"),
				Name:        "Bitcoin",
				IsTradeable: true,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
			wantErr: false,
		},
		{
			name: "valid bank account asset",
			asset: &Asset{
				ID:          uuid.New(),
				Type:        AssetTypeBankAccount,
				Name:        "Chase Checking",
				IsTradeable: false,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
			wantErr: false,
		},
		{
			name: "invalid asset - empty name",
			asset: &Asset{
				ID:        uuid.New(),
				Type:      AssetTypeStock,
				Symbol:    stringPtr("AAPL"),
				Name:      "",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			wantErr: true,
			errMsg:  "asset name is required",
		},
		{
			name: "invalid asset - invalid type",
			asset: &Asset{
				ID:        uuid.New(),
				Type:      AssetType("INVALID"),
				Name:      "Test Asset",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			wantErr: true,
			errMsg:  "invalid asset type: INVALID",
		},
		{
			name: "invalid stock - missing symbol",
			asset: &Asset{
				ID:        uuid.New(),
				Type:      AssetTypeStock,
				Name:      "Apple Inc.",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			wantErr: true,
			errMsg:  "symbol is required for tradeable assets",
		},
		{
			name: "invalid stock - invalid symbol format",
			asset: &Asset{
				ID:        uuid.New(),
				Type:      AssetTypeStock,
				Symbol:    stringPtr("TOOLONG"),
				Name:      "Test Stock",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			wantErr: true,
			errMsg:  "stock symbol must be 1-5 uppercase letters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.asset.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Asset.Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("Asset.Validate() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestAsset_validateStockMetadata(t *testing.T) {
	asset := &Asset{Type: AssetTypeStock}

	tests := []struct {
		name     string
		metadata StockMetadata
		wantErr  bool
		errMsg   string
	}{
		{
			name: "valid stock metadata",
			metadata: StockMetadata{
				Exchange: "NASDAQ",
				Sector:   "Technology",
				Industry: "Consumer Electronics",
			},
			wantErr: false,
		},
		{
			name: "missing exchange",
			metadata: StockMetadata{
				Sector:   "Technology",
				Industry: "Consumer Electronics",
			},
			wantErr: true,
			errMsg:  "exchange is required for stock metadata",
		},
		{
			name: "negative PE ratio",
			metadata: StockMetadata{
				Exchange: "NASDAQ",
				PERatio:  floatPtr(-5.0),
			},
			wantErr: true,
			errMsg:  "PE ratio must be positive",
		},
		{
			name: "invalid dividend yield",
			metadata: StockMetadata{
				Exchange:      "NASDAQ",
				DividendYield: floatPtr(150.0),
			},
			wantErr: true,
			errMsg:  "dividend yield must be between 0 and 100",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := asset.validateStockMetadata(&tt.metadata)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateStockMetadata() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("validateStockMetadata() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestAsset_validateCryptoMetadata(t *testing.T) {
	asset := &Asset{Type: AssetTypeCrypto}

	tests := []struct {
		name     string
		metadata CryptoMetadata
		wantErr  bool
		errMsg   string
	}{
		{
			name: "valid crypto metadata",
			metadata: CryptoMetadata{
				Blockchain:    "Bitcoin",
				WalletAddress: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
				Decimals:      8,
			},
			wantErr: false,
		},
		{
			name: "missing blockchain",
			metadata: CryptoMetadata{
				WalletAddress: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
				Decimals:      8,
			},
			wantErr: true,
			errMsg:  "blockchain is required for crypto metadata",
		},
		{
			name: "missing wallet address",
			metadata: CryptoMetadata{
				Blockchain: "Bitcoin",
				Decimals:   8,
			},
			wantErr: true,
			errMsg:  "wallet address is required for crypto metadata",
		},
		{
			name: "invalid decimals",
			metadata: CryptoMetadata{
				Blockchain:    "Bitcoin",
				WalletAddress: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
				Decimals:      25,
			},
			wantErr: true,
			errMsg:  "decimals must be between 0 and 18",
		},
		{
			name: "short wallet address",
			metadata: CryptoMetadata{
				Blockchain:    "Bitcoin",
				WalletAddress: "short",
				Decimals:      8,
			},
			wantErr: true,
			errMsg:  "wallet address appears to be invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := asset.validateCryptoMetadata(&tt.metadata)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateCryptoMetadata() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("validateCryptoMetadata() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestAsset_MetadataValidation(t *testing.T) {
	// Test that metadata validation works with JSON marshaling/unmarshaling
	stockMetadata := StockMetadata{
		Exchange: "NASDAQ",
		Sector:   "Technology",
		Industry: "Consumer Electronics",
		PERatio:  floatPtr(25.5),
	}

	metadataJSON, err := json.Marshal(stockMetadata)
	if err != nil {
		t.Fatalf("Failed to marshal metadata: %v", err)
	}

	asset := &Asset{
		ID:        uuid.New(),
		Type:      AssetTypeStock,
		Symbol:    stringPtr("AAPL"),
		Name:      "Apple Inc.",
		Metadata:  metadataJSON,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = asset.Validate()
	if err != nil {
		t.Errorf("Asset.Validate() with valid metadata failed: %v", err)
	}
}

// Helper functions
func floatPtr(f float64) *float64 {
	return &f
}
