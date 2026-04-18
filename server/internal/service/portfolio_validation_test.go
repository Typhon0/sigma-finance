package service

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPortfolioValidationFunctions(t *testing.T) {
	t.Run("validatePortfolioName", func(t *testing.T) {
		tests := []struct {
			name      string
			input     string
			expectErr bool
			errType   error
		}{
			{"valid name", "My Portfolio", false, nil},
			{"minimum length", "ABC", false, nil},
			{"empty name", "", true, ErrPortfolioInvalidName},
			{"whitespace only", "   ", true, ErrPortfolioInvalidName},
			{"too short", "AB", true, ErrPortfolioInvalidName},
			{"too long", string(make([]byte, 101)), true, ErrPortfolioInvalidName},
			{"invalid characters", "Portfolio<script>", true, ErrPortfolioInvalidName},
			{"valid with spaces", "  My Portfolio  ", false, nil},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := validatePortfolioName(tt.input)
				if tt.expectErr {
					assert.Error(t, err)
					if tt.errType != nil {
						assert.True(t, errors.Is(err, tt.errType))
					}
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("validateUserID", func(t *testing.T) {
		tests := []struct {
			name      string
			input     string
			expectErr bool
		}{
			{"valid user ID", "user123", false},
			{"empty user ID", "", true},
			{"whitespace only", "   ", true},
			{"valid with spaces", "  user123  ", false},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := validateUserID(tt.input)
				if tt.expectErr {
					assert.Error(t, err)
					assert.True(t, errors.Is(err, ErrPortfolioInvalidInput))
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("validateSortOrder", func(t *testing.T) {
		tests := []struct {
			name      string
			input     int
			expectErr bool
		}{
			{"valid sort order", 5, false},
			{"zero sort order", 0, false},
			{"negative sort order", -1, true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := validateSortOrder(tt.input)
				if tt.expectErr {
					assert.Error(t, err)
					assert.True(t, errors.Is(err, ErrPortfolioInvalidInput))
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("validatePortfolioID", func(t *testing.T) {
		tests := []struct {
			name      string
			input     string
			expectErr bool
		}{
			{"valid portfolio ID", "123", false},
			{"empty portfolio ID", "", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := validatePortfolioID(tt.input)
				if tt.expectErr {
					assert.Error(t, err)
					assert.True(t, errors.Is(err, ErrPortfolioInvalidInput))
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})
}
