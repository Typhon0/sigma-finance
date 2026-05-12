package graphql

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"sigma_finance/internal/service"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func mapMarketDataCompatibilityError(ctx context.Context, err error, replacementField string) error {
	var compatibilityErr *service.SymbolCompatibilityError
	if !errors.As(err, &compatibilityErr) {
		return err
	}

	message := strings.TrimSpace(compatibilityErr.Message)
	if message == "" {
		message = "symbol compatibility lookup failed"
	}
	if strings.TrimSpace(replacementField) != "" {
		message = fmt.Sprintf("%s; symbol compatibility is deprecated, use %s", message, replacementField)
	}

	extensions := map[string]interface{}{
		"code":                          string(compatibilityErr.Code),
		"category":                      "SYMBOL_COMPATIBILITY",
		"compatibilityPath":             "symbol_asset_type",
		"symbolCompatibilityDeprecated": true,
		"deprecationCode":               "SYMBOL_COMPAT_DEPRECATED",
	}

	if replacementField = strings.TrimSpace(replacementField); replacementField != "" {
		extensions["replacementField"] = replacementField
	}
	if compatibilityErr.Symbol != "" {
		extensions["symbol"] = compatibilityErr.Symbol
	}
	if compatibilityErr.AssetType != "" {
		extensions["assetType"] = compatibilityErr.AssetType
	}
	if len(compatibilityErr.Matches) > 0 {
		extensions["candidateInstrumentIds"] = compatibilityErr.Matches
		extensions["candidateCount"] = len(compatibilityErr.Matches)
	}

	return &gqlerror.Error{
		Message:    message,
		Path:       graphql.GetPath(ctx),
		Extensions: extensions,
	}
}
