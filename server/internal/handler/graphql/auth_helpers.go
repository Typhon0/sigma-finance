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
				Message: err.Error(),
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
				Message: err.Error(),
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
				Message: err.Error(),
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
				Message: err.Error(),
			},
		},
	}
}

// Helper functions for context extraction and utilities

// extractIPFromContext extracts IP address from GraphQL context
func extractIPFromContext(ctx context.Context) string {
	// In a real implementation, this would extract from context keys set by middleware
	if ip, ok := ctx.Value("client_ip").(string); ok {
		return ip
	}
	return "127.0.0.1"
}

// extractUserAgentFromContext extracts user agent from GraphQL context
func extractUserAgentFromContext(ctx context.Context) string {
	if ua, ok := ctx.Value("user_agent").(string); ok {
		return ua
	}
	return "GraphQL-Client/1.0"
}

// stringPtrIfNotEmpty returns a pointer to the string if it's not empty, otherwise nil
func stringPtrIfNotEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
