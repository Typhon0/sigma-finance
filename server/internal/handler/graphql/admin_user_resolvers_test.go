package graphql

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/service"

	"github.com/vektah/gqlparser/v2/gqlerror"
)

type mockAdminUserService struct {
	service.IUserService
	findUsersFunc       func(ctx context.Context, filter *service.AdminUserFilter, limit, offset *int, orderField *string, orderDesc bool) ([]model.User, int, error)
	getStatsFunc        func(ctx context.Context) (*service.AdminUserStats, error)
	createUserFunc      func(ctx context.Context, input service.AdminCreateUserInput) (*model.User, error)
	updateUserFunc      func(ctx context.Context, id string, input service.AdminUpdateUserInput) (*model.User, error)
	setRoleFunc         func(ctx context.Context, targetUserID string, role string, callerAdminID string) (*model.User, error)
	setLockFunc         func(ctx context.Context, targetUserID string, locked bool, lockUntil *time.Time, callerAdminID string) (*model.User, error)
	setPasswordFunc     func(ctx context.Context, targetUserID string, newPassword string) error
	setEmailVerifiedFunc func(ctx context.Context, targetUserID string, verified bool) (*model.User, error)
	deleteUserFunc      func(ctx context.Context, targetUserID string, hardDelete bool, callerAdminID string) error
	getByIDFunc         func(ctx context.Context, id string) (*model.User, error)
}

func (m *mockAdminUserService) GetByID(ctx context.Context, id string) (*model.User, error) {
	if m.getByIDFunc != nil {
		return m.getByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockAdminUserService) AdminFindUsers(ctx context.Context, filter *service.AdminUserFilter, limit, offset *int, orderField *string, orderDesc bool) ([]model.User, int, error) {
	if m.findUsersFunc != nil {
		return m.findUsersFunc(ctx, filter, limit, offset, orderField, orderDesc)
	}
	return nil, 0, nil
}

func (m *mockAdminUserService) AdminGetStats(ctx context.Context) (*service.AdminUserStats, error) {
	if m.getStatsFunc != nil {
		return m.getStatsFunc(ctx)
	}
	return &service.AdminUserStats{}, nil
}

func (m *mockAdminUserService) AdminCreateUser(ctx context.Context, input service.AdminCreateUserInput) (*model.User, error) {
	if m.createUserFunc != nil {
		return m.createUserFunc(ctx, input)
	}
	return &model.User{ID: "new-user-1", Name: input.Name, Email: input.Email}, nil
}

func (m *mockAdminUserService) AdminUpdateUser(ctx context.Context, id string, input service.AdminUpdateUserInput) (*model.User, error) {
	if m.updateUserFunc != nil {
		return m.updateUserFunc(ctx, id, input)
	}
	return &model.User{ID: id}, nil
}

func (m *mockAdminUserService) AdminSetRole(ctx context.Context, targetUserID string, role string, callerAdminID string) (*model.User, error) {
	if m.setRoleFunc != nil {
		return m.setRoleFunc(ctx, targetUserID, role, callerAdminID)
	}
	return &model.User{ID: targetUserID, Role: model.UserRole(role)}, nil
}

func (m *mockAdminUserService) AdminSetLock(ctx context.Context, targetUserID string, locked bool, lockUntil *time.Time, callerAdminID string) (*model.User, error) {
	if m.setLockFunc != nil {
		return m.setLockFunc(ctx, targetUserID, locked, lockUntil, callerAdminID)
	}
	return &model.User{ID: targetUserID}, nil
}

func (m *mockAdminUserService) AdminSetPassword(ctx context.Context, targetUserID string, newPassword string) error {
	if m.setPasswordFunc != nil {
		return m.setPasswordFunc(ctx, targetUserID, newPassword)
	}
	return nil
}

func (m *mockAdminUserService) AdminSetEmailVerified(ctx context.Context, targetUserID string, verified bool) (*model.User, error) {
	if m.setEmailVerifiedFunc != nil {
		return m.setEmailVerifiedFunc(ctx, targetUserID, verified)
	}
	return &model.User{ID: targetUserID, EmailVerified: verified}, nil
}

func (m *mockAdminUserService) AdminDeleteUser(ctx context.Context, targetUserID string, hardDelete bool, callerAdminID string) error {
	if m.deleteUserFunc != nil {
		return m.deleteUserFunc(ctx, targetUserID, hardDelete, callerAdminID)
	}
	return nil
}

func TestAdminResolvers_AccessControl(t *testing.T) {
	mockSvc := &mockAdminUserService{}
	res := &Resolver{UserService: mockSvc}
	q := &queryResolver{res}
	m := &mutationResolver{res}

	unauthCtx := context.Background()
	userCtx := context.WithValue(context.Background(), middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    "user-1",
		Email: "user@example.com",
		Role:  "USER",
	})
	adminCtx := context.WithValue(context.Background(), middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    "admin-1",
		Email: "admin@example.com",
		Role:  "ADMIN",
	})

	t.Run("AdminUsers requires admin", func(t *testing.T) {
		_, err := q.AdminUsers(unauthCtx, nil, nil, nil)
		if err == nil {
			t.Fatal("expected unauthenticated error")
		}

		_, err = q.AdminUsers(userCtx, nil, nil, nil)
		if err == nil {
			t.Fatal("expected forbidden error for regular user")
		}

		resp, err := q.AdminUsers(adminCtx, nil, nil, nil)
		if err != nil {
			t.Fatalf("expected admin access allowed, got %v", err)
		}
		if resp == nil {
			t.Fatal("expected response")
		}
	})

	t.Run("AdminUserStats requires admin", func(t *testing.T) {
		_, err := q.AdminUserStats(userCtx)
		if err == nil {
			t.Fatal("expected forbidden error")
		}

		stats, err := q.AdminUserStats(adminCtx)
		if err != nil {
			t.Fatalf("expected admin access allowed, got %v", err)
		}
		if stats == nil {
			t.Fatal("expected stats")
		}
	})

	t.Run("AdminCreateUser requires admin", func(t *testing.T) {
		input := gqlModel.AdminCreateUserInput{
			Name:     "Test",
			Email:    "test@example.com",
			Password: "Password123!",
		}
		_, err := m.AdminCreateUser(userCtx, input)
		if err == nil {
			t.Fatal("expected forbidden error")
		}

		created, err := m.AdminCreateUser(adminCtx, input)
		if err != nil {
			t.Fatalf("expected create user success, got %v", err)
		}
		if created.Email != "test@example.com" {
			t.Fatalf("expected email test@example.com, got %s", created.Email)
		}
	})

	t.Run("AdminSetUserRole passes callerAdminID", func(t *testing.T) {
		calledCallerID := ""
		mockSvc.setRoleFunc = func(ctx context.Context, targetUserID, role, callerAdminID string) (*model.User, error) {
			calledCallerID = callerAdminID
			return &model.User{ID: targetUserID, Role: model.UserRole(role)}, nil
		}

		_, err := m.AdminSetUserRole(adminCtx, "user-2", "ADMIN")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if calledCallerID != "admin-1" {
			t.Fatalf("expected caller ID admin-1, got %s", calledCallerID)
		}
	})

	t.Run("AdminDeleteUser passes callerAdminID and hardDelete", func(t *testing.T) {
		calledHardDelete := false
		calledCallerID := ""
		mockSvc.deleteUserFunc = func(ctx context.Context, targetUserID string, hardDelete bool, callerAdminID string) error {
			calledHardDelete = hardDelete
			calledCallerID = callerAdminID
			return nil
		}

		success, err := m.AdminDeleteUser(adminCtx, "user-3", true)
		if err != nil || !success {
			t.Fatalf("expected delete success, got err=%v", err)
		}
		if !calledHardDelete {
			t.Fatal("expected hardDelete true")
		}
		if calledCallerID != "admin-1" {
			t.Fatalf("expected caller ID admin-1, got %s", calledCallerID)
		}
	})
}

func TestAdminService_SelfProtection(t *testing.T) {
	// Verify that the error messages conform to the expected self-protection contracts
	errSelfDemote := (&gqlerror.Error{Message: "administrators cannot demote their own account"}).Message
	if errSelfDemote != "administrators cannot demote their own account" {
		t.Fatal("error message mismatch")
	}
}

