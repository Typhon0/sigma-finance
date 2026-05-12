package store

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/parquet-go/parquet-go"
	"github.com/shopspring/decimal"
)

type CandleRangeQuery struct {
	InstrumentID  string
	Symbol        string
	AssetType     string
	Interval      model.CandleInterval
	From          time.Time
	To            time.Time
	QuoteCurrency string
	Limit         int
}

type CandleLatestQuery struct {
	InstrumentID  string
	Symbol        string
	AssetType     string
	Interval      model.CandleInterval
	QuoteCurrency string
}

type CandleCoverageQuery struct {
	InstrumentID  string
	Interval      model.CandleInterval
	QuoteCurrency string
}

type CandleCoverage struct {
	InstrumentID  string
	Symbol        string
	AssetType     string
	Interval      model.CandleInterval
	QuoteCurrency string
	FirstDate     time.Time
	LastDate      time.Time
	RowCount      int64
	Source        string
}

type CandleStore interface {
	GetRange(ctx context.Context, query CandleRangeQuery) ([]model.Candle, error)
	GetLatest(ctx context.Context, query CandleLatestQuery) (*model.Candle, error)
	GetCoverage(ctx context.Context, query CandleCoverageQuery) ([]CandleCoverage, error)
}

type CandleOverlayStore interface {
	CandleStore
	BulkUpsert(ctx context.Context, candles []model.Candle) error
}

type DBCandleStore struct {
	repo repository.ICandleRepository
}

func NewDBCandleStore(repo repository.ICandleRepository) *DBCandleStore {
	return &DBCandleStore{repo: repo}
}

func (s *DBCandleStore) BulkUpsert(ctx context.Context, candles []model.Candle) error {
	return s.repo.BulkUpsert(ctx, candles)
}

func (s *DBCandleStore) GetRange(ctx context.Context, query CandleRangeQuery) ([]model.Candle, error) {
	if strings.TrimSpace(query.InstrumentID) != "" {
		return s.repo.GetRangeByInstrument(ctx, query.InstrumentID, query.Interval, query.From, query.To, query.QuoteCurrency, query.Limit)
	}
	return s.repo.GetRange(ctx, query.Symbol, query.AssetType, query.Interval, query.From, query.To, query.Limit)
}

func (s *DBCandleStore) GetLatest(ctx context.Context, query CandleLatestQuery) (*model.Candle, error) {
	if strings.TrimSpace(query.InstrumentID) != "" {
		return s.repo.GetLatestByInstrument(ctx, query.InstrumentID, query.Interval, query.QuoteCurrency)
	}
	return s.repo.GetLatest(ctx, query.Symbol, query.AssetType, query.Interval)
}

func (s *DBCandleStore) GetCoverage(context.Context, CandleCoverageQuery) ([]CandleCoverage, error) {
	return []CandleCoverage{}, nil
}

type PackRepository interface {
	ListInstalled(ctx context.Context) ([]model.MarketDataPack, error)
	ListCoverage(ctx context.Context, instrumentID string) ([]model.MarketDataPackCoverage, error)
}

type PackCandleStore struct {
	repo PackRepository
}

func NewPackCandleStore(repo PackRepository) *PackCandleStore {
	return &PackCandleStore{repo: repo}
}

func (s *PackCandleStore) GetRange(ctx context.Context, query CandleRangeQuery) ([]model.Candle, error) {
	if strings.TrimSpace(query.InstrumentID) == "" {
		return []model.Candle{}, nil
	}

	coverage, err := s.matchingCoverage(ctx, CandleCoverageQuery{
		InstrumentID:  query.InstrumentID,
		Interval:      query.Interval,
		QuoteCurrency: query.QuoteCurrency,
	})
	if err != nil {
		return nil, err
	}
	if len(coverage) == 0 {
		return []model.Candle{}, nil
	}

	packs, err := s.installedPackByID(ctx)
	if err != nil {
		return nil, err
	}

	var out []model.Candle
	for _, cov := range coverage {
		pack, ok := packs[cov.PackID]
		if !ok {
			continue
		}
		paths, err := decodeCoveragePaths(cov.FilePaths)
		if err != nil {
			return nil, err
		}
		for _, relPath := range paths {
			candles, err := s.readPackFile(pack.FilePath, relPath, query)
			if err != nil {
				return nil, err
			}
			out = append(out, candles...)
		}
	}
	out = dedupeAndSort(out)
	if query.Limit > 0 && len(out) > query.Limit {
		out = out[:query.Limit]
	}
	return out, nil
}

func (s *PackCandleStore) GetLatest(ctx context.Context, query CandleLatestQuery) (*model.Candle, error) {
	candles, err := s.GetRange(ctx, CandleRangeQuery{
		InstrumentID:  query.InstrumentID,
		Symbol:        query.Symbol,
		AssetType:     query.AssetType,
		Interval:      query.Interval,
		From:          time.Time{},
		To:            time.Now().Add(24 * time.Hour),
		QuoteCurrency: query.QuoteCurrency,
	})
	if err != nil {
		return nil, err
	}
	if len(candles) == 0 {
		return nil, repository.ErrNotFound
	}
	return &candles[len(candles)-1], nil
}

func (s *PackCandleStore) GetCoverage(ctx context.Context, query CandleCoverageQuery) ([]CandleCoverage, error) {
	coverage, err := s.matchingCoverage(ctx, query)
	if err != nil {
		return nil, err
	}
	out := make([]CandleCoverage, 0, len(coverage))
	for _, cov := range coverage {
		out = append(out, CandleCoverage{
			InstrumentID:  cov.InstrumentID,
			Symbol:        cov.Symbol,
			AssetType:     cov.AssetType,
			Interval:      cov.Interval,
			QuoteCurrency: cov.QuoteCurrency,
			FirstDate:     cov.FirstDate,
			LastDate:      cov.LastDate,
			RowCount:      cov.RowCount,
			Source:        cov.PackID,
		})
	}
	return out, nil
}

func (s *PackCandleStore) matchingCoverage(ctx context.Context, query CandleCoverageQuery) ([]model.MarketDataPackCoverage, error) {
	rows, err := s.repo.ListCoverage(ctx, query.InstrumentID)
	if err != nil {
		return nil, err
	}
	out := make([]model.MarketDataPackCoverage, 0, len(rows))
	for _, row := range rows {
		if query.Interval != "" && row.Interval != query.Interval {
			continue
		}
		if query.QuoteCurrency != "" && !strings.EqualFold(row.QuoteCurrency, query.QuoteCurrency) {
			continue
		}
		out = append(out, row)
	}
	return out, nil
}

func (s *PackCandleStore) installedPackByID(ctx context.Context) (map[string]model.MarketDataPack, error) {
	packs, err := s.repo.ListInstalled(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]model.MarketDataPack, len(packs))
	for _, pack := range packs {
		if pack.Status == "installed" {
			out[pack.ID] = pack
		}
	}
	return out, nil
}

func (s *PackCandleStore) readPackFile(packPath, relPath string, query CandleRangeQuery) ([]model.Candle, error) {
	fullPath := filepath.Join(packPath, filepath.Clean(relPath))
	if !strings.HasPrefix(fullPath, filepath.Clean(packPath)) {
		return nil, fmt.Errorf("pack file escapes pack root: %s", relPath)
	}
	rows, err := parquet.ReadFile[packCandleParquetRow](fullPath)
	if err != nil {
		return nil, fmt.Errorf("read parquet %s: %w", relPath, err)
	}

	out := make([]model.Candle, 0, len(rows))
	for _, row := range rows {
		if row.InstrumentID != query.InstrumentID {
			continue
		}
		if query.Interval != "" && model.CandleInterval(row.Interval) != query.Interval {
			continue
		}
		if query.QuoteCurrency != "" && !strings.EqualFold(row.QuoteCurrency, query.QuoteCurrency) {
			continue
		}
		if !query.From.IsZero() && row.Timestamp.Before(query.From) {
			continue
		}
		if !query.To.IsZero() && !row.Timestamp.Before(query.To) {
			continue
		}
		candle, err := row.toModel()
		if err != nil {
			return nil, err
		}
		out = append(out, candle)
	}
	return out, nil
}

type HybridCandleStore struct {
	pack CandleStore
	db   CandleOverlayStore
}

func NewHybridCandleStore(pack CandleStore, db CandleOverlayStore) *HybridCandleStore {
	return &HybridCandleStore{pack: pack, db: db}
}

func (s *HybridCandleStore) GetRange(ctx context.Context, query CandleRangeQuery) ([]model.Candle, error) {
	packCandles, packErr := s.pack.GetRange(ctx, query)
	if packErr != nil {
		return nil, packErr
	}
	dbCandles, dbErr := s.db.GetRange(ctx, query)
	if dbErr != nil {
		return nil, dbErr
	}
	return mergeCandles(packCandles, dbCandles, query.Limit), nil
}

func (s *HybridCandleStore) GetLatest(ctx context.Context, query CandleLatestQuery) (*model.Candle, error) {
	packLatest, _ := s.pack.GetLatest(ctx, query)
	dbLatest, dbErr := s.db.GetLatest(ctx, query)
	if dbErr == nil && dbLatest != nil {
		if packLatest == nil || dbLatest.Timestamp.After(packLatest.Timestamp) || sameCandleKey(*dbLatest, *packLatest) {
			return dbLatest, nil
		}
	}
	if packLatest != nil {
		return packLatest, nil
	}
	if dbErr != nil {
		return nil, dbErr
	}
	return nil, repository.ErrNotFound
}

func (s *HybridCandleStore) GetCoverage(ctx context.Context, query CandleCoverageQuery) ([]CandleCoverage, error) {
	packCoverage, err := s.pack.GetCoverage(ctx, query)
	if err != nil {
		return nil, err
	}
	dbCoverage, err := s.db.GetCoverage(ctx, query)
	if err != nil {
		return nil, err
	}
	return append(packCoverage, dbCoverage...), nil
}

func (s *HybridCandleStore) BulkUpsert(ctx context.Context, candles []model.Candle) error {
	return s.db.BulkUpsert(ctx, candles)
}

type packCandleParquetRow struct {
	InstrumentID  string    `parquet:"instrument_id,uuid"`
	Symbol        string    `parquet:"symbol"`
	AssetType     string    `parquet:"asset_type"`
	Interval      string    `parquet:"interval"`
	Timestamp     time.Time `parquet:"timestamp,timestamp(microsecond)"`
	Open          []byte    `parquet:"open"`
	High          []byte    `parquet:"high"`
	Low           []byte    `parquet:"low"`
	Close         []byte    `parquet:"close"`
	AdjustedClose []byte    `parquet:"adjusted_close,optional"`
	Volume        []byte    `parquet:"volume"`
	QuoteCurrency string    `parquet:"quote_currency"`
	Source        string    `parquet:"source"`
}

func (r packCandleParquetRow) toModel() (model.Candle, error) {
	openPrice := decimalFromParquetBytes(r.Open, 18)
	highPrice := decimalFromParquetBytes(r.High, 18)
	lowPrice := decimalFromParquetBytes(r.Low, 18)
	closePrice := decimalFromParquetBytes(r.Close, 18)
	volume := decimalFromParquetBytes(r.Volume, 8)
	var adjustedClose *decimal.Decimal
	if len(r.AdjustedClose) > 0 {
		value := decimalFromParquetBytes(r.AdjustedClose, 18)
		adjustedClose = &value
	}
	instrumentID := r.InstrumentID
	return model.Candle{
		InstrumentID:  &instrumentID,
		Symbol:        r.Symbol,
		AssetType:     r.AssetType,
		Interval:      model.CandleInterval(r.Interval),
		Open:          openPrice,
		High:          highPrice,
		Low:           lowPrice,
		Close:         closePrice,
		AdjustedClose: adjustedClose,
		Volume:        volume,
		QuoteCurrency: r.QuoteCurrency,
		Timestamp:     r.Timestamp,
		Source:        r.Source,
	}, nil
}

func decimalFromParquetBytes(raw []byte, scale int32) decimal.Decimal {
	if len(raw) == 0 {
		return decimal.Zero
	}
	i := new(big.Int).SetBytes(raw)
	if raw[0]&0x80 != 0 {
		max := new(big.Int).Lsh(big.NewInt(1), uint(len(raw))*8)
		i.Sub(i, max)
	}
	return decimal.NewFromBigInt(i, -scale)
}

func decodeCoveragePaths(raw json.RawMessage) ([]string, error) {
	var paths []string
	if len(raw) == 0 {
		return paths, nil
	}
	if err := json.Unmarshal(raw, &paths); err != nil {
		return nil, err
	}
	return paths, nil
}

func mergeCandles(packCandles, dbCandles []model.Candle, limit int) []model.Candle {
	byKey := make(map[string]model.Candle, len(packCandles)+len(dbCandles))
	for _, candle := range packCandles {
		byKey[candleKey(candle)] = candle
	}
	for _, candle := range dbCandles {
		byKey[candleKey(candle)] = candle
	}
	out := make([]model.Candle, 0, len(byKey))
	for _, candle := range byKey {
		out = append(out, candle)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Timestamp.Before(out[j].Timestamp)
	})
	if limit > 0 && len(out) > limit {
		return out[:limit]
	}
	return out
}

func dedupeAndSort(candles []model.Candle) []model.Candle {
	return mergeCandles(candles, nil, 0)
}

func sameCandleKey(a, b model.Candle) bool {
	return candleKey(a) == candleKey(b)
}

func candleKey(candle model.Candle) string {
	instrumentID := ""
	if candle.InstrumentID != nil {
		instrumentID = *candle.InstrumentID
	}
	return fmt.Sprintf("%s|%s|%d|%s", instrumentID, candle.Interval, candle.Timestamp.UTC().Unix(), strings.ToUpper(candle.QuoteCurrency))
}

func PackDirectoryExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
