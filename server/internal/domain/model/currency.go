package model

// Currency represents a supported currency code
type Currency string

const (
	CurrencyUSD Currency = "USD"
	CurrencyEUR Currency = "EUR"
	CurrencyGBP Currency = "GBP"
)

// IsValid checks if the currency is a supported value
func (c Currency) IsValid() bool {
	switch c {
	case CurrencyUSD, CurrencyEUR, CurrencyGBP:
		return true
	default:
		return false
	}
}

// String returns the currency code string
func (c Currency) String() string {
	return string(c)
}
