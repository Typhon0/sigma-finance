package traderepublic

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func TestProtocol_HandshakeAndSubscription(t *testing.T) {
	handshakeReceived := make(chan string, 1)

	// Start mock WebSocket server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		// Read handshake: expected "connect 31 {clientInfo}"
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}
		handshakeReceived <- string(msg)

		if strings.HasPrefix(string(msg), "connect 31 ") {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))
		} else {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("error"))
			return
		}

		// Read subscription
		_, msg, err = conn.ReadMessage()
		if err != nil {
			return
		}

		text := string(msg)
		if strings.HasPrefix(text, "sub 1 ") {
			// Send response: "1 A {"status":"ok"}"
			_ = conn.WriteMessage(websocket.TextMessage, []byte(`1 A {"status":"ok"}`))
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	customInfo := ClientInfo{
		Locale:          "de",
		PlatformID:      "webtrading",
		PlatformVersion: "chrome - 131.0.0",
		ClientID:        "app.traderepublic.com",
		ClientVersion:   "7000",
	}

	client := NewWSClient(wsURL, nil, WithClientInfo(customInfo), WithEchoInterval(0))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Close()

	// Verify handshake payload format: "connect 31 {clientInfo}"
	received := <-handshakeReceived
	assert.True(t, strings.HasPrefix(received, "connect 31 {"), "Handshake must be 'connect 31 {clientInfo}'")
	assert.Contains(t, received, `"locale":"de"`)

	var result struct {
		Status string `json:"status"`
	}
	err = client.FetchOne(ctx, map[string]string{"type": "test"}, &result)
	require.NoError(t, err)
	assert.Equal(t, "ok", result.Status)
}

func TestProtocol_ApplyDelta_UnitTests(t *testing.T) {
	// 1. Basic insertion and copy
	// prev: "hello world"
	// copy 5 ("hello"), insert " beautiful", copy 6 (" world")
	// delta: "=5\t+ beautiful\t=6"
	prev := "hello world"
	delta := "=5\t+%20beautiful\t=6"
	res, err := ApplyDelta(prev, delta)
	require.NoError(t, err)
	assert.Equal(t, "hello beautiful world", res)

	// 2. Deletion / skipping
	// prev: "hello beautiful world"
	// copy 6 ("hello "), skip 10 ("beautiful "), copy 5 ("world")
	// delta: "=6\t-10\t=5"
	prev2 := "hello beautiful world"
	delta2 := "=6\t-10\t=5"
	res2, err := ApplyDelta(prev2, delta2)
	require.NoError(t, err)
	assert.Equal(t, "hello world", res2)

	// 3. Trade Republic price tick delta fixture
	// Initial JSON: {"company":"Apple","price":150.00,"volume":1000}
	// Patch price to 155.50
	prevJSON := `{"company":"Apple","price":150.00,"volume":1000}`
	// Copy up to "price": (27 bytes: `{"company":"Apple","price":`)
	// Skip 6 bytes (`150.00`)
	// Insert `155.50`
	// Copy remaining 15 bytes (`,"volume":1000}`)
	deltaJSON := "=27\t-6\t+155.50\t=15"
	resJSON, err := ApplyDelta(prevJSON, deltaJSON)
	require.NoError(t, err)
	assert.Equal(t, `{"company":"Apple","price":155.50,"volume":1000}`, resJSON)

	// 4. Error on copy exceeding previous length
	_, err = ApplyDelta("short", "=100")
	assert.Error(t, err)

	// 5. Error on unknown operator
	_, err = ApplyDelta("short", "*5")
	assert.Error(t, err)
}

func TestProtocol_DeltaReconstruction_OverWebSocket(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31 {clientInfo}
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		_, _, _ = conn.ReadMessage() // sub 1

		// Send initial Answer
		initialJSON := `{"company":"Apple","price":150.00}`
		_ = conn.WriteMessage(websocket.TextMessage, []byte("1 A "+initialJSON))
		time.Sleep(20 * time.Millisecond)

		// Send character-delta updating 150.00 to 155.00:
		// len(`{"company":"Apple","price":`) = 27
		// skip 6 (`150.00`)
		// insert `155.00`
		// copy 1 (`}`)
		delta := "=27\t-6\t+155.00\t=1"
		_ = conn.WriteMessage(websocket.TextMessage, []byte("1 D "+delta))
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client := NewWSClient(wsURL, nil, WithEchoInterval(0))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Close()

	subID, frames, err := client.Subscribe(ctx, map[string]string{"type": "ticker"})
	require.NoError(t, err)
	defer client.Unsubscribe(subID)

	// First frame is Answer
	frame1 := <-frames
	assert.Equal(t, FrameAnswer, frame1.Type)
	var state1 map[string]interface{}
	_ = json.Unmarshal(frame1.Payload, &state1)
	assert.Equal(t, "Apple", state1["company"])
	assert.Equal(t, float64(150), state1["price"])

	// Second frame is reconstructed Delta
	frame2 := <-frames
	assert.Equal(t, FrameDelta, frame2.Type)
	var state2 map[string]interface{}
	_ = json.Unmarshal(frame2.Payload, &state2)
	assert.Equal(t, "Apple", state2["company"], "Delta must retain untouched properties from previous Answer")
	assert.Equal(t, float64(155), state2["price"], "Delta must update patched properties via character-delta")
}

func TestProtocol_ClientInitiatedEcho(t *testing.T) {
	echoReceived := make(chan int64, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31 {clientInfo}
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		// Read client-initiated echo
		_, msg, err := conn.ReadMessage()
		if err == nil {
			text := string(msg)
			if strings.HasPrefix(text, "echo ") {
				tsStr := strings.TrimPrefix(text, "echo ")
				if ts, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
					echoReceived <- ts
					// Echo back the same timestamp
					_ = conn.WriteMessage(websocket.TextMessage, msg)
				}
			}
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client := NewWSClient(wsURL, nil, WithEchoInterval(50*time.Millisecond))
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := client.Connect(ctx)
	require.NoError(t, err)
	defer client.Close()

	select {
	case ts := <-echoReceived:
		assert.Greater(t, ts, int64(0), "Client must send client-initiated echo with timestamp")
	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for client-initiated echo frame")
	}
}
