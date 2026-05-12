package writer

import (
	"context"
	"fmt"
)

type PlanSummary struct {
	PackID  string
	Version string
	OutDir  string
}

type PackWriter interface {
	Write(ctx context.Context, summary PlanSummary) error
}

type NoopWriter struct{}

func (NoopWriter) Write(_ context.Context, _ PlanSummary) error {
	return fmt.Errorf("pack writer not implemented")
}
