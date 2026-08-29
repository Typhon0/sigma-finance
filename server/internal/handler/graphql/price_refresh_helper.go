package graphql

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"sigma_finance/internal/domain/model"
)

func (r *mutationResolver) triggerAssetPriceRefresh(asset *model.Asset) {
	if r == nil || r.MarketDataService == nil || asset == nil || !asset.IsTradeable {
		return
	}

	assetID, err := uuid.Parse(asset.ID)
	if err != nil {
		log.Printf("[WARN] [graphql] skipping async price refresh for asset %s: invalid uuid: %v", asset.ID, err)
		return
	}

	go func(id uuid.UUID, assetName string) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		if _, refreshErr := r.MarketDataService.UpdateAssetPrice(ctx, id); refreshErr != nil {
			log.Printf("[ERROR] [graphql] async price refresh failed for asset %s: %v", assetName, refreshErr)
		}
	}(assetID, asset.Name)
}
