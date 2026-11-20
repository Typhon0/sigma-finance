package realestate

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/uptrace/bun"
	"golang.org/x/sync/singleflight"
)

// DVFClient queries Cerema DVF+ Open Data with local caching and singleflight deduplication
type DVFClient struct {
	httpClient *http.Client
	db         *bun.DB
	sf         singleflight.Group
}

// NewDVFClient creates a new DVF client with a 4-second timeout and local Bun cache
func NewDVFClient(db *bun.DB) *DVFClient {
	return &DVFClient{
		httpClient: &http.Client{
			Timeout: 4 * time.Second,
		},
		db: db,
	}
}

// FetchMutations retrieves mutations for a given city and property type, utilizing the local 30-day cache
func (c *DVFClient) FetchMutations(ctx context.Context, cityCode string, propertyType string, minYear int) ([]DVFMutation, error) {
	cityCode = strings.TrimSpace(cityCode)
	if cityCode == "" {
		return nil, fmt.Errorf("cityCode is empty")
	}

	normPropType := "APARTMENT"
	codtypbien := "121"
	if strings.EqualFold(propertyType, "House") || strings.EqualFold(propertyType, "HOUSE") {
		normPropType = "HOUSE"
		codtypbien = "111"
	}

	// 1. Check local cache: expires_at > NOW() AND min_year <= minYear
	now := time.Now()
	var cacheRec DVFCommuneCacheRecord
	err := c.db.NewSelect().
		Table("sigma_finance.dvf_commune_cache").
		Where("city_code = ? AND property_type = ? AND expires_at > ? AND min_year <= ?", cityCode, normPropType, now, minYear).
		Scan(ctx, &cacheRec)

	if err == nil && len(cacheRec.Mutations) > 0 {
		return cacheRec.Mutations, nil
	}

	// 2. Singleflight deduplication for external HTTP calls
	sfKey := fmt.Sprintf("%s:%s:%d", cityCode, normPropType, minYear)
	result, sfErr, _ := c.sf.Do(sfKey, func() (interface{}, error) {
		mutations, fetchErr := c.fetchFromCerema(ctx, cityCode, codtypbien, minYear)
		if fetchErr != nil {
			return nil, fetchErr
		}

		// Store in cache with 30-day TTL
		expiresAt := now.Add(30 * 24 * time.Hour)
		record := DVFCommuneCacheRecord{
			CityCode:     cityCode,
			PropertyType: normPropType,
			MinYear:      minYear,
			Mutations:    mutations,
			CachedAt:     now,
			ExpiresAt:    expiresAt,
		}

		_, insertErr := c.db.NewInsert().
			Table("sigma_finance.dvf_commune_cache").
			Model(&record).
			On("CONFLICT (city_code, property_type) DO UPDATE").
			Set("min_year = EXCLUDED.min_year").
			Set("mutations = EXCLUDED.mutations").
			Set("cached_at = EXCLUDED.cached_at").
			Set("expires_at = EXCLUDED.expires_at").
			Exec(ctx)

		if insertErr != nil {
			log.Printf("[WARN] [dvf_client] failed to save dvf_commune_cache for %s: %v", cityCode, insertErr)
		}

		return mutations, nil
	})

	if sfErr != nil {
		return nil, sfErr
	}

	return result.([]DVFMutation), nil
}

// FetchMutationsBbox queries Cerema using a 2.5km bounding box around (lat, lon) for border cases
func (c *DVFClient) FetchMutationsBbox(ctx context.Context, lat, lon float64, propertyType string, minYear int) ([]DVFMutation, error) {
	if lat == 0 && lon == 0 {
		return nil, nil
	}

	codtypbien := "121"
	if strings.EqualFold(propertyType, "House") || strings.EqualFold(propertyType, "HOUSE") {
		codtypbien = "111"
	}

	// Calculate 2.5km delta
	const deltaKm = 2.5
	dLat := deltaKm / 111.32
	dLon := deltaKm / (111.32 * math.Cos(lat*math.Pi/180.0))

	lonMin := lon - dLon
	latMin := lat - dLat
	lonMax := lon + dLon
	latMax := lat + dLat

	bboxStr := fmt.Sprintf("%.5f,%.5f,%.5f,%.5f", lonMin, latMin, lonMax, latMax)
	endpoint := fmt.Sprintf(
		"https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/?in_bbox=%s&codtypbien=%s&anneemut_min=%d&page_size=500",
		url.QueryEscape(bboxStr),
		codtypbien,
		minYear,
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
		return nil, fmt.Errorf("cerema bbox returned status %d", resp.StatusCode)
	}

	var raw map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	return c.parseCeremaResponse(raw), nil
}

func (c *DVFClient) fetchFromCerema(ctx context.Context, cityCode, codtypbien string, minYear int) ([]DVFMutation, error) {
	endpoint := fmt.Sprintf(
		"https://apidf-preprod.cerema.fr/dvf_opendata/mutations/?code_insee=%s&codtypbien=%s&anneemut_min=%d&page_size=500",
		cityCode,
		codtypbien,
		minYear,
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
		return nil, fmt.Errorf("cerema returned status %d", resp.StatusCode)
	}

	var raw map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	return c.parseCeremaResponse(raw), nil
}

func (c *DVFClient) parseCeremaResponse(raw map[string]interface{}) []DVFMutation {
	var items []interface{}

	if results, ok := raw["results"].([]interface{}); ok {
		items = results
	} else if features, ok := raw["features"].([]interface{}); ok {
		items = features
	} else if resObj, ok := raw["results"].(map[string]interface{}); ok {
		if feats, ok := resObj["features"].([]interface{}); ok {
			items = feats
		}
	}

	mutations := make([]DVFMutation, 0, len(items))

	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		props := itemMap
		if p, hasProps := itemMap["properties"].(map[string]interface{}); hasProps {
			props = p
		}

		// Parse mutation id
		idMut := fmt.Sprintf("%v", props["idmutation"])
		if idMut == "" || idMut == "<nil>" {
			idMut = fmt.Sprintf("%v", props["id"])
		}

		// Parse date
		dateStr := fmt.Sprintf("%v", props["datemut"])
		dateMut, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		// Parse value
		valeurFonc := parseFloat(props["valeurfonc"])
		sbati := parseFloat(props["sbati"])
		if sbati <= 0 || valeurFonc <= 0 {
			continue
		}

		// Parse codtypbien
		codeType := strings.TrimSpace(fmt.Sprintf("%v", props["codtypbien"]))

		// Parse nature
		libNat := strings.TrimSpace(fmt.Sprintf("%v", props["libnatmut"]))

		// Parse VEFA
		vefa := false
		if v, ok := props["vefa"].(bool); ok {
			vefa = v
		} else if vStr, ok := props["vefa"].(string); ok {
			vefa = strings.EqualFold(vStr, "true") || vStr == "1"
		}

		// Parse single lot restriction
		nbApt := parseInt(props["nblocapt"])
		nbMai := parseInt(props["nblocmai"])
		if strings.HasPrefix(codeType, "121") && nbApt > 1 {
			continue // exclude block sale of apartments
		}
		if strings.HasPrefix(codeType, "111") && nbMai > 1 {
			continue // exclude block sale of houses
		}

		// Parse coordinates
		lat, lon := extractCoordinates(itemMap, props)

		var sterr *float64
		if sVal := parseFloat(props["sterr"]); sVal > 0 {
			sterr = &sVal
		}

		mutations = append(mutations, DVFMutation{
			IDMutation: idMut,
			DateMut:    dateMut,
			ValeurFonc: valeurFonc,
			SBati:      sbati,
			STerr:      sterr,
			CodTypBien: codeType,
			LibNatMut:  libNat,
			VEFA:       vefa,
			Latitude:   lat,
			Longitude:  lon,
		})
	}

	return mutations
}

func extractCoordinates(itemMap, props map[string]interface{}) (lat, lon float64) {
	// Try props lat/lon directly
	if latVal := parseFloat(props["lat"]); latVal != 0 {
		lat = latVal
	} else if latVal := parseFloat(props["latitude"]); latVal != 0 {
		lat = latVal
	}
	if lonVal := parseFloat(props["lon"]); lonVal != 0 {
		lon = lonVal
	} else if lonVal := parseFloat(props["longitude"]); lonVal != 0 {
		lon = lonVal
	}

	if lat != 0 && lon != 0 {
		return lat, lon
	}

	// Try GeoJSON geometry [lon, lat]
	if geom, ok := itemMap["geometry"].(map[string]interface{}); ok {
		if coords, ok := geom["coordinates"].([]interface{}); ok && len(coords) >= 2 {
			lon = parseFloat(coords[0])
			lat = parseFloat(coords[1])
			return lat, lon
		}
	}

	return lat, lon
}

func parseFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		clean := strings.TrimSpace(strings.Replace(val, ",", ".", -1))
		f, _ := strconv.ParseFloat(clean, 64)
		return f
	}
	return 0
}

func parseInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(val))
		return i
	}
	return 0
}
