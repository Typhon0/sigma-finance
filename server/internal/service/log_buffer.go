package service

import (
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"sync"
	"time"
)

// LogEntry represents a single log line with metadata.
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Service   string    `json:"service"`
}

// LogLevel represents log severity.
type LogLevel string

const (
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
)

// LogBuffer is a thread-safe ring buffer that captures structured log entries.
type LogBuffer struct {
	mu       sync.RWMutex
	buf      []LogEntry
	capacity int
	pos      int
	count    int
	seq      uint64 // monotonic sequence number for SSE clients to track position
	watchers map[uint64]chan []LogEntry
}

// NewLogBuffer creates a new log buffer with the given capacity.
func NewLogBuffer(capacity int) *LogBuffer {
	return &LogBuffer{
		buf:      make([]LogEntry, capacity),
		capacity: capacity,
		watchers: make(map[uint64]chan []LogEntry),
	}
}

// Append adds a log entry to the buffer and notifies watchers.
func (lb *LogBuffer) Append(entry LogEntry) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	lb.buf[lb.pos] = entry
	lb.pos = (lb.pos + 1) % lb.capacity
	if lb.count < lb.capacity {
		lb.count++
	}
	lb.seq++

	// Notify watchers (non-blocking)
	for _, ch := range lb.watchers {
		select {
		case ch <- []LogEntry{entry}:
		default:
			// Dropped - watcher too slow
		}
	}
}

// Recent returns the most recent n log entries in chronological order.
func (lb *LogBuffer) Recent(n int) []LogEntry {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	if n <= 0 || lb.count == 0 {
		n = lb.count
	}
	if n > lb.count {
		n = lb.count
	}
	if n > lb.capacity {
		n = lb.capacity
	}

	result := make([]LogEntry, n)
	start := (lb.pos - n + lb.capacity) % lb.capacity
	for i := 0; i < n; i++ {
		result[i] = lb.buf[(start+i)%lb.capacity]
	}
	return result
}

// All returns all buffered entries in chronological order.
func (lb *LogBuffer) All() []LogEntry {
	return lb.Recent(lb.capacity)
}

// Subscribe returns a channel that receives new log entries and a cleanup function.
func (lb *LogBuffer) Subscribe() (<-chan []LogEntry, func()) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	id := lb.seq // Use sequence as subscriber ID
	ch := make(chan []LogEntry, 64)
	lb.watchers[id] = ch

	unsubscribe := func() {
		lb.mu.Lock()
		defer lb.mu.Unlock()
		if ch, ok := lb.watchers[id]; ok {
			close(ch)
			delete(lb.watchers, id)
		}
	}

	return ch, unsubscribe
}

// LogWriter implements io.Writer to capture Go's standard log output.
type LogWriter struct {
	buf    *LogBuffer
	writer io.Writer // secondary writer (e.g., os.Stdout)
}

// NewLogWriter creates a LogWriter that writes to both the buffer and a secondary writer.
func NewLogWriter(buf *LogBuffer, writer io.Writer) *LogWriter {
	return &LogWriter{buf: buf, writer: writer}
}

// Write implements io.Writer, parsing Go's log.LstdFlags format.
func (lw *LogWriter) Write(p []byte) (n int, err error) {
	message := strings.TrimRight(string(p), "\n\r")

	// If secondary writer is set, write there too
	if lw.writer != nil {
		lw.writer.Write(p)
	}

	entry := LogEntry{
		Timestamp: time.Now(),
		Level:     string(detectLevel(message)),
		Message:   message,
		Service:   "go-server",
	}

	lw.buf.Append(entry)

	// Note: Do NOT call log.Writer() here — it causes a reentrant mutex
	// deadlock because this Write method is called from within the standard
	// logger's own mutex-protected section.
	// Output to stderr is handled by the secondary writer (os.Stdout),
	// which Docker/container runtimes already capture.

	return len(p), nil
}

// CaptureStandardLog redirects Go's standard log package output to the buffer.
func (lb *LogBuffer) CaptureStandardLog() {
	lw := NewLogWriter(lb, os.Stdout)
	log.SetOutput(lw)
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("")
}

// detectLevel attempts to detect the log level from a message.
func detectLevel(msg string) LogLevel {
	upper := strings.ToUpper(msg)
	switch {
	case strings.Contains(upper, "ERROR") || strings.Contains(upper, "FATAL") || strings.Contains(upper, "PANIC"):
		return LogLevelError
	case strings.Contains(upper, "WARN") || strings.Contains(upper, "WARNING"):
		return LogLevelWarn
	case strings.Contains(upper, "DEBUG"):
		return LogLevelDebug
	default:
		return LogLevelInfo
	}
}

// Format entry as a colored text line for SSE/text output.
func (e LogEntry) String() string {
	ts := e.Timestamp.Format("2006-01-02 15:04:05.000")
	return fmt.Sprintf("[%s] [%s] [%s] %s", ts, e.Level, e.Service, e.Message)
}
