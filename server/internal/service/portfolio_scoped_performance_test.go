package service

import (
	"testing"
	"time"
)

func day(year int, month time.Month, d int) time.Time {
	return time.Date(year, month, d, 0, 0, 0, 0, time.UTC)
}

func TestTrimLeadingZeroPoints(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input []PerformancePoint
		want  []PerformancePoint
	}{
		{
			name:  "empty series stays empty",
			input: []PerformancePoint{},
			want:  []PerformancePoint{},
		},
		{
			name: "leading zeros are dropped",
			input: []PerformancePoint{
				{Date: day(2015, time.April, 20), Value: 0},
				{Date: day(2026, time.April, 17), Value: 0},
				{Date: day(2026, time.April, 18), Value: 878.53},
				{Date: day(2026, time.April, 19), Value: 8804.92},
			},
			want: []PerformancePoint{
				{Date: day(2026, time.April, 18), Value: 878.53},
				{Date: day(2026, time.April, 19), Value: 8804.92},
			},
		},
		{
			name: "series without leading zeros is unchanged",
			input: []PerformancePoint{
				{Date: day(2026, time.April, 18), Value: 878.53},
				{Date: day(2026, time.April, 19), Value: 8804.92},
			},
			want: []PerformancePoint{
				{Date: day(2026, time.April, 18), Value: 878.53},
				{Date: day(2026, time.April, 19), Value: 8804.92},
			},
		},
		{
			name: "zero days after the first value are kept",
			input: []PerformancePoint{
				{Date: day(2026, time.April, 18), Value: 0},
				{Date: day(2026, time.April, 19), Value: 120},
				{Date: day(2026, time.April, 20), Value: 0},
				{Date: day(2026, time.April, 21), Value: 90},
			},
			want: []PerformancePoint{
				{Date: day(2026, time.April, 19), Value: 120},
				{Date: day(2026, time.April, 20), Value: 0},
				{Date: day(2026, time.April, 21), Value: 90},
			},
		},
		{
			name: "negative value counts as held",
			input: []PerformancePoint{
				{Date: day(2026, time.April, 17), Value: 0},
				{Date: day(2026, time.April, 18), Value: -12},
			},
			want: []PerformancePoint{
				{Date: day(2026, time.April, 18), Value: -12},
			},
		},
		{
			name: "all-zero series returns empty so callers fall back",
			input: []PerformancePoint{
				{Date: day(2026, time.April, 18), Value: 0},
				{Date: day(2026, time.April, 19), Value: 0},
			},
			want: []PerformancePoint{},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := trimLeadingZeroPoints(tt.input)
			if len(got) != len(tt.want) {
				t.Fatalf("length = %d, want %d", len(got), len(tt.want))
			}
			for i := range got {
				if !got[i].Date.Equal(tt.want[i].Date) {
					t.Errorf("point %d date = %s, want %s", i, got[i].Date, tt.want[i].Date)
				}
				if got[i].Value != tt.want[i].Value {
					t.Errorf("point %d value = %v, want %v", i, got[i].Value, tt.want[i].Value)
				}
			}
		})
	}
}
