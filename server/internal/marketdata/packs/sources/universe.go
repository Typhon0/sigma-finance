package sources

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Universe struct {
	Symbols []UniverseSymbol `yaml:"symbols"`
}

type UniverseSymbol struct {
	InstrumentID string `yaml:"instrument_id"`
	Symbol       string `yaml:"symbol"`
	BaseAsset    string `yaml:"base_asset"`
	QuoteAsset   string `yaml:"quote_asset"`
	AssetType    string `yaml:"asset_type"`
}

func LoadUniverse(path string) (*Universe, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open universe: %w", err)
	}
	defer file.Close()

	var universe Universe
	decoder := yaml.NewDecoder(file)
	decoder.KnownFields(true)
	if err := decoder.Decode(&universe); err != nil {
		return nil, fmt.Errorf("decode universe yaml: %w", err)
	}
	if err := universe.Validate(); err != nil {
		return nil, err
	}
	return &universe, nil
}

func (u *Universe) Validate() error {
	if u == nil {
		return fmt.Errorf("universe is required")
	}
	if len(u.Symbols) == 0 {
		return fmt.Errorf("universe symbols are required")
	}
	for i, symbol := range u.Symbols {
		if strings.TrimSpace(symbol.InstrumentID) == "" {
			return fmt.Errorf("universe symbol %d instrument_id is required", i)
		}
		if strings.TrimSpace(symbol.Symbol) == "" {
			return fmt.Errorf("universe symbol %d symbol is required", i)
		}
		if strings.TrimSpace(symbol.AssetType) == "" {
			return fmt.Errorf("universe symbol %d asset_type is required", i)
		}
	}
	return nil
}
