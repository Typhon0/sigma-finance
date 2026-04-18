package graphql

import (
	"testing"

	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/stretchr/testify/assert"
)

func TestPortfolioResolverValidation(t *testing.T) {
	t.Run("validatePortfolioName", func(t *testing.T) {
		tests := []struct {
			name        string
			input       string
			expectError bool
		}{
			{"valid name", "My Portfolio", false},
			{"minimum length", "ABC", false},
			{"empty name", "", true},
			{"too short", "AB", true},
			{"too long", string(make([]byte, 101)), true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := validatePortfolioName(tt.input)
				if tt.expectError {
					assert.Error(t, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("sanitizePortfolioName", func(t *testing.T) {
		tests := []struct {
			name     string
			input    string
			expected string
		}{
			{"trim spaces", "  My Portfolio  ", "My Portfolio"},
			{"normalize spaces", "My   Portfolio", "My Portfolio"},
			{"mixed whitespace", " \t My  \n Portfolio \r ", "My Portfolio"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result := sanitizePortfolioName(tt.input)
				assert.Equal(t, tt.expected, result)
			})
		}
	})

	t.Run("sanitizeDescription", func(t *testing.T) {
		tests := []struct {
			name     string
			input    string
			expected string
		}{
			{"trim spaces", "  Description  ", "Description"},
			{"limit length", string(make([]byte, 600)), string(make([]byte, 500))},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result := sanitizeDescription(tt.input)
				assert.Equal(t, tt.expected, result)
			})
		}
	})


	t.Run("handlePortfolioServiceError", func(t *testing.T) {
		tests := []struct {
			name     string
			input    error
			contains string
		}{
			{"nil error", nil, ""},
			{"portfolio not found", service.ErrPortfolioNotFound, "portfolio not found"},
			{"portfolio name exists", service.ErrPortfolioNameExists, "portfolio name already exists"},
			{"portfolio unauthorized", service.ErrPortfolioUnauthorized, "unauthorized: access denied to portfolio"},
			{"portfolio invalid name", service.ErrPortfolioInvalidName, "invalid portfolio name"},
			{"portfolio invalid input", service.ErrPortfolioInvalidInput, "invalid input"},
			{"portfolio has positions", service.ErrPortfolioHasPositions, "cannot delete portfolio: portfolio contains positions"},
			{"legacy repository not found", repository.ErrNotFound, "portfolio not found"},
			{"validation error", assert.AnError, "portfolio operation failed"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result := handlePortfolioServiceError(tt.input)
				if tt.input == nil {
					assert.NoError(t, result)
				} else {
					assert.Error(t, result)
					if tt.contains != "" {
						assert.Contains(t, result.Error(), tt.contains)
					}
				}
			})
		}
	})
}



func TestBuildPortfolioOrderClause(t *testing.T) {
	tests := []struct {
		name     string
		input    gqlModel.PortfolioOrder
		expected string
	}{
		{"name ascending", gqlModel.PortfolioOrder{Field: gqlModel.PortfolioOrderFieldName, Direction: gqlModel.SortDirectionAsc}, "name ASC"},
		{"name descending", gqlModel.PortfolioOrder{Field: gqlModel.PortfolioOrderFieldName, Direction: gqlModel.SortDirectionDesc}, "name DESC"},
		{"sort order ascending", gqlModel.PortfolioOrder{Field: gqlModel.PortfolioOrderFieldSortOrder, Direction: gqlModel.SortDirectionAsc}, "sort_order ASC"},
		{"created at descending", gqlModel.PortfolioOrder{Field: gqlModel.PortfolioOrderFieldCreatedAt, Direction: gqlModel.SortDirectionDesc}, "created_at DESC"},
		{"updated at ascending", gqlModel.PortfolioOrder{Field: gqlModel.PortfolioOrderFieldUpdatedAt, Direction: gqlModel.SortDirectionAsc}, "updated_at ASC"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildPortfolioOrderClause(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
