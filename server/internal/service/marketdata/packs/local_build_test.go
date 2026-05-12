package packs

import (
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/providers"
)

func TestResolveLocalBuildRateLimitsLowersProviderLimit(t *testing.T) {
	reqPerMinute := 50
	reqPerDay := 1000
	input := StartLocalPackBuildInput{
		RequestsPerMinute: &reqPerMinute,
		RequestsPerDay:    &reqPerDay,
	}
	limit := resolveLocalBuildRateLimits(input, providers.RateLimit{
		RequestsPerMinute: 200,
		RequestsPerDay:    10000,
	})
	if limit.RequestsPerMinute != 50 {
		t.Fatalf("expected 50 req/min, got %d", limit.RequestsPerMinute)
	}
	if limit.RequestsPerDay != 1000 {
		t.Fatalf("expected 1000 req/day, got %d", limit.RequestsPerDay)
	}
}

func TestBuildLocalPackIDDefault(t *testing.T) {
	id := buildLocalPackID("TIINGO", nil)
	if !strings.HasPrefix(id, "local-tiingo-daily-") {
		t.Fatalf("unexpected pack id %s", id)
	}
}

func TestLocalBuildManifestFlags(t *testing.T) {
	svc := &packService{}
	job := &model.MarketDataPackBuildJob{
		PackID:         "local-tiingo-daily-test",
		SourceProvider: "TIINGO",
	}
	manifest := svc.localBuildManifest(job, localBuildConfig{AssetTypes: []string{"STOCK"}}, time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2020, 1, 31, 0, 0, 0, 0, time.UTC))
	if manifest.Distribution != "local" {
		t.Fatalf("expected local distribution")
	}
	if manifest.InstallMode != "build_local" {
		t.Fatalf("expected build_local install mode")
	}
	if !manifest.GeneratedByUser {
		t.Fatalf("expected generated_by_user=true")
	}
	if !manifest.UploadForbidden {
		t.Fatalf("expected upload_forbidden=true")
	}
	if manifest.RedistributionAllowed {
		t.Fatalf("expected redistribution_allowed=false")
	}
}
