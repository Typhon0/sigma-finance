package realestate

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ADEMEClient handles DPE queries to ADEME Open Data
type ADEMEClient struct {
	httpClient *http.Client
}

// NewADEMEClient creates a new ADEMEClient instance with a 4-second timeout
func NewADEMEClient() *ADEMEClient {
	return &ADEMEClient{
		httpClient: &http.Client{
			Timeout: 4 * time.Second,
		},
	}
}

type ademeLineResponse struct {
	Total   int `json:"total"`
	Results []struct {
		NumeroDPE                string      `json:"numero_dpe"`
		NumeroDPERemplace        interface{} `json:"numero_dpe_remplace"`
		EtiquetteDPE             string      `json:"etiquette_dpe"`
		DateEtablissementDPE     string      `json:"date_etablissement_dpe"`
		SurfaceHabitableLogement interface{} `json:"surface_habitable_logement"`
		TypeBatiment             string      `json:"type_batiment"`
	} `json:"results"`
}

// FetchDPE queries ADEME for the given BAN ID and surface, returning a structured result
func (c *ADEMEClient) FetchDPE(ctx context.Context, banID string, surfaceM2 float64, propertyType string) (*ADEMEDpeResult, error) {
	banID = strings.TrimSpace(banID)
	if banID == "" {
		return nil, nil
	}

	// 1. Try dpe03existant first
	res, err := c.queryDataset(ctx, "dpe03existant", banID, surfaceM2, propertyType)
	if err == nil && res != nil {
		return res, nil
	}

	// 2. Fallback to dpe02neuf (new construction)
	res, err = c.queryDataset(ctx, "dpe02neuf", banID, surfaceM2, propertyType)
	if err == nil && res != nil {
		return res, nil
	}

	return nil, nil
}

func (c *ADEMEClient) queryDataset(ctx context.Context, dataset, banID string, targetSurface float64, propertyType string) (*ADEMEDpeResult, error) {
	endpoint := fmt.Sprintf(
		"https://data.ademe.fr/data-fair/api/v1/datasets/%s/lines?qs=identifiant_ban:\"%s\"&size=30&sort=-date_etablissement_dpe",
		dataset,
		url.QueryEscape(banID),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "SigmaFinance/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ademe api returned status %d", resp.StatusCode)
	}

	var data ademeLineResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	if len(data.Results) == 0 {
		return nil, nil
	}

	// Track replaced DPE IDs to avoid picking obsolete/cancelled ones
	replacedSet := make(map[string]bool)
	for _, row := range data.Results {
		if row.NumeroDPERemplace != nil {
			if strVal, ok := row.NumeroDPERemplace.(string); ok && strVal != "" {
				replacedSet[strVal] = true
			}
		}
	}

	isApartment := strings.EqualFold(propertyType, "Apartment") ||
		strings.EqualFold(propertyType, "APARTMENT") ||
		strings.EqualFold(propertyType, "condo")

	var bestMatch *ADEMEDpeResult
	minDiff := math.MaxFloat64

	for _, row := range data.Results {
		if replacedSet[row.NumeroDPE] {
			continue // Skip superseded/cancelled DPE
		}

		// Filter building type if indicated
		typeBat := strings.ToLower(row.TypeBatiment)
		if isApartment && strings.Contains(typeBat, "maison") {
			continue
		}
		if !isApartment && strings.Contains(typeBat, "appartement") {
			continue
		}

		// Parse surface
		surf := 0.0
		switch v := row.SurfaceHabitableLogement.(type) {
		case float64:
			surf = v
		case int:
			surf = float64(v)
		}

		diff := math.Abs(surf - targetSurface)
		// Check tolerance: within 5m2 or within 10%
		toleranceOk := false
		if targetSurface > 0 {
			if diff <= 5.0 || (diff/targetSurface) <= 0.10 {
				toleranceOk = true
			}
		} else {
			toleranceOk = true // No surface supplied, take most recent
		}

		if toleranceOk && diff < minDiff {
			minDiff = diff
			rating := strings.ToUpper(strings.TrimSpace(row.EtiquetteDPE))
			if rating == "" {
				continue
			}

			diagYear := ""
			if len(row.DateEtablissementDPE) >= 4 {
				diagYear = row.DateEtablissementDPE[:4]
			}

			bestMatch = &ADEMEDpeResult{
				Rating:         rating,
				SurfaceM2:      &surf,
				DiagnosticDate: &diagYear,
				SourceDataset:  dataset,
			}
		}
	}

	return bestMatch, nil
}
