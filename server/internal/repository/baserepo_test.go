package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepository_Create(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	repo := NewRepository[model.User](testDB.DB)

	user := &model.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}

	createdUser, err := repo.Create(ctx, user)
	require.NoError(t, err)
	assert.NotZero(t, createdUser.ID)
	assert.Equal(t, "testuser", createdUser.Username)
	assert.Equal(t, "test@example.com", createdUser.Email)
	assert.NotZero(t, createdUser.CreatedAt)
	assert.NotZero(t, createdUser.UpdatedAt)
}

func TestRepository_GetByID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	user, err := repo.GetByID(ctx, uint(testData.Users[0].ID))
	require.NoError(t, err)
	assert.Equal(t, testData.Users[0].ID, user.ID)
	assert.Equal(t, testData.Users[0].Username, user.Username)
	assert.Equal(t, testData.Users[0].Email, user.Email)
}

func TestRepository_GetByID_NotFound(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	repo := NewRepository[model.User](testDB.DB)

	_, err := repo.GetByID(ctx, 999)
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepository_Update(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	user := testData.Users[0]
	user.Email = "updated@example.com"

	err := repo.Update(ctx, user)
	require.NoError(t, err)

	// Verify the update
	updatedUser, err := repo.GetByID(ctx, uint(user.ID))
	require.NoError(t, err)
	assert.Equal(t, "updated@example.com", updatedUser.Email)
}

func TestRepository_Update_NotFound(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	repo := NewRepository[model.User](testDB.DB)

	user := &model.User{
		ID:       999,
		Username: "nonexistent",
		Email:    "nonexistent@example.com",
		Password: "password",
	}

	err := repo.Update(ctx, user)
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepository_Delete(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	err := repo.Delete(ctx, uint(testData.Users[0].ID))
	require.NoError(t, err)

	// Verify the deletion
	_, err = repo.GetByID(ctx, uint(testData.Users[0].ID))
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepository_Delete_NotFound(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	repo := NewRepository[model.User](testDB.DB)

	err := repo.Delete(ctx, 999)
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepository_FindAllBy(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	_ = testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	users, err := repo.FindAllBy(ctx)
	require.NoError(t, err)
	assert.Len(t, users, 2)
}

func TestRepository_FindAllBy_WithLimit(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	_ = testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	users, err := repo.FindAllBy(ctx, WithLimit(1))
	require.NoError(t, err)
	assert.Len(t, users, 1)
}

func TestRepository_FindOneBy(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	user, err := repo.FindOneBy(ctx, ByColumn("email", testData.Users[0].Email))
	require.NoError(t, err)
	assert.Equal(t, testData.Users[0].ID, user.ID)
	assert.Equal(t, testData.Users[0].Email, user.Email)
}

func TestRepository_FindOneBy_NotFound(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	repo := NewRepository[model.User](testDB.DB)

	_, err := repo.FindOneBy(ctx, ByColumn("email", "nonexistent@example.com"))
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepository_Count(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	_ = testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	count, err := repo.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 2, count)
}

func TestRepository_Count_WithFilter(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	count, err := repo.Count(ctx, ByColumn("email", testData.Users[0].Email))
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestQueryOptions(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	_ = testDB.SeedTestData(ctx)

	repo := NewRepository[model.User](testDB.DB)

	t.Run("WithOrder", func(t *testing.T) {
		users, err := repo.FindAllBy(ctx, WithOrder("username DESC"))
		require.NoError(t, err)
		assert.Len(t, users, 2)
		// Assuming testuser2 comes before testuser1 in DESC order
		assert.Equal(t, "testuser2", users[0].Username)
	})

	t.Run("WithOffset", func(t *testing.T) {
		users, err := repo.FindAllBy(ctx, WithOffset(1), WithOrder("username ASC"))
		require.NoError(t, err)
		assert.Len(t, users, 1)
		assert.Equal(t, "testuser2", users[0].Username)
	})

	t.Run("Combined Options", func(t *testing.T) {
		users, err := repo.FindAllBy(ctx, WithLimit(1), WithOffset(0), WithOrder("username ASC"))
		require.NoError(t, err)
		assert.Len(t, users, 1)
		assert.Equal(t, "testuser1", users[0].Username)
	})
}
