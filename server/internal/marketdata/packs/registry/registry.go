package registry

import "time"

type PlannedPack struct {
	PackID         string
	Version        string
	Name           string
	Distribution   string
	SourceProvider string
	CreatedAt      time.Time
}
