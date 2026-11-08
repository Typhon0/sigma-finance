package adapters

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"

	"github.com/shopspring/decimal"
)

const (
	defaultWoobBaseURL = "http://localhost:50055"
	defaultWoobTimeout = 30 * time.Second
)

// WoobCredentials defines the payload stored in SyncCredential for Woob.
type WoobCredentials struct {
	Institution string `json:"institution"` // "fortuneo" | "caissedepargne"
	Login       string `json:"login"`
	Password    string `json:"password"`
	Region      string `json:"region,omitempty"`
	SessionID   string `json:"session_id,omitempty"`
}

// WoobAdapter implements syncservice.SyncAdapter using the local woob-service container.
type WoobAdapter struct {
	baseURL    string
	httpClient *http.Client
}

// NewWoobAdapter creates a new WoobAdapter.
func NewWoobAdapter(baseURL string, client *http.Client) *WoobAdapter {
	if baseURL == "" {
		baseURL = strings.TrimSpace(os.Getenv("WOOB_SERVICE_URL"))
		if baseURL == "" {
			baseURL = defaultWoobBaseURL
		}
	}
	if client == nil {
		client = &http.Client{Timeout: defaultWoobTimeout}
	}
	return &WoobAdapter{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: client,
	}
}

func (a *WoobAdapter) Provider() string {
	return model.SyncProviderWoob
}

func (a *WoobAdapter) parseCredentials(cred *model.SyncCredential) (*WoobCredentials, error) {
	if cred == nil {
		return nil, syncservice.ErrCredentialNotFound
	}
	secretData := cred.RawData
	if secretData == "" {
		decrypted, err := cred.Decrypt()
		if err != nil {
			return nil, fmt.Errorf("%w: failed to decrypt credential: %v", syncservice.ErrInvalidCredentials, err)
		}
		secretData = decrypted
	}

	var creds WoobCredentials
	if err := json.Unmarshal([]byte(secretData), &creds); err != nil {
		// Try decrypting if not valid JSON directly
		decrypted, errDec := cred.Decrypt()
		if errDec == nil {
			if errJson := json.Unmarshal([]byte(decrypted), &creds); errJson == nil {
				secretData = decrypted
			}
		}
		if creds.Institution == "" {
			return nil, fmt.Errorf("invalid woob credentials JSON: %w", err)
		}
	}

	if creds.Institution == "" || (creds.Login == "" && creds.SessionID == "") {
		return nil, syncservice.ErrInvalidCredentials
	}

	return &creds, nil
}

// ensureSession authenticates if no active session ID exists.
func (a *WoobAdapter) ensureSession(ctx context.Context, creds *WoobCredentials) (string, error) {
	if creds.SessionID != "" {
		return creds.SessionID, nil
	}

	if creds.Login == "" || creds.Password == "" {
		return "", fmt.Errorf("session expired and no login/password credentials available to re-authenticate")
	}

	payload := map[string]interface{}{
		"institution": creds.Institution,
		"login":       creds.Login,
		"password":    creds.Password,
		"region":      creds.Region,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/v1/auth/login", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("woob-service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("login failed (%d): %s", resp.StatusCode, string(respBytes))
	}

	var res struct {
		SessionID string `json:"session_id"`
		Status    string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	creds.SessionID = res.SessionID
	return res.SessionID, nil
}

func (a *WoobAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	creds, err := a.parseCredentials(cred)
	if err != nil {
		return err
	}
	_, err = a.ensureSession(ctx, creds)
	return err
}

func (a *WoobAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	creds, err := a.parseCredentials(cred)
	if err != nil {
		return nil, err
	}
	sessionID, err := a.ensureSession(ctx, creds)
	if err != nil {
		return nil, err
	}

	payload := map[string]string{"session_id": sessionID}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/v1/accounts", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound && creds.Login != "" && creds.Password != "" {
		// Session expired in woob-service, re-authenticate and retry once
		creds.SessionID = ""
		newSessionID, errAuth := a.ensureSession(ctx, creds)
		if errAuth == nil {
			retryPayload := map[string]string{"session_id": newSessionID}
			retryBody, _ := json.Marshal(retryPayload)
			retryReq, errReq := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/v1/accounts", bytes.NewReader(retryBody))
			if errReq == nil {
				retryReq.Header.Set("Content-Type", "application/json")
				retryResp, errDo := a.httpClient.Do(retryReq)
				if errDo == nil {
					defer retryResp.Body.Close()
					if retryResp.StatusCode == http.StatusOK {
						resp = retryResp
					}
				}
			}
		}
	}

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to fetch accounts from woob (%d): %s", resp.StatusCode, string(respBytes))
	}

	var items []struct {
		ExternalID    string  `json:"external_id"`
		Name          string  `json:"name"`
		Type          string  `json:"type"`
		Currency      string  `json:"currency"`
		Balance       float64 `json:"balance"`
		IBAN          *string `json:"iban"`
		AccountNumber *string `json:"account_number"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}

	institutionName := formatInstitutionName(creds.Institution)

	var results []syncservice.RawAccount
	for _, it := range items {
		accType := model.AccountTypeBank
		taxWrapper := model.TaxWrapperStandardTaxable

		rawType := strings.ToLower(it.Type)
		nameUpper := strings.ToUpper(it.Name)

		switch rawType {
		case "market":
			accType = model.AccountTypeBroker
			if strings.Contains(nameUpper, "PEA") {
				taxWrapper = model.TaxWrapperPEA
			} else {
				taxWrapper = model.TaxWrapperStandardTaxable
			}
		case "pea":
			accType = model.AccountTypeBroker
			taxWrapper = model.TaxWrapperPEA
		case "life_insurance":
			accType = model.AccountTypeBroker
			taxWrapper = model.TaxWrapperRetirementSheltered
		case "retirement":
			accType = model.AccountTypeBroker
			taxWrapper = model.TaxWrapperRetirementSheltered
		case "loan", "card", "savings", "checking":
			if strings.Contains(nameUpper, "PEA") {
				accType = model.AccountTypeBroker
				taxWrapper = model.TaxWrapperPEA
			} else if strings.Contains(nameUpper, "ASSURANCE") || strings.Contains(nameUpper, "VIE") {
				accType = model.AccountTypeBroker
				taxWrapper = model.TaxWrapperRetirementSheltered
			} else {
				accType = model.AccountTypeBank
			}
		default:
			if strings.Contains(nameUpper, "PEA") {
				accType = model.AccountTypeBroker
				taxWrapper = model.TaxWrapperPEA
			} else if strings.Contains(nameUpper, "ASSURANCE") || strings.Contains(nameUpper, "VIE") {
				accType = model.AccountTypeBroker
				taxWrapper = model.TaxWrapperRetirementSheltered
			} else {
				accType = model.AccountTypeBank
			}
		}

		accNum := it.ExternalID
		if it.AccountNumber != nil && *it.AccountNumber != "" {
			accNum = *it.AccountNumber
		} else if it.IBAN != nil && *it.IBAN != "" {
			accNum = *it.IBAN
		}

		results = append(results, syncservice.RawAccount{
			ExternalID:    it.ExternalID,
			Name:          it.Name,
			Type:          accType,
			TaxWrapper:    taxWrapper,
			Institution:   institutionName,
			AccountNumber: accNum,
			Currency:      model.Currency(strings.ToUpper(it.Currency)),
		})
	}

	return results, nil
}

func formatInstitutionName(inst string) string {
	cleaned := strings.ToLower(strings.TrimSpace(inst))
	switch cleaned {
	case "boursorama", "boursobank":
		return "BoursoBank"
	case "fortuneo":
		return "Fortuneo"
	case "caissedepargne", "caisse_epargne":
		return "Caisse d'Épargne"
	case "creditagricole", "credit_agricole":
		return "Crédit Agricole"
	case "bnp", "bnpparibas":
		return "BNP Paribas"
	case "societegenerale", "societe_generale":
		return "Société Générale"
	case "creditmutuel", "credit_mutuel":
		return "Crédit Mutuel"
	case "cic":
		return "CIC"
	case "labanquepostale", "banquepostale":
		return "La Banque Postale"
	case "lcl":
		return "LCL"
	case "banquepopulaire", "banque_populaire":
		return "Banque Populaire"
	case "hellobank":
		return "Hello bank!"
	case "bforbank":
		return "BforBank"
	case "boursedirect":
		return "Bourse Direct"
	case "amundi":
		return "Amundi"
	case "linxea":
		return "Linxea"
	case "yomoni":
		return "Yomoni"
	case "revolut":
		return "Revolut"
	case "n26":
		return "N26"
	default:
		if len(inst) > 0 {
			words := strings.Fields(strings.ReplaceAll(inst, "_", " "))
			for i, w := range words {
				if len(w) > 0 {
					words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
				}
			}
			return strings.Join(words, " ")
		}
		return "Banque"
	}
}

func (a *WoobAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.BalancesSnapshot, error) {
	creds, err := a.parseCredentials(cred)
	if err != nil {
		return syncservice.BalancesSnapshot{}, err
	}
	sessionID, err := a.ensureSession(ctx, creds)
	if err != nil {
		return syncservice.BalancesSnapshot{}, err
	}

	payload := map[string]string{"session_id": sessionID}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/v1/accounts", bytes.NewReader(body))
	if err != nil {
		return syncservice.BalancesSnapshot{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return syncservice.BalancesSnapshot{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return syncservice.BalancesSnapshot{}, fmt.Errorf("failed to fetch balances (%d): %s", resp.StatusCode, string(respBytes))
	}

	var items []struct {
		ExternalID string  `json:"external_id"`
		Balance    float64 `json:"balance"`
		Currency   string  `json:"currency"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return syncservice.BalancesSnapshot{}, err
	}

	for _, it := range items {
		if it.ExternalID == externalAccountID {
			amount := decimal.NewFromFloat(it.Balance)
			return syncservice.BalancesSnapshot{
				Balances: []syncservice.RawBalance{
					{
						Currency:  model.Currency(strings.ToUpper(it.Currency)),
						Amount:    amount,
						Available: &amount,
					},
				},
				IsComplete: true,
				AsOf:       time.Now(),
			}, nil
		}
	}

	return syncservice.BalancesSnapshot{IsComplete: true, AsOf: time.Now()}, nil
}

func (a *WoobAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.HoldingsSnapshot, error) {
	creds, err := a.parseCredentials(cred)
	if err != nil {
		return syncservice.HoldingsSnapshot{}, err
	}
	sessionID, err := a.ensureSession(ctx, creds)
	if err != nil {
		return syncservice.HoldingsSnapshot{}, err
	}

	payload := map[string]string{
		"session_id":          sessionID,
		"external_account_id": externalAccountID,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/v1/investments", bytes.NewReader(body))
	if err != nil {
		return syncservice.HoldingsSnapshot{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return syncservice.HoldingsSnapshot{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return syncservice.HoldingsSnapshot{}, fmt.Errorf("failed to fetch holdings (%d): %s", resp.StatusCode, string(respBytes))
	}

	var items []struct {
		ISIN      string  `json:"isin"`
		Code      string  `json:"code"`
		Symbol    string  `json:"symbol"`
		Name      string  `json:"name"`
		Quantity  float64 `json:"quantity"`
		UnitValue float64 `json:"unit_value"`
		Valuation float64 `json:"valuation"`
		Diff      float64 `json:"diff"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return syncservice.HoldingsSnapshot{}, err
	}

	var holdings []syncservice.RawHolding
	for _, it := range items {
		// Filter out synthetic cash line (e.g. Fortuneo's XX-liquidity)
		if it.ISIN == "XX-liquidity" || it.Code == "XX-liquidity" || strings.HasPrefix(it.ISIN, "XX-") || strings.EqualFold(it.Name, "Liquidités") {
			continue
		}

		qty := decimal.NewFromFloat(it.Quantity)
		if qty.IsZero() || qty.IsNegative() {
			continue
		}

		price := decimal.NewFromFloat(it.UnitValue)
		costBasis := price // default cost basis if not distinguished
		if it.Quantity > 0 && it.Diff != 0 {
			costBasisVal := (it.Valuation - it.Diff) / it.Quantity
			costBasis = decimal.NewFromFloat(costBasisVal)
		}

		symbol := strings.TrimSpace(it.Symbol)
		if symbol == "" {
			symbol = strings.TrimSpace(it.Code)
		}
		if symbol == "" {
			symbol = strings.TrimSpace(it.ISIN)
		}
		if symbol == "" {
			symbol = strings.TrimSpace(it.Name)
		}

		isin := strings.TrimSpace(it.ISIN)
		if isin == "" && len(symbol) == 12 {
			isin = symbol
		}

		extID := isin
		if extID == "" {
			extID = symbol
		}

		var totalCost *model.Money
		if !costBasis.IsZero() && !qty.IsZero() {
			c := model.Money(costBasis.Mul(qty).Mul(decimal.NewFromInt(100)).Round(0).IntPart())
			totalCost = &c
		}

		holdings = append(holdings, syncservice.RawHolding{
			ExternalID:       extID,
			Symbol:           symbol,
			Name:             it.Name,
			ISIN:             isin,
			AssetType:        model.AssetTypeStock,
			Quantity:         qty,
			CostBasisPerUnit: &costBasis,
			TotalCostBasis:   totalCost,
			CurrentPrice:     &price,
			Currency:         model.CurrencyEUR,
		})
	}

	return syncservice.HoldingsSnapshot{
		Holdings:       holdings,
		IsComplete:     true,
		AsOf:           time.Now(),
		PaginationDone: true,
	}, nil
}

func (a *WoobAdapter) FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time, cursors syncservice.StreamCursors) (syncservice.TransactionsSnapshot, error) {
	creds, err := a.parseCredentials(cred)
	if err != nil {
		return syncservice.TransactionsSnapshot{}, err
	}
	sessionID, err := a.ensureSession(ctx, creds)
	if err != nil {
		return syncservice.TransactionsSnapshot{}, err
	}

	payload := map[string]string{
		"session_id":          sessionID,
		"external_account_id": externalAccountID,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/v1/transactions", bytes.NewReader(body))
	if err != nil {
		return syncservice.TransactionsSnapshot{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return syncservice.TransactionsSnapshot{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return syncservice.TransactionsSnapshot{}, fmt.Errorf("failed to fetch transactions (%d): %s", resp.StatusCode, string(respBytes))
	}

	var items []struct {
		ExternalID string  `json:"external_id"`
		Name       string  `json:"name"`
		Amount     float64 `json:"amount"`
		Currency   string  `json:"currency"`
		Date       string  `json:"date"`
		Raw        string  `json:"raw"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return syncservice.TransactionsSnapshot{}, err
	}

	var txs []syncservice.RawTransaction
	for _, it := range items {
		parsedDate, err := time.Parse("2006-01-02", it.Date)
		if err != nil {
			parsedDate = time.Now()
		}

		txType := model.TransactionTypeTransferIn
		if it.Amount < 0 {
			txType = model.TransactionTypeWithdrawal
		} else if it.Amount > 0 {
			txType = model.TransactionTypeDeposit
		}

		txs = append(txs, syncservice.RawTransaction{
			ExternalID: it.ExternalID,
			Name:       it.Name,
			Type:       txType,
			Amount:     model.Money(int64(it.Amount * 100)),
			Currency:   model.Currency(strings.ToUpper(it.Currency)),
			ExecutedAt: parsedDate,
			Notes:      it.Raw,
			RawPayload: []byte(it.Raw),
		})
	}

	return syncservice.TransactionsSnapshot{
		Transactions:   txs,
		IsComplete:     true,
		PaginationDone: true,
	}, nil
}
