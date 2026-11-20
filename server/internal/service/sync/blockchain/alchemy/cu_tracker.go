package alchemy

import (
	"context"
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/uptrace/bun"
	"sigma_finance/internal/domain/model"
)

const (
	DefaultMaxComputeUnits  int64   = 30_000_000 // 30M free monthly quota
	DefaultSoftLimitPercent float64 = 0.80       // 80% threshold = 24M CUs
)

func isNil(i interface{}) bool {
	if i == nil {
		return true
	}
	switch reflect.TypeOf(i).Kind() {
	case reflect.Ptr, reflect.Map, reflect.Array, reflect.Chan, reflect.Slice:
		return reflect.ValueOf(i).IsNil()
	}
	return false
}

// CUTracker tracks monthly Compute Unit usage and enforces the 80% soft limit
type CUTracker struct {
	mu            sync.RWMutex
	db            bun.IDB
	consumedUnits int64
	currentMonth  string
	maxUnits      int64
	softLimitPct  float64
	isThrottled   bool
}

// NewCUTracker creates a new Compute Unit tracker
func NewCUTracker(db bun.IDB) *CUTracker {
	now := time.Now().UTC()
	currentMonth := now.Format("2006-01")

	tracker := &CUTracker{
		db:           db,
		currentMonth: currentMonth,
		maxUnits:     DefaultMaxComputeUnits,
		softLimitPct: DefaultSoftLimitPercent,
	}

	if !isNil(db) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tracker.loadFromDB(ctx)
	}

	return tracker
}

func (t *CUTracker) loadFromDB(ctx context.Context) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	var record model.WalletCUTracking
	err := t.db.NewSelect().
		Model(&record).
		Where("billing_month = ?", t.currentMonth).
		Scan(ctx)
	if err == nil {
		t.consumedUnits = record.ComputeUnitsConsumed
		t.isThrottled = record.IsThrottled
	}
	return nil
}

// RecordConsumption records compute units consumed by an API call and checks soft throttle
func (t *CUTracker) RecordConsumption(ctx context.Context, units int64) (bool, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Check if month rolled over
	now := time.Now().UTC().Format("2006-01")
	if now != t.currentMonth {
		t.currentMonth = now
		t.consumedUnits = 0
		t.isThrottled = false
	}

	t.consumedUnits += units
	threshold := int64(float64(t.maxUnits) * t.softLimitPct)
	if t.consumedUnits >= threshold {
		t.isThrottled = true
	}

	if t.db != nil {
		_, err := t.db.NewInsert().
			Model(&model.WalletCUTracking{
				BillingMonth:         t.currentMonth,
				ComputeUnitsConsumed: t.consumedUnits,
				IsThrottled:          t.isThrottled,
				UpdatedAt:            time.Now().UTC(),
			}).
			On("CONFLICT (billing_month) DO UPDATE").
			Set("compute_units_consumed = EXCLUDED.compute_units_consumed").
			Set("is_throttled = EXCLUDED.is_throttled").
			Set("updated_at = EXCLUDED.updated_at").
			Exec(ctx)
		if err != nil {
			return t.isThrottled, fmt.Errorf("failed to persist CU consumption: %w", err)
		}
	}

	return t.isThrottled, nil
}

// IsThrottled returns true if the background polling soft limit has been reached
func (t *CUTracker) IsThrottled() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.isThrottled
}

// GetStatus returns the current monthly CU tracking stats
func (t *CUTracker) GetStatus() (string, int64, int64, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.currentMonth, t.consumedUnits, t.maxUnits, t.isThrottled
}
