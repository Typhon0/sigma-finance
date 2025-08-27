package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Fix token column sizes for JWT tokens ")
			_, err := db.ExecContext(ctx, `
-- Increase token column sizes to accommodate JWT tokens
-- JWT tokens can be 500-1500+ characters, so we use TEXT type for unlimited length
ALTER TABLE sigma_finance.session 
ALTER COLUMN token TYPE TEXT,
ALTER COLUMN refresh_token TYPE TEXT;

ALTER TABLE sigma_finance.password_reset_token 
ALTER COLUMN token TYPE TEXT;

ALTER TABLE sigma_finance.email_verification_token 
ALTER COLUMN token TYPE TEXT;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert token column sizes ")
			_, err := db.ExecContext(ctx, `
-- Revert token columns back to VARCHAR(255)
-- Note: This may cause data loss if tokens are longer than 255 characters
ALTER TABLE sigma_finance.session 
ALTER COLUMN token TYPE VARCHAR(255),
ALTER COLUMN refresh_token TYPE VARCHAR(255);

ALTER TABLE sigma_finance.password_reset_token 
ALTER COLUMN token TYPE VARCHAR(255);

ALTER TABLE sigma_finance.email_verification_token 
ALTER COLUMN token TYPE VARCHAR(255);
			`)
			return err
		},
	)
}
