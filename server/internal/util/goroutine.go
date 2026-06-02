package util

import (
	"context"
	"log"
	"runtime/debug"
)

// RunTask safely executes a function in a new goroutine,
// recovering from any panics to prevent crashing the server.
func RunTask(ctx context.Context, name string, task func(ctx context.Context)) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[PANIC RECOVERED] in goroutine %q: %v\nStack Trace:\n%s", name, r, string(debug.Stack()))
			}
		}()
		
		// If context is already cancelled, don't run
		if ctx.Err() != nil {
			return
		}

		task(ctx)
	}()
}
