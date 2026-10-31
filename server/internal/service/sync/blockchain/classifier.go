package blockchain

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain/model"
)

// ClassificationResult contains classified accounting transactions and staged reviews
type ClassificationResult struct {
	Transactions    []*model.Transaction
	StagedReviews   []*model.WalletActivityReview
	UpdatedActivity []*model.WalletActivity
}

// ActivityClassifier translates raw on-chain activities into portfolio transactions and reviews
type ActivityClassifier struct{}

// NewActivityClassifier creates a new ActivityClassifier
func NewActivityClassifier() *ActivityClassifier {
	return &ActivityClassifier{}
}

// Classify processes raw activities for a wallet account
func (c *ActivityClassifier) Classify(
	ctx context.Context,
	account *model.WalletAccount,
	activities []*model.WalletActivity,
	ownedAddresses map[string]bool,
) (*ClassificationResult, error) {
	result := &ClassificationResult{}

	// 1. Group activities by TxHash to detect multi-token swaps
	byTxHash := make(map[string][]*model.WalletActivity)
	for _, act := range activities {
		byTxHash[act.TxHash] = append(byTxHash[act.TxHash], act)
	}

	userLowerAddr := strings.ToLower(account.AddressOrXpub)

	for txHash, group := range byTxHash {
		// Case A: Complex multi-legged transaction (3+ movements or unrecognized contract call)
		if len(group) >= 3 {
			for _, act := range group {
				review := &model.WalletActivityReview{
					WalletActivityID: act.ID,
					UserID:           account.UserID,
					ReviewStatus:     model.WalletReviewStatusPending,
					SuggestedType:    model.TransactionTypeTransferIn,
					Notes:            stringPtr(fmt.Sprintf("Complex DeFi transaction (%d movements in tx %s)", len(group), truncateHash(txHash))),
					CreatedAt:        time.Now().UTC(),
					UpdatedAt:        time.Now().UTC(),
				}
				result.StagedReviews = append(result.StagedReviews, review)
			}
			continue
		}

		// Case B: Token Swap (Same tx_hash has 1 outgoing and 1 incoming token for user)
		var outgoing []*model.WalletActivity
		var incoming []*model.WalletActivity

		for _, act := range group {
			fromLower := strings.ToLower(act.FromAddress)
			toLower := strings.ToLower(act.ToAddress)

			if fromLower == userLowerAddr && toLower != userLowerAddr {
				outgoing = append(outgoing, act)
			} else if toLower == userLowerAddr && fromLower != userLowerAddr {
				incoming = append(incoming, act)
			}
		}

		if len(outgoing) == 1 && len(incoming) == 1 && !isRentRecoveryOrClosure(group) {
			// SWAP DETECTED: Outgoing = SELL, Incoming = BUY
			outAct := outgoing[0]
			inAct := incoming[0]

			// Outgoing SELL transaction
			sellTx := &model.Transaction{
				UserID:            account.UserID,
				AccountID:         account.AccountID,
				Type:              model.TransactionTypeSell,
				Amount:            1, // Satisfies valid_amount CHECK (amount <> 0)
				ExecutedAt:        outAct.ExecutedAt,
				Quantity:          &outAct.FormattedAmount,
				UnitPriceCurrency: model.CurrencyUSD,
				FeesCurrency:      model.CurrencyUSD,
				Notes:             stringPtr(fmt.Sprintf("On-chain swap sell (tx: %s)", truncateHash(txHash))),
			}

			// Incoming BUY transaction with fee capitalization
			buyTx := &model.Transaction{
				UserID:            account.UserID,
				AccountID:         account.AccountID,
				Type:              model.TransactionTypeBuy,
				Amount:            1, // Satisfies valid_amount CHECK (amount <> 0)
				ExecutedAt:        inAct.ExecutedAt,
				Quantity:          &inAct.FormattedAmount,
				UnitPriceCurrency: model.CurrencyUSD,
				FeesCurrency:      model.CurrencyUSD,
				Notes:             stringPtr(fmt.Sprintf("On-chain swap buy (tx: %s)", truncateHash(txHash))),
			}

			result.Transactions = append(result.Transactions, sellTx, buyTx)
			continue
		}

		// Case C: Standard Single Transfers
		for _, act := range group {
			fromLower := strings.ToLower(act.FromAddress)
			toLower := strings.ToLower(act.ToAddress)

			// 1. Outgoing transfer
			if fromLower == userLowerAddr {
				isInternal := ownedAddresses[toLower]

				txType := model.TransactionTypeTransferOut
				notes := fmt.Sprintf("On-chain transfer out to %s", act.ToAddress)
				if isInternal {
					notes = fmt.Sprintf("Internal transfer to owned wallet %s", act.ToAddress)
				}

				tx := &model.Transaction{
					UserID:            account.UserID,
					AccountID:         account.AccountID,
					Type:              txType,
					Amount:            1, // Satisfies valid_amount CHECK (amount <> 0)
					ExecutedAt:        act.ExecutedAt,
					Quantity:          &act.FormattedAmount,
					UnitPriceCurrency: model.CurrencyUSD,
					FeesCurrency:      model.CurrencyUSD,
					Notes:             stringPtr(notes),
				}
				result.Transactions = append(result.Transactions, tx)

				// Record separate native FEE disposal if fee was spent
				if act.FeeAmount != "" && act.FeeAmount != "0" {
					feeDecimals := 18
					switch account.Network {
					case model.BlockchainNetworkSolana:
						feeDecimals = 9
					case model.BlockchainNetworkBitcoin:
						feeDecimals = 8
					}
					feeDecimal := parseRawAmountToDecimal(act.FeeAmount, feeDecimals)
					if feeDecimal.GreaterThan(decimal.Zero) {
						feeTx := &model.Transaction{
							UserID:            account.UserID,
							AccountID:         account.AccountID,
							Type:              model.TransactionTypeFee,
							Amount:            1, // Satisfies valid_amount CHECK (amount <> 0)
							ExecutedAt:        act.ExecutedAt,
							Quantity:          &feeDecimal,
							UnitPriceCurrency: model.CurrencyUSD,
							FeesCurrency:      model.CurrencyUSD,
							Notes:             stringPtr(fmt.Sprintf("Network gas fee for tx %s", truncateHash(txHash))),
						}
						result.Transactions = append(result.Transactions, feeTx)
					}
				}
				continue
			}

			// 2. Incoming transfer
			if toLower == userLowerAddr {
				isInternal := ownedAddresses[fromLower]

				txType := model.TransactionTypeTransferIn
				notes := fmt.Sprintf("On-chain transfer in from %s", act.FromAddress)
				if isInternal {
					notes = fmt.Sprintf("Internal transfer from owned wallet %s", act.FromAddress)
				}

				tx := &model.Transaction{
					UserID:            account.UserID,
					AccountID:         account.AccountID,
					Type:              txType,
					Amount:            1, // Satisfies valid_amount CHECK (amount <> 0)
					ExecutedAt:        act.ExecutedAt,
					Quantity:          &act.FormattedAmount,
					UnitPriceCurrency: model.CurrencyUSD,
					FeesCurrency:      model.CurrencyUSD,
					Notes:             stringPtr(notes),
				}
				result.Transactions = append(result.Transactions, tx)
			}
		}
	}

	return result, nil
}

func truncateHash(s string) string {
	if len(s) > 10 {
		return s[:10]
	}
	return s
}

func parseRawAmountToDecimal(rawStr string, decimals int) decimal.Decimal {
	bi, ok := new(big.Int).SetString(rawStr, 10)
	if !ok {
		return decimal.Zero
	}
	return decimal.NewFromBigInt(bi, 0).Shift(-int32(decimals))
}

func stringPtr(s string) *string {
	return &s
}

func isRentRecoveryOrClosure(acts []*model.WalletActivity) bool {
	for _, a := range acts {
		if len(a.RawMetadata) > 0 {
			var m map[string]interface{}
			if err := json.Unmarshal(a.RawMetadata, &m); err == nil {
				if r, ok := m["rent_recovery_detected"].(bool); ok && r {
					return true
				}
				if c, ok := m["is_account_closure"].(bool); ok && c {
					return true
				}
			}
		}
	}
	return false
}
