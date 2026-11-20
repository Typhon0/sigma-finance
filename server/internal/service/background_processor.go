package service

import (
	"context"
	"fmt"
	"log"
	"sigma_finance/internal/config"
	"sigma_finance/internal/repository"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// BackgroundProcessor drives the periodic portfolio snapshot refresh.
//
// It used to carry a second worker pool whose jobs slept and returned
// hardcoded maps ("volatility": 0.12, "cleaned_entries": 50). Those jobs wrote
// nothing and refreshed nothing, so they are gone; the only real work left is
// CalculateAndSaveHistoricalSnapshots for each portfolio.
type BackgroundProcessor struct {
	config *config.PerformanceConfig
	uow    repository.IUnitOfWork

	// Worker pool
	calculationWorkers *WorkerPool

	// Job queue
	calculationQueue chan CalculationJob

	// State management
	isRunning bool
	stopCh    chan struct{}
	wg        sync.WaitGroup
	mu        sync.RWMutex

	// Metrics
	processedJobs     int64
	failedJobs        int64
	avgProcessingTime time.Duration
}

// CalculationJob represents a performance calculation job
type CalculationJob struct {
	ID          string
	Type        CalculationType
	PortfolioID string
	UserID      string
	Priority    int
	CreatedAt   time.Time
	Deadline    time.Time
	RetryCount  int
	MaxRetries  int
	Context     map[string]interface{}
}

// CalculationType defines the supported calculation job types
type CalculationType string

const (
	PortfolioPerformanceCalc CalculationType = "portfolio_performance"
)

// WorkerPool manages a pool of background workers
type WorkerPool struct {
	workers   int
	jobCh     chan Job
	resultCh  chan JobResult
	stopCh    chan struct{}
	wg        sync.WaitGroup
	processor JobProcessor

	// droppedJobs counts the Submit() calls that hit a full queue.  Read
	// via WorkerPool.GetDroppedJobs() and surfaced through
	// BackgroundProcessor.GetMetrics() so ops can alert on sustained drop
	// rates.  Atomic because Submit() is called from the dispatcher
	// goroutine.
	droppedJobs atomic.Int64
}

// Job interface for background processing
type Job interface {
	GetID() string
	GetType() string
	GetPriority() int
	GetCreatedAt() time.Time
}

// JobResult represents the result of a background job
type JobResult struct {
	JobID     string
	Success   bool
	Result    interface{}
	Error     error
	Duration  time.Duration
	Timestamp time.Time
}

// JobProcessor interface for processing jobs
type JobProcessor interface {
	ProcessCalculation(ctx context.Context, job CalculationJob) (interface{}, error)
}

// NewBackgroundProcessor creates a new background processor.
// Calling without a uow keeps the ticker dormant; only callers that supply a
// unit-of-work (the production wiring in cmd/app.go) actually drive the
// per-portfolio refresh path.
func NewBackgroundProcessor(
	config *config.PerformanceConfig,
	uow repository.IUnitOfWork,
) *BackgroundProcessor {
	bp := &BackgroundProcessor{
		config:           config,
		uow:              uow,
		calculationQueue: make(chan CalculationJob, 1000),
		stopCh:           make(chan struct{}),
	}

	bp.calculationWorkers = NewWorkerPool(5, bp) // 5 calculation workers

	return bp
}

// Start begins background processing
func (bp *BackgroundProcessor) Start(ctx context.Context) error {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	if bp.isRunning {
		return fmt.Errorf("background processor is already running")
	}

	bp.isRunning = true
	log.Printf("[INFO] Starting background processor with %d calculation workers",
		bp.calculationWorkers.workers)

	bp.calculationWorkers.Start()

	bp.wg.Add(1)
	go bp.calculationDispatcher()

	bp.wg.Add(1)
	go bp.periodicTaskScheduler()

	bp.wg.Add(1)
	go bp.metricsCollector()

	return nil
}

// Stop gracefully stops background processing
func (bp *BackgroundProcessor) Stop() error {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	if !bp.isRunning {
		return nil
	}

	log.Printf("[INFO] Stopping background processor...")
	close(bp.stopCh)
	bp.isRunning = false

	bp.calculationWorkers.Stop()

	bp.wg.Wait()

	log.Printf("[INFO] Background processor stopped")
	return nil
}

// ScheduleCalculation adds a calculation job to the queue
func (bp *BackgroundProcessor) ScheduleCalculation(job CalculationJob) error {
	if !bp.isRunning {
		return fmt.Errorf("background processor is not running")
	}

	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now()
	}
	if job.Deadline.IsZero() {
		job.Deadline = job.CreatedAt.Add(5 * time.Minute)
	}
	if job.MaxRetries == 0 {
		job.MaxRetries = 3
	}

	select {
	case bp.calculationQueue <- job:
		return nil
	default:
		return fmt.Errorf("calculation queue is full")
	}
}

// calculationDispatcher dispatches calculation jobs to workers
func (bp *BackgroundProcessor) calculationDispatcher() {
	defer bp.wg.Done()

	for {
		select {
		case job := <-bp.calculationQueue:
			if time.Now().After(job.Deadline) {
				log.Printf("[WARN] Calculation job %s expired, skipping", job.ID)
				continue
			}
			bp.calculationWorkers.Submit(job)

		case <-bp.stopCh:
			return
		}
	}
}

// periodicTaskScheduler schedules periodic background tasks
func (bp *BackgroundProcessor) periodicTaskScheduler() {
	defer bp.wg.Done()

	performanceTicker := time.NewTicker(5 * time.Minute)
	defer performanceTicker.Stop()

	for {
		select {
		case <-performanceTicker.C:
			bp.schedulePerformanceUpdates()

		case <-bp.stopCh:
			return
		}
	}
}

// schedulePerformanceUpdates enqueues one CalculationJob per active portfolio
// so the worker pool can call CalculateAndSaveHistoricalSnapshots for each
// one.  Callers that don't want this behaviour (operator about to PURGE +
// rebuild manually) set DISABLE_AUTO_SNAPSHOT_REBUILD=true and the ticker
// short-circuits.
func (bp *BackgroundProcessor) schedulePerformanceUpdates() {
	if bp.uow == nil {
		log.Printf("[WARN] [BackgroundProcessor.schedulePerformanceUpdates] skipped: uow not injected")
		return
	}

	if isAutoSnapshotRebuildDisabled() {
		log.Printf("[INFO] [BackgroundProcessor.schedulePerformanceUpdates] skipped: DISABLE_AUTO_SNAPSHOT_REBUILD=true")
		return
	}

	// Short query depth so the ticker doesn't hold a connection if the
	// portfolio table is hot.  We only need IDs.
	listCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	portfolios, err := bp.uow.Portfolio().FindAllBy(listCtx)
	if err != nil {
		log.Printf("[ERROR] [BackgroundProcessor.schedulePerformanceUpdates] find-all portfolios failed: %v", err)
		return
	}

	enqueued := 0
	for _, p := range portfolios {
		id := strings.TrimSpace(p.ID)
		if id == "" {
			continue
		}
		job := CalculationJob{
			ID:          fmt.Sprintf("perf_update_%s_%d", id, time.Now().UnixNano()),
			Type:        PortfolioPerformanceCalc,
			PortfolioID: id,
			Priority:    2,
			CreatedAt:   time.Now(),
			MaxRetries:  3,
		}
		if scheduleErr := bp.ScheduleCalculation(job); scheduleErr != nil {
			log.Printf("[INFO] [BackgroundProcessor.schedulePerformanceUpdates] schedule failed portfolio=%s err=%v", id, scheduleErr)
			continue
		}
		enqueued++
	}

	log.Printf("[INFO] [BackgroundProcessor.schedulePerformanceUpdates] scheduled per-portfolio jobs portfolios_total=%d enqueued=%d", len(portfolios), enqueued)
}

// metricsCollector collects and logs performance metrics
func (bp *BackgroundProcessor) metricsCollector() {
	defer bp.wg.Done()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			bp.logMetrics()

		case <-bp.stopCh:
			return
		}
	}
}

// logMetrics logs current performance metrics
func (bp *BackgroundProcessor) logMetrics() {
	bp.mu.RLock()
	processedJobs := bp.processedJobs
	failedJobs := bp.failedJobs
	avgProcessingTime := bp.avgProcessingTime
	bp.mu.RUnlock()

	log.Printf("[INFO] Background Processor Metrics - Processed: %d, Failed: %d, Avg Time: %v",
		processedJobs, failedJobs, avgProcessingTime)

	log.Printf("[INFO] Queue Size - Calculation: %d", len(bp.calculationQueue))
}

// ProcessCalculation implements JobProcessor interface. The named return is
// what lets the deferred metric record the real outcome instead of counting
// every job as a success.
func (bp *BackgroundProcessor) ProcessCalculation(ctx context.Context, job CalculationJob) (result interface{}, err error) {
	startTime := time.Now()

	defer func() {
		bp.updateMetrics(err == nil, time.Since(startTime))
	}()

	switch job.Type {
	case PortfolioPerformanceCalc:
		return bp.processPortfolioPerformance(ctx, job)
	default:
		return nil, fmt.Errorf("unknown calculation type: %s", job.Type)
	}
}

// processPortfolioPerformance is the worker-pool entry point for the
// PortfolioPerformanceCalc job type.  It invokes the vectorized
// CalculateAndSaveHistoricalSnapshots SQL against the real
// IPerformanceRepository.
//
// We pass a single-day window (today_00:00..today_23:59:59) so the SQL's
// generate_series produces one snapshot_date row and the ON CONFLICT clause
// upserts today's row in one bulk statement instead of looping per-portfolio
// in Go.  Full-window rebuilds are still possible - just widen the start
// argument here or invoke the manual tools/rebuild_portfolio_snapshots CLI.
func (bp *BackgroundProcessor) processPortfolioPerformance(ctx context.Context, job CalculationJob) (interface{}, error) {
	start := time.Now()

	portfolioID := strings.TrimSpace(job.PortfolioID)
	if portfolioID == "" {
		log.Printf("[WARN] [BackgroundProcessor.processPortfolioPerformance] skipping job %s: empty PortfolioID", job.ID)
		return map[string]interface{}{
			"job_id":        job.ID,
			"status":        "skipped",
			"reason":        "empty_portfolio_id",
			"calculated_at": time.Now(),
		}, nil
	}

	if bp.uow == nil || bp.uow.Performance() == nil {
		return nil, fmt.Errorf("uow.Performance() not wired; cannot refresh portfolio %s", portfolioID)
	}

	// Use a single-day window (today 00:00..23:59:59 UTC) so the SQL
	// produces one snapshot_date row and ON CONFLICT DO UPDATE upserts
	// today's row in place.
	now := time.Now().UTC()
	startDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	endDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, time.UTC)
	if endDay.After(now) {
		endDay = now
	}

	if err := bp.uow.Performance().CalculateAndSaveHistoricalSnapshots(ctx, portfolioID, startDay, endDay); err != nil {
		log.Printf("[ERROR] [BackgroundProcessor.processPortfolioPerformance] CalculateAndSaveHistoricalSnapshots failed portfolio=%s window=[%s..%s] err=%v", portfolioID, startDay.Format("2006-01-02"), endDay.Format("2006-01-02"), err)
		return nil, err
	}

	log.Printf("[INFO] [BackgroundProcessor.processPortfolioPerformance] refresh ok portfolio=%s window=[%s..%s] duration=%v", portfolioID, startDay.Format("2006-01-02"), endDay.Format("2006-01-02"), time.Since(start))
	return map[string]interface{}{
		"portfolio_id":  portfolioID,
		"start":         startDay,
		"end":           endDay,
		"calculated_at": time.Now(),
		"duration_ms":   time.Since(start).Milliseconds(),
	}, nil
}

// updateMetrics updates processing metrics
func (bp *BackgroundProcessor) updateMetrics(success bool, duration time.Duration) {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	if success {
		bp.processedJobs++
	} else {
		bp.failedJobs++
	}

	// Update average processing time (simple moving average)
	if bp.processedJobs+bp.failedJobs == 1 {
		bp.avgProcessingTime = duration
	} else {
		bp.avgProcessingTime = (bp.avgProcessingTime + duration) / 2
	}
}

// GetMetrics returns current processing metrics
func (bp *BackgroundProcessor) GetMetrics() map[string]interface{} {
	bp.mu.RLock()
	defer bp.mu.RUnlock()

	return map[string]interface{}{
		"processed_jobs":           bp.processedJobs,
		"failed_jobs":              bp.failedJobs,
		"avg_processing_time":      bp.avgProcessingTime,
		"calculation_queue_size":   len(bp.calculationQueue),
		"calculation_dropped_jobs": bp.calculationWorkers.GetDroppedJobs(),
		"is_running":               bp.isRunning,
	}
}

// Implementation of Job interface for CalculationJob
func (j CalculationJob) GetID() string           { return j.ID }
func (j CalculationJob) GetType() string         { return string(j.Type) }
func (j CalculationJob) GetPriority() int        { return j.Priority }
func (j CalculationJob) GetCreatedAt() time.Time { return j.CreatedAt }
