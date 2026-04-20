package model

// CurrencyPair represents a pair of base and quote currencies
type CurrencyPair struct {
	BaseCurrency  Currency
	QuoteCurrency Currency
}

// String returns the currency pair in "BASE/QUOTE" format
func (cp CurrencyPair) String() string {
	return cp.BaseCurrency.String() + "/" + cp.QuoteCurrency.String()
}
