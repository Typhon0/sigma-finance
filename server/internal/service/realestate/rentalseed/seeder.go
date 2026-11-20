package rentalseed

import (
	"bytes"
	"compress/gzip"
	"context"
	_ "embed"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"strconv"
	"time"

	"github.com/uptrace/bun"
)

//go:embed carte_loyers_2025.csv.gz
var CarteLoyersCSVGz []byte

// CommuneRentalIndicator represents a row in sigma_finance.commune_rental_indicators
type CommuneRentalIndicator struct {
	bun.BaseModel `bun:"table:sigma_finance.commune_rental_indicators"`

	CityCode                 string    `bun:"city_code,pk"`
	CityName                 string    `bun:"city_name,notnull"`
	ApartmentRentPerM2       *float64  `bun:"apartment_rent_per_m2"`
	ApartmentT1T2RentPerM2   *float64  `bun:"apartment_t1_t2_rent_per_m2"`
	ApartmentT3PlusRentPerM2 *float64  `bun:"apartment_t3_plus_rent_per_m2"`
	HouseRentPerM2           *float64  `bun:"house_rent_per_m2"`
	IsCommuneLevel           bool      `bun:"is_commune_level,default:false"`
	R2Adjusted               *float64  `bun:"r2_adjusted"`
	Source                   string    `bun:"source,default:'CARTE_DES_LOYERS_2025'"`
	UpdatedAt                time.Time `bun:"updated_at,nullzero,default:current_timestamp"`
}

// SeedCommuneRentalIndicators parses the embedded compressed CSV and inserts/updates records by batch of 1,000
func SeedCommuneRentalIndicators(ctx context.Context, db *bun.DB) error {
	if len(CarteLoyersCSVGz) == 0 {
		return fmt.Errorf("carte_loyers_2025.csv.gz is empty or missing")
	}

	// Quick check if already seeded
	count, err := db.NewSelect().Model((*CommuneRentalIndicator)(nil)).Count(ctx)
	if err == nil && count >= 30000 {
		log.Printf("[INFO] [rentalseed] commune_rental_indicators already seeded (%d rows), skipping", count)
		return nil
	}

	log.Printf("[INFO] [rentalseed] seeding commune_rental_indicators from embedded carte_loyers_2025.csv.gz...")
	gzReader, err := gzip.NewReader(bytes.NewReader(CarteLoyersCSVGz))
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzReader.Close()

	csvReader := csv.NewReader(gzReader)
	header, err := csvReader.Read()
	if err != nil {
		return fmt.Errorf("failed to read CSV header: %w", err)
	}
	_ = header

	parseFloatPtr := func(s string) *float64 {
		if s == "" {
			return nil
		}
		if f, parseErr := strconv.ParseFloat(s, 64); parseErr == nil {
			return &f
		}
		return nil
	}

	batch := make([]CommuneRentalIndicator, 0, 1000)
	totalInserted := 0
	now := time.Now()

	for {
		row, readErr := csvReader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			log.Printf("[WARN] [rentalseed] CSV read row error: %v", readErr)
			continue
		}
		if len(row) < 8 {
			continue
		}

		cityCode := row[0]
		cityName := row[1]
		appRent := parseFloatPtr(row[2])
		app12Rent := parseFloatPtr(row[3])
		app3Rent := parseFloatPtr(row[4])
		maiRent := parseFloatPtr(row[5])
		isCom := row[6] == "true"
		r2 := parseFloatPtr(row[7])

		item := CommuneRentalIndicator{
			CityCode:                 cityCode,
			CityName:                 cityName,
			ApartmentRentPerM2:       appRent,
			ApartmentT1T2RentPerM2:   app12Rent,
			ApartmentT3PlusRentPerM2: app3Rent,
			HouseRentPerM2:           maiRent,
			IsCommuneLevel:           isCom,
			R2Adjusted:               r2,
			Source:                   "CARTE_DES_LOYERS_2025",
			UpdatedAt:                now,
		}
		batch = append(batch, item)

		if len(batch) >= 1000 {
			_, err = db.NewInsert().
				Model(&batch).
				On("CONFLICT (city_code) DO UPDATE").
				Set("city_name = EXCLUDED.city_name").
				Set("apartment_rent_per_m2 = EXCLUDED.apartment_rent_per_m2").
				Set("apartment_t1_t2_rent_per_m2 = EXCLUDED.apartment_t1_t2_rent_per_m2").
				Set("apartment_t3_plus_rent_per_m2 = EXCLUDED.apartment_t3_plus_rent_per_m2").
				Set("house_rent_per_m2 = EXCLUDED.house_rent_per_m2").
				Set("is_commune_level = EXCLUDED.is_commune_level").
				Set("r2_adjusted = EXCLUDED.r2_adjusted").
				Set("source = EXCLUDED.source").
				Set("updated_at = EXCLUDED.updated_at").
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("failed to insert batch into commune_rental_indicators: %w", err)
			}
			totalInserted += len(batch)
			batch = batch[:0]
		}
	}

	if len(batch) > 0 {
		_, err = db.NewInsert().
			Model(&batch).
			On("CONFLICT (city_code) DO UPDATE").
			Set("city_name = EXCLUDED.city_name").
			Set("apartment_rent_per_m2 = EXCLUDED.apartment_rent_per_m2").
			Set("apartment_t1_t2_rent_per_m2 = EXCLUDED.apartment_t1_t2_rent_per_m2").
			Set("apartment_t3_plus_rent_per_m2 = EXCLUDED.apartment_t3_plus_rent_per_m2").
			Set("house_rent_per_m2 = EXCLUDED.house_rent_per_m2").
			Set("is_commune_level = EXCLUDED.is_commune_level").
			Set("r2_adjusted = EXCLUDED.r2_adjusted").
			Set("source = EXCLUDED.source").
			Set("updated_at = EXCLUDED.updated_at").
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("failed to insert final batch into commune_rental_indicators: %w", err)
		}
		totalInserted += len(batch)
	}

	log.Printf("[INFO] [rentalseed] successfully seeded %d commune rental indicators", totalInserted)
	return nil
}
