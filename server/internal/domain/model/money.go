package model

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
