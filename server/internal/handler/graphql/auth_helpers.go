// TODO: This GraphQL layer needs to be updated for the new asset management schema
// Temporarily excluded from build until GraphQL layer task is implemented
//go:build ignore

package graphql

import (
	"context"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/service"
)

// Helper functions for error conversion and context extraction

// convertAuthErrorToGraphQL converts service authentication errors to GraphQL AuthResponse
func convertAuthErrorToGraphQL(err error) *gqlModel.AuthResponse {
	if authErr, ok := err.(*service.AuthError); ok {
		return &gqlModel.AuthResponse{
			Success: false,
			Errors: []*gqlModel.AuthError{
				{
					Code:    authErr.Code,
					Message: authErr.Message,
					Field:   stringPtrIfNotEmpty(authErr.Field),
				},
			},
		}
	}

	// Handle validation errors from domain models
	if validationErr, ok := err.(*model.ValidationError); ok {
		return &gqlModel.AuthResponse{
			Success: false,
			Errors: []*gqlModel.AuthError{
				{
					Code:    "INVALID_INPUT",
					Message: validationErr.Message,
					Field:   stringPtrIfNotEmpty(validationErr.Field),
				},
			},
		}
	}

	// Generic error
	return &gqlModel.AuthResponse{
		Success: false,
		Errors: []*gqlModel.AuthError{
			{
				Code:    "INTERNAL_ERROR",
				Message: "An unexpected error occurred",
			},
		},
	}
}

// convertLogoutErrorToGraphQL converts service errors to GraphQL LogoutResponse
func convertLogoutErrorToGraphQL(err error) *gqlModel.LogoutResponse {
	if authErr, ok := err.(*service.AuthError); ok {
		return &gqlModel.LogoutResponse{
			Success: false,
			Errors: []*gqlModel.AuthError{
				{
					Code:    authErr.Code,
					Message: authErr.Message,
					Field:   stringPtrIfNotEmpty(authErr.Field),
				},
			},
		}
	}

	// Generic error
	return &gqlModel.LogoutResponse{
		Success: false,
		Errors: []*gqlModel.AuthError{
			{
				Code:    "INTERNAL_ERROR",
				Message: "An unexpected error occurred",
			},
		},
	}
}

// convertPasswordResetErrorToGraphQL converts service errors to GraphQL PasswordResetResponse
func convertPasswordResetErrorToGraphQL(err error) *gqlModel.PasswordResetResponse {
	if authErr, ok := err.(*service.AuthError); ok {
		return &gqlModel.PasswordResetResponse{
			Success: false,
			Errors: []*gqlModel.AuthError{
				{
					Code:    authErr.Code,
					Message: authErr.Message,
					Field:   stringPtrIfNotEmpty(authErr.Field),
				},
			},
		}
	}

	// Generic error
	return &gqlModel.PasswordResetResponse{
		Success: false,
		Errors: []*gqlModel.AuthError{
			{
				Code:    "INTERNAL_ERROR",
				Message: "An unexpected error occurred",
			},
		},
	}
}

// convertEmailVerificationErrorToGraphQL converts service errors to GraphQL EmailVerificationResponse
func convertEmailVerificationErrorToGraphQL(err error) *gqlModel.EmailVerificationResponse {
	if authErr, ok := err.(*service.AuthError); ok {
		return &gqlModel.EmailVerificationResponse{
			Success: false,
			Errors: []*gqlModel.AuthError{
				{
					Code:    authErr.Code,
					Message: authErr.Message,
					Field:   stringPtrIfNotEmpty(authErr.Field),
				},
			},
		}
	}

	// Generic error
	return &gqlModel.EmailVerificationResponse{
		Success: false,
		Errors: []*gqlModel.AuthError{
			{
				Code:    "INTERNAL_ERROR",
				Message: "An unexpected error occurred",
			},
		},
	}
}

// Helper functions for context extraction and utilities

// extractIPFromContext extracts IP address from GraphQL context
func extractIPFromContext(ctx context.Context) string {
	// In a real implementation, this would extract from HTTP headers
	// For testing, return a valid IP address
	return "127.0.0.1"
}

// extractUserAgentFromContext extracts user agent from GraphQL context
func extractUserAgentFromContext(ctx context.Context) string {
	// In a real implementation, this would extract from HTTP headers
	// For testing, return a test user agent
	return "GraphQL-Test-Client/1.0"
}

// extractUserIDFromToken extracts user ID from JWT token using SecurityService
func (r *mutationResolver) extractUserIDFromToken(token string) string {
	claims, err := r.SecurityService.ValidateJWT(token)
	if err != nil {
		return ""
	}
	return claims.UserID
}

// stringPtrIfNotEmpty returns a pointer to the string if it's not empty, otherwise nil
func stringPtrIfNotEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
