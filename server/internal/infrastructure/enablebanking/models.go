package enablebanking

import (
	"encoding/json"
	"fmt"
	"time"
)

// ASPSP represents a financial institution returned by Enable Banking API.
type ASPSP struct {
	Name                string   `json:"name"`
	Title               string   `json:"title"`
	Country             string   `json:"country"`
	Logo                string   `json:"logo,omitempty"`
	PsuTypes            []string `json:"psu_types,omitempty"`
	IdentificationCodes []string `json:"identification_codes,omitempty"`
}

// ASPSPsResponse represents the payload returned by GET /aspsps.
type ASPSPsResponse struct {
	ASPSPs []ASPSP `json:"aspsps"`
}

// StartAuthAccess specifies the access permissions requested from the bank.
type StartAuthAccess struct {
	ValidUntil *time.Time `json:"valid_until,omitempty"`
}

// ASPSPTarget represents the target institution in auth requests.
type ASPSPTarget struct {
	Name    string `json:"name"`
	Country string `json:"country"`
}

// StartAuthRequest represents the payload for POST /auth.
type StartAuthRequest struct {
	Access      StartAuthAccess `json:"access"`
	ASPSP       ASPSPTarget     `json:"aspsp"`
	State       string          `json:"state"`
	RedirectURL string          `json:"redirect_url"`
	PsuType     string          `json:"psu_type,omitempty"`
}

// StartAuthResponse represents the response from POST /auth.
type StartAuthResponse struct {
	URL             string `json:"url"`
	ID              string `json:"id,omitempty"`
	AuthorizationID string `json:"authorization_id,omitempty"`
	SessionID       string `json:"session_id,omitempty"`
}

// ApplicationResponse represents the response from GET /application.
type ApplicationResponse struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Environment  string   `json:"environment"`
	RedirectURLs []string `json:"redirect_urls"`
	RedirectURIs []string `json:"redirectUris"`
	Active       bool     `json:"active"`
	Countries    []string `json:"countries"`
	Services     []string `json:"services"`
}

// AuthorizeSessionRequest represents the payload for POST /sessions.
type AuthorizeSessionRequest struct {
	Code string `json:"code"`
}

// GenericIdentification represents non-IBAN/BBAN account identifier (e.g. Revolut Pockets/Vaults with OTHI).
type GenericIdentification struct {
	Identification string `json:"identification"`
	SchemeName     string `json:"scheme_name,omitempty"`
	Issuer         string `json:"issuer,omitempty"`
}

// AccountIdentification contains standard account numbers (IBAN, BBAN, etc.).
type AccountIdentification struct {
	IBAN  string `json:"iban,omitempty"`
	BBAN  string `json:"bban,omitempty"`
	Other string `json:"other,omitempty"`
}

// UnmarshalJSON handles both string and GenericIdentification object in the "other" field.
func (a *AccountIdentification) UnmarshalJSON(data []byte) error {
	var aux struct {
		IBAN     string          `json:"iban,omitempty"`
		BBAN     string          `json:"bban,omitempty"`
		RawOther json.RawMessage `json:"other,omitempty"`
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	a.IBAN = aux.IBAN
	a.BBAN = aux.BBAN

	if len(aux.RawOther) > 0 && string(aux.RawOther) != "null" {
		// 1. Try string directly
		var s string
		if err := json.Unmarshal(aux.RawOther, &s); err == nil && s != "" {
			a.Other = s
			return nil
		}
		// 2. Try GenericIdentification object {"identification": "...", "scheme_name": "OTHI"}
		var gen GenericIdentification
		if err := json.Unmarshal(aux.RawOther, &gen); err == nil && gen.Identification != "" {
			a.Other = gen.Identification
			return nil
		}
	}
	return nil
}

// AccountDetailsResponse represents the response from GET /accounts/{account_id}/details.
type AccountDetailsResponse struct {
	AccountID AccountIdentification `json:"account_id"`
	Name      string                `json:"name,omitempty"`
	Details   string                `json:"details,omitempty"`
	Product   string                `json:"product,omitempty"`
	Currency  string                `json:"currency,omitempty"`
	Status    string                `json:"status,omitempty"`
}

// SessionAccountInfo contains parsed account information from a session.
type SessionAccountInfo struct {
	UID       string                `json:"uid,omitempty"`
	AccountID AccountIdentification `json:"account_id,omitempty"`
	Name      string                `json:"name,omitempty"`
	Product   string                `json:"product,omitempty"`
	Currency  string                `json:"currency,omitempty"`
	Details   string                `json:"details,omitempty"`
}

// SessionResponse represents the response from POST /sessions or GET /sessions/{id}.
type SessionResponse struct {
	SessionID    string               `json:"session_id"`
	Status       string               `json:"status,omitempty"`
	Accounts     []string             `json:"-"`
	AccountsInfo []SessionAccountInfo `json:"-"`
	ASPSP        *ASPSPTarget         `json:"aspsp,omitempty"`
}

// AccountIDs returns all discovered account IDs in the session.
func (s *SessionResponse) AccountIDs() []string {
	if len(s.Accounts) > 0 {
		return s.Accounts
	}
	ids := make([]string, 0, len(s.AccountsInfo))
	for _, a := range s.AccountsInfo {
		id := a.UID
		if id == "" {
			id = a.AccountID.IBAN
		}
		if id == "" {
			id = a.AccountID.Other
		}
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// UnmarshalJSON handles both []string, []SessionAccountInfo, and arbitrary map accounts in the "accounts" field.
func (s *SessionResponse) UnmarshalJSON(data []byte) error {
	type Alias SessionResponse
	aux := &struct {
		RawAccounts json.RawMessage `json:"accounts"`
		*Alias
	}{
		Alias: (*Alias)(s),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}

	if len(aux.RawAccounts) == 0 || string(aux.RawAccounts) == "null" {
		return nil
	}

	// 1. Try unmarshaling as []string (UUIDs from GET /sessions)
	var strAccounts []string
	if err := json.Unmarshal(aux.RawAccounts, &strAccounts); err == nil {
		s.Accounts = strAccounts
		s.AccountsInfo = make([]SessionAccountInfo, len(strAccounts))
		for i, id := range strAccounts {
			s.AccountsInfo[i] = SessionAccountInfo{UID: id}
		}
		return nil
	}

	// 2. Try unmarshaling as []SessionAccountInfo (objects from POST /sessions with AccountIdentification)
	var objAccounts []SessionAccountInfo
	if err := json.Unmarshal(aux.RawAccounts, &objAccounts); err == nil {
		s.AccountsInfo = objAccounts
		s.Accounts = make([]string, 0, len(objAccounts))
		for _, info := range objAccounts {
			id := info.UID
			if id == "" && info.AccountID.IBAN != "" {
				id = info.AccountID.IBAN
			}
			if id == "" && info.AccountID.Other != "" {
				id = info.AccountID.Other
			}
			s.Accounts = append(s.Accounts, id)
		}
		return nil
	}

	// 3. Tier 3 fallback: Parse as []map[string]interface{} to guarantee no schema variation can ever fail
	var genericAccounts []map[string]interface{}
	if err := json.Unmarshal(aux.RawAccounts, &genericAccounts); err == nil {
		s.AccountsInfo = make([]SessionAccountInfo, 0, len(genericAccounts))
		s.Accounts = make([]string, 0, len(genericAccounts))

		for _, item := range genericAccounts {
			var info SessionAccountInfo
			if uid, ok := item["uid"].(string); ok {
				info.UID = uid
			}
			if name, ok := item["name"].(string); ok {
				info.Name = name
			}
			if curr, ok := item["currency"].(string); ok {
				info.Currency = curr
			}
			if prod, ok := item["product"].(string); ok {
				info.Product = prod
			}
			if det, ok := item["details"].(string); ok {
				info.Details = det
			}

			if acctIDMap, ok := item["account_id"].(map[string]interface{}); ok {
				if iban, ok := acctIDMap["iban"].(string); ok {
					info.AccountID.IBAN = iban
				}
				if bban, ok := acctIDMap["bban"].(string); ok {
					info.AccountID.BBAN = bban
				}
				if otherStr, ok := acctIDMap["other"].(string); ok {
					info.AccountID.Other = otherStr
				} else if otherMap, ok := acctIDMap["other"].(map[string]interface{}); ok {
					if id, ok := otherMap["identification"].(string); ok {
						info.AccountID.Other = id
					}
				}
			} else if acctIDStr, ok := item["account_id"].(string); ok {
				info.AccountID.Other = acctIDStr
			}

			id := info.UID
			if id == "" {
				id = info.AccountID.IBAN
			}
			if id == "" {
				id = info.AccountID.Other
			}
			if id != "" {
				s.Accounts = append(s.Accounts, id)
				s.AccountsInfo = append(s.AccountsInfo, info)
			}
		}
		if len(s.Accounts) > 0 {
			return nil
		}
	}

	return fmt.Errorf("unable to unmarshal session accounts: unexpected format: %s", string(aux.RawAccounts))
}

// MarshalJSON serializes SessionResponse preserving accounts format.
func (s SessionResponse) MarshalJSON() ([]byte, error) {
	type Alias SessionResponse
	if len(s.AccountsInfo) > 0 && s.AccountsInfo[0].AccountID.IBAN != "" {
		return json.Marshal(&struct {
			Accounts []SessionAccountInfo `json:"accounts"`
			Alias
		}{
			Accounts: s.AccountsInfo,
			Alias:    Alias(s),
		})
	}
	return json.Marshal(&struct {
		Accounts []string `json:"accounts"`
		Alias
	}{
		Accounts: s.Accounts,
		Alias:    Alias(s),
	})
}

const (
	BalanceTypeCLAV = "CLAV" // Closing Available
	BalanceTypeCLBD = "CLBD" // Closing Booked
	BalanceTypeOPBD = "OPBD" // Opening Booked
	BalanceTypePRCD = "PRCD" // Previously Closed Booked
)

// BalanceAmount represents monetary amount and currency in a balance.
type BalanceAmount struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

// BalanceItem represents an account balance line item.
type BalanceItem struct {
	Name               string        `json:"name,omitempty"`
	BalanceAmount      BalanceAmount `json:"balance_amount"`
	BalanceType        string        `json:"balance_type"`
	ReferenceDate      string        `json:"reference_date,omitempty"`
	LastChangeDateTime string        `json:"last_change_date_time,omitempty"`
}

// BalancesResponse represents the response from GET /accounts/{id}/balances.
type BalancesResponse struct {
	Balances []BalanceItem `json:"balances"`
}

// TransactionAmount represents amount and currency in a transaction.
type TransactionAmount struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

// PartyInfo represents debtor or creditor details.
type PartyInfo struct {
	Name string `json:"name,omitempty"`
}

// TransactionItem represents a financial movement.
type TransactionItem struct {
	TransactionID        string                `json:"transaction_id,omitempty"`
	EntryReference       string                `json:"entry_reference,omitempty"`
	TransactionAmount    TransactionAmount     `json:"transaction_amount"`
	CreditDebitIndicator string                `json:"credit_debit_indicator"` // "CRDT" or "DBIT"
	Status               string                `json:"status,omitempty"`                 // "BOOKED", "PDNG"
	BookingDate          string                `json:"booking_date,omitempty"`
	ValueDate            string                `json:"value_date,omitempty"`
	RemittanceInfo       []string              `json:"remittance_information,omitempty"`
	Creditor             *PartyInfo            `json:"creditor,omitempty"`
	Debtor               *PartyInfo            `json:"debtor,omitempty"`
	DebtorAccount        *AccountIdentification `json:"debtor_account,omitempty"`
	CreditorAccount      *AccountIdentification `json:"creditor_account,omitempty"`
	BankTransactionCode  any                   `json:"bank_transaction_code,omitempty"`
}

// TransactionsResponse represents the paginated response from GET /accounts/{id}/transactions.
type TransactionsResponse struct {
	Transactions    []TransactionItem `json:"transactions"`
	ContinuationKey string            `json:"continuation_key,omitempty"`
}

// APIError represents an error response payload from Enable Banking.
type APIError struct {
	StatusCode int         `json:"code,omitempty"`
	ErrorCode  string      `json:"error,omitempty"`
	Message    string      `json:"message,omitempty"`
	Detail     interface{} `json:"detail,omitempty"`
}

func (e *APIError) Error() string {
	if e.ErrorCode != "" && e.Message != "" {
		return fmt.Sprintf("enable banking error (%s): %s", e.ErrorCode, e.Message)
	}
	if e.Message != "" {
		return fmt.Sprintf("enable banking error: %s", e.Message)
	}
	if e.ErrorCode != "" {
		return fmt.Sprintf("enable banking error: %s", e.ErrorCode)
	}
	return fmt.Sprintf("enable banking api error (status %d)", e.StatusCode)
}

