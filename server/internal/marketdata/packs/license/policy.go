package license

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Policy struct {
	ProviderID               string   `yaml:"provider_id"`
	Name                     string   `yaml:"name"`
	SourceURL                string   `yaml:"source_url"`
	LicenseName              string   `yaml:"license_name"`
	RedistributionAllowed    bool     `yaml:"redistribution_allowed"`
	CommercialUseAllowed     bool     `yaml:"commercial_use_allowed"`
	AttributionRequired      bool     `yaml:"attribution_required"`
	TermsCheckedAt           string   `yaml:"terms_checked_at"`
	AllowedDistributionModes []string `yaml:"allowed_distribution_modes"`
	Notes                    []string `yaml:"notes"`
}

func LoadPolicy(path string) (*Policy, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open license policy: %w", err)
	}
	defer file.Close()

	var policy Policy
	decoder := yaml.NewDecoder(file)
	decoder.KnownFields(true)
	if err := decoder.Decode(&policy); err != nil {
		return nil, fmt.Errorf("decode license policy yaml: %w", err)
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &policy, nil
}

func (p *Policy) Validate() error {
	if p == nil {
		return fmt.Errorf("license policy is required")
	}
	if strings.TrimSpace(p.ProviderID) == "" {
		return fmt.Errorf("license policy provider_id is required")
	}
	if strings.TrimSpace(p.Name) == "" {
		return fmt.Errorf("license policy name is required")
	}
	if strings.TrimSpace(p.LicenseName) == "" {
		return fmt.Errorf("license policy license_name is required")
	}
	if strings.TrimSpace(p.TermsCheckedAt) == "" {
		return fmt.Errorf("license policy terms_checked_at is required")
	}
	return nil
}
