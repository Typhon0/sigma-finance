package model

import "github.com/shopspring/decimal"

// Money represents a monetary amount in the smallest currency unit (e.g. cents for USD).
// All monetary values must use this type to avoid floating point precision issues.
// For crypto assets we currently also scale to 1e-2 of the quote currency (cents) to
// keep a unified representation; future enhancement may introduce per-asset scaling.
type Money int64

// FromFloat converts a decimal float price into Money assuming 2 decimal places.
// NOTE: Do not use for crypto assets requiring >2 decimals without revisiting scaling.
func FromFloat(v float64) Money { return Money(v * 100) }

// ToFloat converts Money back to a float with 2 decimal places.
func (m Money) ToFloat() float64 { return float64(m) / 100.0 }

// FromDecimal converts a decimal to Money, scaling by 100 to convert to cents
func FromDecimal(d decimal.Decimal) Money {
	return Money(d.Mul(decimal.NewFromInt(100)).IntPart())
}

// ToDecimal converts Money to a decimal, scaling by 0.01 to convert from cents
func (m Money) ToDecimal() decimal.Decimal {
	return decimal.NewFromInt(int64(m)).Div(decimal.NewFromInt(100))
}

// Abs returns the absolute value of the Money
func (m Money) Abs() Money {
	if m < 0 {
		return -m
	}
	return m
}

// IsZero returns true if the money amount is zero
func (m Money) IsZero() bool {
	return m == 0
}

// IsPositive returns true if the money amount is positive
func (m Money) IsPositive() bool {
	return m > 0
}

// IsNegative returns true if the money amount is negative
func (m Money) IsNegative() bool {
	return m < 0
}
