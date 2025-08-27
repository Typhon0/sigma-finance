package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add authentication system tables ")
			_, err := db.ExecContext(ctx, `
-- Update existing user table to support authentication
ALTER TABLE sigma_finance.user 
DROP COLUMN IF EXISTS username,
ADD COLUMN IF NOT EXISTS id_new UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Migrate existing data to new UUID format (if needed)
UPDATE sigma_finance.user SET id_new = gen_random_uuid() WHERE id_new IS NULL;

-- Drop old ID column and rename new one (this is a breaking change)
-- Note: In production, you'd want to handle this more carefully
ALTER TABLE sigma_finance.user DROP CONSTRAINT IF EXISTS user_pkey CASCADE;
ALTER TABLE sigma_finance.user DROP COLUMN IF EXISTS id;
ALTER TABLE sigma_finance.user RENAME COLUMN id_new TO id;
ALTER TABLE sigma_finance.user ADD PRIMARY KEY (id);

-- Rename password column to match new schema
ALTER TABLE sigma_finance.user RENAME COLUMN password_hash TO password_hash_old;
ALTER TABLE sigma_finance.user ADD COLUMN password_hash VARCHAR(255);
UPDATE sigma_finance.user SET password_hash = password_hash_old;
ALTER TABLE sigma_finance.user DROP COLUMN password_hash_old;

-- Create authentication methods table
CREATE TABLE IF NOT EXISTS sigma_finance.auth_method (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, external_id),
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sigma_finance.session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE
);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS sigma_finance.password_reset_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE
);

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS sigma_finance.email_verification_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE
);

-- Create authentication audit log table
CREATE TABLE IF NOT EXISTS sigma_finance.auth_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_email ON sigma_finance.user(email);
CREATE INDEX IF NOT EXISTS idx_user_email_verified ON sigma_finance.user(email_verified);
CREATE INDEX IF NOT EXISTS idx_auth_method_user_id ON sigma_finance.auth_method(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_method_provider ON sigma_finance.auth_method(provider);
CREATE INDEX IF NOT EXISTS idx_session_token ON sigma_finance.session(token);
CREATE INDEX IF NOT EXISTS idx_session_user_id ON sigma_finance.session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON sigma_finance.session(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_token ON sigma_finance.password_reset_token(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_id ON sigma_finance.password_reset_token(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_token_token ON sigma_finance.email_verification_token(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_token_user_id ON sigma_finance.email_verification_token(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_event_user_id ON sigma_finance.auth_event(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_event_email ON sigma_finance.auth_event(email);
CREATE INDEX IF NOT EXISTS idx_auth_event_action ON sigma_finance.auth_event(action);
CREATE INDEX IF NOT EXISTS idx_auth_event_created_at ON sigma_finance.auth_event(created_at);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove authentication system tables ")
			_, err := db.ExecContext(ctx, `
-- Drop authentication tables
DROP TABLE IF EXISTS sigma_finance.auth_event;
DROP TABLE IF EXISTS sigma_finance.email_verification_token;
DROP TABLE IF EXISTS sigma_finance.password_reset_token;
DROP TABLE IF EXISTS sigma_finance.session;
DROP TABLE IF EXISTS sigma_finance.auth_method;

-- Revert user table changes (this is a simplified revert)
-- Note: In production, you'd want to handle this more carefully to preserve data
ALTER TABLE sigma_finance.user 
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS name,
DROP COLUMN IF EXISTS last_login_at,
DROP COLUMN IF EXISTS failed_login_count,
DROP COLUMN IF EXISTS locked_until;

-- Note: Reverting the ID column change would be complex and data-destructive
-- This is left as a simplified version for the migration
			`)
			return err
		},
	)
}
