package traderepublic

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

var (
	// ErrConnectionPreempted indicates WebSocket closed with code 3003 (another connection registered).
	ErrConnectionPreempted = errors.New("trade republic connection preempted by newer session (close code 3003)")

	// ErrProtocolError indicates unexpected or malformed frame from Trade Republic.
	ErrProtocolError = errors.New("trade republic protocol error")

	// ErrSubscriptionTimeout indicates waiting for answer/delta timed out.
	ErrSubscriptionTimeout = errors.New("timeout waiting for trade republic response")

	// ErrSubscriptionFailed indicates Trade Republic returned an 'E' frame.
	ErrSubscriptionFailed = errors.New("trade republic subscription rejected")

	// ErrEchoTimeout indicates server did not respond to echo keepalive in time.
	ErrEchoTimeout = errors.New("trade republic echo keepalive response timeout")
)

const (
	DefaultWSEndpoint   = "wss://api.traderepublic.com"
	ProtocolVersion31   = 31
	DefaultEchoInterval = 15 * time.Second
	DefaultEchoTimeout  = 10 * time.Second
	DefaultReadTimeout  = 45 * time.Second
)

// ClientInfo encapsulates the client metadata sent in the 'connect 31 {clientInfo}' handshake.
type ClientInfo struct {
	Locale          string `json:"locale"`
	PlatformID      string `json:"platformId"`
	PlatformVersion string `json:"platformVersion"`
	ClientID        string `json:"clientId"`
	ClientVersion   string `json:"clientVersion"`
}

// DefaultClientInfo returns standard browser-like client metadata.
func DefaultClientInfo() ClientInfo {
	return ClientInfo{
		Locale:          "en",
		PlatformID:      "webtrading",
		PlatformVersion: "chrome - 131.0.0",
		ClientID:        "app.traderepublic.com",
		ClientVersion:   "7000",
	}
}

// WSFrameType represents the message type indicator in Trade Republic's text wire protocol.
type WSFrameType string

const (
	FrameAnswer     WSFrameType = "A"
	FrameDelta      WSFrameType = "D"
	FrameCompletion WSFrameType = "C"
	FrameError      WSFrameType = "E"
)

// IncomingFrame holds a parsed message from the Trade Republic WebSocket.
type IncomingFrame struct {
	SubscriptionID int
	Type           WSFrameType
	Payload        json.RawMessage
	RawText        string
}

// WSClientOption configures optional parameters on WSClient.
type WSClientOption func(*WSClient)

// WithClientInfo overrides the client info JSON sent during handshake.
func WithClientInfo(info ClientInfo) WSClientOption {
	return func(c *WSClient) {
		c.clientInfo = info
	}
}

// WithProtocolVersion overrides the protocol version integer.
func WithProtocolVersion(v int) WSClientOption {
	return func(c *WSClient) {
		c.protocolVersion = v
	}
}

// WithEchoInterval overrides the client-initiated echo tick frequency.
func WithEchoInterval(interval time.Duration) WSClientOption {
	return func(c *WSClient) {
		c.echoInterval = interval
	}
}

// WSClient manages a context-aware text-over-WebSocket session with Trade Republic.
type WSClient struct {
	endpoint        string
	cookies         []*http.Cookie
	clientInfo      ClientInfo
	protocolVersion int
	echoInterval    time.Duration
	echoTimeout     time.Duration

	conn   *websocket.Conn
	connMu sync.Mutex

	subIDCounter int64

	subsMu sync.RWMutex
	subs   map[int]*wsSubscription

	// cachedPayloads stores the last known raw string payload for character-delta reconstruction
	statesMu       sync.RWMutex
	cachedPayloads map[int]string

	echoMu       sync.Mutex
	lastEchoSent int64
	echoAckChan  chan int64

	closed    chan struct{}
	closeOnce sync.Once
	err       error
}

type wsSubscription struct {
	id     int
	frames chan IncomingFrame
	done   chan struct{}
}

// NewWSClient creates an unstarted Trade Republic WebSocket client.
func NewWSClient(endpoint string, cookies []*http.Cookie, opts ...WSClientOption) *WSClient {
	if endpoint == "" {
		endpoint = DefaultWSEndpoint
	}
	c := &WSClient{
		endpoint:        endpoint,
		cookies:         cookies,
		clientInfo:      DefaultClientInfo(),
		protocolVersion: ProtocolVersion31,
		echoInterval:    DefaultEchoInterval,
		echoTimeout:     DefaultEchoTimeout,
		subs:            make(map[int]*wsSubscription),
		cachedPayloads:  make(map[int]string),
		echoAckChan:     make(chan int64, 4),
		closed:          make(chan struct{}),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Connect establishes the WebSocket connection, performs the handshake, and launches the single read loop.
func (c *WSClient) Connect(ctx context.Context) error {
	header := make(http.Header)
	header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
	header.Set("Origin", "https://app.traderepublic.com")

	var cookieStrings []string
	for _, cookie := range c.cookies {
		if cookie != nil && cookie.Name != "" {
			cookieStrings = append(cookieStrings, fmt.Sprintf("%s=%s", cookie.Name, cookie.Value))
		}
	}
	if len(cookieStrings) > 0 {
		cookieHeaderVal := strings.Join(cookieStrings, "; ")
		header.Set("Cookie", cookieHeaderVal)
		log.Printf("[DEBUG] [traderepublic.ws] WebSocket dial Cookie header: %s", cookieHeaderVal)
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 15 * time.Second,
	}

	conn, resp, err := dialer.DialContext(ctx, c.endpoint, header)
	if err != nil {
		if resp != nil {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("websocket dial failed (status %d): %s: %w", resp.StatusCode, string(body), err)
		}
		return fmt.Errorf("websocket dial failed: %w", err)
	}
	c.conn = conn

	// Initial handshake frame: "connect 31 {clientInfo}"
	clientInfoJSON, err := json.Marshal(c.clientInfo)
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("failed to marshal client info: %w", err)
	}
	handshakeCmd := fmt.Sprintf("connect %d %s", c.protocolVersion, string(clientInfoJSON))

	if err := c.conn.WriteMessage(websocket.TextMessage, []byte(handshakeCmd)); err != nil {
		_ = conn.Close()
		return fmt.Errorf("failed to send handshake %q: %w", handshakeCmd, err)
	}

	// Read initial response synchronously BEFORE launching readLoop to guarantee single reader
	_ = c.conn.SetReadDeadline(time.Now().Add(15 * time.Second))
	_, msg, err := c.conn.ReadMessage()
	_ = c.conn.SetReadDeadline(time.Time{})
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("failed to read handshake response: %w", err)
	}

	text := strings.TrimSpace(string(msg))
	if text != "connected" && !strings.HasPrefix(text, "connected") {
		_ = conn.Close()
		return fmt.Errorf("%w: expected 'connected', got %q", ErrProtocolError, text)
	}

	// Launch single background frame read loop and echo loop
	go c.readLoop()
	if c.echoInterval > 0 {
		go c.echoLoop()
	}

	return nil
}

// Subscribe registers a subscription, sends the 'sub <id> <payload>' frame, and returns a subscription channel.
func (c *WSClient) Subscribe(ctx context.Context, payload any) (int, <-chan IncomingFrame, error) {
	subID := int(atomic.AddInt64(&c.subIDCounter, 1))

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, fmt.Errorf("failed to marshal subscription payload: %w", err)
	}

	sub := &wsSubscription{
		id:     subID,
		frames: make(chan IncomingFrame, 32),
		done:   make(chan struct{}),
	}

	c.subsMu.Lock()
	c.subs[subID] = sub
	c.subsMu.Unlock()

	command := fmt.Sprintf("sub %d %s", subID, string(jsonBytes))
	c.connMu.Lock()
	err = c.conn.WriteMessage(websocket.TextMessage, []byte(command))
	c.connMu.Unlock()

	if err != nil {
		c.Unsubscribe(subID)
		return 0, nil, fmt.Errorf("failed to write subscription frame: %w", err)
	}

	return subID, sub.frames, nil
}

// Unsubscribe cancels a subscription on Trade Republic and cleans up internal routing channels.
func (c *WSClient) Unsubscribe(subID int) {
	c.subsMu.Lock()
	sub, exists := c.subs[subID]
	delete(c.subs, subID)
	c.subsMu.Unlock()

	c.statesMu.Lock()
	delete(c.cachedPayloads, subID)
	c.statesMu.Unlock()

	if exists && sub != nil {
		close(sub.done)
	}

	c.connMu.Lock()
	if c.conn != nil {
		command := fmt.Sprintf("unsub %d", subID)
		_ = c.conn.WriteMessage(websocket.TextMessage, []byte(command))
	}
	c.connMu.Unlock()
}

// FetchOne subscribes, waits for the first authoritative Answer (or reconstructed Delta), and automatically unsubscribes.
func (c *WSClient) FetchOne(ctx context.Context, payload any, target any) error {
	subID, frames, err := c.Subscribe(ctx, payload)
	if err != nil {
		return err
	}
	defer c.Unsubscribe(subID)

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-c.closed:
		return c.CloseErr()
	case frame, ok := <-frames:
		if !ok {
			return ErrSubscriptionTimeout
		}
		if frame.Type == FrameError {
			return fmt.Errorf("%w: %s", ErrSubscriptionFailed, string(frame.Payload))
		}
		if target != nil && len(frame.Payload) > 0 {
			if err := json.Unmarshal(frame.Payload, target); err != nil {
				return fmt.Errorf("failed to unmarshal Trade Republic frame payload: %w", err)
			}
		}
		return nil
	}
}

// readLoop is the SOLE reader goroutine for the WebSocket connection.
// It parses frames, handles echo responses, reconstructs character deltas, and dispatches to subscription channels.
func (c *WSClient) readLoop() {
	defer c.Close()

	for {
		_, msgBytes, err := c.conn.ReadMessage()
		if err != nil {
			c.setCloseError(err)
			return
		}

		rawText := strings.TrimSpace(string(msgBytes))
		if rawText == "" {
			continue
		}

		// Handle echo frames
		if strings.HasPrefix(rawText, "echo ") {
			tsStr := strings.TrimSpace(strings.TrimPrefix(rawText, "echo"))
			if ts, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
				c.echoMu.Lock()
				lastSent := c.lastEchoSent
				c.echoMu.Unlock()

				if lastSent == ts {
					// Server replied to our client-initiated echo
					select {
					case c.echoAckChan <- ts:
					default:
					}
					continue
				}
			}

			// Unprompted echo from server: echo back to keep alive
			c.connMu.Lock()
			_ = c.conn.WriteMessage(websocket.TextMessage, msgBytes)
			c.connMu.Unlock()
			continue
		}

		// Parse frame: format is either "<id> <TYPE> <PAYLOAD>" or "<TYPE> <id> <PAYLOAD>"
		frame, parseErr := parseWSFrame(rawText)
		if parseErr != nil {
			log.Printf("[DEBUG] [TradeRepublic WS] Skipping unrecognized frame format: %s", rawText)
			continue
		}

		// Handle Delta 'D' frames using Trade Republic's custom character-delta format
		if frame.Type == FrameDelta {
			reconstructed, deltaErr := c.applyDelta(frame.SubscriptionID, string(frame.Payload))
			if deltaErr == nil {
				frame.Payload = json.RawMessage(reconstructed)
			} else {
				log.Printf("[WARN] [TradeRepublic WS] Character-delta reconstruction failed for sub %d: %v", frame.SubscriptionID, deltaErr)
			}
		} else if frame.Type == FrameAnswer {
			// Cache answer string for future character-deltas
			c.statesMu.Lock()
			c.cachedPayloads[frame.SubscriptionID] = string(frame.Payload)
			c.statesMu.Unlock()
		}

		// Dispatch frame to matching subscription channel by request ID
		c.subsMu.RLock()
		sub, ok := c.subs[frame.SubscriptionID]
		c.subsMu.RUnlock()

		if ok && sub != nil {
			select {
			case sub.frames <- frame:
			default:
				log.Printf("[WARN] [TradeRepublic WS] Dropping frame on full channel for sub %d", frame.SubscriptionID)
			}
		}
	}
}

// echoLoop sends client-initiated periodic echo messages and validates responses with timeout detection.
func (c *WSClient) echoLoop() {
	ticker := time.NewTicker(c.echoInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.closed:
			return
		case <-ticker.C:
			ts := time.Now().UnixMilli()
			c.echoMu.Lock()
			c.lastEchoSent = ts
			c.echoMu.Unlock()

			echoCmd := fmt.Sprintf("echo %d", ts)
			c.connMu.Lock()
			err := c.conn.WriteMessage(websocket.TextMessage, []byte(echoCmd))
			c.connMu.Unlock()
			if err != nil {
				c.setCloseError(err)
				c.Close()
				return
			}

			// Await echo response with timeout detection
			select {
			case <-c.closed:
				return
			case ackTS := <-c.echoAckChan:
				if ackTS != ts {
					log.Printf("[DEBUG] [TradeRepublic WS] Echo timestamp mismatch: sent %d, got %d", ts, ackTS)
				}
			case <-time.After(c.echoTimeout):
				log.Printf("[ERROR] [TradeRepublic WS] Echo keepalive response timeout (%v)", c.echoTimeout)
				c.setCloseError(ErrEchoTimeout)
				c.Close()
				return
			}
		}
	}
}

// parseWSFrame parses a Trade Republic WebSocket frame text.
// Supports both "<id> <TYPE> <PAYLOAD>" and "<TYPE> <id> <PAYLOAD>" variations.
func parseWSFrame(text string) (IncomingFrame, error) {
	parts := strings.SplitN(text, " ", 3)
	if len(parts) < 2 {
		return IncomingFrame{}, ErrProtocolError
	}

	var subID int
	var frameType WSFrameType
	var payload json.RawMessage

	// Case 1: "<id> <TYPE> [PAYLOAD]"
	if id, err := strconv.Atoi(parts[0]); err == nil {
		subID = id
		frameType = WSFrameType(parts[1])
		if len(parts) == 3 {
			payload = json.RawMessage(parts[2])
		}
	} else if id, err := strconv.Atoi(parts[1]); err == nil {
		// Case 2: "<TYPE> <id> [PAYLOAD]"
		frameType = WSFrameType(parts[0])
		subID = id
		if len(parts) == 3 {
			payload = json.RawMessage(parts[2])
		}
	} else {
		return IncomingFrame{}, ErrProtocolError
	}

	return IncomingFrame{
		SubscriptionID: subID,
		Type:           frameType,
		Payload:        payload,
		RawText:        text,
	}, nil
}

// ApplyDelta applies Trade Republic's custom character-delta patch format for 'D' frames.
// The delta is a tab-separated sequence of operations:
//
//	+<urlencoded literal> -> insert literal at current cursor
//	=<n>                  -> copy n bytes from previous payload
//	-<n>                  -> skip n bytes of previous payload
func ApplyDelta(prev string, delta string) (string, error) {
	chunks := strings.Split(delta, "\t")
	var out strings.Builder
	i := 0
	prevLen := len(prev)

	for _, chunk := range chunks {
		if len(chunk) == 0 {
			continue
		}
		op := chunk[0]
		arg := chunk[1:]
		switch op {
		case '+':
			// Literal is query/plus-urlencoded (%20, +, etc.)
			unescaped, err := url.QueryUnescape(arg)
			if err != nil {
				return "", fmt.Errorf("failed to unescape delta chunk %q: %w", chunk, err)
			}
			out.WriteString(unescaped)
		case '=':
			n, err := strconv.Atoi(arg)
			if err != nil {
				return "", fmt.Errorf("invalid copy length in chunk %q: %w", chunk, err)
			}
			if i+n > prevLen {
				return "", fmt.Errorf("copy length %d exceeds remaining previous payload length (%d from %d): chunk %q", n, prevLen-i, i, chunk)
			}
			out.WriteString(prev[i : i+n])
			i += n
		case '-':
			n, err := strconv.Atoi(arg)
			if err != nil {
				return "", fmt.Errorf("invalid skip length in chunk %q: %w", chunk, err)
			}
			if i+n > prevLen {
				return "", fmt.Errorf("skip length %d exceeds remaining previous payload length (%d from %d): chunk %q", n, prevLen-i, i, chunk)
			}
			i += n
		default:
			return "", fmt.Errorf("unknown delta operator %q in chunk %q", op, chunk)
		}
	}
	return out.String(), nil
}

// applyDelta merges or reconstructs an updated state using Trade Republic character-delta format.
func (c *WSClient) applyDelta(subID int, deltaText string) (string, error) {
	c.statesMu.Lock()
	defer c.statesMu.Unlock()

	prev, exists := c.cachedPayloads[subID]
	if !exists {
		c.cachedPayloads[subID] = deltaText
		return deltaText, nil
	}

	reconstructed, err := ApplyDelta(prev, deltaText)
	if err != nil {
		return "", err
	}

	c.cachedPayloads[subID] = reconstructed
	return reconstructed, nil
}

// setCloseError checks for close codes such as 3003 ("registered").
func (c *WSClient) setCloseError(err error) {
	if websocket.IsCloseError(err, 3003) {
		c.err = ErrConnectionPreempted
	} else {
		c.err = err
	}
}

// CloseErr returns the terminal error if the connection closed.
func (c *WSClient) CloseErr() error {
	if c.err != nil {
		return c.err
	}
	return errors.New("connection closed")
}

// Close gracefully disconnects the WebSocket and cleans up all resources.
func (c *WSClient) Close() error {
	var err error
	c.closeOnce.Do(func() {
		close(c.closed)

		c.subsMu.Lock()
		for _, sub := range c.subs {
			close(sub.done)
		}
		c.subs = make(map[int]*wsSubscription)
		c.subsMu.Unlock()

		c.connMu.Lock()
		if c.conn != nil {
			_ = c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "bye"))
			err = c.conn.Close()
		}
		c.connMu.Unlock()
	})
	return err
}
