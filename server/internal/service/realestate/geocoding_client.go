package realestate

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GeocodingClient provides server-side geocoding via IGN BAN Geoplateforme
type GeocodingClient struct {
	httpClient *http.Client
}

// NewGeocodingClient creates a new geocoding client with a 4-second timeout
func NewGeocodingClient() *GeocodingClient {
	return &GeocodingClient{
		httpClient: &http.Client{
			Timeout: 4 * time.Second,
		},
	}
}

// GeocodedLocation holds extracted geocoding data
type GeocodedLocation struct {
	Label     string
	CityCode  string
	BANID     string
	Postcode  string
	City      string
	Latitude  float64
	Longitude float64
}

type banSearchResponse struct {
	Features []struct {
		Geometry struct {
			Coordinates []float64 `json:"coordinates"` // [lon, lat]
		} `json:"geometry"`
		Properties struct {
			ID       string `json:"id"`
			CityCode string `json:"citycode"`
			Postcode string `json:"postcode"`
			City     string `json:"city"`
			Label    string `json:"label"`
		} `json:"properties"`
	} `json:"features"`
}

// GeocodeAddress queries IGN BAN to resolve coordinates and city code
func (c *GeocodingClient) GeocodeAddress(ctx context.Context, addressQuery string) (*GeocodedLocation, error) {
	addressQuery = strings.TrimSpace(addressQuery)
	if addressQuery == "" {
		return nil, nil
	}

	endpoint := fmt.Sprintf("https://data.geopf.fr/geocodage/search/?q=%s&limit=1", url.QueryEscape(addressQuery))
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
		return nil, fmt.Errorf("ban geocode returned status %d", resp.StatusCode)
	}

	var data banSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	if len(data.Features) == 0 {
		return nil, nil
	}

	f := data.Features[0]
	loc := &GeocodedLocation{
		Label:    f.Properties.Label,
		CityCode: f.Properties.CityCode,
		BANID:    f.Properties.ID,
		Postcode: f.Properties.Postcode,
		City:     f.Properties.City,
	}

	if len(f.Geometry.Coordinates) >= 2 {
		loc.Longitude = f.Geometry.Coordinates[0]
		loc.Latitude = f.Geometry.Coordinates[1]
	}

	return loc, nil
}
