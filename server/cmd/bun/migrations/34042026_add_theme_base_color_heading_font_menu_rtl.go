package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add theme base color, heading font, menu options, and RTL ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS theme_base_color VARCHAR(20) NOT NULL DEFAULT 'neutral';

				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS theme_heading_font VARCHAR(30) NOT NULL DEFAULT 'inherit';

				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS theme_menu_accent VARCHAR(10) NOT NULL DEFAULT 'subtle';

				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS theme_menu_color VARCHAR(30) NOT NULL DEFAULT 'default';

				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS theme_rtl BOOLEAN NOT NULL DEFAULT false;

				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_base_color_check
					CHECK (theme_base_color IN (
						'neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'
					));

				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_heading_font_check
					CHECK (theme_heading_font IN (
						'inherit',
						'inter', 'noto-sans', 'nunito-sans', 'figtree', 'roboto', 'raleway',
						'dm-sans', 'public-sans', 'outfit', 'jetbrains-mono', 'geist', 'geist-mono',
						'lora', 'merriweather', 'playfair-display', 'noto-serif', 'roboto-slab',
						'oxanium', 'manrope', 'space-grotesk', 'montserrat', 'ibm-plex-sans',
						'source-sans-3', 'instrument-sans', 'eb-garamond', 'instrument-serif'
					));

				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_menu_accent_check
					CHECK (theme_menu_accent IN ('subtle', 'bold'));

				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_menu_color_check
					CHECK (theme_menu_color IN (
						'default', 'inverted', 'default-translucent', 'inverted-translucent'
					));
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Add theme base color, heading font, menu options, and RTL ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_base_color_check;
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_heading_font_check;
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_menu_accent_check;
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_menu_color_check;
				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS theme_base_color;
				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS theme_heading_font;
				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS theme_menu_accent;
				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS theme_menu_color;
				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS theme_rtl;
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
