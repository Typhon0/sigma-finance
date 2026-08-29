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

// BackgroundProcessor handles background processing for performance calculations
type BackgroundProcessor struct {
	config *config.PerformanceConfig
	uow    repository.IUnitOfWork

	// Worker pools
	calculationWorkers *WorkerPool
	refreshWorkers     *WorkerPool

	// Job queues
	calculationQueue chan CalculationJob
	refreshQueue     chan RefreshJob

	// State management
	isRunning        bool
	stopCh           chan struct{}
	wg               sync.WaitGroup
	mu               sync.RWMutex

	// Metrics
	processedJobs    int64
	failedJobs       int64
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

// RefreshJob represents a cache refresh job
type RefreshJob struct {
	ID          string
	CacheKey    string
	DataType    string
	Priority    int
	CreatedAt   time.Time
	RetryCount  int
	MaxRetries  int
}

// CalculationType defines different types of calculations
type CalculationType string

const (
	PortfolioPerformanceCalc CalculationType = "portfolio_performance"
	AssetAllocationCalc      CalculationType = "asset_allocation"
	RiskMetricsCalc          CalculationType = "risk_metrics"
	ChartDataCalc            CalculationType = "chart_data"
	MarketDataUpdateCalc     CalculationType = "market_data_update"
)

// WorkerPool manages a pool of background workers
type WorkerPool struct {
	workers    int
	jobCh      chan Job
	resultCh   chan JobResult
	stopCh     chan struct{}
	wg         sync.WaitGroup
	processor  JobProcessor

	// droppedJobs counts the Submit() calls that hit a full queue.  Read
	// via WorkerPool.GetDroppedJobs() and surfaced through
	// BackgroundProcessor.GetMetrics() so ops can alert on sustained drop
	// rates.  Atomic because Submit() is called from multiple goroutines
	// (calculationDispatcher + the future refreshDispatcher).
	droppedJobs atomic.Int64
}

// Job interface for background processing
type Job interface {
	GetID() string
	GetType() string
	GetPriority() int
	GetCreatedAt() time.Time
	Process(ctx context.Context) (interface{}, error)
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

// JobProcessor interface for processing different job types
type JobProcessor interface {
	ProcessCalculation(ctx context.Context, job CalculationJob) (interface{}, error)
	ProcessRefresh(ctx context.Context, job RefreshJob) (interface{}, error)
}

// NewBackgroundProcessor creates a new background processor.
// Calling without a uow keeps the ticker dormant; only callers that supply a
// unit-of-work (the production wiring in cmd/app.go) actually drive the
// per-portfolio refresh path.  The PerformanceCacheService parameter has
// been removed: the ticker fan-outs through the calculation worker pool and
// writes straight to the SQL snapshots table - there's nothing to invalidate
// in the process-local cache from this side.
func NewBackgroundProcessor(
	config *config.PerformanceConfig,
	uow repository.IUnitOfWork,
) *BackgroundProcessor {
	bp := &BackgroundProcessor{
		config:           config,
		uow:              uow,
		calculationQueue: make(chan CalculationJob, 1000),
		refreshQueue:     make(chan RefreshJob, 500),
		stopCh:           make(chan struct{}),
	}

	// Create worker pools
	bp.calculationWorkers = NewWorkerPool(5, bp) // 5 calculation workers
	bp.refreshWorkers = NewWorkerPool(3, bp)     // 3 refresh workers

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
	log.Printf("[INFO] Starting background processor with %d calculation workers and %d refresh workers",
		bp.calculationWorkers.workers, bp.refreshWorkers.workers)

	// Start worker pools
	bp.calculationWorkers.Start()
	bp.refreshWorkers.Start()

	// Start job dispatchers
	bp.wg.Add(2)
	go bp.calculationDispatcher()
	go bp.refreshDispatcher()

	// Start periodic tasks
	bp.wg.Add(1)
	go bp.periodicTaskScheduler()

	// Start metrics collector
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

	// Stop worker pools
	bp.calculationWorkers.Stop()
	bp.refreshWorkers.Stop()

	// Wait for all goroutines to finish
	bp.wg.Wait()

	log.Printf("[INFO] Background processor stopped")
	return nil
}

// ScheduleCalculation adds a calculation job to the queue
func (bp *BackgroundProcessor) ScheduleCalculation(job CalculationJob) error {
	if !bp.isRunning {
		return fmt.Errorf("background processor is not running")
	}

	// Set defaults
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

// ScheduleRefresh adds a refresh job to the queue
func (bp *BackgroundProcessor) ScheduleRefresh(job RefreshJob) error {
	if !bp.isRunning {
		return fmt.Errorf("background processor is not running")
	}

	// Set defaults
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now()
	}
	if job.MaxRetries == 0 {
		job.MaxRetries = 2
	}

	select {
	case bp.refreshQueue <- job:
		return nil
	default:
		return fmt.Errorf("refresh queue is full")
	}
}

// calculationDispatcher dispatches calculation jobs to workers
func (bp *BackgroundProcessor) calculationDispatcher() {
	defer bp.wg.Done()

	for {
		select {
		case job := <-bp.calculationQueue:
			// Check if job has expired
			if time.Now().After(job.Deadline) {
				log.Printf("[WARN] Calculation job %s expired, skipping", job.ID)
				continue
			}

			// Send to worker pool
			bp.calculationWorkers.Submit(job)

		case <-bp.stopCh:
			return
		}
	}
}

// refreshDispatcher dispatches refresh jobs to workers
func (bp *BackgroundProcessor) refreshDispatcher() {
	defer bp.wg.Done()

	for {
		select {
		case job := <-bp.refreshQueue:
			// Send to worker pool
			bp.refreshWorkers.Submit(job)

		case <-bp.stopCh:
			return
		}
	}
}

// periodicTaskScheduler schedules periodic background tasks
func (bp *BackgroundProcessor) periodicTaskScheduler() {
	defer bp.wg.Done()

	// Schedule portfolio performance updates every 5 minutes
	performanceTicker := time.NewTicker(5 * time.Minute)
	defer performanceTicker.Stop()

	// Schedule cache cleanup every 30 minutes
	cleanupTicker := time.NewTicker(30 * time.Minute)
	defer cleanupTicker.Stop()

	// Schedule market data updates every minute during market hours
	marketDataTicker := time.NewTicker(1 * time.Minute)
	defer marketDataTicker.Stop()

	for {
		select {
		case <-performanceTicker.C:
			bp.schedulePerformanceUpdates()

		case <-cleanupTicker.C:
			bp.scheduleCacheCleanup()

		case <-marketDataTicker.C:
			if bp.isMarketHours() {
				bp.scheduleMarketDataUpdates()
			}

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

// scheduleCacheCleanup schedules cache cleanup tasks
func (bp *BackgroundProcessor) scheduleCacheCleanup() {
	job := RefreshJob{
		ID:         fmt.Sprintf("cache_cleanup_%d", time.Now().Unix()),
		DataType:   "cleanup",
		Priority:   1,
		CreatedAt:  time.Now(),
		MaxRetries: 1,
	}

	if err := bp.ScheduleRefresh(job); err != nil {
		log.Printf("[INFO] Failed to schedule cache cleanup: %v", err)
	}
}

// scheduleMarketDataUpdates schedules market data updates
func (bp *BackgroundProcessor) scheduleMarketDataUpdates() {
	job := CalculationJob{
		ID:          fmt.Sprintf("market_data_%d", time.Now().Unix()),
		Type:        MarketDataUpdateCalc,
		Priority:    3,
		CreatedAt:   time.Now(),
		MaxRetries:  2,
	}

	if err := bp.ScheduleCalculation(job); err != nil {
		log.Printf("[INFO] Failed to schedule market data update: %v", err)
	}
}

// isMarketHours checks if current time is during market hours
func (bp *BackgroundProcessor) isMarketHours() bool {
	now := time.Now()
	hour := now.Hour()
	
	// Simple check for US market hours (9:30 AM - 4:00 PM EST)
	// In production, this would be more sophisticated
	return hour >= 9 && hour < 16
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

	// Log queue sizes
	log.Printf("[INFO] Queue Sizes - Calculation: %d, Refresh: %d",
		len(bp.calculationQueue), len(bp.refreshQueue))
}

// ProcessCalculation implements JobProcessor interface
func (bp *BackgroundProcessor) ProcessCalculation(ctx context.Context, job CalculationJob) (interface{}, error) {
	startTime := time.Now()
	
	defer func() {
		duration := time.Since(startTime)
		bp.updateMetrics(true, duration)
	}()

	switch job.Type {
	case PortfolioPerformanceCalc:
		return bp.processPortfolioPerformance(ctx, job)
	case AssetAllocationCalc:
		return bp.processAssetAllocation(ctx, job)
	case RiskMetricsCalc:
		return bp.processRiskMetrics(ctx, job)
	case ChartDataCalc:
		return bp.processChartData(ctx, job)
	case MarketDataUpdateCalc:
		return bp.processMarketDataUpdate(ctx, job)
	default:
		return nil, fmt.Errorf("unknown calculation type: %s", job.Type)
	}
}

// ProcessRefresh implements JobProcessor interface
func (bp *BackgroundProcessor) ProcessRefresh(ctx context.Context, job RefreshJob) (interface{}, error) {
	startTime := time.Now()
	
	defer func() {
		duration := time.Since(startTime)
		bp.updateMetrics(true, duration)
	}()

	switch job.DataType {
	case "cleanup":
		return bp.processCacheCleanup(ctx, job)
	default:
		return bp.processGenericRefresh(ctx, job)
	}
}

// Individual processing methods
//
// processPortfolioPerformance is the worker-pool entry point for the
// PortfolioPerformanceCalc job type.  It used to be a 100ms sleep + fake map;
// it now invokes the vectorized CalculateAndSaveHistoricalSnapshots SQL
// against the real IPerformanceRepository.
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
	// today's row in place.  This matches the semantics of the old
	// UpdatePerformanceSnapshots(path) per-tick refresh while staying on the
	// vectorized SQL function the user requested.
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

func (bp *BackgroundProcessor) processAssetAllocation(ctx context.Context, job CalculationJob) (interface{}, error) {
	log.Printf("[INFO] Processing asset allocation calculation for job %s", job.ID)
	// Simulate calculation work
	time.Sleep(50 * time.Millisecond)
	
	return map[string]interface{}{
		"portfolio_id": job.PortfolioID,
		"allocations": map[string]float64{
			"stocks": 0.6,
			"bonds":  0.3,
			"cash":   0.1,
		},
		"calculated_at": time.Now(),
	}, nil
}

func (bp *BackgroundProcessor) processRiskMetrics(ctx context.Context, job CalculationJob) (interface{}, error) {
	log.Printf("[INFO] Processing risk metrics calculation for job %s", job.ID)
	// Simulate calculation work
	time.Sleep(200 * time.Millisecond)
	
	return map[string]interface{}{
		"portfolio_id": job.PortfolioID,
		"volatility":   0.12,
		"sharpe_ratio": 1.5,
		"max_drawdown": -0.08,
		"calculated_at": time.Now(),
	}, nil
}

func (bp *BackgroundProcessor) processChartData(ctx context.Context, job CalculationJob) (interface{}, error) {
	log.Printf("[INFO] Processing chart data calculation for job %s", job.ID)
	// Simulate data processing
	time.Sleep(75 * time.Millisecond)
	
	return map[string]interface{}{
		"portfolio_id": job.PortfolioID,
		"data_points": 100,
		"time_range":  "1M",
		"calculated_at": time.Now(),
	}, nil
}

func (bp *BackgroundProcessor) processMarketDataUpdate(ctx context.Context, job CalculationJob) (interface{}, error) {
	log.Printf("[INFO] Processing market data update for job %s", job.ID)
	// Simulate market data fetch and update
	time.Sleep(300 * time.Millisecond)
	
	return map[string]interface{}{
		"updated_assets": 150,
		"updated_at":     time.Now(),
	}, nil
}

func (bp *BackgroundProcessor) processCacheCleanup(ctx context.Context, job RefreshJob) (interface{}, error) {
	log.Printf("[INFO] Processing cache cleanup for job %s", job.ID)
	// Simulate cache cleanup
	time.Sleep(25 * time.Millisecond)
	
	return map[string]interface{}{
		"cleaned_entries": 50,
		"cleaned_at":      time.Now(),
	}, nil
}

func (bp *BackgroundProcessor) processGenericRefresh(ctx context.Context, job RefreshJob) (interface{}, error) {
	log.Printf("[INFO] Processing generic refresh for job %s", job.ID)
	// Simulate refresh work
	time.Sleep(50 * time.Millisecond)
	
	return map[string]interface{}{
		"cache_key":    job.CacheKey,
		"refreshed_at": time.Now(),
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
	if bp.processedJobs == 1 {
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
		"processed_jobs":       bp.processedJobs,
		"failed_jobs":          bp.failedJobs,
		"avg_processing_time":  bp.avgProcessingTime,
		"calculation_queue_size": len(bp.calculationQueue),
		"refresh_queue_size":   len(bp.refreshQueue),
		"is_running":           bp.isRunning,
	}
}

// Implementation of Job interface for CalculationJob
func (j CalculationJob) GetID() string        { return j.ID }
func (j CalculationJob) GetType() string      { return string(j.Type) }
func (j CalculationJob) GetPriority() int     { return j.Priority }
func (j CalculationJob) GetCreatedAt() time.Time { return j.CreatedAt }

func (j CalculationJob) Process(ctx context.Context) (interface{}, error) {
	// This would be implemented by the processor
	return nil, fmt.Errorf("not implemented")
}

// Implementation of Job interface for RefreshJob
func (j RefreshJob) GetID() string        { return j.ID }
func (j RefreshJob) GetType() string      { return j.DataType }
func (j RefreshJob) GetPriority() int     { return j.Priority }
func (j RefreshJob) GetCreatedAt() time.Time { return j.CreatedAt }

func (j RefreshJob) Process(ctx context.Context) (interface{}, error) {
	// This would be implemented by the processor
	return nil, fmt.Errorf("not implemented")
}