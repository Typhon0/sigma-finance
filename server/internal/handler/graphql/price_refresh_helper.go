package graphql

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service"
)

type assetPriceUpdater interface {
	UpdateAssetPrice(ctx context.Context, assetID uuid.UUID) (*service.AssetPriceData, error)
}

type priceRefreshQueue struct {
	mu           sync.Mutex
	pending      map[uuid.UUID]string
	timer        *time.Timer
	debounceDur  time.Duration
	marketData   assetPriceUpdater
	workerTokens chan struct{}
}

var (
	defaultPriceRefreshQueue *priceRefreshQueue
	queueOnce                sync.Once
)

func getPriceRefreshQueue(md assetPriceUpdater) *priceRefreshQueue {
	queueOnce.Do(func() {
		defaultPriceRefreshQueue = &priceRefreshQueue{
			pending:      make(map[uuid.UUID]string),
			debounceDur:  500 * time.Millisecond,
			marketData:   md,
			workerTokens: make(chan struct{}, 3), // max 3 concurrent workers
		}
	})
	if defaultPriceRefreshQueue.marketData == nil && md != nil {
		defaultPriceRefreshQueue.marketData = md
	}
	return defaultPriceRefreshQueue
}

func (q *priceRefreshQueue) enqueue(id uuid.UUID, name string) {
	q.mu.Lock()
	defer q.mu.Unlock()

	q.pending[id] = name

	if q.timer != nil {
		q.timer.Stop()
	}
	q.timer = time.AfterFunc(q.debounceDur, q.flush)
}

func (q *priceRefreshQueue) flush() {
	q.mu.Lock()
	if len(q.pending) == 0 {
		q.mu.Unlock()
		return
	}
	batch := q.pending
	q.pending = make(map[uuid.UUID]string)
	md := q.marketData
	q.mu.Unlock()

	if md == nil {
		return
	}

	for id, name := range batch {
		q.workerTokens <- struct{}{}
		go func(assetID uuid.UUID, assetName string) {
			defer func() { <-q.workerTokens }()

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()

			if _, refreshErr := md.UpdateAssetPrice(ctx, assetID); refreshErr != nil {
				log.Printf("[ERROR] [graphql] async price refresh failed for asset %s: %v", assetName, refreshErr)
			}
		}(id, name)
	}
}

func (r *mutationResolver) triggerAssetPriceRefresh(asset *model.Asset) {
	if r == nil || r.MarketDataService == nil || asset == nil || !asset.IsTradeable {
		return
	}

	assetID, err := uuid.Parse(asset.ID)
	if err != nil {
		log.Printf("[WARN] [graphql] skipping async price refresh for asset %s: invalid uuid: %v", asset.ID, err)
		return
	}

	q := getPriceRefreshQueue(r.MarketDataService)
	q.enqueue(assetID, asset.Name)
}
