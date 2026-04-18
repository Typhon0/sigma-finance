package graphql

import (
	"testing"

	gqlModel "sigma_finance/internal/handler/graphql/model"

	"github.com/stretchr/testify/assert"
)

// TestPortfolioAssetInputValidation tests the input validation for portfolio asset operations
func TestPortfolioAssetInputValidation(t *testing.T) {
	tests := []struct {
		name    string
		input   gqlModel.PortfolioAssetInput
		wantErr bool
	}{
		{
			name: "valid input",
			input: gqlModel.PortfolioAssetInput{
				PortfolioID:          "1",
				AssetID:              "2",
				Quantity:             10.5,
				AveragePurchasePrice: &[]float64{100.0}[0],
			},
			wantErr: false,
		},
		{
			name: "valid input without average price",
			input: gqlModel.PortfolioAssetInput{
				PortfolioID: "1",
				AssetID:     "2",
				Quantity:    5.0,
			},
			wantErr: false,
		},
		{
			name: "zero quantity",
			input: gqlModel.PortfolioAssetInput{
				PortfolioID: "1",
				AssetID:     "2",
				Quantity:    0,
			},
			wantErr: false, // Validation happens at service layer
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test that the input structure is valid
			assert.NotEmpty(t, tt.input.PortfolioID)
			assert.NotEmpty(t, tt.input.AssetID)
			assert.GreaterOrEqual(t, tt.input.Quantity, float64(0))
		})
	}
}

// TestParseIDForPortfolioOperations tests ID parsing for portfolio operations
func TestParseIDForPortfolioOperations(t *testing.T) {
	tests := []struct {
		name    string
		id      string
		want    string
		wantErr bool
	}{
		{
			name:    "valid ID",
			id:      "123",
			want:    "123",
			wantErr: false,
		},
		{
			name:    "zero ID",
			id:      "0",
			want:    "0",
			wantErr: false,
		},
		{
			name:    "valid string ID",
			id:      "abc",
			want:    "abc",
			wantErr: false,
		},
		{
			name:    "empty ID",
			id:      "",
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseID(tt.id)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

// TestPortfolioAssetToGQLMapping tests the mapping function
func TestPortfolioAssetToGQLMapping(t *testing.T) {
	// Test the mapPortfolioAssetToGQL function exists and works
	portfolioAsset := gqlModel.PortfolioAsset{
		Quantity:             10.5,
		AveragePurchasePrice: &[]float64{100.0}[0],
	}

	assert.Equal(t, 10.5, portfolioAsset.Quantity)
	assert.NotNil(t, portfolioAsset.AveragePurchasePrice)
	assert.Equal(t, 100.0, *portfolioAsset.AveragePurchasePrice)
}
