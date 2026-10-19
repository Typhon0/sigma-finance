package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/uptrace/bun"
)

func TestAccountRepository_Basic(t *testing.T) {
	t.Run("NewAccountRepository creates repository", func(t *testing.T) {
		var db bun.IDB
		repo := NewAccountRepository(db)

		assert.NotNil(t, repo)
		assert.NotNil(t, repo.Repository)
	})

	t.Run("AccountRepository implements IAccountRepository", func(t *testing.T) {
		var db bun.IDB
		var _ IAccountRepository = NewAccountRepository(db)
	})
}
