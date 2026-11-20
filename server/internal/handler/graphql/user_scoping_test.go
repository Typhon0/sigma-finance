package graphql

import (
	"context"
	"testing"

	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"sigma_finance/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUpdateAndDeleteUser_ScopedToCaller pins the rule that user mutations act
// on the caller's own account unless the caller is an administrator: without
// it, any authenticated user could rename another account, change its email
// (the login identifier) or delete it outright.
func TestUpdateAndDeleteUser_ScopedToCaller(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	uow := repository.NewUnitOfWork(testDB.DB)
	userSvc := service.NewUserService(uow)
	resolver := &Resolver{
		UserService: userSvc,
		UOW:         uow,
	}
	mutResolver := &mutationResolver{resolver}

	// Seed through the service: the resolver mutation is admin-only.
	victim, err := userSvc.CreateUser(ctx, service.CreateUserInput{
		Username: "victim",
		Email:    "victim@example.com",
		Password: "password123",
	})
	require.NoError(t, err)

	attacker, err := userSvc.CreateUser(ctx, service.CreateUserInput{
		Username: "attacker",
		Email:    "attacker@example.com",
		Password: "password123",
	})
	require.NoError(t, err)

	attackerCtx := withAuthUser(ctx, attacker.ID, attacker.Email)

	newName := "renamed-by-attacker"
	_, err = mutResolver.UpdateUser(attackerCtx, victim.ID, gqlModel.UpdateUserInput{Username: &newName})
	require.Error(t, err, "a non-admin must not update another user")

	record, err := uow.User().GetByID(ctx, victim.ID)
	require.NoError(t, err)
	assert.Equal(t, "victim", record.Name, "victim's name must be untouched")

	_, err = mutResolver.DeleteUser(attackerCtx, victim.ID)
	require.Error(t, err, "a non-admin must not delete another user")

	record, err = uow.User().GetByID(ctx, victim.ID)
	require.NoError(t, err, "victim must still exist")
	assert.Equal(t, victim.ID, record.ID)

	// The caller's own account stays editable.
	ownName := "attacker-renamed-self"
	updated, err := mutResolver.UpdateUser(attackerCtx, attacker.ID, gqlModel.UpdateUserInput{Username: &ownName})
	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, ownName, updated.Username)

	// An administrator may act on someone else's account.
	adminCtx := seedAdminCaller(t, ctx, uow, mutResolver)
	adminName := "renamed-by-admin"
	updated, err = mutResolver.UpdateUser(adminCtx, victim.ID, gqlModel.UpdateUserInput{Username: &adminName})
	require.NoError(t, err)
	assert.Equal(t, adminName, updated.Username)

	// An administrator may also delete another account.
	_, err = mutResolver.DeleteUser(adminCtx, victim.ID)
	require.NoError(t, err)

	_, err = uow.User().GetByID(ctx, victim.ID)
	require.Error(t, err, "deleted user must be gone")
}
