// Package repository contains the data access layer for the application.
// It provides a robust, generic repository implementation using Bun ORM,
// along with a Unit of Work pattern for handling atomic transactions.
package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/uptrace/bun"
)

// ErrNotFound is a standard error returned when a requested record is not found.
// Services should check for this specific error to handle "not found" cases gracefully.
var ErrNotFound = errors.New("record not found")

// QueryOption defines a function signature for modifying a bun.SelectQuery.
// This enables a flexible and composable way to build database queries.
type QueryOption func(*bun.SelectQuery) *bun.SelectQuery

// IDBProvider provides access to the underlying database connection for custom operations
type IDBProvider interface {
	GetDB() bun.IDB
}

// IRepository defines the enhanced generic repository interface. It provides
// a standard set of methods for data manipulation and querying.
type IRepository[T any] interface {
	IDBProvider
	Create(ctx context.Context, entity *T) (*T, error)
	Update(ctx context.Context, entity *T) error
	Delete(ctx context.Context, id uint) error
	GetByID(ctx context.Context, id uint) (T, error)
	FindOneBy(ctx context.Context, options ...QueryOption) (T, error)
	FindAllBy(ctx context.Context, options ...QueryOption) ([]T, error)
	Count(ctx context.Context, options ...QueryOption) (int, error)
}

// Repository is the concrete implementation of the IRepository interface.
// It uses bun.IDB, which allows it to work seamlessly with both a standard
// database connection pool (bun.DB) and a database transaction (bun.Tx).
type Repository[T any] struct {
	db bun.IDB
}

// GetDB returns the underlying database connection for custom operations
func (r *Repository[T]) GetDB() bun.IDB {
	return r.db
}

// NewRepository is the public constructor for a standard repository instance.
// It should be called at application startup with the main DB connection pool.
func NewRepository[T any](db *bun.DB) *Repository[T] {
	return &Repository[T]{db: db}
}

// Create persists a new entity to the database.
// It uses .Returning("*") to scan all database-generated values (like ID, timestamps) back into the entity.
func (r *Repository[T]) Create(ctx context.Context, entity *T) (*T, error) {
	_, err := r.db.NewInsert().Model(entity).Returning("*").Exec(ctx)
	return entity, err
}

// Update saves changes to an existing entity, identified by its primary key.
// It returns ErrNotFound if no record with the given PK exists.
func (r *Repository[T]) Update(ctx context.Context, entity *T) error {
	res, err := r.db.NewUpdate().Model(entity).WherePK().Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// Delete removes an entity by its primary key.
// It returns ErrNotFound if no record with the given PK exists.
func (r *Repository[T]) Delete(ctx context.Context, id uint) error {
	res, err := r.db.NewDelete().Model((*T)(nil)).Where("id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// GetByID is a convenience method that retrieves a single entity by its primary key.
func (r *Repository[T]) GetByID(ctx context.Context, id uint) (T, error) {
	return r.FindOneBy(ctx, ByID(id))
}

// FindOneBy finds the first record that matches the given query options.
// It wraps the database driver's "no rows" error in the standard ErrNotFound.
func (r *Repository[T]) FindOneBy(ctx context.Context, options ...QueryOption) (T, error) {
	var entity T
	query := r.db.NewSelect().Model(&entity)

	for _, option := range options {
		query = option(query)
	}

	err := query.Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return entity, ErrNotFound
		}
		return entity, err
	}
	return entity, nil
}

// FindAllBy retrieves a slice of all entities that match the given query options.
func (r *Repository[T]) FindAllBy(ctx context.Context, options ...QueryOption) ([]T, error) {
	var entities []T
	query := r.db.NewSelect().Model(&entities)

	for _, option := range options {
		query = option(query)
	}

	err := query.Scan(ctx)
	return entities, err
}

// Count returns the total number of records that match the given query options.
func (r *Repository[T]) Count(ctx context.Context, options ...QueryOption) (int, error) {
	query := r.db.NewSelect().Model((*T)(nil))

	for _, option := range options {
		query = option(query)
	}

	return query.Count(ctx)
}

// --- Reusable QueryOption Helpers ---

// ByColumn creates a generic "WHERE column = value" clause.
// It uses bun.Ident to safely escape the column name, preventing SQL injection.
func ByColumn(column string, value any) QueryOption {
	return func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("? = ?", bun.Ident(column), value)
	}
}

// WithLimit applies a LIMIT clause to the query.
func WithLimit(limit int) QueryOption {
	return func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Limit(limit)
	}
}

// WithOffset applies an OFFSET clause, typically for pagination.
func WithOffset(offset int) QueryOption {
	return func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Offset(offset)
	}
}

// WithOrder applies an ORDER BY clause. E.g., WithOrder("created_at DESC").
func WithOrder(order string) QueryOption {
	return func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Order(order)
	}
}

// WithPreload enables eager loading of related models to solve the N+1 problem.
// The relation string must match the struct field name. E.g., WithPreload("User").
func WithPreload(relation string) QueryOption {
	return func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Relation(relation)
	}
}

// WithSoftDeleted includes records that have been soft-deleted.
// This requires the model struct to have a `deleted_at` field with the `bun:",soft_delete"` tag.
func WithSoftDeleted() QueryOption {
	return func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.WhereAllWithDeleted()
	}
}

// ByID creates a WHERE clause for the primary key.
func ByID(id uint) QueryOption {
	return func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("id = ?", id)
	}
}
