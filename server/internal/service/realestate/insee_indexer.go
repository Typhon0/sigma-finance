package realestate

import (
	"context"
	"fmt"
	"math"
	"sigma_finance/internal/domain/model"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// INSEEIndexer handles quarterly Notaires-INSEE indexation
type INSEEIndexer struct {
	db *bun.DB
}

// NewINSEEIndexer creates a new indexer instance
func NewINSEEIndexer(db *bun.DB) *INSEEIndexer {
	return &INSEEIndexer{db: db}
}

// GetQuarter returns formatted quarter string e.g. "2024-Q2"
func GetQuarter(t time.Time) string {
	month := int(t.Month())
	quarter := (month-1)/3 + 1
	return fmt.Sprintf("%d-Q%d", t.Year(), quarter)
}

// ResolveSeries maps the cityCode and propertyType to the most specific regional series
func (idx *INSEEIndexer) ResolveSeries(cityCode string, propertyType string) string {
	isApartment := strings.EqualFold(propertyType, "Apartment") ||
		strings.EqualFold(propertyType, "APARTMENT") ||
		strings.EqualFold(propertyType, "condo")

	if len(cityCode) < 2 {
		return "FRANCE_METRO"
	}

	dep := strings.ToUpper(cityCode[:2])

	// Paris
	if dep == "75" {
		if isApartment {
			return "PARIS_APARTMENT"
		}
		return "PETITE_COURONNE_HOUSE"
	}

	// Petite Couronne
	if dep == "92" || dep == "93" || dep == "94" {
		if isApartment {
			return "PETITE_COURONNE_APARTMENT"
		}
		return "PETITE_COURONNE_HOUSE"
	}

	// Grande Couronne
	if dep == "77" || dep == "78" || dep == "91" || dep == "95" {
		if isApartment {
			return "GRANDE_COURONNE_APARTMENT"
		}
		return "GRANDE_COURONNE_HOUSE"
	}

	// Province (including Alsace-Moselle 57, 67, 68)
	if isApartment {
		return "PROVINCE_APARTMENT"
	}
	return "PROVINCE_HOUSE"
}

// GetIndexValue fetches the index value for a given quarter and series from the database
func (idx *INSEEIndexer) GetIndexValue(ctx context.Context, quarter, seriesID string) (float64, error) {
	var rec INSEEHousingIndexRecord
	err := idx.db.NewSelect().
		Model(&rec).
		Where("quarter = ? AND series_id = ?", quarter, seriesID).
		Scan(ctx)
	if err == nil {
		return rec.IndexValue, nil
	}

	// Fallback to FRANCE_METRO if specific series missing for that quarter
	if seriesID != "FRANCE_METRO" {
		err = idx.db.NewSelect().
			Model(&rec).
			Where("quarter = ? AND series_id = 'FRANCE_METRO'", quarter).
			Scan(ctx)
		if err == nil {
			return rec.IndexValue, nil
		}
	}

	// If quarter is newer than database records, fetch the latest available quarter for that series
	err = idx.db.NewSelect().
		Model(&rec).
		Where("series_id = ?", seriesID).
		Order("quarter DESC").
		Limit(1).
		Scan(ctx)
	if err == nil {
		return rec.IndexValue, nil
	}

	return 0, fmt.Errorf("no insee index found for quarter %s series %s: %w", quarter, seriesID, err)
}

// Estimate calculates the updated value based strictly on Notaires-INSEE index (NO double discount)
func (idx *INSEEIndexer) Estimate(
	ctx context.Context,
	purchasePrice float64,
	purchaseDate time.Time,
	cityCode, propertyType string,
	targetDate time.Time,
) (estimatedValue, evolutionPercent float64, baseQ, targetQ string, err error) {
	if purchasePrice <= 0 {
		return 0, 0, "", "", fmt.Errorf("invalid purchase price")
	}

	seriesID := idx.ResolveSeries(cityCode, propertyType)
	baseQ = GetQuarter(purchaseDate)
	targetQ = GetQuarter(targetDate)

	baseVal, err := idx.GetIndexValue(ctx, baseQ, seriesID)
	if err != nil {
		return 0, 0, baseQ, targetQ, fmt.Errorf("failed to get base index for %s: %w", baseQ, err)
	}
	if baseVal <= 0 {
		return 0, 0, baseQ, targetQ, fmt.Errorf("invalid base index value: %f", baseVal)
	}

	targetVal, err := idx.GetIndexValue(ctx, targetQ, seriesID)
	if err != nil {
		return 0, 0, baseQ, targetQ, fmt.Errorf("failed to get target index for %s: %w", targetQ, err)
	}
	if targetVal <= 0 {
		return 0, 0, baseQ, targetQ, fmt.Errorf("invalid target index value: %f", targetVal)
	}

	ratio := targetVal / baseVal
	estimatedValue = math.Round(purchasePrice * ratio)
	evolutionPercent = math.Round(((ratio-1.0)*100.0)*10.0) / 10.0

	return estimatedValue, evolutionPercent, baseQ, targetQ, nil
}

// GenerateHistoricalPricePoints builds smooth quarterly asset_prices points between purchaseDate and targetDate
func (idx *INSEEIndexer) GenerateHistoricalPricePoints(
	ctx context.Context,
	assetID string,
	purchasePrice float64,
	purchaseDate time.Time,
	cityCode, propertyType string,
	finalValuation *float64,
	targetDate time.Time,
) ([]model.AssetPrice, error) {
	if !IsMetropolitanFrance(cityCode) || purchasePrice <= 0 || purchaseDate.After(targetDate) {
		return nil, nil
	}

	seriesID := idx.ResolveSeries(cityCode, propertyType)
	baseQ := GetQuarter(purchaseDate)
	baseVal, err := idx.GetIndexValue(ctx, baseQ, seriesID)
	if err != nil || baseVal <= 0 {
		return nil, err
	}

	// Generate list of quarter dates between purchaseDate and targetDate
	type qPoint struct {
		Date    time.Time
		Quarter string
		Index   float64
		Price   float64
	}

	var points []qPoint
	cur := purchaseDate

	for !cur.After(targetDate) {
		qStr := GetQuarter(cur)
		val, qErr := idx.GetIndexValue(ctx, qStr, seriesID)
		if qErr == nil && val > 0 {
			rawPrice := purchasePrice * (val / baseVal)
			points = append(points, qPoint{
				Date:    cur,
				Quarter: qStr,
				Index:   val,
				Price:   rawPrice,
			})
		}
		// Move to next quarter (+3 months)
		cur = cur.AddDate(0, 3, 0)
	}

	// Always ensure the targetDate point is included
	lastQStr := GetQuarter(targetDate)
	targetVal, tErr := idx.GetIndexValue(ctx, lastQStr, seriesID)
	if tErr == nil && targetVal > 0 {
		rawLastPrice := purchasePrice * (targetVal / baseVal)
		points = append(points, qPoint{
			Date:    targetDate,
			Quarter: lastQStr,
			Index:   targetVal,
			Price:   rawLastPrice,
		})
	}

	if len(points) == 0 {
		return nil, nil
	}

	// Progressive linear scale adjustment if finalValuation differs from raw indexation:
	// delta(i) = (finalValuation - rawFinalPrice) * (i / (N-1))
	rawFinalPrice := points[len(points)-1].Price
	var diff float64
	if finalValuation != nil && *finalValuation > 0 {
		diff = *finalValuation - rawFinalPrice
	}

	result := make([]model.AssetPrice, len(points))
	n := float64(len(points) - 1)
	if n <= 0 {
		n = 1.0
	}

	for i, pt := range points {
		progress := float64(i) / n
		adjustedPrice := pt.Price + (diff * progress)
		if adjustedPrice < 1.0 {
			adjustedPrice = pt.Price
		}

		result[i] = model.AssetPrice{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(math.Round(adjustedPrice)),
			Timestamp: pt.Date,
			Source:    "insee_backfill",
		}
	}

	return result, nil
}
