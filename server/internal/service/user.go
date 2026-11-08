package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/uptrace/bun"
	"golang.org/x/crypto/bcrypt"
)

type AdminUserFilter struct {
	Search        *string
	Role          *string
	IsLocked      *bool
	EmailVerified *bool
}

type AdminUserStats struct {
	TotalUsers      int
	ActiveUsers     int
	LockedUsers     int
	AdminUsers      int
	UnverifiedUsers int
}

type AdminCreateUserInput struct {
	Name          string
	Email         string
	Password      string
	Role          *string
	EmailVerified *bool
}

type AdminUpdateUserInput struct {
	Name            *string
	Email           *string
	Role            *string
	TaxJurisdiction *string
	DisplayCurrency *string
}

type IUserService interface {
	GetByID(ctx context.Context, id string) (*model.User, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.User, error)
	CreateUser(ctx context.Context, input CreateUserInput) (*model.User, error)
	UpdateUser(ctx context.Context, id string, input UpdateUserInput) (*model.User, error)
	DeleteUser(ctx context.Context, id string) error

	// Admin methods
	AdminFindUsers(ctx context.Context, filter *AdminUserFilter, limit, offset *int, orderField *string, orderDesc bool) ([]model.User, int, error)
	AdminGetStats(ctx context.Context) (*AdminUserStats, error)
	AdminCreateUser(ctx context.Context, input AdminCreateUserInput) (*model.User, error)
	AdminUpdateUser(ctx context.Context, id string, input AdminUpdateUserInput) (*model.User, error)
	AdminSetRole(ctx context.Context, targetUserID string, role string, callerAdminID string) (*model.User, error)
	AdminSetLock(ctx context.Context, targetUserID string, locked bool, lockUntil *time.Time, callerAdminID string) (*model.User, error)
	AdminSetPassword(ctx context.Context, targetUserID string, newPassword string) error
	AdminSetEmailVerified(ctx context.Context, targetUserID string, verified bool) (*model.User, error)
	AdminDeleteUser(ctx context.Context, targetUserID string, hardDelete bool, callerAdminID string) error
}

type UserService struct {
	uow repository.IUnitOfWork
}

func NewUserService(uow repository.IUnitOfWork) *UserService {
	return &UserService{uow: uow}
}

type CreateUserInput struct {
	Username string
	Email    string
	Password string
}

type UpdateUserInput struct {
	Username *string
	Email    *string
	Password *string
}

func (s *UserService) GetByID(ctx context.Context, id string) (*model.User, error) {
	return s.uow.User().GetByID(ctx, id)
}

func (s *UserService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.User, error) {
	return s.uow.User().FindAllBy(ctx, opts...)
}

func (s *UserService) CreateUser(ctx context.Context, input CreateUserInput) (*model.User, error) {
	log.Printf("[INFO] [UserService] CreateUser: started username=%s email=%s", input.Username, input.Email)
	if len(input.Username) < 3 {
		return nil, errors.New("username must be at least 3 characters long")
	}
	if input.Email == "" {
		return nil, errors.New("email is required")
	}
	newUser := model.User{
		Name:  input.Username, // Map Username to Name field
		Email: input.Email,
		// PasswordHash will be set by authentication service
	}
	createdUser, err := s.uow.User().Create(ctx, &newUser)
	if err != nil {
		log.Printf("[ERROR] [UserService] CreateUser: ERROR: creation failed username=%s: %v", input.Username, err)
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	log.Printf("[INFO] [UserService] CreateUser: SUCCESS id=%s username=%s", createdUser.ID, input.Username)
	return createdUser, nil
}

func (s *UserService) UpdateUser(ctx context.Context, id string, input UpdateUserInput) (*model.User, error) {
	log.Printf("[INFO] [UserService] UpdateUser: started id=%s", id)
	userToUpdate, err := s.uow.User().GetByID(ctx, id)
	if err != nil {
		log.Printf("[WARN] [UserService] UpdateUser: ERROR not found id=%s: %v", id, err)
		return nil, err
	}

	// Only update fields that are provided
	if input.Username != nil {
		userToUpdate.Name = *input.Username
	}
	if input.Email != nil {
		userToUpdate.Email = *input.Email
	}
	if input.Password != nil {
		// Password updates should be handled by authentication service
		// userToUpdate.PasswordHash = hashedPassword
	}

	err = s.uow.User().Update(ctx, userToUpdate)
	if err != nil {
		log.Printf("[ERROR] [UserService] UpdateUser: ERROR update failed id=%s: %v", id, err)
		return nil, fmt.Errorf("failed to update user: %w", err)
	}
	log.Printf("[INFO] [UserService] UpdateUser: SUCCESS id=%s", id)
	return userToUpdate, nil
}

func (s *UserService) DeleteUser(ctx context.Context, id string) error {
	log.Printf("[INFO] [UserService] DeleteUser: started id=%s", id)
	err := s.uow.User().Delete(ctx, id)
	if err != nil {
		log.Printf("[ERROR] [UserService] DeleteUser: ERROR id=%s: %v", id, err)
	} else {
		log.Printf("[INFO] [UserService] DeleteUser: SUCCESS id=%s", id)
	}
	return err
}

func (s *UserService) AdminFindUsers(ctx context.Context, filter *AdminUserFilter, limit, offset *int, orderField *string, orderDesc bool) ([]model.User, int, error) {
	log.Printf("[INFO] [UserService] AdminFindUsers: started")
	db := s.uow.User().GetDB()

	buildQuery := func() *bun.SelectQuery {
		q := db.NewSelect().Model((*model.User)(nil))
		if filter != nil {
			if filter.Search != nil && strings.TrimSpace(*filter.Search) != "" {
				term := strings.ToLower(strings.TrimSpace(*filter.Search))
				q = q.Where("LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR id::text LIKE ?", "%"+term+"%", "%"+term+"%", "%"+term+"%")
			}
			if filter.Role != nil && strings.TrimSpace(*filter.Role) != "" {
				q = q.Where("UPPER(role) = ?", strings.ToUpper(strings.TrimSpace(*filter.Role)))
			}
			if filter.IsLocked != nil {
				if *filter.IsLocked {
					q = q.Where("locked_until IS NOT NULL AND locked_until > NOW()")
				} else {
					q = q.Where("locked_until IS NULL OR locked_until <= NOW()")
				}
			}
			if filter.EmailVerified != nil {
				q = q.Where("email_verified = ?", *filter.EmailVerified)
			}
		}
		return q
	}

	totalCount, err := buildQuery().Count(ctx)
	if err != nil {
		log.Printf("[ERROR] [UserService] AdminFindUsers: count failed: %v", err)
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	dataQuery := buildQuery()

	// Ordering
	direction := "ASC"
	if orderDesc {
		direction = "DESC"
	}

	sortColumn := "created_at"
	if orderField != nil {
		switch strings.ToUpper(*orderField) {
		case "NAME", "USERNAME":
			sortColumn = "name"
		case "EMAIL":
			sortColumn = "email"
		case "LAST_LOGIN_AT", "LASTLOGIN":
			sortColumn = "last_login_at"
		case "CREATED_AT":
			sortColumn = "created_at"
		}
	}
	dataQuery = dataQuery.Order(fmt.Sprintf("%s %s", sortColumn, direction))

	if limit != nil && *limit > 0 {
		dataQuery = dataQuery.Limit(*limit)
	} else {
		dataQuery = dataQuery.Limit(20)
	}

	if offset != nil && *offset >= 0 {
		dataQuery = dataQuery.Offset(*offset)
	}

	var users []model.User
	if err := dataQuery.Scan(ctx, &users); err != nil {
		log.Printf("[ERROR] [UserService] AdminFindUsers: scan failed: %v", err)
		return nil, 0, fmt.Errorf("failed to fetch users: %w", err)
	}

	return users, totalCount, nil
}

func (s *UserService) AdminGetStats(ctx context.Context) (*AdminUserStats, error) {
	log.Printf("[INFO] [UserService] AdminGetStats: started")
	db := s.uow.User().GetDB()

	type rawStats struct {
		TotalUsers      int `bun:"total_users"`
		ActiveUsers     int `bun:"active_users"`
		LockedUsers     int `bun:"locked_users"`
		AdminUsers      int `bun:"admin_users"`
		UnverifiedUsers int `bun:"unverified_users"`
	}

	var st rawStats
	err := db.NewSelect().
		TableExpr("sigma_finance.user AS u").
		ColumnExpr("COUNT(*) AS total_users").
		ColumnExpr("COUNT(*) FILTER (WHERE locked_until IS NULL OR locked_until <= NOW()) AS active_users").
		ColumnExpr("COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW()) AS locked_users").
		ColumnExpr("COUNT(*) FILTER (WHERE UPPER(role) = 'ADMIN') AS admin_users").
		ColumnExpr("COUNT(*) FILTER (WHERE email_verified = false) AS unverified_users").
		Scan(ctx, &st)
	if err != nil {
		log.Printf("[ERROR] [UserService] AdminGetStats: query failed: %v", err)
		return nil, fmt.Errorf("failed to fetch user statistics: %w", err)
	}

	return &AdminUserStats{
		TotalUsers:      st.TotalUsers,
		ActiveUsers:     st.ActiveUsers,
		LockedUsers:     st.LockedUsers,
		AdminUsers:      st.AdminUsers,
		UnverifiedUsers: st.UnverifiedUsers,
	}, nil
}

func (s *UserService) AdminCreateUser(ctx context.Context, input AdminCreateUserInput) (*model.User, error) {
	log.Printf("[INFO] [UserService] AdminCreateUser: started email=%s", input.Email)
	if strings.TrimSpace(input.Email) == "" {
		return nil, errors.New("email is required")
	}
	if len(input.Password) < 8 {
		return nil, errors.New("password must be at least 8 characters long")
	}

	existing, _ := s.uow.User().GetByEmail(ctx, strings.TrimSpace(input.Email))
	if existing != nil {
		return nil, errors.New("a user with this email address already exists")
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}
	hashStr := string(hashBytes)

	role := model.UserRoleUser
	if input.Role != nil && strings.EqualFold(strings.TrimSpace(*input.Role), string(model.UserRoleAdmin)) {
		role = model.UserRoleAdmin
	}

	emailVerified := false
	if input.EmailVerified != nil {
		emailVerified = *input.EmailVerified
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = strings.Split(input.Email, "@")[0]
	}

	newUser := model.User{
		Name:            name,
		Email:           strings.TrimSpace(input.Email),
		PasswordHash:    &hashStr,
		Role:            role,
		EmailVerified:   emailVerified,
		DisplayCurrency: model.CurrencyUSD,
		TaxJurisdiction: "FR",
	}

	createdUser, err := s.uow.User().Create(ctx, &newUser)
	if err != nil {
		log.Printf("[ERROR] [UserService] AdminCreateUser: creation failed: %v", err)
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	log.Printf("[INFO] [UserService] AdminCreateUser: created user id=%s", createdUser.ID)
	return createdUser, nil
}

func (s *UserService) AdminUpdateUser(ctx context.Context, id string, input AdminUpdateUserInput) (*model.User, error) {
	log.Printf("[INFO] [UserService] AdminUpdateUser: started id=%s", id)
	user, err := s.uow.User().GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if input.Name != nil && strings.TrimSpace(*input.Name) != "" {
		user.Name = strings.TrimSpace(*input.Name)
	}
	if input.Email != nil && strings.TrimSpace(*input.Email) != "" {
		cleanEmail := strings.TrimSpace(*input.Email)
		if !strings.EqualFold(user.Email, cleanEmail) {
			existing, _ := s.uow.User().GetByEmail(ctx, cleanEmail)
			if existing != nil && existing.ID != user.ID {
				return nil, errors.New("a user with this email address already exists")
			}
			user.Email = cleanEmail
		}
	}
	if input.Role != nil && strings.TrimSpace(*input.Role) != "" {
		user.Role = model.UserRole(strings.ToUpper(strings.TrimSpace(*input.Role)))
	}
	if input.TaxJurisdiction != nil && strings.TrimSpace(*input.TaxJurisdiction) != "" {
		user.TaxJurisdiction = strings.ToUpper(strings.TrimSpace(*input.TaxJurisdiction))
	}
	if input.DisplayCurrency != nil && strings.TrimSpace(*input.DisplayCurrency) != "" {
		user.DisplayCurrency = model.Currency(strings.ToUpper(strings.TrimSpace(*input.DisplayCurrency)))
	}
	user.UpdatedAt = time.Now()

	if err := s.uow.User().Update(ctx, user); err != nil {
		log.Printf("[ERROR] [UserService] AdminUpdateUser: update failed: %v", err)
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return user, nil
}

func (s *UserService) AdminSetRole(ctx context.Context, targetUserID string, role string, callerAdminID string) (*model.User, error) {
	log.Printf("[INFO] [UserService] AdminSetRole: target=%s role=%s caller=%s", targetUserID, role, callerAdminID)
	normalizedRole := strings.ToUpper(strings.TrimSpace(role))
	if normalizedRole != string(model.UserRoleUser) && normalizedRole != string(model.UserRoleAdmin) {
		return nil, errors.New("invalid role: must be USER or ADMIN")
	}

	if callerAdminID != "" && targetUserID == callerAdminID && normalizedRole != string(model.UserRoleAdmin) {
		return nil, errors.New("administrators cannot demote their own account")
	}

	user, err := s.uow.User().GetByID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	user.Role = model.UserRole(normalizedRole)
	user.UpdatedAt = time.Now()

	if err := s.uow.User().Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update role: %w", err)
	}

	return user, nil
}

func (s *UserService) AdminSetLock(ctx context.Context, targetUserID string, locked bool, lockUntil *time.Time, callerAdminID string) (*model.User, error) {
	log.Printf("[INFO] [UserService] AdminSetLock: target=%s locked=%v caller=%s", targetUserID, locked, callerAdminID)
	if callerAdminID != "" && targetUserID == callerAdminID && locked {
		return nil, errors.New("administrators cannot lock their own account")
	}

	user, err := s.uow.User().GetByID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	if locked {
		until := time.Now().Add(24 * time.Hour)
		if lockUntil != nil && lockUntil.After(time.Now()) {
			until = *lockUntil
		}
		user.LockedUntil = &until
		// Invalidate active sessions immediately
		_ = s.uow.Session().RevokeAllUserSessions(ctx, targetUserID)
	} else {
		user.LockedUntil = nil
		user.FailedLoginCount = 0
	}
	user.UpdatedAt = time.Now()

	if err := s.uow.User().Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update lock status: %w", err)
	}

	return user, nil
}

func (s *UserService) AdminSetPassword(ctx context.Context, targetUserID string, newPassword string) error {
	log.Printf("[INFO] [UserService] AdminSetPassword: target=%s", targetUserID)
	if len(newPassword) < 8 {
		return errors.New("password must be at least 8 characters long")
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.uow.User().UpdatePasswordHash(ctx, targetUserID, string(hashBytes)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Invalidate active sessions immediately on password reset
	_ = s.uow.Session().RevokeAllUserSessions(ctx, targetUserID)
	return nil
}

func (s *UserService) AdminSetEmailVerified(ctx context.Context, targetUserID string, verified bool) (*model.User, error) {
	log.Printf("[INFO] [UserService] AdminSetEmailVerified: target=%s verified=%v", targetUserID, verified)
	if err := s.uow.User().UpdateEmailVerified(ctx, targetUserID, verified); err != nil {
		return nil, fmt.Errorf("failed to update email verification status: %w", err)
	}

	return s.uow.User().GetByID(ctx, targetUserID)
}

func (s *UserService) AdminDeleteUser(ctx context.Context, targetUserID string, hardDelete bool, callerAdminID string) error {
	log.Printf("[INFO] [UserService] AdminDeleteUser: target=%s hardDelete=%v caller=%s", targetUserID, hardDelete, callerAdminID)
	if callerAdminID != "" && targetUserID == callerAdminID {
		return errors.New("administrators cannot delete or disable their own account")
	}

	// Always revoke active sessions
	_ = s.uow.Session().RevokeAllUserSessions(ctx, targetUserID)

	if !hardDelete {
		// Soft disable: lock account permanently
		farFuture := time.Now().AddDate(100, 0, 0)
		user, err := s.uow.User().GetByID(ctx, targetUserID)
		if err != nil {
			return err
		}
		user.LockedUntil = &farFuture
		user.UpdatedAt = time.Now()
		return s.uow.User().Update(ctx, user)
	}

	// Hard delete with database cascade
	return s.uow.User().Delete(ctx, targetUserID)
}
