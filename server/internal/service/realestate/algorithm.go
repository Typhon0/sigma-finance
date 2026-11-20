package realestate

import (
	"math"
	"sort"
	"strings"
	"time"
)

// IsAlsaceMoselle returns true for departments 57 (Moselle), 67 (Bas-Rhin), 68 (Haut-Rhin)
func IsAlsaceMoselle(cityCode string) bool {
	if len(cityCode) < 2 {
		return false
	}
	prefix := cityCode[:2]
	return prefix == "57" || prefix == "67" || prefix == "68"
}

// IsMetropolitanFrance returns true for departments 01..95, 2A, 2B
func IsMetropolitanFrance(cityCode string) bool {
	if len(cityCode) < 2 {
		return false
	}
	prefix := strings.ToUpper(cityCode[:2])
	if prefix == "2A" || prefix == "2B" {
		return true
	}
	// DROM start with 971, 972, 973, 974, 976, COM with 975, 977, 978, 98
	if strings.HasPrefix(cityCode, "97") || strings.HasPrefix(cityCode, "98") {
		return false
	}
	// Check numeric 01 to 95
	if len(cityCode) >= 2 {
		p := cityCode[:2]
		if p >= "01" && p <= "95" {
			return true
		}
	}
	return false
}

// IsExcludedCOM returns true for Mayotte (976) and Collectivités d'outre-mer (975, 977, 978, 98x)
func IsExcludedCOM(cityCode string) bool {
	if strings.HasPrefix(cityCode, "976") ||
		strings.HasPrefix(cityCode, "975") ||
		strings.HasPrefix(cityCode, "977") ||
		strings.HasPrefix(cityCode, "978") ||
		strings.HasPrefix(cityCode, "98") {
		return true
	}
	return false
}

// IsEligibleDVF returns true for territories covered by DVF+ (Metropolitan France except 57/67/68, plus DROM 971, 972, 973, 974)
func IsEligibleDVF(cityCode string) bool {
	if IsAlsaceMoselle(cityCode) || IsExcludedCOM(cityCode) {
		return false
	}
	if IsMetropolitanFrance(cityCode) {
		return true
	}
	// DROM covered by DVF
	if strings.HasPrefix(cityCode, "971") ||
		strings.HasPrefix(cityCode, "972") ||
		strings.HasPrefix(cityCode, "973") ||
		strings.HasPrefix(cityCode, "974") {
		return true
	}
	return false
}

// HaversineDistance computes the great-circle distance between two GPS points in kilometers
func HaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0

	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)

	rLat1 := lat1 * (math.Pi / 180.0)
	rLat2 := lat2 * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(rLat1)*math.Cos(rLat2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}

// FilterCandidates parses and filters candidate mutations from DVF based on property type,
// VEFA exclusion, level 4 codtypbien, price/surface bounds, and computes comparable weights.
func FilterCandidates(
	mutations []DVFMutation,
	targetPropertyType string,
	targetSurface float64,
	targetLat, targetLon float64,
	refTime time.Time,
) []DVFComparable {
	isApartment := strings.EqualFold(targetPropertyType, "Apartment") ||
		strings.EqualFold(targetPropertyType, "APARTMENT") ||
		strings.EqualFold(targetPropertyType, "condo")

	comparables := make([]DVFComparable, 0, len(mutations))

	for _, m := range mutations {
		// 1. Must be a standard sale
		if !strings.EqualFold(m.LibNatMut, "Vente") {
			continue
		}
		// 2. VEFA / new construction exclusion
		if m.VEFA {
			continue
		}

		// 3. Level 4 codtypbien check
		// 1211 / 1111 = VEFA, 1214 / 1114 = strictly professional
		code := strings.TrimSpace(m.CodTypBien)
		if isApartment {
			if !strings.HasPrefix(code, "121") {
				continue
			}
			if code == "1211" || code == "1214" {
				continue
			}
		} else {
			if !strings.HasPrefix(code, "111") {
				continue
			}
			if code == "1111" || code == "1114" {
				continue
			}
		}

		// 4. Plausible bounds on surface & value
		if m.SBati < 9.0 || m.ValeurFonc < 15000.0 {
			continue
		}

		pricePerM2 := m.ValeurFonc / m.SBati
		if pricePerM2 < 300.0 || pricePerM2 > 35000.0 {
			continue
		}

		// Distance
		var distKm float64
		if m.Latitude != 0 && m.Longitude != 0 && targetLat != 0 && targetLon != 0 {
			distKm = HaversineDistance(targetLat, targetLon, m.Latitude, m.Longitude)
		}

		// Time diff in months
		monthsAgo := refTime.Sub(m.DateMut).Hours() / (24.0 * 30.4375)
		if monthsAgo < 0 {
			monthsAgo = 0
		}
		if monthsAgo > 36.0 {
			continue // hard limit 36 months
		}

		// Weights
		wTime := math.Exp(-0.04 * monthsAgo)
		wDist := 1.0 / (1.0 + distKm)
		wSurf := 1.0
		if targetSurface > 0 {
			diffRatio := math.Abs(m.SBati-targetSurface) / targetSurface
			wSurf = 1.0 / (1.0 + diffRatio)
		}
		weight := wTime * wDist * wSurf

		comparables = append(comparables, DVFComparable{
			Mutation:   m,
			PricePerM2: pricePerM2,
			DistanceKm: distKm,
			MonthsAgo:  monthsAgo,
			Weight:     weight,
		})
	}

	return comparables
}

// FilterByTier filters comparables according to concentric circles and surface bands
func FilterByTier(comparables []DVFComparable, targetSurface float64, tier int) []DVFComparable {
	var maxDistKm float64
	var maxMonths float64
	var minSurfRatio float64
	var maxSurfRatio float64

	switch tier {
	case 1:
		maxDistKm = 0.5 // 500m
		maxMonths = 24.0
		minSurfRatio = 0.70
		maxSurfRatio = 1.30
	case 2:
		maxDistKm = 1.0 // 1 km
		maxMonths = 24.0
		minSurfRatio = 0.65
		maxSurfRatio = 1.35
	default: // Tier 3
		maxDistKm = 2.5 // 2.5 km (or commune level)
		maxMonths = 36.0
		minSurfRatio = 0.50
		maxSurfRatio = 1.50
	}

	filtered := make([]DVFComparable, 0, len(comparables))
	for _, c := range comparables {
		if c.DistanceKm > maxDistKm {
			continue
		}
		if c.MonthsAgo > maxMonths {
			continue
		}
		if targetSurface > 0 {
			ratio := c.Mutation.SBati / targetSurface
			if ratio < minSurfRatio || ratio > maxSurfRatio {
				continue
			}
		}
		filtered = append(filtered, c)
	}

	// Broaden surface band to [0.4*S, 1.8*S] if fewer than 5 matches in tier 3
	if tier == 3 && len(filtered) < 5 && targetSurface > 0 {
		filtered = filtered[:0]
		for _, c := range comparables {
			if c.DistanceKm <= maxDistKm && c.MonthsAgo <= maxMonths {
				ratio := c.Mutation.SBati / targetSurface
				if ratio >= 0.40 && ratio <= 1.80 {
					filtered = append(filtered, c)
				}
			}
		}
	}

	return filtered
}

// RemoveOutliersIQR eliminates statistical outliers based on price/m2 using IQR for N >= 6
func RemoveOutliersIQR(comparables []DVFComparable) []DVFComparable {
	if len(comparables) < 6 {
		return comparables
	}

	sorted := make([]DVFComparable, len(comparables))
	copy(sorted, comparables)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].PricePerM2 < sorted[j].PricePerM2
	})

	q1Idx := int(float64(len(sorted)) * 0.25)
	q3Idx := int(float64(len(sorted)) * 0.75)

	q1 := sorted[q1Idx].PricePerM2
	q3 := sorted[q3Idx].PricePerM2
	iqr := q3 - q1

	lowerBound := q1 - 1.5*iqr
	upperBound := q3 + 1.5*iqr

	cleaned := make([]DVFComparable, 0, len(comparables))
	for _, c := range comparables {
		if c.PricePerM2 >= lowerBound && c.PricePerM2 <= upperBound {
			cleaned = append(cleaned, c)
		}
	}

	return cleaned
}

// CalculateWeightedMedian computes the weighted median, 25th percentile (P25) and 75th percentile (P75)
func CalculateWeightedMedian(comparables []DVFComparable) (basePrice, p25, p75 float64) {
	if len(comparables) == 0 {
		return 0, 0, 0
	}

	sorted := make([]DVFComparable, len(comparables))
	copy(sorted, comparables)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].PricePerM2 < sorted[j].PricePerM2
	})

	totalWeight := 0.0
	for _, c := range sorted {
		totalWeight += c.Weight
	}
	if totalWeight <= 0 {
		return sorted[len(sorted)/2].PricePerM2, sorted[0].PricePerM2, sorted[len(sorted)-1].PricePerM2
	}

	getPercentile := func(p float64) float64 {
		targetW := p * totalWeight
		accumW := 0.0
		for _, c := range sorted {
			accumW += c.Weight
			if accumW >= targetW {
				return c.PricePerM2
			}
		}
		return sorted[len(sorted)-1].PricePerM2
	}

	basePrice = getPercentile(0.50)
	p25 = getPercentile(0.25)
	p75 = getPercentile(0.75)

	return basePrice, p25, p75
}

// CalculateQualitativeFactor calculates the qualitative multiplier factor for DVF_COMPARABLES mode ONLY.
// IsGroundFloor is strictly ignored for houses. Result is clamped to [0.75, 1.25].
func CalculateQualitativeFactor(adj QualitativeAdjustmentInput) float64 {
	isApartment := strings.EqualFold(adj.PropertyType, "Apartment") ||
		strings.EqualFold(adj.PropertyType, "APARTMENT") ||
		strings.EqualFold(adj.PropertyType, "condo")

	delta := 0.0

	// 1. Condition
	if adj.Condition != nil {
		cond := strings.ToUpper(strings.TrimSpace(*adj.Condition))
		switch cond {
		case "RENOVATED", "NEW_OR_RENOVATED", "EXCELLENT":
			delta += 0.08
		case "TO_REFRESH":
			delta -= 0.06
		case "TO_RENOVATE", "POOR":
			delta -= 0.15
		default: // STANDARD, GOOD
			delta += 0.00
		}
	}

	// 2. DPE
	if adj.DPERating != nil {
		dpe := strings.ToUpper(strings.TrimSpace(*adj.DPERating))
		switch dpe {
		case "A":
			delta += 0.05
		case "B":
			delta += 0.04
		case "E":
			delta -= 0.03
		case "F":
			delta -= 0.08
		case "G":
			delta -= 0.12
		default: // C, D, or unknown
			delta += 0.00
		}
	}

	// 3. Outdoor amenities (apartments only)
	if isApartment && adj.HasOutdoor != nil && *adj.HasOutdoor {
		delta += 0.04
	}

	// 4. Ground floor (RDC) - strictly ignored for houses!
	if isApartment && adj.IsGroundFloor != nil && *adj.IsGroundFloor {
		delta -= 0.07
	}

	factor := 1.0 + delta
	if factor < 0.75 {
		factor = 0.75
	}
	if factor > 1.25 {
		factor = 1.25
	}

	return factor
}

// ComputeConfidence determines the confidence index
func ComputeConfidence(comparablesCount int, tier int, isDVF bool) string {
	if !isDVF {
		// For INSEE indexation
		if comparablesCount > 0 {
			return ValuationConfidenceMedium
		}
		return ValuationConfidenceLow
	}

	if comparablesCount >= 15 && tier <= 2 {
		return ValuationConfidenceHigh
	}
	if comparablesCount >= 6 && tier <= 3 {
		return ValuationConfidenceMedium
	}
	if comparablesCount >= 3 {
		return ValuationConfidenceLow
	}
	return ValuationConfidenceUnavailable
}
