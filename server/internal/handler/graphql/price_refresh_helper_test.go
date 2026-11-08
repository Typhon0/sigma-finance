package graphql

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/service"
)

type mockMarketDataServiceForRefresh struct {
	callCount int32
	calledIDs sync.Map
}

func (m *mockMarketDataServiceForRefresh) UpdateAssetPrice(ctx context.Context, assetID uuid.UUID) (*service.AssetPriceData, error) {
	atomic.AddInt32(&m.callCount, 1)
	m.calledIDs.Store(assetID, true)
	return nil, nil
}

func TestPriceRefreshQueue_DeduplicationAndBatching(t *testing.T) {
	mockMD := &mockMarketDataServiceForRefresh{}
	q := &priceRefreshQueue{
		pending:      make(map[uuid.UUID]string),
		debounceDur:  50 * time.Millisecond,
		marketData:   mockMD,
		workerTokens: make(chan struct{}, 3),
	}

	id1 := uuid.New()
	id2 := uuid.New()

	// Enqueue id1 twice and id2 once rapidly
	q.enqueue(id1, "Asset 1")
	q.enqueue(id1, "Asset 1 duplicate")
	q.enqueue(id2, "Asset 2")

	// Wait for debounce flush
	time.Sleep(150 * time.Millisecond)

	// id1 should be deduplicated, so only 2 total calls
	assert.Equal(t, int32(2), atomic.LoadInt32(&mockMD.callCount))
	_, hasID1 := mockMD.calledIDs.Load(id1)
	_, hasID2 := mockMD.calledIDs.Load(id2)
	assert.True(t, hasID1)
	assert.True(t, hasID2)
}
