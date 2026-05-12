package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add user theme style ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS theme_style VARCHAR(10);

				UPDATE sigma_finance."user"
				SET theme_style = COALESCE(theme_style, 'vega')
				WHERE theme_style IS NULL;

				ALTER TABLE sigma_finance."user"
					ALTER COLUMN theme_style SET DEFAULT 'vega',
					ALTER COLUMN theme_style SET NOT NULL;

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_style_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_style_check
					CHECK (theme_style IN ('vega', 'nova', 'maia', 'lyra', 'mira'));
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Add user theme style ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_style_check;

				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS theme_style;
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
