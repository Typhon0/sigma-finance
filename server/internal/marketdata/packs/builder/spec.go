package builder

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type PackSpec struct {
	PackID                string         `yaml:"pack_id"`
	Name                  string         `yaml:"name"`
	Description           string         `yaml:"description"`
	Version               string         `yaml:"version"`
	FormatVersion         int            `yaml:"format_version"`
	Distribution          string         `yaml:"distribution"`
	AssetType             string         `yaml:"asset_type"`
	Interval              string         `yaml:"interval"`
	QuoteCurrency         string         `yaml:"quote_currency"`
	SourceProvider        string         `yaml:"source_provider"`
	LicensePolicy         string         `yaml:"license_policy"`
	RedistributionAllowed *bool          `yaml:"redistribution_allowed,omitempty"`
	GeneratedByUser       bool           `yaml:"generated_by_user,omitempty"`
	UploadForbidden       bool           `yaml:"upload_forbidden,omitempty"`
	InstallMode           string         `yaml:"install_mode,omitempty"`
	History               HistorySpec    `yaml:"history"`
	Universe              UniverseConfig `yaml:"universe"`
	Output                OutputConfig   `yaml:"output"`
}

type HistorySpec struct {
	Start string `yaml:"start"`
	End   string `yaml:"end"`
}

type UniverseConfig struct {
	File string `yaml:"file"`
}

type OutputConfig struct {
	Compression string   `yaml:"compression"`
	PartitionBy []string `yaml:"partition_by"`
}

func LoadSpec(path string) (*PackSpec, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open pack spec: %w", err)
	}
	defer file.Close()

	var spec PackSpec
	decoder := yaml.NewDecoder(file)
	decoder.KnownFields(true)
	if err := decoder.Decode(&spec); err != nil {
		return nil, fmt.Errorf("decode pack spec yaml: %w", err)
	}
	if err := spec.Validate(); err != nil {
		return nil, err
	}
	return &spec, nil
}

func (s *PackSpec) Validate() error {
	if s == nil {
		return fmt.Errorf("pack spec is required")
	}
	required := map[string]string{
		"pack_id":            s.PackID,
		"name":               s.Name,
		"version":            s.Version,
		"distribution":       s.Distribution,
		"asset_type":         s.AssetType,
		"interval":           s.Interval,
		"quote_currency":     s.QuoteCurrency,
		"source_provider":    s.SourceProvider,
		"history.start":      s.History.Start,
		"history.end":        s.History.End,
		"universe.file":      s.Universe.File,
		"output.compression": s.Output.Compression,
	}
	for field, value := range required {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("pack spec %s is required", field)
		}
	}
	if s.FormatVersion <= 0 {
		return fmt.Errorf("pack spec format_version must be > 0")
	}
	if len(s.Output.PartitionBy) == 0 {
		return fmt.Errorf("pack spec output.partition_by is required")
	}
	mode := strings.ToLower(strings.TrimSpace(s.Distribution))
	if mode != "public" && mode != "private" && mode != "local" {
		return fmt.Errorf("pack spec distribution must be public, private, or local")
	}
	return nil
}
