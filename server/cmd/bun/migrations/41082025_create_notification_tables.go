package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create notification tables ")

			// Create notification_preferences table
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.notification_preferences (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL UNIQUE,
					email_enabled BOOLEAN DEFAULT true,
					push_enabled BOOLEAN DEFAULT false,
					in_app_enabled BOOLEAN DEFAULT true,
					webhook_enabled BOOLEAN DEFAULT false,
					webhook_url VARCHAR(500),
					quiet_hours_enabled BOOLEAN DEFAULT false,
					quiet_hours_start VARCHAR(5),
					quiet_hours_end VARCHAR(5),
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
			`)
			if err != nil {
				fmt.Printf("notification_preferences table error: %v ", err)
			}

			// Create notification_logs table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.notification_logs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL,
					alert_id UUID NOT NULL,
					method VARCHAR(20) NOT NULL,
					status VARCHAR(20) NOT NULL,
					message TEXT,
					error_message TEXT,
					sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
					delivered_at TIMESTAMP WITH TIME ZONE
				);
			`)
			if err != nil {
				fmt.Printf("notification_logs table error: %v ", err)
			}

			// Create push_subscriptions table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.push_subscriptions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL,
					endpoint VARCHAR(500) NOT NULL,
					p256dh VARCHAR(100) NOT NULL,
					auth VARCHAR(50) NOT NULL,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
			`)
			if err != nil {
				fmt.Printf("push_subscriptions table error: %v ", err)
			}

			// Create indexes
			_, err = db.ExecContext(ctx, `
				CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON sigma_finance.notification_logs(user_id);
				CREATE INDEX IF NOT EXISTS idx_notification_logs_alert_id ON sigma_finance.notification_logs(alert_id);
				CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON sigma_finance.notification_logs(sent_at DESC);
				CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON sigma_finance.push_subscriptions(user_id);
			`)
			if err != nil {
				fmt.Printf("indexes error: %v ", err)
			}

			fmt.Println(" done")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop notification tables ")
			db.ExecContext(ctx, `DROP TABLE IF EXISTS sigma_finance.push_subscriptions;`)
			db.ExecContext(ctx, `DROP TABLE IF EXISTS sigma_finance.notification_logs;`)
			db.ExecContext(ctx, `DROP TABLE IF EXISTS sigma_finance.notification_preferences;`)
			fmt.Println(" done")
			return nil
		},
	)
}
