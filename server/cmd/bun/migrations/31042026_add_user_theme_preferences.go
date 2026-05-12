package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add user theme preferences ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10),
					ADD COLUMN IF NOT EXISTS theme_accent_color VARCHAR(20),
					ADD COLUMN IF NOT EXISTS theme_font_preference VARCHAR(20),
					ADD COLUMN IF NOT EXISTS theme_radius NUMERIC(3,2);

				UPDATE sigma_finance."user"
				SET
					theme_preference = COALESCE(theme_preference, 'system'),
					theme_accent_color = COALESCE(theme_accent_color, 'zinc'),
					theme_font_preference = COALESCE(theme_font_preference, 'inter'),
					theme_radius = COALESCE(theme_radius, 0.5)
				WHERE
					theme_preference IS NULL
					OR theme_accent_color IS NULL
					OR theme_font_preference IS NULL
					OR theme_radius IS NULL;

				ALTER TABLE sigma_finance."user"
					ALTER COLUMN theme_preference SET DEFAULT 'system',
					ALTER COLUMN theme_preference SET NOT NULL,
					ALTER COLUMN theme_accent_color SET DEFAULT 'zinc',
					ALTER COLUMN theme_accent_color SET NOT NULL,
					ALTER COLUMN theme_font_preference SET DEFAULT 'inter',
					ALTER COLUMN theme_font_preference SET NOT NULL,
					ALTER COLUMN theme_radius SET DEFAULT 0.5,
					ALTER COLUMN theme_radius SET NOT NULL;

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_preference_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_preference_check
					CHECK (theme_preference IN ('light', 'dark', 'system'));

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_accent_color_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_accent_color_check
					CHECK (theme_accent_color IN (
						'slate', 'gray', 'zinc', 'neutral', 'stone',
						'red', 'orange', 'amber', 'yellow', 'lime',
						'green', 'emerald', 'teal', 'cyan', 'sky',
						'blue', 'indigo', 'violet', 'purple', 'fuchsia',
						'pink', 'rose'
					));

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_font_preference_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_font_preference_check
					CHECK (theme_font_preference IN (
						'inter', 'roboto', 'opensans', 'lato', 'poppins', 'montserrat'
					));

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_radius_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_radius_check
					CHECK (theme_radius >= 0.1 AND theme_radius <= 1.2);
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Add user theme preferences ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_radius_check,
					DROP CONSTRAINT IF EXISTS user_theme_font_preference_check,
					DROP CONSTRAINT IF EXISTS user_theme_accent_color_check,
					DROP CONSTRAINT IF EXISTS user_theme_preference_check;

				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS theme_radius,
					DROP COLUMN IF EXISTS theme_font_preference,
					DROP COLUMN IF EXISTS theme_accent_color,
					DROP COLUMN IF EXISTS theme_preference;
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
	)
}
