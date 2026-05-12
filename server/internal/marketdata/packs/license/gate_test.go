package license

import "testing"

func TestGatePublicRedistributionAllowedPasses(t *testing.T) {
	policy := &Policy{
		ProviderID:               "binance-public-data",
		Name:                     "Binance Public Data",
		RedistributionAllowed:    true,
		CommercialUseAllowed:     true,
		AllowedDistributionModes: []string{"public", "private", "local"},
		LicenseName:              "MIT",
		TermsCheckedAt:           "2026-05-11",
	}
	result := Evaluate("public", "binance-public-data", policy)
	if !result.Allowed {
		t.Fatalf("expected gate pass, errors=%v", result.Errors)
	}
}

func TestGatePublicRedistributionDeniedFails(t *testing.T) {
	policy := &Policy{
		ProviderID:               "yahoo-finance",
		Name:                     "Yahoo Finance",
		RedistributionAllowed:    false,
		CommercialUseAllowed:     true,
		AllowedDistributionModes: []string{"local"},
		LicenseName:              "Proprietary",
		TermsCheckedAt:           "2026-05-11",
	}
	result := Evaluate("public", "yahoo-finance", policy)
	if result.Allowed {
		t.Fatalf("expected gate failure")
	}
}

func TestGatePublicMissingLicenseFails(t *testing.T) {
	result := Evaluate("public", "", nil)
	if result.Allowed {
		t.Fatalf("expected gate failure")
	}
}

func TestGateLocalRedistributionDeniedWarnsAndPasses(t *testing.T) {
	policy := &Policy{
		ProviderID:               "eodhd-local-only",
		Name:                     "EODHD",
		RedistributionAllowed:    false,
		CommercialUseAllowed:     false,
		AllowedDistributionModes: []string{"local"},
		LicenseName:              "Proprietary",
		TermsCheckedAt:           "2026-05-11",
	}
	result := Evaluate("local", "eodhd-local-only", policy)
	if !result.Allowed {
		t.Fatalf("expected gate pass for local build, errors=%v", result.Errors)
	}
	if len(result.Warnings) == 0 {
		t.Fatalf("expected warning for local build")
	}
}
