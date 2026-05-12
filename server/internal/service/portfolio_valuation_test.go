package service

import (
	"math"
	"testing"

	"sigma_finance/internal/domain/model"
)

func TestCalculateGainLossPercent(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                    string
		totalGainLoss           model.Money
		totalCostBasis          model.Money
		totalDisplayValue       model.Money
		costBasisCoveredDisplay model.Money
		want                    float64
	}{
		{
			name:                    "returns zero with missing cost basis",
			totalGainLoss:           100_00,
			totalCostBasis:          0,
			totalDisplayValue:       500_00,
			costBasisCoveredDisplay: 500_00,
			want:                    0,
		},
		{
			name:                    "returns zero when cost basis coverage is too low",
			totalGainLoss:           10_000_00,
			totalCostBasis:          20_00,
			totalDisplayValue:       29_852_29,
			costBasisCoveredDisplay: 5_000_00,
			want:                    0,
		},
		{
			name:                    "returns percentage when coverage is sufficient",
			totalGainLoss:           1_799_14,
			totalCostBasis:          8_753_15,
			totalDisplayValue:       10_552_29,
			costBasisCoveredDisplay: 10_552_29,
			want:                    20.5542,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := calculateGainLossPercent(tc.totalGainLoss, tc.totalCostBasis, tc.totalDisplayValue, tc.costBasisCoveredDisplay).InexactFloat64()
			if math.Abs(got-tc.want) > 0.001 {
				t.Fatalf("calculateGainLossPercent() = %f, want %f", got, tc.want)
			}
		})
	}
}
