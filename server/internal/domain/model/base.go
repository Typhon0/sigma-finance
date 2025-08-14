package model

import "time"

// Entity is a base interface that all model must implement
type Entity interface {
	GetID() int64
	SetID(id int64)
	GetCreatedAt() time.Time
	SetCreatedAt(time.Time)
	GetUpdatedAt() time.Time
	SetUpdatedAt(time.Time)
}

// BaseEntity is a base struct that implements Entity interface
type BaseEntity struct {
	ID        int64     `db:"id"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

func (e *BaseEntity) GetID() int64 {
	return e.ID
}

func (e *BaseEntity) SetID(id int64) {
	e.ID = id
}

func (e *BaseEntity) GetCreatedAt() time.Time {
	return e.CreatedAt
}

func (e *BaseEntity) SetCreatedAt(t time.Time) {
	e.CreatedAt = t
}

func (e *BaseEntity) GetUpdatedAt() time.Time {
	return e.UpdatedAt
}

func (e *BaseEntity) SetUpdatedAt(t time.Time) {
	e.UpdatedAt = t
}
