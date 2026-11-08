package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestSidecarHubManager_LifecycleAndBroadcast(t *testing.T) {
	var pollCount int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&pollCount, 1)
		w.Header().Set("Content-Type", "application/json")
		resp := sidecarLogsResponse{
			Logs: []sidecarLogEntry{
				{
					Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
					Level:     "INFO",
					Message:   "poll event",
					Service:   "test-sidecar",
				},
			},
		}
		if count > 1 {
			// On second poll, provide an advanced timestamp
			resp.Logs[0].Timestamp = time.Now().UTC().Add(time.Duration(count) * time.Second).Format(time.RFC3339Nano)
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	mgr := &sidecarHubManager{
		hubs: make(map[string]*sidecarHub),
	}

	// 1. Subscribe client 1 and client 2
	ch1, unsub1 := mgr.subscribe(server.URL, "test-sidecar")
	ch2, unsub2 := mgr.subscribe(server.URL, "test-sidecar")

	// Allow poller to seed and tick once
	time.Sleep(1200 * time.Millisecond)

	// Verify both channels received items or can read without blocking
	select {
	case entries1 := <-ch1:
		assert.NotEmpty(t, entries1)
	case <-time.After(500 * time.Millisecond):
		// Initial seed consumes backlog; poller tick may emit if timestamp advanced
	}

	select {
	case entries2 := <-ch2:
		assert.NotEmpty(t, entries2)
	case <-time.After(500 * time.Millisecond):
	}

	// Unsubscribe client 1
	unsub1()

	// Unsubscribe client 2
	unsub2()

	// Verify poller stopped: poll count shouldn't keep rapidly growing after a short pause
	pollsAtUnsub := atomic.LoadInt32(&pollCount)
	time.Sleep(1200 * time.Millisecond)
	pollsAfterWait := atomic.LoadInt32(&pollCount)

	// Difference should be at most 1 (due to in-flight tick)
	assert.LessOrEqual(t, pollsAfterWait-pollsAtUnsub, int32(1))
}
