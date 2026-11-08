package service

import (
	"testing"
	"time"
)

// TestLogBufferSubscribersAreIndependent guards against watcher ID collisions.
// Subscriptions taken while the server was idle used to share the same ID, so
// unsubscribing the stale one closed the live stream's channel and the client
// looped through reconnect/disconnect.
func TestLogBufferSubscribersAreIndependent(t *testing.T) {
	lb := NewLogBuffer(10)

	first, unsubscribeFirst := lb.Subscribe()
	second, unsubscribeSecond := lb.Subscribe()
	defer unsubscribeSecond()

	unsubscribeFirst()

	select {
	case _, ok := <-first:
		if ok {
			t.Fatal("expected first subscriber channel to be closed")
		}
	case <-time.After(time.Second):
		t.Fatal("expected first subscriber channel to be closed")
	}

	lb.Append(LogEntry{Level: string(LogLevelInfo), Message: "still streaming", Service: "go-server"})

	select {
	case entries := <-second:
		if len(entries) != 1 || entries[0].Message != "still streaming" {
			t.Fatalf("unexpected entries: %+v", entries)
		}
	case <-time.After(time.Second):
		t.Fatal("second subscriber stopped receiving entries after another subscriber unsubscribed")
	}
}

func TestLogBufferSubscribeDeliversAppendedEntries(t *testing.T) {
	lb := NewLogBuffer(10)

	ch, unsubscribe := lb.Subscribe()
	defer unsubscribe()

	lb.Append(LogEntry{Level: string(LogLevelError), Message: "boom", Service: "go-server"})

	select {
	case entries := <-ch:
		if len(entries) != 1 || entries[0].Message != "boom" {
			t.Fatalf("unexpected entries: %+v", entries)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for appended entry")
	}
}
