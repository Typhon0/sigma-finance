package blockchain

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/crypto"
	"sigma_finance/internal/service/providers"
)

var stablecoins = map[string]bool{
	"USDT":  true,
	"USDC":  true,
	"DAI":   true,
	"BUSD":  true,
	"FDUSD": true,
	"USDE":  true,
	"TUSD":  true,
	"PYUSD": true,
	"EURC":  true,
}

func isStablecoin(symbol string) bool {
	return stablecoins[strings.ToUpper(strings.TrimSpace(symbol))]
}

func getNativeSymbol(network model.BlockchainNetwork) string {
	switch network {
	case model.BlockchainNetworkEthereum, model.BlockchainNetworkBase,
		model.BlockchainNetworkArbitrum, model.BlockchainNetworkOptimism:
		return "ETH"
	case model.BlockchainNetworkSolana:
		return "SOL"
	case model.BlockchainNetworkBitcoin:
		return "BTC"
	case model.BlockchainNetworkPolygon:
		return "POL"
	default:
		return "ETH"
	}
}

// InflowRecord stores a single incoming token movement and its derived unit cost
type InflowRecord struct {
	Quantity   decimal.Decimal
	UnitPrice  decimal.Decimal
	ExecutedAt time.Time
	IsDexSwap  bool
}

// ResolveAccountCostBasis calculates VWAP cost basis for all balances in the given wallet account.
func (s *WalletSyncService) ResolveAccountCostBasis(
	ctx context.Context,
	account *model.WalletAccount,
	activities []*model.WalletActivity,
) error {
	var balances []model.WalletBalance
	err := s.db.NewSelect().
		Model(&balances).
		Where("wallet_account_id = ?", account.ID).
		Scan(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch balances for cost basis: %w", err)
	}

	if len(balances) == 0 {
		return nil
	}

	// Map token addresses to symbols from current balances
	tokenSymbolMap := make(map[string]string)
	for _, b := range balances {
		if b.TokenAddress != nil && *b.TokenAddress != "" {
			tokenSymbolMap[strings.ToLower(*b.TokenAddress)] = b.Symbol
		}
	}

	// Index activities by tx_hash to detect swaps
	txMap := make(map[string][]*model.WalletActivity)
	for _, act := range activities {
		txMap[act.TxHash] = append(txMap[act.TxHash], act)
	}

	userLowerAddr := strings.ToLower(account.AddressOrXpub)

	for _, bal := range balances {
		var inflows []InflowRecord
		var earliestAcquisition *time.Time
		hasSwap := false

		for _, act := range activities {
			if strings.ToLower(act.ToAddress) != userLowerAddr {
				continue
			}

			// Match token address or native
			isMatch := false
			if bal.TokenAddress == nil || *bal.TokenAddress == "" {
				isMatch = (act.TokenAddress == nil || *act.TokenAddress == "")
			} else if act.TokenAddress != nil {
				isMatch = strings.EqualFold(*act.TokenAddress, *bal.TokenAddress)
			}

			if !isMatch || !act.FormattedAmount.IsPositive() {
				continue
			}

			if earliestAcquisition == nil || act.ExecutedAt.Before(*earliestAcquisition) {
				t := act.ExecutedAt
				earliestAcquisition = &t
			}

			// Check if part of a DEX swap in this transaction
			group := txMap[act.TxHash]
			var swapOut *model.WalletActivity
			for _, g := range group {
				if strings.ToLower(g.FromAddress) == userLowerAddr && g.TxHash == act.TxHash && g.ID != act.ID {
					swapOut = g
					break
				}
			}

			var unitPrice decimal.Decimal
			isSwapLeg := false

			if swapOut != nil && swapOut.FormattedAmount.IsPositive() {
				outSymbol := s.resolveSymbolForActivity(account.Network, swapOut.TokenAddress, tokenSymbolMap)
				outPrice, errPrice := s.fetchHistoricalPrice(ctx, outSymbol, swapOut.ExecutedAt)
				if errPrice == nil && outPrice.IsPositive() {
					outVal := swapOut.FormattedAmount.Mul(outPrice)
					unitPrice = outVal.Div(act.FormattedAmount)
					isSwapLeg = true
					hasSwap = true
				}
			}

			if unitPrice.IsZero() {
				// Fallback to inbound token historical price
				inSymbol := bal.Symbol
				p, errP := s.fetchHistoricalPrice(ctx, inSymbol, act.ExecutedAt)
				if errP == nil && p.IsPositive() {
					unitPrice = p
				}
			}

			if unitPrice.IsPositive() {
				inflows = append(inflows, InflowRecord{
					Quantity:   act.FormattedAmount,
					UnitPrice:  unitPrice,
					ExecutedAt: act.ExecutedAt,
					IsDexSwap:  isSwapLeg,
				})
			}
		}

		if len(inflows) == 0 {
			// Anti-phantom gain rule: default stablecoins to $1.00 FMV if no inflows detected
			if isStablecoin(bal.Symbol) && bal.CostBasisType != "MANUAL" {
				one := decimal.NewFromInt(1)
				basisType := "HISTORICAL_FMV"
				_, errUpd := s.db.NewUpdate().
					Model((*model.WalletBalance)(nil)).
					Set("cost_basis_per_unit = ?", one).
					Set("cost_basis_currency = 'USD'").
					Set("cost_basis_type = ?", basisType).
					Set("auto_estimated_basis = ?", one).
					Set("last_updated_at = NOW()").
					Where("id = ?", bal.ID).
					Exec(ctx)
				if errUpd != nil {
					log.Printf("[WARN] [WalletSyncService] Failed to set default stablecoin cost basis for %s: %v", bal.Symbol, errUpd)
				}
			}
			continue
		}

		// Calculate VWAP: sum(qty * price) / sum(qty)
		totalCost := decimal.Zero
		totalQty := decimal.Zero
		for _, inf := range inflows {
			cost := inf.Quantity.Mul(inf.UnitPrice)
			totalCost = totalCost.Add(cost)
			totalQty = totalQty.Add(inf.Quantity)
		}

		if !totalQty.IsPositive() {
			continue
		}

		vwap := totalCost.Div(totalQty)
		basisType := "HISTORICAL_FMV"
		if hasSwap {
			basisType = "DEX_SWAP"
		}

		// Update database
		upd := s.db.NewUpdate().
			Model((*model.WalletBalance)(nil)).
			Set("auto_estimated_basis = ?", vwap).
			Set("acquired_at = ?", earliestAcquisition).
			Set("last_updated_at = NOW()").
			Where("id = ?", bal.ID)

		// Never overwrite MANUAL cost basis
		if bal.CostBasisType != "MANUAL" {
			upd = upd.
				Set("cost_basis_per_unit = ?", vwap).
				Set("cost_basis_currency = 'USD'").
				Set("cost_basis_type = ?", basisType)
		}

		_, errUpd := upd.Exec(ctx)
		if errUpd != nil {
			log.Printf("[WARN] [WalletSyncService] Failed to update cost basis for balance %s (%s): %v", bal.ID, bal.Symbol, errUpd)
		}
	}

	return nil
}

func (s *WalletSyncService) resolveSymbolForActivity(network model.BlockchainNetwork, tokenAddress *string, tokenSymbolMap map[string]string) string {
	if tokenAddress == nil || *tokenAddress == "" {
		return getNativeSymbol(network)
	}
	addrLower := strings.ToLower(*tokenAddress)
	if sym, ok := tokenSymbolMap[addrLower]; ok && sym != "" {
		return sym
	}
	return ""
}

func (s *WalletSyncService) fetchHistoricalPrice(ctx context.Context, symbol string, t time.Time) (decimal.Decimal, error) {
	sym := crypto.NormalizeCryptoSymbol(symbol)
	if sym == "" {
		return decimal.Zero, fmt.Errorf("empty symbol")
	}

	if isStablecoin(sym) {
		return decimal.NewFromInt(1), nil
	}

	// 1. Try local DB asset_prices_daily rollup
	var localPrice struct {
		Price decimal.Decimal `bun:"price"`
	}
	dateStr := t.UTC().Format("2006-01-02")
	err := s.db.NewSelect().
		TableExpr("sigma_finance.asset_prices_daily apd").
		Join("JOIN sigma_finance.assets a ON a.id = apd.asset_id").
		Column("apd.price").
		Where("UPPER(a.ticker) = UPPER(?) AND apd.price_date = ?", sym, dateStr).
		Limit(1).
		Scan(ctx, &localPrice)
	if err == nil && localPrice.Price.IsPositive() {
		return localPrice.Price, nil
	}

	// 2. Query Binance public API klines (1d candle on acquisition date)
	binance := providers.NewBinanceProvider()
	start := t.UTC().Truncate(24 * time.Hour)
	end := start.Add(24 * time.Hour)
	resp, err := binance.GetCandles(ctx, providers.CandleRequest{
		Symbol:    sym + "/USDT",
		AssetType: "CRYPTO",
		Interval:  model.Interval1d,
		From:      start,
		To:        end,
		Limit:     1,
	})
	if err == nil && resp != nil && len(resp.Candles) > 0 && resp.Candles[0].Close.IsPositive() {
		return resp.Candles[0].Close, nil
	}

	return decimal.Zero, fmt.Errorf("no historical price found for %s on %s", sym, dateStr)
}

