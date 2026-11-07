package model_test

import (
	"testing"

	"sigma_finance/internal/domain/model"

	"github.com/stretchr/testify/assert"
)

func TestFromFloat(t *testing.T) {
	testCases := []struct {
		name     string
		input    float64
		expected model.Money
	}{
		{name: "whole number", input: 100.0, expected: 10000},
		{name: "two decimal places standard", input: 100.50, expected: 10050},
		{name: "edge case 19.99 precision", input: 19.99, expected: 1999},
		{name: "edge case 147.23 precision", input: 147.23, expected: 14723},
		{name: "edge case 0.07 precision", input: 0.07, expected: 7},
		{name: "edge case 0.14 precision", input: 0.14, expected: 14},
		{name: "negative value standard", input: -50.25, expected: -5025},
		{name: "negative value 19.99", input: -19.99, expected: -1999},
		{name: "three decimal rounding half up", input: 10.005, expected: 1001},
		{name: "negative three decimal rounding", input: -0.125, expected: -13},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := model.FromFloat(tc.input)
			assert.Equal(t, tc.expected, got, "input %f should produce %d cents, got %d", tc.input, tc.expected, got)
		})
	}
}
