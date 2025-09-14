package service

import (
	"context"
	"fmt"
	"log"
	"time"
)

// NewWorkerPool creates a new worker pool
func NewWorkerPool(workers int, processor JobProcessor) *WorkerPool {
	return &WorkerPool{
		workers:   workers,
		jobCh:     make(chan Job, workers*2),
		resultCh:  make(chan JobResult, workers*2),
		stopCh:    make(chan struct{}),
		processor: processor,
	}
}

// Start begins processing jobs with the worker pool
func (wp *WorkerPool) Start() {
	log.Printf("Starting worker pool with %d workers", wp.workers)
	
	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go wp.worker(i)
	}

	// Start result processor
	wp.wg.Add(1)
	go wp.resultProcessor()
}

// Stop gracefully stops the worker pool
func (wp *WorkerPool) Stop() {
	log.Printf("Stopping worker pool...")
	
	close(wp.stopCh)
	wp.wg.Wait()
	
	log.Printf("Worker pool stopped")
}

// Submit adds a job to the worker pool
func (wp *WorkerPool) Submit(job Job) {
	select {
	case wp.jobCh <- job:
		// Job submitted successfully
	default:
		log.Printf("Worker pool job queue is full, dropping job %s", job.GetID())
	}
}

// worker processes jobs from the job channel
func (wp *WorkerPool) worker(workerID int) {
	defer wp.wg.Done()
	
	log.Printf("Worker %d started", workerID)
	
	for {
		select {
		case job := <-wp.jobCh:
			result := wp.processJob(workerID, job)
			
			select {
			case wp.resultCh <- result:
				// Result sent successfully
			default:
				log.Printf("Worker %d: Result channel full, dropping result for job %s", 
					workerID, job.GetID())
			}

		case <-wp.stopCh:
			log.Printf("Worker %d stopping", workerID)
			return
		}
	}
}

// processJob processes a single job and returns the result
func (wp *WorkerPool) processJob(workerID int, job Job) JobResult {
	startTime := time.Now()
	
	log.Printf("Worker %d processing job %s (type: %s, priority: %d)", 
		workerID, job.GetID(), job.GetType(), job.GetPriority())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var result interface{}
	var err error

	// Process based on job type
	switch j := job.(type) {
	case CalculationJob:
		result, err = wp.processor.ProcessCalculation(ctx, j)
	case RefreshJob:
		result, err = wp.processor.ProcessRefresh(ctx, j)
	default:
		err = fmt.Errorf("unknown job type: %T", job)
	}

	duration := time.Since(startTime)
	
	jobResult := JobResult{
		JobID:     job.GetID(),
		Success:   err == nil,
		Result:    result,
		Error:     err,
		Duration:  duration,
		Timestamp: time.Now(),
	}

	if err != nil {
		log.Printf("Worker %d: Job %s failed after %v: %v", 
			workerID, job.GetID(), duration, err)
	} else {
		log.Printf("Worker %d: Job %s completed successfully in %v", 
			workerID, job.GetID(), duration)
	}

	return jobResult
}

// resultProcessor handles job results
func (wp *WorkerPool) resultProcessor() {
	defer wp.wg.Done()
	
	log.Printf("Result processor started")
	
	for {
		select {
		case result := <-wp.resultCh:
			wp.handleResult(result)

		case <-wp.stopCh:
			log.Printf("Result processor stopping")
			return
		}
	}
}

// handleResult processes a job result
func (wp *WorkerPool) handleResult(result JobResult) {
	if result.Success {
		log.Printf("Job %s completed successfully in %v", result.JobID, result.Duration)
		
		// Handle successful results
		// This could include:
		// - Updating cache
		// - Sending notifications
		// - Triggering dependent jobs
		
	} else {
		log.Printf("Job %s failed: %v", result.JobID, result.Error)
		
		// Handle failed results
		// This could include:
		// - Retry logic
		// - Error notifications
		// - Fallback processing
	}
}

