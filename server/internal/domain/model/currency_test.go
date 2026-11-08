package model_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"sigma_finance/internal/domain/model"
)

func TestCurrency_IsValid(t *testing.T) {
	tests := []struct {
		currency model.Currency
		expected bool
	}{
		{model.CurrencyEUR, true},
		{model.CurrencyUSD, true},
		{model.CurrencyGBP, true},
		{model.CurrencyCHF, true},
		{model.CurrencyJPY, true},
		{model.CurrencyCAD, true},
		{model.CurrencyAUD, true},
		{model.Currency("INVALID"), false},
		{model.Currency(""), false},
	}

	for _, tt := range tests {
		t.Run(string(tt.currency), func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.currency.IsValid())
		})
	}
}

func TestCurrency_MinorUnitExponent(t *testing.T) {
	tests := []struct {
		currency model.Currency
		expected int
	}{
		{model.CurrencyEUR, 2},
		{model.CurrencyUSD, 2},
		{model.CurrencyGBP, 2},
		{model.CurrencyJPY, 0},
		{model.CurrencyKRW, 0},
		{model.CurrencyBHD, 3},
		{model.CurrencyKWD, 3},
		{model.CurrencyCHF, 2},
	}

	for _, tt := range tests {
		t.Run(string(tt.currency), func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.currency.MinorUnitExponent())
		})
	}
}
