package graphql

import (
	"context"
	"errors"
	"testing"

	"sigma_finance/internal/service"

	"github.com/vektah/gqlparser/v2/gqlerror"
)

func TestMapMarketDataCompatibilityError(t *testing.T) {
	compatErr := service.NewSymbolCompatibilityError(
		service.SymbolCompatibilityAmbiguous,
		"symbol BTC maps to multiple instruments; use instrumentId",
		"BTC",
		"CRYPTO",
		[]string{"inst-1", "inst-2"},
	)

	mapped := mapMarketDataCompatibilityError(context.Background(), compatErr, "candlesByInstrument")

	gqlErr, ok := mapped.(*gqlerror.Error)
	if !ok {
		t.Fatalf("expected gqlerror.Error, got %T", mapped)
	}

	if gqlErr.Message == "" {
		t.Fatal("expected non-empty GraphQL error message")
	}

	code, ok := gqlErr.Extensions["code"].(string)
	if !ok || code != string(service.SymbolCompatibilityAmbiguous) {
		t.Fatalf("unexpected code extension: %#v", gqlErr.Extensions["code"])
	}

	deprecated, ok := gqlErr.Extensions["symbolCompatibilityDeprecated"].(bool)
	if !ok || !deprecated {
		t.Fatalf("expected symbolCompatibilityDeprecated=true, got %#v", gqlErr.Extensions["symbolCompatibilityDeprecated"])
	}

	replacement, ok := gqlErr.Extensions["replacementField"].(string)
	if !ok || replacement != "candlesByInstrument" {
		t.Fatalf("unexpected replacementField extension: %#v", gqlErr.Extensions["replacementField"])
	}
}

func TestMapMarketDataCompatibilityErrorPassThrough(t *testing.T) {
	original := errors.New("plain error")
	mapped := mapMarketDataCompatibilityError(context.Background(), original, "candlesByInstrument")

	if mapped != original {
		t.Fatalf("expected original error passthrough, got %v", mapped)
	}
}
