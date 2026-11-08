package model

// Currency represents a supported currency code
type Currency string

const (
	CurrencyUSD Currency = "USD"
	CurrencyEUR Currency = "EUR"
	CurrencyGBP Currency = "GBP"
	CurrencyCHF Currency = "CHF"
	CurrencyCAD Currency = "CAD"
	CurrencyAUD Currency = "AUD"
	CurrencyJPY Currency = "JPY"
	CurrencyCNY Currency = "CNY"
	CurrencyHKD Currency = "HKD"
	CurrencyNZD Currency = "NZD"
	CurrencySEK Currency = "SEK"
	CurrencyNOK Currency = "NOK"
	CurrencyDKK Currency = "DKK"
	CurrencyPLN Currency = "PLN"
	CurrencySGD Currency = "SGD"
	CurrencyCZK Currency = "CZK"
	CurrencyHUF Currency = "HUF"
	CurrencyILS Currency = "ILS"
	CurrencyMXN Currency = "MXN"
	CurrencyBRL Currency = "BRL"
	CurrencyZAR Currency = "ZAR"
	CurrencyKRW Currency = "KRW"
	CurrencyINR Currency = "INR"
	CurrencyBHD Currency = "BHD"
	CurrencyKWD Currency = "KWD"
	CurrencyOMR Currency = "OMR"
	CurrencyJOD Currency = "JOD"
)

// IsValid checks if the currency is a supported value
func (c Currency) IsValid() bool {
	switch c {
	case CurrencyUSD, CurrencyEUR, CurrencyGBP, CurrencyCHF, CurrencyCAD,
		CurrencyAUD, CurrencyJPY, CurrencyCNY, CurrencyHKD, CurrencyNZD,
		CurrencySEK, CurrencyNOK, CurrencyDKK, CurrencyPLN, CurrencySGD,
		CurrencyCZK, CurrencyHUF, CurrencyILS, CurrencyMXN, CurrencyBRL,
		CurrencyZAR, CurrencyKRW, CurrencyINR, CurrencyBHD, CurrencyKWD,
		CurrencyOMR, CurrencyJOD:
		return true
	default:
		return false
	}
}

// MinorUnitExponent returns the number of decimal places (exponent) for the minor unit.
// Most currencies have 2 (cents/pence). JPY/KRW have 0. BHD/KWD/OMR/JOD have 3.
func (c Currency) MinorUnitExponent() int {
	switch c {
	case CurrencyJPY, CurrencyKRW:
		return 0
	case CurrencyBHD, CurrencyKWD, CurrencyOMR, CurrencyJOD:
		return 3
	default:
		return 2
	}
}

// String returns the currency code string
func (c Currency) String() string {
	return string(c)
}
