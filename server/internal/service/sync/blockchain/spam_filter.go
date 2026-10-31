package blockchain

import (
	"context"
	"strings"

	"github.com/uptrace/bun"
	"sigma_finance/internal/domain/model"
)

// SpamFilter evaluates on-chain token balances against Sigma's catalog
type SpamFilter struct {
	db bun.IDB
}

// NewSpamFilter creates a new SpamFilter instance
func NewSpamFilter(db bun.IDB) *SpamFilter {
	return &SpamFilter{db: db}
}

// EvaluateToken checks if a token is legitimate or unverified/spam
func (f *SpamFilter) EvaluateToken(ctx context.Context, bal RawTokenBalance) (isSpam bool, instrumentID *string) {
	// Native coins are always legitimate
	if bal.IsNative || bal.TokenAddress == nil || *bal.TokenAddress == "" {
		return false, nil
	}

	tokenAddr := strings.ToLower(strings.TrimSpace(*bal.TokenAddress))

	// Obvious spam signals in token name/symbol
	lowerName := strings.ToLower(bal.Name)
	lowerSym := strings.ToLower(bal.Symbol)
	if strings.Contains(lowerName, "visit") || strings.Contains(lowerName, ".org") ||
		strings.Contains(lowerName, ".io") || strings.Contains(lowerName, "claim") ||
		strings.Contains(lowerName, "airdrop") || strings.Contains(lowerSym, ".com") {
		return true, nil
	}

	if f.db == nil {
		// If no DB, default to unflagged
		return false, nil
	}

	// Check against instruments table in catalog
	var inst model.Instrument
	err := f.db.NewSelect().
		Model(&inst).
		Where("LOWER(primary_contract_address) = ?", tokenAddr).
		Limit(1).
		Scan(ctx)

	if err == nil && inst.ID != "" {
		id := inst.ID
		return false, &id
	}

	// Check if token exists in platforms_json
	var instByPlatform model.Instrument
	err = f.db.NewSelect().
		Model(&instByPlatform).
		Where("platforms_json::text ILIKE ?", "%"+tokenAddr+"%").
		Limit(1).
		Scan(ctx)

	if err == nil && instByPlatform.ID != "" {
		id := instByPlatform.ID
		return false, &id
	}

	// If token has no match in catalog and large quantity of unknown symbol -> mark as unverified spam
	// Allow well-known symbols if contract matched or standard
	upperSym := strings.ToUpper(strings.TrimSpace(bal.Symbol))
	switch upperSym {
	case "USDC", "USDT", "DAI", "WETH", "WBTC", "SOL", "WSOL", "JUP", "BONK", "WIF", "RENDER", "PYTH", "JTO", "RAY", "BSOL", "JITOSOL", "MSOL":
		return false, nil
	}

	// Unknown token not in catalog: tag as spam/hidden shelf
	return true, nil
}
