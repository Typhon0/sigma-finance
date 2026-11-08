package blockchain

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestBackgroundSyncWorker_StopMultipleTimes(t *testing.T) {
	worker := NewBackgroundSyncWorker(nil, nil)
	worker.interval = 50 * time.Millisecond

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	worker.Start(ctx)

	// Call Stop multiple times; it must not panic
	assert.NotPanics(t, func() {
		worker.Stop()
		worker.Stop()
		worker.Stop()
	})
}
