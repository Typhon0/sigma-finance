package adapters

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure/enablebanking"
	syncservice "sigma_finance/internal/service/sync"
)

// EnableBankingCredentials represents the decrypted credential payload for Enable Banking.
type EnableBankingCredentials struct {
	ApplicationID string `json:"application_id"`
	PrivateKey    string `json:"private_key"`
	RedirectURL   string `json:"redirect_url,omitempty"`
	SessionID     string `json:"session_id,omitempty"`
}

// EnableBankingAdapter implements syncservice.SyncAdapter for European PSD2 Open Banking via Enable Banking.
type EnableBankingAdapter struct {
	clientFactory func(appID, privateKey string) *enablebanking.Client
	timeNow       func() time.Time
}

// EnableBankingOption allows customizing the adapter.
type EnableBankingOption func(*EnableBankingAdapter)

// WithEnableBankingClientFactory sets a custom client factory (useful for unit testing).
func WithEnableBankingClientFactory(factory func(appID, privateKey string) *enablebanking.Client) EnableBankingOption {
	return func(a *EnableBankingAdapter) {
		a.clientFactory = factory
	}
}

// NewEnableBankingAdapter creates a new EnableBankingAdapter instance.
func NewEnableBankingAdapter(opts ...EnableBankingOption) *EnableBankingAdapter {
	a := &EnableBankingAdapter{
		clientFactory: func(appID, privateKey string) *enablebanking.Client {
			return enablebanking.NewClient(appID, privateKey)
		},
		timeNow: time.Now,
	}
	for _, opt := range opts {
		opt(a)
	}
	return a
}

// Provider returns the provider identifier string.
func (a *EnableBankingAdapter) Provider() string {
	return model.SyncProviderEnableBanking
}

func (a *EnableBankingAdapter) parseCredentials(cred *model.SyncCredential) (*EnableBankingCredentials, error) {
	parsed := &EnableBankingCredentials{}

	if cred != nil {
		rawJSON, err := cred.Decrypt()
		if err == nil && strings.TrimSpace(rawJSON) != "" {
			_ = json.Unmarshal([]byte(rawJSON), parsed)
			if parsed.ApplicationID == "" || parsed.PrivateKey == "" {
				var aux struct {
					ApplicationID string `json:"applicationId"`
					PrivateKey    string `json:"privateKey"`
					RedirectURL   string `json:"redirectUrl"`
					SessionID     string `json:"sessionId"`
				}
				if json.Unmarshal([]byte(rawJSON), &aux) == nil {
					if parsed.ApplicationID == "" {
						parsed.ApplicationID = aux.ApplicationID
					}
					if parsed.PrivateKey == "" {
						parsed.PrivateKey = aux.PrivateKey
					}
					if parsed.RedirectURL == "" {
						parsed.RedirectURL = aux.RedirectURL
					}
					if parsed.SessionID == "" {
						parsed.SessionID = aux.SessionID
					}
				}
			}
		}
	}

	// Fallback to environment variables if missing in DB credential
	if parsed.ApplicationID == "" {
		parsed.ApplicationID = strings.TrimSpace(os.Getenv("ENABLEBANKING_APPLICATION_ID"))
		if parsed.ApplicationID == "" {
			parsed.ApplicationID = strings.TrimSpace(os.Getenv("ENABLE_BANKING_APPLICATION_ID"))
		}
	}
	if parsed.PrivateKey == "" {
		parsed.PrivateKey = strings.TrimSpace(os.Getenv("ENABLEBANKING_PRIVATE_KEY"))
		if parsed.PrivateKey == "" {
			parsed.PrivateKey = strings.TrimSpace(os.Getenv("ENABLE_BANKING_PRIVATE_KEY"))
		}
		if parsed.PrivateKey == "" {
			keyPath := strings.TrimSpace(os.Getenv("ENABLEBANKING_PRIVATE_KEY_PATH"))
			if keyPath == "" {
				keyPath = strings.TrimSpace(os.Getenv("ENABLE_BANKING_PRIVATE_KEY_PATH"))
			}
			if keyPath != "" {
				if keyBytes, err := os.ReadFile(keyPath); err == nil {
					parsed.PrivateKey = string(keyBytes)
				}
			}
		}
	}
	if parsed.RedirectURL == "" {
		parsed.RedirectURL = strings.TrimSpace(os.Getenv("ENABLEBANKING_REDIRECT_URI"))
		if parsed.RedirectURL == "" {
			parsed.RedirectURL = strings.TrimSpace(os.Getenv("ENABLE_BANKING_REDIRECT_URI"))
		}
	}

	if parsed.ApplicationID == "" || parsed.PrivateKey == "" {
		return nil, syncservice.ErrInvalidCredentials
	}

	return parsed, nil
}

func (a *EnableBankingAdapter) getClient(cred *model.SyncCredential) (*enablebanking.Client, *EnableBankingCredentials, error) {
	creds, err := a.parseCredentials(cred)
	if err != nil {
		return nil, nil, err
	}
	client := a.clientFactory(creds.ApplicationID, creds.PrivateKey)
	return client, creds, nil
}

// TestConnection verifies that the provided credentials can successfully communicate with Enable Banking API.
func (a *EnableBankingAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	client, _, err := a.getClient(cred)
	if err != nil {
		return err
	}

	// Verify authentication by fetching France ASPSPs (lightweight public endpoint)
	_, err = client.GetASPSPs(ctx, "FR")
	if err != nil {
		if errors.Is(err, enablebanking.ErrUnauthorized) {
			return syncservice.ErrInvalidCredentials
		}
		if errors.Is(err, enablebanking.ErrRateLimited) {
			return syncservice.ErrRateLimited
		}
		return err
	}
	return nil
}

// FetchAccounts queries Enable Banking for discovered bank accounts under the current session.
func (a *EnableBankingAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	client, creds, err := a.getClient(cred)
	if err != nil {
		return nil, err
	}

	if creds.SessionID == "" {
		return nil, fmt.Errorf("%w: missing session ID in credentials", syncservice.ErrInvalidCredentials)
	}

	// Poll session until accounts are ready (handling bank activation latency)
	sessionRes, err := client.PollSessionUntilReady(ctx, creds.SessionID, 3, 1500*time.Millisecond)
	if err != nil {
		if errors.Is(err, enablebanking.ErrConsentExpired) {
			return nil, syncservice.ErrExpiredCredentials
		}
		if errors.Is(err, enablebanking.ErrUnauthorized) {
			return nil, syncservice.ErrInvalidCredentials
		}
		return nil, err
	}

	var rawAccounts []syncservice.RawAccount
	institution := "Bank"
	if sessionRes.ASPSP != nil && sessionRes.ASPSP.Name != "" {
		institution = sessionRes.ASPSP.Name
	}

	for i, accountID := range sessionRes.AccountIDs() {
		var preInfo *enablebanking.SessionAccountInfo
		if i < len(sessionRes.AccountsInfo) && (sessionRes.AccountsInfo[i].UID == accountID || sessionRes.AccountsInfo[i].AccountID.IBAN == accountID) {
			preInfo = &sessionRes.AccountsInfo[i]
		}

		details, err := client.GetAccountDetails(ctx, accountID)
		if err != nil {
			log.Printf("[WARN] [EnableBankingAdapter] Failed to fetch details for account %s: %v", accountID, err)
		}

		iban := ""
		bban := ""
		other := ""
		name := ""
		currency := "EUR"

		if details != nil {
			iban = strings.ToUpper(strings.ReplaceAll(details.AccountID.IBAN, " ", ""))
			bban = details.AccountID.BBAN
			other = details.AccountID.Other
			name = details.Name
			if name == "" {
				name = details.Product
			}
			if name == "" {
				name = details.Details
			}
			if details.Currency != "" {
				currency = strings.ToUpper(strings.TrimSpace(details.Currency))
			}
		} else if preInfo != nil {
			iban = strings.ToUpper(strings.ReplaceAll(preInfo.AccountID.IBAN, " ", ""))
			bban = preInfo.AccountID.BBAN
			other = preInfo.AccountID.Other
			name = preInfo.Name
			if name == "" {
				name = preInfo.Product
			}
			if name == "" {
				name = preInfo.Details
			}
			if preInfo.Currency != "" {
				currency = strings.ToUpper(strings.TrimSpace(preInfo.Currency))
			}
		}

		accountNum := iban
		if accountNum == "" {
			accountNum = bban
		}
		if accountNum == "" {
			accountNum = other
		}
		if accountNum == "" {
			accountNum = accountID
		}

		if name == "" && iban != "" {
			name = fmt.Sprintf("%s (%s)", institution, iban)
		} else if name == "" && other != "" {
			shortOther := other
			if len(shortOther) > 8 {
				shortOther = shortOther[:8]
			}
			name = fmt.Sprintf("%s (Pocket %s)", institution, shortOther)
		}
		if name == "" {
			name = fmt.Sprintf("%s Account", institution)
		}

		rawAccounts = append(rawAccounts, syncservice.RawAccount{
			ExternalID:    accountID,
			Name:          name,
			Type:          model.AccountTypeBank,
			TaxWrapper:    model.TaxWrapperStandardTaxable,
			Institution:   institution,
			AccountNumber: accountNum,
			Currency:      model.Currency(currency),
		})
	}

	sort.Slice(rawAccounts, func(i, j int) bool {
		return rawAccounts[i].ExternalID < rawAccounts[j].ExternalID
	})

	return rawAccounts, nil
}

// FetchBalances queries /accounts/{id}/balances and returns cash balances.
func (a *EnableBankingAdapter) FetchBalances(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
) (syncservice.BalancesSnapshot, error) {
	if strings.TrimSpace(externalAccountID) == "" {
		return syncservice.BalancesSnapshot{}, errors.New("external account ID is required")
	}

	client, _, err := a.getClient(cred)
	if err != nil {
		return syncservice.BalancesSnapshot{}, err
	}

	bals, err := client.GetBalances(ctx, externalAccountID)
	if err != nil {
		if errors.Is(err, enablebanking.ErrConsentExpired) {
			return syncservice.BalancesSnapshot{}, syncservice.ErrExpiredCredentials
		}
		if errors.Is(err, enablebanking.ErrUnauthorized) {
			return syncservice.BalancesSnapshot{}, syncservice.ErrInvalidCredentials
		}
		return syncservice.BalancesSnapshot{}, err
	}

	type currencyBalances struct {
		booked    *decimal.Decimal
		available *decimal.Decimal
	}
	grouped := make(map[string]*currencyBalances)

	for _, item := range bals {
		currCode := strings.ToUpper(strings.TrimSpace(item.BalanceAmount.Currency))
		if currCode == "" {
			currCode = string(model.CurrencyEUR)
		}

		amt, parseErr := decimal.NewFromString(strings.TrimSpace(item.BalanceAmount.Amount))
		if parseErr != nil {
			continue
		}

		cb, exists := grouped[currCode]
		if !exists {
			cb = &currencyBalances{}
			grouped[currCode] = cb
		}

		bType := strings.ToUpper(strings.TrimSpace(item.BalanceType))
		switch bType {
		case "CLBD": // Closing Booked (highest priority for booked)
			cb.booked = &amt
		case "ITBD": // Interim Booked
			if cb.booked == nil {
				cb.booked = &amt
			}
		case "XPCD": // Expected
			if cb.booked == nil {
				cb.booked = &amt
			}
		case "CLAV": // Closing Available
			cb.available = &amt
		case "ITAV": // Interim Available
			if cb.available == nil {
				cb.available = &amt
			}
		default:
			if cb.booked == nil {
				cb.booked = &amt
			}
		}
	}

	var rawBalances []syncservice.RawBalance
	for curr, cb := range grouped {
		var amt decimal.Decimal
		var avail *decimal.Decimal

		if cb.booked != nil {
			amt = *cb.booked
			if cb.available != nil {
				avail = cb.available
			} else {
				avail = cb.booked
			}
		} else if cb.available != nil {
			amt = *cb.available
			avail = cb.available
		} else {
			continue
		}

		rawBalances = append(rawBalances, syncservice.RawBalance{
			Currency:  model.Currency(curr),
			Amount:    amt,
			Available: avail,
		})
	}

	sort.Slice(rawBalances, func(i, j int) bool {
		return rawBalances[i].Currency < rawBalances[j].Currency
	})

	return syncservice.BalancesSnapshot{
		Balances:   rawBalances,
		IsComplete: true,
		AsOf:       a.timeNow(),
	}, nil
}

// FetchHoldings returns an empty snapshot because PSD2 bank accounts hold cash rather than securities.
func (a *EnableBankingAdapter) FetchHoldings(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
) (syncservice.HoldingsSnapshot, error) {
	return syncservice.HoldingsSnapshot{
		Holdings:       []syncservice.RawHolding{},
		IsComplete:     true,
		AsOf:           a.timeNow(),
		PaginationDone: true,
	}, nil
}

// FetchTransactions retrieves paginated booked transactions for an account.
func (a *EnableBankingAdapter) FetchTransactions(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
	since *time.Time,
	cursors syncservice.StreamCursors,
) (syncservice.TransactionsSnapshot, error) {
	if strings.TrimSpace(externalAccountID) == "" {
		return syncservice.TransactionsSnapshot{}, errors.New("external account ID is required")
	}

	client, _, err := a.getClient(cred)
	if err != nil {
		return syncservice.TransactionsSnapshot{}, err
	}

	dateFrom := ""
	if since != nil && !since.IsZero() {
		// Look back 7 days to catch any weekend/holiday settlement delays
		lookback := since.AddDate(0, 0, -7)
		dateFrom = lookback.Format("2006-01-02")
	} else {
		// Default to 90 days back (standard PSD2 historical limit)
		dateFrom = a.timeNow().AddDate(0, 0, -90).Format("2006-01-02")
	}

	continuationKey := ""
	if cursors != nil {
		continuationKey = cursors["continuation_key"]
	}

	var allRawTxs []syncservice.RawTransaction
	pageCount := 0
	const maxPages = 20

	for {
		pageCount++
		resp, err := client.GetTransactions(ctx, externalAccountID, dateFrom, continuationKey)
		if err != nil {
			if errors.Is(err, enablebanking.ErrConsentExpired) {
				return syncservice.TransactionsSnapshot{}, syncservice.ErrExpiredCredentials
			}
			return syncservice.TransactionsSnapshot{}, err
		}

		for _, item := range resp.Transactions {
			// Ingest only settled BOOK transactions
			status := strings.ToUpper(strings.TrimSpace(item.Status))
			if status != "" && status != "BOOK" && status != "BOOKED" {
				continue
			}

			txDate := a.parseTransactionDate(item.BookingDate, item.ValueDate)

			amtDec, err := decimal.NewFromString(strings.TrimSpace(item.TransactionAmount.Amount))
			if err != nil {
				continue
			}

			// Invert if negative so absolute amount is stored with type indicating direction
			isDebit := strings.ToUpper(strings.TrimSpace(item.CreditDebitIndicator)) == "DBIT" || amtDec.IsNegative()
			absAmt := amtDec.Abs()

			cents := int64(math.Round(absAmt.Mul(decimal.NewFromInt(100)).InexactFloat64()))
			if absAmt.IsZero() || cents == 0 {
				// Zero-amount card verification check (e.g. PayPal, Amazon, Tesla €0.00 pre-authorization)
				continue
			}

			txType := model.TransactionTypeDeposit
			if isDebit {
				txType = model.TransactionTypeWithdrawal
			}

			curr := strings.ToUpper(strings.TrimSpace(item.TransactionAmount.Currency))
			if curr == "" {
				curr = string(model.CurrencyEUR)
			}

			// External ID: prefer transaction_id, fallback to entry_reference or composite SHA256 hash
			extID := item.TransactionID
			if extID == "" {
				extID = item.EntryReference
			}
			if extID == "" {
				remittance := strings.Join(item.RemittanceInfo, " ")
				hashPayload := fmt.Sprintf("%s|%s|%s|%s", txDate.Format("2006-01-02"), item.TransactionAmount.Amount, curr, remittance)
				hash := sha256.Sum256([]byte(hashPayload))
				extID = "eb_" + hex.EncodeToString(hash[:16])
			}

			var notesParts []string
			if item.Creditor != nil && item.Creditor.Name != "" {
				notesParts = append(notesParts, item.Creditor.Name)
			} else if item.Debtor != nil && item.Debtor.Name != "" {
				notesParts = append(notesParts, item.Debtor.Name)
			}
			if len(item.RemittanceInfo) > 0 {
				notesParts = append(notesParts, strings.Join(item.RemittanceInfo, " - "))
			}
			notes := strings.Join(notesParts, " - ")
			if len(notes) > 255 {
				notes = notes[:255]
			}

			allRawTxs = append(allRawTxs, syncservice.RawTransaction{
				ExternalID: extID,
				Status:     "COMPLETED",
				Type:       txType,
				Amount:     model.Money(cents),
				Currency:   model.Currency(curr),
				ExecutedAt: txDate,
				Notes:      notes,
			})
		}

		continuationKey = resp.ContinuationKey
		if continuationKey == "" || pageCount >= maxPages {
			break
		}
	}

	resultCursors := syncservice.StreamCursors{}
	if continuationKey != "" {
		resultCursors["continuation_key"] = continuationKey
	}

	return syncservice.TransactionsSnapshot{
		Transactions:   allRawTxs,
		StreamCursors:  resultCursors,
		IsComplete:     true,
		PaginationDone: continuationKey == "",
	}, nil
}

func (a *EnableBankingAdapter) parseTransactionDate(bookingDate, valueDate string) time.Time {
	for _, ds := range []string{bookingDate, valueDate} {
		if ds != "" {
			if t, err := time.Parse("2006-01-02", ds); err == nil {
				return t.UTC()
			}
			if t, err := time.Parse(time.RFC3339, ds); err == nil {
				return t.UTC()
			}
		}
	}
	return a.timeNow().UTC()
}
