package main

import "testing"

func yfinanceTestEntry(timestamp, message string) yfinanceLogEntry {
	return yfinanceLogEntry{
		Timestamp: timestamp,
		Level:     "INFO",
		Message:   message,
		Service:   "yfinance",
	}
}

func assertYFinanceMessages(t *testing.T, entries []yfinanceLogEntry, want ...string) {
	t.Helper()

	if len(entries) != len(want) {
		t.Fatalf("got %d entries %v, want %v", len(entries), entryMessages(entries), want)
	}
	for i, entry := range entries {
		if entry.Message != want[i] {
			t.Fatalf("got %v, want %v", entryMessages(entries), want)
		}
	}
}

func entryMessages(entries []yfinanceLogEntry) []string {
	messages := make([]string, len(entries))
	for i, entry := range entries {
		messages[i] = entry.Message
	}
	return messages
}

// TestYFinanceLogCursorDoesNotReplayBacklog guards the initial snapshot: the
// client already loaded it, so polling the same snapshot must emit nothing.
func TestYFinanceLogCursorDoesNotReplayBacklog(t *testing.T) {
	var cursor yfinanceLogCursor
	backlog := []yfinanceLogEntry{
		yfinanceTestEntry("2026-11-01T10:00:00.100000Z", "a"),
		yfinanceTestEntry("2026-11-01T10:00:01.200000Z", "b"),
	}
	cursor.Seed(backlog)

	assertYFinanceMessages(t, cursor.Advance(backlog))
	assertYFinanceMessages(t, cursor.Advance(backlog))
	assertYFinanceMessages(t,
		cursor.Advance(append(backlog, yfinanceTestEntry("2026-11-01T10:00:02.300000Z", "c"))),
		"c",
	)
}

// TestYFinanceLogCursorEmitsEntriesOnce covers repeated polls of an overlapping
// snapshot: each entry is emitted exactly once as it appears.
func TestYFinanceLogCursorEmitsEntriesOnce(t *testing.T) {
	var cursor yfinanceLogCursor
	cursor.Seed([]yfinanceLogEntry{yfinanceTestEntry("2026-11-01T10:00:00.100000Z", "a")})

	snapshot := []yfinanceLogEntry{
		yfinanceTestEntry("2026-11-01T10:00:00.100000Z", "a"),
		yfinanceTestEntry("2026-11-01T10:00:01.200000Z", "b"),
		yfinanceTestEntry("2026-11-01T10:00:02.300000Z", "c"),
	}
	assertYFinanceMessages(t, cursor.Advance(snapshot), "b", "c")
	assertYFinanceMessages(t, cursor.Advance(snapshot))
	assertYFinanceMessages(t,
		cursor.Advance(append(snapshot, yfinanceTestEntry("2026-11-01T10:00:03.400000Z", "d"))),
		"d",
	)
}

// TestYFinanceLogCursorSeedsAfterInitialFailure guards the recovery path: when
// the first fetch fails, the first successful snapshot seeds the cursor instead
// of streaming the entire ring buffer.
func TestYFinanceLogCursorSeedsAfterInitialFailure(t *testing.T) {
	var cursor yfinanceLogCursor // no Seed: the initial fetch failed

	recovered := []yfinanceLogEntry{
		yfinanceTestEntry("2026-11-01T10:00:00.100000Z", "a"),
		yfinanceTestEntry("2026-11-01T10:00:01.200000Z", "b"),
	}
	assertYFinanceMessages(t, cursor.Advance(recovered))
	assertYFinanceMessages(t, cursor.Advance(recovered))
	assertYFinanceMessages(t,
		cursor.Advance(append(recovered, yfinanceTestEntry("2026-11-01T10:00:02.300000Z", "c"))),
		"c",
	)
}

func TestYFinanceLogCursorSkipsOlderAndEqualTimestamps(t *testing.T) {
	var cursor yfinanceLogCursor
	cursor.Seed([]yfinanceLogEntry{yfinanceTestEntry("2026-11-01T10:00:05.000000Z", "head")})

	snapshot := []yfinanceLogEntry{
		yfinanceTestEntry("2026-11-01T10:00:03.000000Z", "older"),
		yfinanceTestEntry("2026-11-01T10:00:05.000000Z", "equal"),
		yfinanceTestEntry("2026-11-01T10:00:06.000000Z", "newer"),
	}
	assertYFinanceMessages(t, cursor.Advance(snapshot), "newer")
}

// Python's datetime.isoformat() omits the fractional part when it is zero, so
// the cursor must compare mixed precision timestamps correctly.
func TestYFinanceLogCursorComparesMixedTimestampPrecision(t *testing.T) {
	var cursor yfinanceLogCursor
	cursor.Seed([]yfinanceLogEntry{yfinanceTestEntry("2026-11-01T10:00:00Z", "a")})

	assertYFinanceMessages(t,
		cursor.Advance([]yfinanceLogEntry{yfinanceTestEntry("2026-11-01T10:00:00.500000Z", "b")}),
		"b",
	)
	assertYFinanceMessages(t,
		cursor.Advance([]yfinanceLogEntry{yfinanceTestEntry("2026-11-01T10:00:00Z", "stale")}),
	)
}

func TestYFinanceLogCursorHandlesEmptyInitialBuffer(t *testing.T) {
	var cursor yfinanceLogCursor
	cursor.Seed(nil)

	assertYFinanceMessages(t,
		cursor.Advance([]yfinanceLogEntry{yfinanceTestEntry("2026-11-01T10:00:00.100000Z", "a")}),
		"a",
	)
}

func TestSidecarLogCursor_WoobService(t *testing.T) {
	var cursor sidecarLogCursor
	cursor.Seed([]sidecarLogEntry{
		{
			Timestamp: "2026-11-04T10:54:49.000000Z",
			Level:     "INFO",
			Message:   "Woob request access token",
			Service:   "woob",
		},
	})

	fresh := cursor.Advance([]sidecarLogEntry{
		{
			Timestamp: "2026-11-04T10:54:49.000000Z",
			Level:     "INFO",
			Message:   "Woob request access token",
			Service:   "woob",
		},
		{
			Timestamp: "2026-11-04T10:54:52.000000Z",
			Level:     "INFO",
			Message:   "Woob discovered 2 accounts",
			Service:   "woob",
		},
	})

	if len(fresh) != 1 {
		t.Fatalf("expected 1 fresh entry, got %d", len(fresh))
	}
	if fresh[0].Message != "Woob discovered 2 accounts" {
		t.Fatalf("unexpected message: %s", fresh[0].Message)
	}
	if fresh[0].Service != "woob" {
		t.Fatalf("unexpected service: %s", fresh[0].Service)
	}
}

func TestGetRegisteredSidecars(t *testing.T) {
	sidecars := getRegisteredSidecars()
	if len(sidecars) < 2 {
		t.Fatalf("expected at least 2 sidecars registered, got %d", len(sidecars))
	}

	foundYF := false
	foundWoob := false
	for _, sc := range sidecars {
		if sc.ID == "yfinance" {
			foundYF = true
			if sc.Type != "sidecar" {
				t.Errorf("yfinance type should be sidecar, got %s", sc.Type)
			}
		}
		if sc.ID == "woob" {
			foundWoob = true
			if sc.Type != "sidecar" {
				t.Errorf("woob type should be sidecar, got %s", sc.Type)
			}
		}
	}

	if !foundYF || !foundWoob {
		t.Errorf("expected both yfinance and woob registered, foundYF=%v foundWoob=%v", foundYF, foundWoob)
	}
}
