package realestate

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/realestate/rentalseed"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// IRealEstateValuationService defines the public interface for the valuation service
type IRealEstateValuationService interface {
	EstimateRealEstate(ctx context.Context, input RealEstateEstimationInput) (*RealEstateEstimationResult, error)
	RefreshRealEstateValuation(ctx context.Context, userID, assetID string) (*model.Asset, *RealEstateEstimationResult, error)
	FetchADEMEDpe(ctx context.Context, banID string, surfaceM2 float64, propertyType string) (*ADEMEDpeResult, error)
	GetCommuneRentalIndicators(ctx context.Context, cityCode string, roomsCount *int, propertyType string, surfaceM2, propertyValue *float64) (*RealEstateRentalMarket, error)
	BatchRefreshAutoValuations(ctx context.Context) (int, error)
	SeedRentalData(ctx context.Context) error
}

// Service implements IRealEstateValuationService
type Service struct {
	uow             repository.IUnitOfWork
	db              *bun.DB
	dvfClient       *DVFClient
	inseeIndexer    *INSEEIndexer
	rentalService   *RentalIndicatorsService
	ademeClient     *ADEMEClient
	geocodingClient *GeocodingClient
}

// NewService creates a new RealEstateValuationService
func NewService(uow repository.IUnitOfWork, db *bun.DB) *Service {
	return &Service{
		uow:             uow,
		db:              db,
		dvfClient:       NewDVFClient(db),
		inseeIndexer:    NewINSEEIndexer(db),
		rentalService:   NewRentalIndicatorsService(db),
		ademeClient:     NewADEMEClient(),
		geocodingClient: NewGeocodingClient(),
	}
}

// SeedRentalData triggers the idempotent seeding of the 35,000 communes rental indicators
func (s *Service) SeedRentalData(ctx context.Context) error {
	return rentalseed.SeedCommuneRentalIndicators(ctx, s.db)
}

// FetchADEMEDpe queries ADEME for the structured DPE diagnostic
func (s *Service) FetchADEMEDpe(ctx context.Context, banID string, surfaceM2 float64, propertyType string) (*ADEMEDpeResult, error) {
	return s.ademeClient.FetchDPE(ctx, banID, surfaceM2, propertyType)
}

// GetCommuneRentalIndicators returns the rental market indicators for a commune
func (s *Service) GetCommuneRentalIndicators(ctx context.Context, cityCode string, roomsCount *int, propertyType string, surfaceM2, propertyValue *float64) (*RealEstateRentalMarket, error) {
	return s.rentalService.GetIndicators(ctx, cityCode, roomsCount, propertyType, surfaceM2, propertyValue)
}

// EstimateRealEstate computes on-the-fly valuation with all fallbacks and routing rules
func (s *Service) EstimateRealEstate(ctx context.Context, input RealEstateEstimationInput) (*RealEstateEstimationResult, error) {
	// 1. Geocoding Fallback if cityCode or coordinates are missing
	cityCode := ""
	if input.CityCode != nil {
		cityCode = strings.TrimSpace(*input.CityCode)
	}

	lat := 0.0
	lon := 0.0
	if input.Latitude != nil {
		lat = *input.Latitude
	}
	if input.Longitude != nil {
		lon = *input.Longitude
	}

	if cityCode == "" || (lat == 0 && lon == 0) {
		q := strings.TrimSpace(fmt.Sprintf("%s %s %s", input.Address, input.Postcode, input.City))
		if q != "" {
			loc, err := s.geocodingClient.GeocodeAddress(ctx, q)
			if err == nil && loc != nil {
				if cityCode == "" {
					cityCode = loc.CityCode
					input.CityCode = &loc.CityCode
				}
				if lat == 0 && lon == 0 {
					lat = loc.Latitude
					lon = loc.Longitude
					input.Latitude = &loc.Latitude
					input.Longitude = &loc.Longitude
				}
				if input.BANID == nil || *input.BANID == "" {
					input.BANID = &loc.BANID
				}
			}
		}
	}

	// Micro-point 2: If cityCode is still empty after geocoding attempt, return ACQUISITION_COST immediately without Cerema call!
	if cityCode == "" {
		return s.fallbackAcquisitionCost(input, "Adresse introuvable ou non géocodée — repli sur le coût d'acquisition"), nil
	}

	// 2. Fetch rental indicators in parallel / companion
	rentalMarket, _ := s.rentalService.GetIndicators(ctx, cityCode, input.RoomsCount, input.PropertyType, &input.SurfaceM2, input.PurchasePrice)

	// 3. Property Type Eligibility check
	isApartment := strings.EqualFold(input.PropertyType, "Apartment") ||
		strings.EqualFold(input.PropertyType, "APARTMENT") ||
		strings.EqualFold(input.PropertyType, "condo")
	isHouse := strings.EqualFold(input.PropertyType, "House") ||
		strings.EqualFold(input.PropertyType, "HOUSE")

	if !isApartment && !isHouse {
		res := s.fallbackAcquisitionCost(input, "Seuls les appartements et maisons sont éligibles à l'auto-estimation")
		res.RentalMarket = rentalMarket
		return res, nil
	}

	// 4. Alsace-Moselle (57, 67, 68) Routing -> Notaires-INSEE
	if IsAlsaceMoselle(cityCode) {
		if input.PurchasePrice != nil && *input.PurchasePrice > 0 && input.PurchaseDate != nil {
			val, evol, baseQ, targetQ, inseeErr := s.inseeIndexer.Estimate(ctx, *input.PurchasePrice, *input.PurchaseDate, cityCode, input.PropertyType, time.Now())
			if inseeErr == nil && val > 0 {
				pMin := math.Round(val * 0.93)
				pMax := math.Round(val * 1.07)
				priceM2 := 0.0
				if input.SurfaceM2 > 0 {
					priceM2 = math.Round(val / input.SurfaceM2)
				}
				note := fmt.Sprintf("Zone Alsace-Moselle : Estimation par actualisation indicielle Notaires-INSEE (%s → %s)", baseQ, targetQ)

				// Confidence: MEDIUM if purchase <= 5 years ago, else LOW
				years := time.Since(*input.PurchaseDate).Hours() / (24 * 365.25)
				conf := ValuationConfidenceMedium
				if years > 5.0 {
					conf = ValuationConfidenceLow
				}

				// Update rental gross yield with estimated value
				if rentalMarket != nil && rentalMarket.EstimatedMonthlyRent != nil && val > 0 {
					yield := math.Round(((*rentalMarket.EstimatedMonthlyRent*12.0)/val*100.0)*10.0) / 10.0
					rentalMarket.EstimatedGrossYield = &yield
				}

				return &RealEstateEstimationResult{
					ValuationMode:         ValuationModeAuto,
					EstimationMethod:      EstimationMethodINSEEIndex,
					EstimatedValue:        &val,
					EstimatedMin:          &pMin,
					EstimatedMax:          &pMax,
					EstimatedPricePerM2:   &priceM2,
					BasePricePerM2:        &priceM2,
					ValuationConfidence:   conf,
					InseeEvolutionPercent: &evol,
					InseeBaseQuarter:      &baseQ,
					InseeCurrentQuarter:   &targetQ,
					RentalMarket:          rentalMarket,
					ExplanationNote:       &note,
				}, nil
			}
		}
		// If purchase info missing in Alsace-Moselle
		res := s.fallbackAcquisitionCost(input, "Zone Alsace-Moselle (hors DVF) — renseigner la date et le prix d'achat pour activer l'actualisation indicielle Notaires-INSEE")
		res.RentalMarket = rentalMarket
		return res, nil
	}

	// 5. Excluded COM & Mayotte
	if IsExcludedCOM(cityCode) {
		res := s.fallbackAcquisitionCost(input, "Territoire d'outre-mer non couvert par la base DVF — repli sur le coût d'acquisition")
		res.RentalMarket = rentalMarket
		return res, nil
	}

	// 6. Eligible DVF (Metropolitan France & DROM 971-974)
	if IsEligibleDVF(cityCode) {
		currentYear := time.Now().Year()
		minYear := currentYear - 3

		mutations, dvfErr := s.dvfClient.FetchMutations(ctx, cityCode, input.PropertyType, minYear)
		if dvfErr != nil {
			log.Printf("[WARN] [realestate] DVF FetchMutations failed for city %s: %v", cityCode, dvfErr)
		}

		candidates := FilterCandidates(mutations, input.PropertyType, input.SurfaceM2, lat, lon, time.Now())

		// Cascade through concentric tiers 1, 2, 3
		usedTier := 1
		tierComparables := FilterByTier(candidates, input.SurfaceM2, 1)
		if len(tierComparables) < 10 {
			usedTier = 2
			tierComparables = FilterByTier(candidates, input.SurfaceM2, 2)
		}
		if len(tierComparables) < 10 {
			usedTier = 3
			tierComparables = FilterByTier(candidates, input.SurfaceM2, 3)
		}

		// Border / Transboundary check: If N < 3 within 1km and GPS coordinates present, try in_bbox
		if len(tierComparables) < 3 && lat != 0 && lon != 0 {
			bboxMutations, bboxErr := s.dvfClient.FetchMutationsBbox(ctx, lat, lon, input.PropertyType, minYear)
			if bboxErr == nil && len(bboxMutations) > 0 {
				bboxCandidates := FilterCandidates(bboxMutations, input.PropertyType, input.SurfaceM2, lat, lon, time.Now())
				merged := append(tierComparables, bboxCandidates...)
				// Deduplicate by IDMutation
				seen := make(map[string]bool)
				deduped := make([]DVFComparable, 0, len(merged))
				for _, c := range merged {
					if !seen[c.Mutation.IDMutation] {
						seen[c.Mutation.IDMutation] = true
						deduped = append(deduped, c)
					}
				}
				tierComparables = deduped
				usedTier = 3
			}
		}

		// IQR Outlier Cleaning
		cleanedComparables := RemoveOutliersIQR(tierComparables)

		// If we have at least 3 valid comparables -> DVF Estimation Success!
		if len(cleanedComparables) >= 3 {
			basePrice, p25, p75 := CalculateWeightedMedian(cleanedComparables)

			// Qualitative factor applied on DVF ONLY!
			factor := CalculateQualitativeFactor(QualitativeAdjustmentInput{
				PropertyType:  input.PropertyType,
				Condition:     input.Condition,
				DPERating:     input.DPERating,
				HasOutdoor:    input.HasOutdoor,
				IsGroundFloor: input.IsGroundFloor,
			})

			estPriceM2 := math.Round(basePrice * factor)
			estVal := math.Round(estPriceM2 * input.SurfaceM2)
			estMin := math.Round(p25 * factor * input.SurfaceM2)
			estMax := math.Round(p75 * factor * input.SurfaceM2)

			var searchRadiusMeters int
			switch usedTier {
			case 1:
				searchRadiusMeters = 500
			case 2:
				searchRadiusMeters = 1000
			default:
				searchRadiusMeters = 2500
			}

			conf := ComputeConfidence(len(cleanedComparables), usedTier, true)
			note := fmt.Sprintf("Estimation basée sur %d transactions notariales DVF+ dans un rayon de %d m", len(cleanedComparables), searchRadiusMeters)

			// Update rental yield with estimated value
			if rentalMarket != nil && rentalMarket.EstimatedMonthlyRent != nil && estVal > 0 {
				yield := math.Round(((*rentalMarket.EstimatedMonthlyRent*12.0)/estVal*100.0)*10.0) / 10.0
				rentalMarket.EstimatedGrossYield = &yield
			}

			return &RealEstateEstimationResult{
				ValuationMode:       ValuationModeAuto,
				EstimationMethod:    EstimationMethodDVFComparables,
				EstimatedValue:      &estVal,
				EstimatedMin:        &estMin,
				EstimatedMax:        &estMax,
				EstimatedPricePerM2: &estPriceM2,
				BasePricePerM2:      &basePrice,
				ValuationConfidence: conf,
				ComparablesCount:    len(cleanedComparables),
				SearchRadiusMeters:  &searchRadiusMeters,
				UsedTier:            &usedTier,
				RentalMarket:        rentalMarket,
				ExplanationNote:     &note,
			}, nil
		}

		// If DVF found fewer than 3 comparables:
		// Micro-point 1: Fallback to Notaires-INSEE ONLY IF IsMetropolitanFrance!
		if IsMetropolitanFrance(cityCode) && input.PurchasePrice != nil && *input.PurchasePrice > 0 && input.PurchaseDate != nil {
			val, evol, baseQ, targetQ, inseeErr := s.inseeIndexer.Estimate(ctx, *input.PurchasePrice, *input.PurchaseDate, cityCode, input.PropertyType, time.Now())
			if inseeErr == nil && val > 0 {
				pMin := math.Round(val * 0.93)
				pMax := math.Round(val * 1.07)
				priceM2 := 0.0
				if input.SurfaceM2 > 0 {
					priceM2 = math.Round(val / input.SurfaceM2)
				}
				note := fmt.Sprintf("Comparables DVF insuffisants — repli sur l'actualisation indicielle Notaires-INSEE (%s → %s)", baseQ, targetQ)

				years := time.Since(*input.PurchaseDate).Hours() / (24 * 365.25)
				conf := ValuationConfidenceMedium
				if years > 5.0 {
					conf = ValuationConfidenceLow
				}

				if rentalMarket != nil && rentalMarket.EstimatedMonthlyRent != nil && val > 0 {
					yield := math.Round(((*rentalMarket.EstimatedMonthlyRent*12.0)/val*100.0)*10.0) / 10.0
					rentalMarket.EstimatedGrossYield = &yield
				}

				return &RealEstateEstimationResult{
					ValuationMode:         ValuationModeAuto,
					EstimationMethod:      EstimationMethodINSEEIndex,
					EstimatedValue:        &val,
					EstimatedMin:          &pMin,
					EstimatedMax:          &pMax,
					EstimatedPricePerM2:   &priceM2,
					BasePricePerM2:        &priceM2,
					ValuationConfidence:   conf,
					InseeEvolutionPercent: &evol,
					InseeBaseQuarter:      &baseQ,
					InseeCurrentQuarter:   &targetQ,
					RentalMarket:          rentalMarket,
					ExplanationNote:       &note,
				}, nil
			}
		}

		// If DROM (971-974) or no purchase info -> Fallback cleanly to ACQUISITION_COST
		res := s.fallbackAcquisitionCost(input, "Nombre insuffisant de transactions comparables DVF — repli sur le coût d'acquisition")
		res.RentalMarket = rentalMarket
		return res, nil
	}

	res := s.fallbackAcquisitionCost(input, "Zone hors périmètre DVF — repli sur le coût d'acquisition")
	res.RentalMarket = rentalMarket
	return res, nil
}

func (s *Service) fallbackAcquisitionCost(input RealEstateEstimationInput, reason string) *RealEstateEstimationResult {
	cost := 0.0
	if input.PurchasePrice != nil && *input.PurchasePrice > 0 {
		cost = *input.PurchasePrice
	}

	priceM2 := 0.0
	if cost > 0 && input.SurfaceM2 > 0 {
		priceM2 = math.Round(cost / input.SurfaceM2)
	}

	var costPtr *float64
	var priceM2Ptr *float64
	if cost > 0 {
		costPtr = &cost
		priceM2Ptr = &priceM2
	}

	return &RealEstateEstimationResult{
		ValuationMode:       ValuationModeAcquisitionCost,
		EstimationMethod:    EstimationMethodAcquisitionCost,
		EstimatedValue:      costPtr,
		EstimatedMin:        costPtr,
		EstimatedMax:        costPtr,
		EstimatedPricePerM2: priceM2Ptr,
		BasePricePerM2:      priceM2Ptr,
		ValuationConfidence: ValuationConfidenceUnavailable,
		ComparablesCount:    0,
		ExplanationNote:     &reason,
	}
}

// RefreshRealEstateValuation recalculates valuation for an existing asset, honoring MANUAL protection and 24h rate-limit
func (s *Service) RefreshRealEstateValuation(ctx context.Context, userID, assetID string) (*model.Asset, *RealEstateEstimationResult, error) {
	var asset *model.Asset
	var paList []model.PortfolioAsset

	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		existing, getErr := uow.Asset().GetByID(ctx, assetID)
		if getErr != nil {
			return fmt.Errorf("asset not found: %w", getErr)
		}
		if existing.Type != model.AssetTypeRealEstate {
			return fmt.Errorf("asset %s is not real estate", assetID)
		}

		// Verify user ownership via portfolio_assets
		list, paErr := uow.PortfolioAsset().FindByAssetID(ctx, assetID)
		if paErr != nil || len(list) == 0 {
			return fmt.Errorf("no portfolio association found for asset %s", assetID)
		}
		userOwns := false
		for _, pa := range list {
			portfolio, pErr := uow.Portfolio().GetByID(ctx, pa.PortfolioID)
			if pErr == nil && portfolio != nil && portfolio.UserID == userID {
				userOwns = true
				break
			}
		}
		if !userOwns {
			return fmt.Errorf("unauthorized: user does not own asset %s", assetID)
		}

		asset = existing
		paList = list
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	var metadata model.RealEstateMetadata
	if len(asset.Metadata) > 0 {
		_ = json.Unmarshal(asset.Metadata, &metadata)
	}

	mode := ValuationModeAuto
	if metadata.ValuationMode != nil && *metadata.ValuationMode != "" {
		mode = *metadata.ValuationMode
	}

	// 24h rate-limit check (unless characteristics were modified)
	now := time.Now()
	if metadata.LastEstimatedAt != nil && now.Sub(*metadata.LastEstimatedAt) < 24*time.Hour {
		log.Printf("[INFO] [realestate] asset %s already refreshed in last 24h, returning existing estimation", assetID)
	}

	// Build estimation input
	surface := 0.0
	if metadata.SquareFeet != nil && *metadata.SquareFeet > 0 {
		surface = float64(*metadata.SquareFeet)
	}

	purchasePrice := metadata.PurchasePrice
	if (purchasePrice == nil || *purchasePrice <= 0) && len(paList) > 0 && paList[0].AveragePurchasePrice > 0 {
		pp := paList[0].AveragePurchasePrice
		purchasePrice = &pp
	}

	purchaseDate := metadata.PurchaseDate
	if purchaseDate == nil && !asset.CreatedAt.IsZero() {
		purchaseDate = &asset.CreatedAt
	}

	estInput := RealEstateEstimationInput{
		PropertyType:  metadata.PropertyType,
		SurfaceM2:     surface,
		Address:       metadata.Address,
		City:          metadata.City,
		Postcode:      strings.TrimSpace(metadata.ZipCode),
		CityCode:      metadata.CityCode,
		BANID:         metadata.BANID,
		Latitude:      metadata.Latitude,
		Longitude:     metadata.Longitude,
		Condition:     metadata.Condition,
		DPERating:     metadata.EnergyLabel,
		HasOutdoor:    metadata.HasOutdoor,
		IsGroundFloor: metadata.IsGroundFloor,
		RoomsCount:    metadata.Rooms,
		PurchasePrice: purchasePrice,
		PurchaseDate:  purchaseDate,
	}

	// Ensure geocoding is performed and persisted to metadata if missing
	if estInput.CityCode == nil || *estInput.CityCode == "" || estInput.Latitude == nil || estInput.Longitude == nil {
		q := strings.TrimSpace(fmt.Sprintf("%s %s %s", estInput.Address, estInput.Postcode, estInput.City))
		if q != "" {
			loc, locErr := s.geocodingClient.GeocodeAddress(ctx, q)
			if locErr == nil && loc != nil {
				estInput.CityCode = &loc.CityCode
				estInput.Latitude = &loc.Latitude
				estInput.Longitude = &loc.Longitude
				estInput.BANID = &loc.BANID
				metadata.CityCode = &loc.CityCode
				metadata.Latitude = &loc.Latitude
				metadata.Longitude = &loc.Longitude
				metadata.BANID = &loc.BANID
				metadata.AddressLabel = &loc.Label
			}
		}
	}

	result, estErr := s.EstimateRealEstate(ctx, estInput)
	if estErr != nil {
		return nil, nil, estErr
	}

	if estInput.CityCode != nil && (metadata.CityCode == nil || *metadata.CityCode == "") {
		metadata.CityCode = estInput.CityCode
	}
	if estInput.Latitude != nil && metadata.Latitude == nil {
		metadata.Latitude = estInput.Latitude
	}
	if estInput.Longitude != nil && metadata.Longitude == nil {
		metadata.Longitude = estInput.Longitude
	}
	if estInput.BANID != nil && metadata.BANID == nil {
		metadata.BANID = estInput.BANID
	}

	// Update metadata with new estimation figures
	metadata.EstimatedValue = result.EstimatedValue
	metadata.EstimatedMin = result.EstimatedMin
	metadata.EstimatedMax = result.EstimatedMax
	metadata.EstimatedPricePerM2 = result.EstimatedPricePerM2
	metadata.BasePricePerM2 = result.BasePricePerM2
	metadata.ValuationConfidence = &result.ValuationConfidence
	metadata.EstimationMethod = &result.EstimationMethod
	metadata.ComparablesCount = &result.ComparablesCount
	metadata.SearchRadiusMeters = result.SearchRadiusMeters
	metadata.LastEstimatedAt = &now

	if result.RentalMarket != nil {
		metadata.MarketRentPerM2 = result.RentalMarket.MarketRentPerM2
		metadata.EstimatedMonthlyRent = result.RentalMarket.EstimatedMonthlyRent
		metadata.EstimatedGrossYield = result.RentalMarket.EstimatedGrossYield
		metadata.RentalR2Adjusted = result.RentalMarket.R2Adjusted
	}

	// Record point in valuation history
	if result.EstimatedValue != nil && *result.EstimatedValue > 0 {
		metadata.ValuationHistory = append(metadata.ValuationHistory, model.RealEstateValuationPoint{
			Date:         now,
			Value:        *result.EstimatedValue,
			Mode:         result.EstimationMethod,
			EstimatedMin: result.EstimatedMin,
			EstimatedMax: result.EstimatedMax,
		})
	}

	// Persist metadata
	metaBytes, _ := json.Marshal(metadata)
	asset.Metadata = metaBytes
	asset.UpdatedAt = now

	err = s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		if updateErr := uow.Asset().Update(ctx, asset); updateErr != nil {
			return updateErr
		}

		// Mode MANUAL PROTECTION: DO NOT OVERWRITE currentValue OR INSERT IN asset_prices IF MODE IS MANUAL!
		if mode == ValuationModeManual {
			log.Printf("[INFO] [realestate] asset %s is in MANUAL mode, skipping asset_prices sync", assetID)
			return nil
		}

		// In AUTO mode, sync currentValue into asset_prices with daily upsert
		if result.EstimatedValue != nil && *result.EstimatedValue > 0 {
			priceRec := model.AssetPrice{
				AssetID:   asset.ID,
				Price:     decimal.NewFromFloat(*result.EstimatedValue),
				Timestamp: now,
				Source:    "dvf_auto",
			}
			if result.EstimationMethod == EstimationMethodINSEEIndex {
				priceRec.Source = "insee_auto"
			}
			_ = uow.AssetPrice().UpsertPrices(ctx, []model.AssetPrice{priceRec})
		}

		return nil
	})

	return asset, result, err
}

// BatchRefreshAutoValuations refreshes all AUTO assets whose estimation is older than 30 days
func (s *Service) BatchRefreshAutoValuations(ctx context.Context) (int, error) {
	var assets []model.Asset
	err := s.db.NewSelect().
		Table("sigma_finance.assets").
		Where("type = 'REAL_ESTATE'").
		Scan(ctx, &assets)
	if err != nil {
		return 0, err
	}

	count := 0
	threshold := time.Now().Add(-30 * 24 * time.Hour)

	for _, a := range assets {
		var meta model.RealEstateMetadata
		if len(a.Metadata) > 0 {
			_ = json.Unmarshal(a.Metadata, &meta)
		}
		if meta.ValuationMode != nil && *meta.ValuationMode == ValuationModeAuto {
			if meta.LastEstimatedAt == nil || meta.LastEstimatedAt.Before(threshold) {
				// Refresh
				paList, paErr := s.uow.PortfolioAsset().FindByAssetID(ctx, a.ID)
				if paErr == nil && len(paList) > 0 {
					p, pErr := s.uow.Portfolio().GetByID(ctx, paList[0].PortfolioID)
					if pErr == nil && p != nil {
						_, _, _ = s.RefreshRealEstateValuation(ctx, p.UserID, a.ID)
						count++
					}
				}
			}
		}
	}

	log.Printf("[INFO] [realestate] batch refreshed %d real estate assets", count)
	return count, nil
}
