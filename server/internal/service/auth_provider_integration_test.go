package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// Test credential validation
func TestCredentialsValidation(t *testing.T) {
	t.Run("EmailPasswordCredentials", func(t *testing.T) {
		// Valid credentials
		creds := &EmailPasswordCredentials{
			Email:    "test@example.com",
			Password: "password123",
		}
		assert.NoError(t, creds.Validate())
		assert.Equal(t, "email_password", creds.Type())

		// Invalid credentials
		invalidCreds := &EmailPasswordCredentials{
			Email:    "",
			Password: "password123",
		}
		err := invalidCreds.Validate()
		assert.Error(t, err)
		authErr, ok := err.(*AuthError)
		assert.True(t, ok)
		assert.Equal(t, ErrInvalidInput, authErr.Code)
	})

	t.Run("ExternalTokenCredentials", func(t *testing.T) {
		// Valid credentials
		creds := &ExternalTokenCredentials{
			Provider: "google",
			Token:    "token123",
		}
		assert.NoError(t, creds.Validate())
		assert.Equal(t, "external_token", creds.Type())

		// Invalid credentials
		invalidCreds := &ExternalTokenCredentials{
			Provider: "",
			Token:    "token123",
		}
		err := invalidCreds.Validate()
		assert.Error(t, err)
		authErr, ok := err.(*AuthError)
		assert.True(t, ok)
		assert.Equal(t, ErrInvalidInput, authErr.Code)
	})
}

// Test register request validation
func TestRegisterRequestValidation(t *testing.T) {
	// Valid request
	req := RegisterRequest{
		Email: "test@example.com",
		Name:  "Test User",
	}
	assert.NoError(t, req.Validate())

	// Invalid request - missing email
	invalidReq := RegisterRequest{
		Name: "Test User",
	}
	err := invalidReq.Validate()
	assert.Error(t, err)
	authErr, ok := err.(*AuthError)
	assert.True(t, ok)
	assert.Equal(t, ErrInvalidInput, authErr.Code)
	assert.Equal(t, "email", authErr.Field)
}
