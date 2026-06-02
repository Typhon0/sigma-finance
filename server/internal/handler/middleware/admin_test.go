package middleware

import (
	"context"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// ── Mock SessionService ──────────────────────────────────────────────

type mockSessionService struct {
	mock.Mock
}

func (m *mockSessionService) ValidateSession(ctx context.Context, token string) (*model.Session, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *mockSessionService) CreateSession(ctx context.Context, userID, ipAddress, userAgent string) (*model.Session, error) {
	args := m.Called(ctx, userID, ipAddress, userAgent)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *mockSessionService) RefreshSession(ctx context.Context, refreshToken string) (*model.Session, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *mockSessionService) RevokeSession(ctx context.Context, token string) error {
	return m.Called(ctx, token).Error(0)
}

func (m *mockSessionService) RevokeAllUserSessions(ctx context.Context, userID string) error {
	return m.Called(ctx, userID).Error(0)
}

func (m *mockSessionService) GetUserSessions(ctx context.Context, userID string) ([]model.Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *mockSessionService) GetActiveUserSessions(ctx context.Context, userID string) ([]model.Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *mockSessionService) CleanupExpiredSessions(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *mockSessionService) ExtendSession(ctx context.Context, sessionID string, duration time.Duration) error {
	return m.Called(ctx, sessionID, duration).Error(0)
}

// ── Mock IUserService ────────────────────────────────────────────────

type mockUserService struct {
	mock.Mock
}

func (m *mockUserService) GetByID(ctx context.Context, id string) (*model.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *mockUserService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.User, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *mockUserService) CreateUser(ctx context.Context, input service.CreateUserInput) (*model.User, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *mockUserService) UpdateUser(ctx context.Context, id string, input service.UpdateUserInput) (*model.User, error) {
	args := m.Called(ctx, id, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *mockUserService) DeleteUser(ctx context.Context, id string) error {
	return m.Called(ctx, id).Error(0)
}

// helper to build a minimal app with admin-protected route
func newAdminTestApp(sessionSvc service.SessionService, userSvc service.IUserService) *fiber.App {
	app := fiber.New()
	adminGroup := app.Group("/admin",
		AuthMiddleware(sessionSvc),
		AdminMiddleware(userSvc),
	)
	adminGroup.Get("/logs/go", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})
	return app
}

func helperAdminUser(userID string) *model.User {
	return &model.User{
		ID:   userID,
		Role: model.UserRoleAdmin,
	}
}

func helperRegularUser(userID string) *model.User {
	return &model.User{
		ID:   userID,
		Role: model.UserRoleUser,
	}
}

// ── Tests ────────────────────────────────────────────────────────────

func TestAdminMiddleware_NoAuthHeader(t *testing.T) {
	sessionSvc := new(mockSessionService)
	userSvc := new(mockUserService)
	app := newAdminTestApp(sessionSvc, userSvc)

	req := httptest.NewRequest("GET", "/admin/logs/go", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Contains(t, string(body), "Authorization header required")

	sessionSvc.AssertNotCalled(t, "ValidateSession")
	userSvc.AssertNotCalled(t, "GetByID")
}

func TestAdminMiddleware_NonAdminReturns403(t *testing.T) {
	sessionSvc := new(mockSessionService)
	userSvc := new(mockUserService)

	validSession := &model.Session{
		ID:     "sess-1",
		UserID: "user-regular",
	}

	sessionSvc.On("ValidateSession", mock.Anything, "valid-token").Return(validSession, nil)
	userSvc.On("GetByID", mock.Anything, "user-regular").Return(helperRegularUser("user-regular"), nil)

	app := newAdminTestApp(sessionSvc, userSvc)

	req := httptest.NewRequest("GET", "/admin/logs/go", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Contains(t, string(body), "admin access required")

	sessionSvc.AssertExpectations(t)
	userSvc.AssertExpectations(t)
}

func TestAdminMiddleware_AdminGets200(t *testing.T) {
	sessionSvc := new(mockSessionService)
	userSvc := new(mockUserService)

	validSession := &model.Session{
		ID:     "sess-2",
		UserID: "user-admin",
	}

	sessionSvc.On("ValidateSession", mock.Anything, "admin-token").Return(validSession, nil)
	userSvc.On("GetByID", mock.Anything, "user-admin").Return(helperAdminUser("user-admin"), nil)

	app := newAdminTestApp(sessionSvc, userSvc)

	req := httptest.NewRequest("GET", "/admin/logs/go", nil)
	req.Header.Set("Authorization", "Bearer admin-token")
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Contains(t, string(body), `"ok":true`)

	sessionSvc.AssertExpectations(t)
	userSvc.AssertExpectations(t)
}

func TestAdminMiddleware_InvalidTokenReturns401(t *testing.T) {
	sessionSvc := new(mockSessionService)
	userSvc := new(mockUserService)

	sessionSvc.On("ValidateSession", mock.Anything, "bad-token").
		Return(nil, service.NewAuthError("invalid_token", "invalid token", ""))

	app := newAdminTestApp(sessionSvc, userSvc)

	req := httptest.NewRequest("GET", "/admin/logs/go", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	sessionSvc.AssertExpectations(t)
	userSvc.AssertNotCalled(t, "GetByID")
}

func TestAdminMiddleware_UserNotFoundReturns401(t *testing.T) {
	sessionSvc := new(mockSessionService)
	userSvc := new(mockUserService)

	validSession := &model.Session{
		ID:     "sess-3",
		UserID: "user-gone",
	}

	sessionSvc.On("ValidateSession", mock.Anything, "orphan-token").Return(validSession, nil)
	userSvc.On("GetByID", mock.Anything, "user-gone").Return(nil, assert.AnError)

	app := newAdminTestApp(sessionSvc, userSvc)

	req := httptest.NewRequest("GET", "/admin/logs/go", nil)
	req.Header.Set("Authorization", "Bearer orphan-token")
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	sessionSvc.AssertExpectations(t)
	userSvc.AssertExpectations(t)
}
