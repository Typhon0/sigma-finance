package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestAuthProviderInterfaceImplementation demonstrates that LocalAuthProvider implements AuthProvider
func TestAuthProviderInterfaceImplementation(t *testing.T) {
	// This test verifies that LocalAuthProvider correctly implements the AuthProvider interface
	// We can't run the full implementation without mocks, but we can verify the interface compliance

	// Create a function that accepts AuthProvider interface
	testProviderInterface := func(provider AuthProvider) (string, bool) {
		return provider.Name(), provider.SupportsRegistration()
	}

	// Create a LocalAuthProvider (this will compile only if it implements AuthProvider)
	// We pass nil values since we're only testing interface compliance, not functionality
	localProvider := NewLocalAuthProvider(nil, nil)

	// This call will only work if LocalAuthProvider implements AuthProvider
	name, supportsReg := testProviderInterface(localProvider)

	// Verify the expected behavior
	assert.Equal(t, "local", name)
	assert.True(t, supportsReg)
}

// TestCredentialsInterfaceImplementation demonstrates that credential types implement Credentials
func TestCredentialsInterfaceImplementation(t *testing.T) {
	// Test function that accepts Credentials interface
	testCredentialsInterface := func(creds Credentials) (string, error) {
		return creds.Type(), creds.Validate()
	}

	// Test EmailPasswordCredentials
	emailCreds := &EmailPasswordCredentials{
		Email:    "test@example.com",
		Password: "password123",
	}

	credType, err := testCredentialsInterface(emailCreds)
	assert.Equal(t, "email_password", credType)
	assert.NoError(t, err)

	// Test ExternalTokenCredentials
	tokenCreds := &ExternalTokenCredentials{
		Provider: "google",
		Token:    "token123",
	}

	credType, err = testCredentialsInterface(tokenCreds)
	assert.Equal(t, "external_token", credType)
	assert.NoError(t, err)
}

// TestAuthErrorImplementation demonstrates that AuthError implements error interface
func TestAuthErrorImplementation(t *testing.T) {
	authErr := NewAuthError(ErrInvalidCredentials, "Invalid credentials", "password")

	// Test that AuthError implements error interface
	var err error = authErr
	assert.Equal(t, "Invalid credentials", err.Error())

	// Test AuthError fields
	assert.Equal(t, ErrInvalidCredentials, authErr.Code)
	assert.Equal(t, "Invalid credentials", authErr.Message)
	assert.Equal(t, "password", authErr.Field)
}
