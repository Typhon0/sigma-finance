package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEmailPasswordCredentials_Type(t *testing.T) {
	creds := &EmailPasswordCredentials{
		Email:    "test@example.com",
		Password: "password123",
	}

	assert.Equal(t, "email_password", creds.Type())
}

func TestEmailPasswordCredentials_Validate(t *testing.T) {
	tests := []struct {
		name        string
		credentials EmailPasswordCredentials
		wantErr     bool
		errCode     string
		errField    string
	}{
		{
			name: "valid credentials",
			credentials: EmailPasswordCredentials{
				Email:    "test@example.com",
				Password: "password123",
			},
			wantErr: false,
		},
		{
			name: "missing email",
			credentials: EmailPasswordCredentials{
				Email:    "",
				Password: "password123",
			},
			wantErr:  true,
			errCode:  ErrInvalidInput,
			errField: "email",
		},
		{
			name: "missing password",
			credentials: EmailPasswordCredentials{
				Email:    "test@example.com",
				Password: "",
			},
			wantErr:  true,
			errCode:  ErrInvalidInput,
			errField: "password",
		},
		{
			name: "both missing",
			credentials: EmailPasswordCredentials{
				Email:    "",
				Password: "",
			},
			wantErr:  true,
			errCode:  ErrInvalidInput,
			errField: "email", // First validation error
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.credentials.Validate()

			if tt.wantErr {
				assert.Error(t, err)
				authErr, ok := err.(*AuthError)
				assert.True(t, ok, "Expected AuthError")
				assert.Equal(t, tt.errCode, authErr.Code)
				assert.Equal(t, tt.errField, authErr.Field)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestExternalTokenCredentials_Type(t *testing.T) {
	creds := &ExternalTokenCredentials{
		Provider: "google",
		Token:    "token123",
	}

	assert.Equal(t, "external_token", creds.Type())
}

func TestExternalTokenCredentials_Validate(t *testing.T) {
	tests := []struct {
		name        string
		credentials ExternalTokenCredentials
		wantErr     bool
		errCode     string
		errField    string
	}{
		{
			name: "valid credentials",
			credentials: ExternalTokenCredentials{
				Provider: "google",
				Token:    "token123",
			},
			wantErr: false,
		},
		{
			name: "missing provider",
			credentials: ExternalTokenCredentials{
				Provider: "",
				Token:    "token123",
			},
			wantErr:  true,
			errCode:  ErrInvalidInput,
			errField: "provider",
		},
		{
			name: "missing token",
			credentials: ExternalTokenCredentials{
				Provider: "google",
				Token:    "",
			},
			wantErr:  true,
			errCode:  ErrInvalidInput,
			errField: "token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.credentials.Validate()

			if tt.wantErr {
				assert.Error(t, err)
				authErr, ok := err.(*AuthError)
				assert.True(t, ok, "Expected AuthError")
				assert.Equal(t, tt.errCode, authErr.Code)
				assert.Equal(t, tt.errField, authErr.Field)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRegisterRequest_Validate(t *testing.T) {
	tests := []struct {
		name     string
		request  RegisterRequest
		wantErr  bool
		errCode  string
		errField string
	}{
		{
			name: "valid request",
			request: RegisterRequest{
				Email: "test@example.com",
				Name:  "Test User",
			},
			wantErr: false,
		},
		{
			name: "missing email",
			request: RegisterRequest{
				Email: "",
				Name:  "Test User",
			},
			wantErr:  true,
			errCode:  ErrInvalidInput,
			errField: "email",
		},
		{
			name: "missing name",
			request: RegisterRequest{
				Email: "test@example.com",
				Name:  "",
			},
			wantErr:  true,
			errCode:  ErrInvalidInput,
			errField: "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()

			if tt.wantErr {
				assert.Error(t, err)
				authErr, ok := err.(*AuthError)
				assert.True(t, ok, "Expected AuthError")
				assert.Equal(t, tt.errCode, authErr.Code)
				assert.Equal(t, tt.errField, authErr.Field)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAuthError_Error(t *testing.T) {
	err := &AuthError{
		Code:    ErrInvalidCredentials,
		Message: "Invalid credentials",
		Field:   "password",
	}

	assert.Equal(t, "Invalid credentials", err.Error())
}

func TestNewAuthError(t *testing.T) {
	err := NewAuthError(ErrInvalidCredentials, "Invalid credentials", "password")

	assert.Equal(t, ErrInvalidCredentials, err.Code)
	assert.Equal(t, "Invalid credentials", err.Message)
	assert.Equal(t, "password", err.Field)
}
