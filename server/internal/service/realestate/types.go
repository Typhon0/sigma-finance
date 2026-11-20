package realestate

import (
	"time"

	"github.com/uptrace/bun"
)

// ValuationMode constants
const (
	ValuationModeAuto            = "AUTO"
	ValuationModeManual          = "MANUAL"
	ValuationModeAcquisitionCost = "ACQUISITION_COST"
)

// EstimationMethod constants
const (
	EstimationMethodDVFComparables  = "DVF_COMPARABLES"
	EstimationMethodINSEEIndex      = "INSEE_INDEX"
	EstimationMethodAcquisitionCost = "ACQUISITION_COST"
)

// ValuationConfidence constants
const (
	ValuationConfidenceHigh        = "HIGH"
	ValuationConfidenceMedium      = "MEDIUM"
	ValuationConfidenceLow         = "LOW"
	ValuationConfidenceUnavailable = "UNAVAILABLE"
)

// DVFMutation represents a lightweight normalized transaction from DVF+
type DVFMutation struct {
	IDMutation string    `json:"id"`
	DateMut    time.Time `json:"date"`
	ValeurFonc float64   `json:"price"`
	SBati      float64   `json:"surface"`
	STerr      *float64  `json:"sterr,omitempty"`
	CodTypBien string    `json:"codtypbien"`
	LibNatMut  string    `json:"libnatmut"`
	VEFA       bool      `json:"vefa"`
	Latitude   float64   `json:"lat"`
	Longitude  float64   `json:"lon"`
}

// DVFComparable is a candidate mutation enriched with distance, price/m2, and weights
type DVFComparable struct {
	Mutation   DVFMutation
	PricePerM2 float64
	DistanceKm float64
	MonthsAgo  float64
	Weight     float64
}

// QualitativeAdjustmentInput holds properties that adjust the DVF valuation
type QualitativeAdjustmentInput struct {
	PropertyType  string
	Condition     *string
	DPERating     *string
	HasOutdoor    *bool
	IsGroundFloor *bool
}

// ADEMEDpeResult represents the structured ADEME diagnosis output
type ADEMEDpeResult struct {
	Rating         string   `json:"rating"`
	SurfaceM2      *float64 `json:"surfaceM2,omitempty"`
	DiagnosticDate *string  `json:"diagnosticDate,omitempty"`
	SourceDataset  string   `json:"sourceDataset"`
}

// RealEstateRentalMarket represents commune rental market indicators
type RealEstateRentalMarket struct {
	MarketRentPerM2      *float64 `json:"marketRentPerM2,omitempty"`
	EstimatedMonthlyRent *float64 `json:"estimatedMonthlyRent,omitempty"`
	EstimatedGrossYield  *float64 `json:"estimatedGrossYield,omitempty"`
	IsCommuneLevel       bool     `json:"isCommuneLevel"`
	R2Adjusted           *float64 `json:"r2Adjusted,omitempty"`
	SourceLabel          string   `json:"sourceLabel"`
}

// RealEstateEstimationInput defines parameters for calculating an estimation
type RealEstateEstimationInput struct {
	PropertyType  string     `json:"propertyType"` // "Apartment" | "House"
	SurfaceM2     float64    `json:"surfaceM2"`
	Address       string     `json:"address"`
	City          string     `json:"city"`
	Postcode      string     `json:"postcode"`
	CityCode      *string    `json:"cityCode,omitempty"`
	BANID         *string    `json:"banId,omitempty"`
	Latitude      *float64   `json:"latitude,omitempty"`
	Longitude     *float64   `json:"longitude,omitempty"`
	Condition     *string    `json:"condition,omitempty"`
	DPERating     *string    `json:"dpeRating,omitempty"`
	HasOutdoor    *bool      `json:"hasOutdoor,omitempty"`
	IsGroundFloor *bool      `json:"isGroundFloor,omitempty"`
	RoomsCount    *int       `json:"roomsCount,omitempty"`
	PurchasePrice *float64   `json:"purchasePrice,omitempty"`
	PurchaseDate  *time.Time `json:"purchaseDate,omitempty"`
}

// RealEstateEstimationResult represents the calculation output
type RealEstateEstimationResult struct {
	ValuationMode         string                  `json:"valuationMode"`
	EstimationMethod      string                  `json:"estimationMethod"`
	EstimatedValue        *float64                `json:"estimatedValue,omitempty"`
	EstimatedMin          *float64                `json:"estimatedMin,omitempty"`
	EstimatedMax          *float64                `json:"estimatedMax,omitempty"`
	EstimatedPricePerM2   *float64                `json:"estimatedPricePerM2,omitempty"`
	BasePricePerM2        *float64                `json:"basePricePerM2,omitempty"`
	ValuationConfidence   string                  `json:"valuationConfidence"`
	ComparablesCount      int                     `json:"comparablesCount"`
	SearchRadiusMeters    *int                    `json:"searchRadiusMeters,omitempty"`
	UsedTier              *int                    `json:"usedTier,omitempty"`
	InseeEvolutionPercent *float64                `json:"inseeEvolutionPercent,omitempty"`
	InseeBaseQuarter      *string                 `json:"inseeBaseQuarter,omitempty"`
	InseeCurrentQuarter   *string                 `json:"inseeCurrentQuarter,omitempty"`
	RentalMarket          *RealEstateRentalMarket `json:"rentalMarket,omitempty"`
	ExplanationNote       *string                 `json:"explanationNote,omitempty"`
}

// DVFCommuneCacheRecord represents the database cache row
type DVFCommuneCacheRecord struct {
	bun.BaseModel `bun:"table:sigma_finance.dvf_commune_cache,alias:dcc"`

	CityCode     string        `bun:"city_code,pk"`
	PropertyType string        `bun:"property_type,pk"`
	MinYear      int           `bun:"min_year"`
	Mutations    []DVFMutation `bun:"mutations,type:jsonb"`
	CachedAt     time.Time     `bun:"cached_at,nullzero,default:current_timestamp"`
	ExpiresAt    time.Time     `bun:"expires_at,notnull"`
}

// INSEEHousingIndexRecord represents a row in sigma_finance.insee_housing_indices
type INSEEHousingIndexRecord struct {
	bun.BaseModel `bun:"table:sigma_finance.insee_housing_indices,alias:ihi"`

	Quarter       string    `bun:"quarter,pk"`
	SeriesID      string    `bun:"series_id,pk"`
	IndexValue    float64   `bun:"index_value"`
	IsProvisional bool      `bun:"is_provisional"`
	PublishedAt   time.Time `bun:"published_at"`
}
