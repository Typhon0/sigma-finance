package adapters

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestKrakenLedgerPageWait(t *testing.T) {
	// Kraken caps the private counter at 20 and decays it 0.5/s while Ledgers
	// costs 4, so the first pages of a run need no pause and later pages must
	// wait for the counter to come down instead of tripping ErrRateLimited.
	t.Run("no pause while the counter has room", func(t *testing.T) {
		assert.Zero(t, krakenLedgerPageWait(3))
		assert.Zero(t, krakenLedgerPageWait(16))
	})

	t.Run("pause grows as the counter saturates", func(t *testing.T) {
		// 19 + 4 = 23 is 3 over the cap: 3 / 0.5 per second, plus one second of margin.
		assert.Equal(t, 7*time.Second, krakenLedgerPageWait(19))
		assert.Equal(t, 9*time.Second, krakenLedgerPageWait(krakenPrivateCounterLimit))
	})
}
