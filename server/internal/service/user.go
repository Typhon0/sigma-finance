package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

type IUserService interface {
	GetByID(ctx context.Context, id uint) (model.User, error)
	GetByStringID(ctx context.Context, id string) (*model.User, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.User, error)
	CreateUser(ctx context.Context, input CreateUserInput) (model.User, error)
	UpdateUser(ctx context.Context, id uint, input UpdateUserInput) (model.User, error)
	DeleteUser(ctx context.Context, id uint) error
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
	Email    *string
	Password *string
}

func (s *UserService) GetByID(ctx context.Context, id uint) (model.User, error) {
	return s.uow.User().GetByID(ctx, id)
}

func (s *UserService) GetByStringID(ctx context.Context, id string) (*model.User, error) {
	return s.uow.User().GetByStringID(ctx, id)
}

func (s *UserService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.User, error) {
	return s.uow.User().FindAllBy(ctx, opts...)
}

func (s *UserService) CreateUser(ctx context.Context, input CreateUserInput) (model.User, error) {
	if len(input.Username) < 3 {
		return model.User{}, errors.New("username must be at least 3 characters long")
	}
	if input.Email == "" {
		return model.User{}, errors.New("email is required")
	}
	newUser := model.User{
		Name:  input.Username, // Map Username to Name field
		Email: input.Email,
		// PasswordHash will be set by authentication service
	}
	createdUser, err := s.uow.User().Create(ctx, &newUser)
	if err != nil {
		return model.User{}, fmt.Errorf("failed to create user: %w", err)
	}
	return *createdUser, nil
}

func (s *UserService) UpdateUser(ctx context.Context, id uint, input UpdateUserInput) (model.User, error) {
	userToUpdate, err := s.uow.User().GetByID(ctx, id)
	if err != nil {
		return model.User{}, err
	}

	// Only update fields that are provided
	if input.Email != nil {
		userToUpdate.Email = *input.Email
	}
	if input.Password != nil {
		// Password updates should be handled by authentication service
		// userToUpdate.PasswordHash = hashedPassword
	}

	err = s.uow.User().Update(ctx, &userToUpdate)
	if err != nil {
		return model.User{}, fmt.Errorf("failed to update user: %w", err)
	}
	return userToUpdate, nil
}

func (s *UserService) DeleteUser(ctx context.Context, id uint) error {
	return s.uow.User().Delete(ctx, id)
}
