package realestate

import (
	"context"
	"math"
	"strings"
	"time"

	"github.com/uptrace/bun"
)

// RentalIndicatorsService resolves rental statistics from commune_rental_indicators
type RentalIndicatorsService struct {
	db *bun.DB
}

// NewRentalIndicatorsService creates a new rental service instance
func NewRentalIndicatorsService(db *bun.DB) *RentalIndicatorsService {
	return &RentalIndicatorsService{db: db}
}

// CommuneRentalIndicatorRecord represents a row in sigma_finance.commune_rental_indicators
type CommuneRentalIndicatorRecord struct {
	bun.BaseModel `bun:"table:sigma_finance.commune_rental_indicators,alias:cri"`

	CityCode                 string    `bun:"city_code,pk"`
	CityName                 string    `bun:"city_name"`
	ApartmentRentPerM2       *float64  `bun:"apartment_rent_per_m2"`
	ApartmentT1T2RentPerM2   *float64  `bun:"apartment_t1_t2_rent_per_m2"`
	ApartmentT3PlusRentPerM2 *float64  `bun:"apartment_t3_plus_rent_per_m2"`
	HouseRentPerM2           *float64  `bun:"house_rent_per_m2"`
	IsCommuneLevel           bool      `bun:"is_commune_level"`
	R2Adjusted               *float64  `bun:"r2_adjusted"`
	Source                   string    `bun:"source"`
	UpdatedAt                time.Time `bun:"updated_at"`
}

// GetIndicators returns rental market data for a given commune and property characteristics
func (s *RentalIndicatorsService) GetIndicators(
	ctx context.Context,
	cityCode string,
	roomsCount *int,
	propertyType string,
	surfaceM2, propertyValue *float64,
) (*RealEstateRentalMarket, error) {
	cityCode = strings.TrimSpace(cityCode)
	if cityCode == "" {
		return nil, nil
	}

	isApartment := strings.EqualFold(propertyType, "Apartment") ||
		strings.EqualFold(propertyType, "APARTMENT") ||
		strings.EqualFold(propertyType, "condo")

	// 1. Try direct lookup by city_code
	var rec CommuneRentalIndicatorRecord
	err := s.db.NewSelect().
		Model(&rec).
		Where("city_code = ?", cityCode).
		Scan(ctx)

	// 2. PLM Fallback if arrondissement not found
	if err != nil {
		parentCode := ""
		if strings.HasPrefix(cityCode, "751") {
			parentCode = "75056" // Paris
		} else if strings.HasPrefix(cityCode, "6938") {
			parentCode = "69123" // Lyon
		} else if strings.HasPrefix(cityCode, "132") {
			parentCode = "13055" // Marseille
		}

		if parentCode != "" {
			err = s.db.NewSelect().
				Model(&rec).
				Where("city_code = ?", parentCode).
				Scan(ctx)
		}
	}

	if err != nil {
		return nil, nil // graceful nil if not found
	}

	// 3. Resolve appropriate rentPerM2 based on propertyType and roomsCount
	var chosenRent *float64
	if isApartment {
		if roomsCount != nil && *roomsCount <= 2 && rec.ApartmentT1T2RentPerM2 != nil {
			chosenRent = rec.ApartmentT1T2RentPerM2
		} else if roomsCount != nil && *roomsCount >= 3 && rec.ApartmentT3PlusRentPerM2 != nil {
			chosenRent = rec.ApartmentT3PlusRentPerM2
		} else if rec.ApartmentRentPerM2 != nil {
			chosenRent = rec.ApartmentRentPerM2
		}
	} else {
		if rec.HouseRentPerM2 != nil {
			chosenRent = rec.HouseRentPerM2
		} else if rec.ApartmentRentPerM2 != nil {
			chosenRent = rec.ApartmentRentPerM2
		}
	}

	res := &RealEstateRentalMarket{
		MarketRentPerM2: chosenRent,
		IsCommuneLevel:  rec.IsCommuneLevel,
		R2Adjusted:      rec.R2Adjusted,
		SourceLabel:     "Estimations ANIL / SeLoger / leboncoin (Carte des loyers 2025)",
	}

	// 4. Calculate monthly rent if surfaceM2 provided
	if chosenRent != nil && surfaceM2 != nil && *surfaceM2 > 0 {
		mRent := math.Round(*chosenRent * *surfaceM2)
		res.EstimatedMonthlyRent = &mRent

		// 5. Calculate gross yield if propertyValue provided and > 0
		if propertyValue != nil && *propertyValue > 0 {
			yield := math.Round(((mRent*12.0) / *propertyValue * 100.0)*10.0) / 10.0
			res.EstimatedGrossYield = &yield
		}
	}

	return res, nil
}
