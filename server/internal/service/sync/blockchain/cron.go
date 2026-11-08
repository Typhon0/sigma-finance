package blockchain

import (
	"context"
	"log"
	"sync"
	"time"
)

// ThrottleChecker defines the contract for checking if monthly quota is throttled
type ThrottleChecker interface {
	IsThrottled() bool
	GetStatus() (string, int64, int64, bool)
}

// BackgroundSyncWorker manages periodic background sync
type BackgroundSyncWorker struct {
	syncService IWalletSyncService
	throttler   ThrottleChecker
	interval    time.Duration
	stopChan    chan struct{}
	stopOnce    sync.Once
}

// NewBackgroundSyncWorker creates a new 12-hour background sync worker
func NewBackgroundSyncWorker(syncService IWalletSyncService, throttler ThrottleChecker) *BackgroundSyncWorker {
	return &BackgroundSyncWorker{
		syncService: syncService,
		throttler:   throttler,
		interval:    12 * time.Hour,
		stopChan:    make(chan struct{}),
	}
}

// Start launches the background worker loop
func (w *BackgroundSyncWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-w.stopChan:
				return
			case <-ticker.C:
				w.executePeriodicSync(ctx)
			}
		}
	}()
}

// Stop terminates the worker safely without panicking on multiple calls
func (w *BackgroundSyncWorker) Stop() {
	w.stopOnce.Do(func() {
		close(w.stopChan)
	})
}

func (w *BackgroundSyncWorker) executePeriodicSync(ctx context.Context) {
	// Enforce 80% soft throttle safety rule
	if w.throttler != nil && w.throttler.IsThrottled() {
		month, consumed, maxUnits, _ := w.throttler.GetStatus()
		log.Printf("[WARN] [BackgroundSyncWorker] Periodic sync skipped for %s: soft limit reached (%d / %d CUs)", month, consumed, maxUnits)
		return
	}

	log.Println("[INFO] [BackgroundSyncWorker] Starting 12-hour scheduled wallet synchronization...")
	syncCtx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()

	if err := w.syncService.SyncAllActiveWallets(syncCtx); err != nil {
		log.Printf("[ERROR] [BackgroundSyncWorker] Scheduled wallet sync encountered error: %v", err)
	} else {
		log.Println("[INFO] [BackgroundSyncWorker] Scheduled wallet synchronization completed successfully")
	}
}
