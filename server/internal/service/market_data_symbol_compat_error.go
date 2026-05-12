package service

import "strings"

type SymbolCompatibilityErrorCode string

const (
	SymbolCompatibilityInvalidInput SymbolCompatibilityErrorCode = "INVALID_INPUT"
	SymbolCompatibilityNotFound     SymbolCompatibilityErrorCode = "ASSET_NOT_FOUND"
	SymbolCompatibilityAmbiguous    SymbolCompatibilityErrorCode = "AMBIGUOUS_INSTRUMENT"
)

type SymbolCompatibilityError struct {
	Code      SymbolCompatibilityErrorCode
	Message   string
	Symbol    string
	AssetType string
	Matches   []string
}

func (e *SymbolCompatibilityError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func NewSymbolCompatibilityError(code SymbolCompatibilityErrorCode, message string, symbol string, assetType string, matches []string) *SymbolCompatibilityError {
	normalizedMatches := make([]string, len(matches))
	copy(normalizedMatches, matches)

	return &SymbolCompatibilityError{
		Code:      code,
		Message:   message,
		Symbol:    strings.TrimSpace(symbol),
		AssetType: strings.ToUpper(strings.TrimSpace(assetType)),
		Matches:   normalizedMatches,
	}
}
