package model

import (
	"testing"
)

func TestAccount_Validate(t *testing.T) {
	tests := []struct {
		name    string
		account Account
		wantErr bool
	}{
		{
			name: "valid broker account",
			account: Account{
				UserID:      "usr-1",
				PortfolioID: "pf-1",
				Name:        "Trade Republic CTO",
				Type:        AccountTypeBroker,
				TaxWrapper:  TaxWrapperStandardTaxable,
			},
			wantErr: false,
		},
		{
			name: "valid PEA account with default tax wrapper assignment",
			account: Account{
				UserID:      "usr-1",
				PortfolioID: "pf-1",
				Name:        "BoursoBank PEA",
				Type:        AccountTypeBroker,
			},
			wantErr: false,
		},
		{
			name: "missing name",
			account: Account{
				UserID:      "usr-1",
				PortfolioID: "pf-1",
				Name:        "",
				Type:        AccountTypeBroker,
			},
			wantErr: true,
		},
		{
			name: "missing user id",
			account: Account{
				UserID:      "",
				PortfolioID: "pf-1",
				Name:        "My Account",
				Type:        AccountTypeBroker,
			},
			wantErr: true,
		},
		{
			name: "missing portfolio id",
			account: Account{
				UserID:      "usr-1",
				PortfolioID: "",
				Name:        "My Account",
				Type:        AccountTypeBroker,
			},
			wantErr: true,
		},
		{
			name: "invalid type",
			account: Account{
				UserID:      "usr-1",
				PortfolioID: "pf-1",
				Name:        "My Account",
				Type:        "UNKNOWN_TYPE",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.account.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Account.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAccountType_IsValid(t *testing.T) {
	valid := []AccountType{
		AccountTypeBroker,
		AccountTypeBank,
		AccountTypeCryptoExchange,
		AccountTypeOther,
	}
	for _, at := range valid {
		if !at.IsValid() {
			t.Errorf("expected %s to be valid", at)
		}
	}

	if AccountType("INVALID").IsValid() {
		t.Errorf("expected INVALID to be invalid")
	}
}
