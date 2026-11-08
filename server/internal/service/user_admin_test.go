package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

type mockUserRepoForAdmin struct {
	repository.IUserRepository
	users map[string]*model.User
}

func (m *mockUserRepoForAdmin) GetByID(ctx context.Context, id string) (*model.User, error) {
	u, ok := m.users[id]
	if !ok {
		return nil, repository.ErrNotFound
	}
	return u, nil
}

func (m *mockUserRepoForAdmin) Update(ctx context.Context, u *model.User) error {
	m.users[u.ID] = u
	return nil
}

func (m *mockUserRepoForAdmin) Delete(ctx context.Context, id string) error {
	delete(m.users, id)
	return nil
}

func (m *mockUserRepoForAdmin) UpdatePasswordHash(ctx context.Context, userID, hash string) error {
	u, ok := m.users[userID]
	if !ok {
		return repository.ErrNotFound
	}
	u.PasswordHash = &hash
	return nil
}

func (m *mockUserRepoForAdmin) UpdateEmailVerified(ctx context.Context, userID string, verified bool) error {
	u, ok := m.users[userID]
	if !ok {
		return repository.ErrNotFound
	}
	u.EmailVerified = verified
	return nil
}

type mockSessionRepoForAdmin struct {
	repository.ISessionRepository
	revokedUserIDs []string
}

func (m *mockSessionRepoForAdmin) RevokeAllUserSessions(ctx context.Context, userID string) error {
	m.revokedUserIDs = append(m.revokedUserIDs, userID)
	return nil
}

type mockUoWForAdmin struct {
	repository.IUnitOfWork
	userRepo    *mockUserRepoForAdmin
	sessionRepo *mockSessionRepoForAdmin
}

func (m *mockUoWForAdmin) User() repository.IUserRepository {
	return m.userRepo
}

func (m *mockUoWForAdmin) Session() repository.ISessionRepository {
	return m.sessionRepo
}

func TestAdminService_SelfProtectionAndActions(t *testing.T) {
	adminID := "admin-id-1"
	otherUserID := "user-id-2"

	userRepo := &mockUserRepoForAdmin{
		users: map[string]*model.User{
			adminID: {
				ID:    adminID,
				Email: "admin@example.com",
				Role:  model.UserRoleAdmin,
			},
			otherUserID: {
				ID:    otherUserID,
				Email: "other@example.com",
				Role:  model.UserRoleUser,
			},
		},
	}
	sessionRepo := &mockSessionRepoForAdmin{}
	uow := &mockUoWForAdmin{userRepo: userRepo, sessionRepo: sessionRepo}
	svc := NewUserService(uow)

	ctx := context.Background()

	t.Run("Self role demotion rejected", func(t *testing.T) {
		_, err := svc.AdminSetRole(ctx, adminID, "USER", adminID)
		if err == nil {
			t.Fatal("expected error on self demote")
		}
	})

	t.Run("Other user role change accepted", func(t *testing.T) {
		updated, err := svc.AdminSetRole(ctx, otherUserID, "ADMIN", adminID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.Role != model.UserRoleAdmin {
			t.Fatalf("expected role ADMIN, got %s", updated.Role)
		}
	})

	t.Run("Self lock rejected", func(t *testing.T) {
		_, err := svc.AdminSetLock(ctx, adminID, true, nil, adminID)
		if err == nil {
			t.Fatal("expected error on self lock")
		}
	})

	t.Run("Other user lock revokes sessions", func(t *testing.T) {
		sessionRepo.revokedUserIDs = nil
		lockTime := time.Now().Add(2 * time.Hour)
		updated, err := svc.AdminSetLock(ctx, otherUserID, true, &lockTime, adminID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if updated.LockedUntil == nil {
			t.Fatal("expected lockedUntil to be set")
		}
		if len(sessionRepo.revokedUserIDs) != 1 || sessionRepo.revokedUserIDs[0] != otherUserID {
			t.Fatalf("expected sessions revoked for %s, got %v", otherUserID, sessionRepo.revokedUserIDs)
		}
	})

	t.Run("Self delete rejected", func(t *testing.T) {
		err := svc.AdminDeleteUser(ctx, adminID, true, adminID)
		if err == nil {
			t.Fatal("expected error on self delete")
		}
		err = svc.AdminDeleteUser(ctx, adminID, false, adminID)
		if err == nil {
			t.Fatal("expected error on self disable")
		}
	})

	t.Run("Password reset validation and session revocation", func(t *testing.T) {
		sessionRepo.revokedUserIDs = nil
		err := svc.AdminSetPassword(ctx, otherUserID, "short")
		if err == nil {
			t.Fatal("expected error on short password")
		}

		err = svc.AdminSetPassword(ctx, otherUserID, "SecurePassword123!")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(sessionRepo.revokedUserIDs) != 1 || sessionRepo.revokedUserIDs[0] != otherUserID {
			t.Fatalf("expected sessions revoked for %s, got %v", otherUserID, sessionRepo.revokedUserIDs)
		}
	})
}

