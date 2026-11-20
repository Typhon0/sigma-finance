package realestate

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeographicRouting(t *testing.T) {
	// Alsace-Moselle
	assert.True(t, IsAlsaceMoselle("67000"))
	assert.True(t, IsAlsaceMoselle("68100"))
	assert.True(t, IsAlsaceMoselle("57000"))
	assert.False(t, IsAlsaceMoselle("75001"))
	assert.False(t, IsAlsaceMoselle("97100"))

	// Metropolitan France
	assert.True(t, IsMetropolitanFrance("75001"))
	assert.True(t, IsMetropolitanFrance("67000"))
	assert.True(t, IsMetropolitanFrance("2A004"))
	assert.True(t, IsMetropolitanFrance("2B001"))
	assert.False(t, IsMetropolitanFrance("97100")) // Guadeloupe
	assert.False(t, IsMetropolitanFrance("97400")) // La Réunion
	assert.False(t, IsMetropolitanFrance("97600")) // Mayotte

	// Excluded COM & Mayotte
	assert.True(t, IsExcludedCOM("97600")) // Mayotte
	assert.True(t, IsExcludedCOM("97500")) // Saint-Pierre-et-Miquelon
	assert.True(t, IsExcludedCOM("97700")) // Saint-Barthélemy
	assert.False(t, IsExcludedCOM("97100"))
	assert.False(t, IsExcludedCOM("75001"))

	// Eligible DVF (Metropole except 57/67/68, plus DROM 971-974)
	assert.True(t, IsEligibleDVF("75001"))
	assert.True(t, IsEligibleDVF("44000"))
	assert.True(t, IsEligibleDVF("97100"))  // Guadeloupe is covered by DVF
	assert.True(t, IsEligibleDVF("97400"))  // La Réunion is covered by DVF
	assert.False(t, IsEligibleDVF("67000")) // Strasbourg: Alsace-Moselle
	assert.False(t, IsEligibleDVF("97600")) // Mayotte: Not covered
}

func TestHaversineDistance(t *testing.T) {
	// Paris Notre-Dame (48.8530, 2.3499) to Eiffel Tower (48.8584, 2.2945) ~ 4.07 km
	dist := HaversineDistance(48.8530, 2.3499, 48.8584, 2.2945)
	assert.InDelta(t, 4.07, dist, 0.2)
}

func TestFilterCandidates_DVF(t *testing.T) {
	refTime := time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)

	mutations := []DVFMutation{
		// 1. Valid apartment (1213 = standard ancient apartment)
		{
			IDMutation: "mut-1",
			DateMut:    refTime.AddDate(0, -6, 0),
			ValeurFonc: 300000,
			SBati:      60,
			CodTypBien: "1213",
			LibNatMut:  "Vente",
			VEFA:       false,
			Latitude:   48.85,
			Longitude:  2.35,
		},
		// 2. VEFA boolean true -> MUST BE EXCLUDED
		{
			IDMutation: "mut-2",
			DateMut:    refTime.AddDate(0, -3, 0),
			ValeurFonc: 350000,
			SBati:      60,
			CodTypBien: "121",
			LibNatMut:  "Vente",
			VEFA:       true,
			Latitude:   48.851,
			Longitude:  2.351,
		},
		// 3. VEFA level 4 code 1211 -> MUST BE EXCLUDED
		{
			IDMutation: "mut-3",
			DateMut:    refTime.AddDate(0, -3, 0),
			ValeurFonc: 360000,
			SBati:      60,
			CodTypBien: "1211",
			LibNatMut:  "Vente",
			VEFA:       false,
			Latitude:   48.851,
			Longitude:  2.351,
		},
		// 4. Professional exclusive level 4 code 1214 -> MUST BE EXCLUDED
		{
			IDMutation: "mut-4",
			DateMut:    refTime.AddDate(0, -4, 0),
			ValeurFonc: 400000,
			SBati:      60,
			CodTypBien: "1214",
			LibNatMut:  "Vente",
			VEFA:       false,
			Latitude:   48.852,
			Longitude:  2.352,
		},
		// 5. Libnatmut != "Vente" (e.g. "Echange") -> MUST BE EXCLUDED
		{
			IDMutation: "mut-5",
			DateMut:    refTime.AddDate(0, -5, 0),
			ValeurFonc: 300000,
			SBati:      60,
			CodTypBien: "1213",
			LibNatMut:  "Echange",
			VEFA:       false,
			Latitude:   48.85,
			Longitude:  2.35,
		},
		// 6. Surface < 9 m² -> MUST BE EXCLUDED
		{
			IDMutation: "mut-6",
			DateMut:    refTime.AddDate(0, -2, 0),
			ValeurFonc: 50000,
			SBati:      8,
			CodTypBien: "1213",
			LibNatMut:  "Vente",
			VEFA:       false,
			Latitude:   48.85,
			Longitude:  2.35,
		},
		// 7. Value < 15 000 € -> MUST BE EXCLUDED
		{
			IDMutation: "mut-7",
			DateMut:    refTime.AddDate(0, -2, 0),
			ValeurFonc: 10000,
			SBati:      30,
			CodTypBien: "1213",
			LibNatMut:  "Vente",
			VEFA:       false,
			Latitude:   48.85,
			Longitude:  2.35,
		},
		// 8. House when looking for Apartment -> MUST BE EXCLUDED
		{
			IDMutation: "mut-8",
			DateMut:    refTime.AddDate(0, -2, 0),
			ValeurFonc: 500000,
			SBati:      120,
			CodTypBien: "1113",
			LibNatMut:  "Vente",
			VEFA:       false,
			Latitude:   48.85,
			Longitude:  2.35,
		},
	}

	res := FilterCandidates(mutations, "Apartment", 60, 48.85, 2.35, refTime)
	require.Len(t, res, 1)
	assert.Equal(t, "mut-1", res[0].Mutation.IDMutation)
	assert.InDelta(t, 5000.0, res[0].PricePerM2, 0.01)
}

func TestQualitativeAdjustments_IsGroundFloorOnHouse(t *testing.T) {
	// Rule: IsGroundFloor MUST BE STRICTLY IGNORED FOR HOUSES!
	cond := "STANDARD"
	dpe := "C"
	isRDC := true
	outdoor := true

	houseInput := QualitativeAdjustmentInput{
		PropertyType:  "House",
		Condition:     &cond,
		DPERating:     &dpe,
		IsGroundFloor: &isRDC,
		HasOutdoor:    &outdoor,
	}

	factorHouse := CalculateQualitativeFactor(houseInput)
	// For House: Standard (0) + DPE C (0) + RDC (ignored = 0) + Outdoor (ignored = 0) -> exactly 1.0
	assert.InDelta(t, 1.0, factorHouse, 0.001, "IsGroundFloor must have zero penalty on a house")

	// For Apartment: Standard (0) + DPE C (0) + RDC (-0.07) + Outdoor (+0.04) -> 0.97
	apptInput := QualitativeAdjustmentInput{
		PropertyType:  "Apartment",
		Condition:     &cond,
		DPERating:     &dpe,
		IsGroundFloor: &isRDC,
		HasOutdoor:    &outdoor,
	}
	factorAppt := CalculateQualitativeFactor(apptInput)
	assert.InDelta(t, 0.97, factorAppt, 0.001)
}

func TestRemoveOutliersIQR(t *testing.T) {
	// 8 comparables with prices around 5000 €/m2, one extreme outlier at 200 €/m2 and one at 30000 €/m2
	comparables := []DVFComparable{
		{PricePerM2: 200.0}, // outlier
		{PricePerM2: 4800.0},
		{PricePerM2: 4900.0},
		{PricePerM2: 5000.0},
		{PricePerM2: 5100.0},
		{PricePerM2: 5200.0},
		{PricePerM2: 5300.0},
		{PricePerM2: 30000.0}, // outlier
	}

	cleaned := RemoveOutliersIQR(comparables)
	assert.Len(t, cleaned, 6)
	for _, c := range cleaned {
		assert.GreaterOrEqual(t, c.PricePerM2, 4000.0)
		assert.LessOrEqual(t, c.PricePerM2, 6000.0)
	}
}

func TestWeightedMedian(t *testing.T) {
	comparables := []DVFComparable{
		{PricePerM2: 4000.0, Weight: 1.0},
		{PricePerM2: 5000.0, Weight: 2.0},
		{PricePerM2: 6000.0, Weight: 1.0},
	}

	base, p25, p75 := CalculateWeightedMedian(comparables)
	assert.InDelta(t, 5000.0, base, 1.0)
	assert.InDelta(t, 4000.0, p25, 1000.0)
	assert.InDelta(t, 6000.0, p75, 1000.0)
}
