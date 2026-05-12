package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Fix theme constraints and add missing options ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_font_preference_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_font_preference_check
					CHECK (theme_font_preference IN (
						'inter', 'roboto', 'opensans', 'lato', 'poppins', 'montserrat',
						'noto-sans', 'nunito-sans', 'figtree', 'raleway', 'dm-sans',
						'public-sans', 'outfit', 'jetbrains-mono', 'geist', 'geist-mono',
						'lora', 'merriweather', 'playfair-display', 'noto-serif', 'roboto-slab',
						'oxanium', 'manrope', 'space-grotesk', 'ibm-plex-sans',
						'source-sans-3', 'instrument-sans', 'eb-garamond', 'instrument-serif'
					));

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_style_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_style_check
					CHECK (theme_style IN ('vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera'));

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_accent_color_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_accent_color_check
					CHECK (theme_accent_color IN (
						'slate', 'gray', 'zinc', 'neutral', 'stone',
						'red', 'orange', 'amber', 'yellow', 'lime',
						'green', 'emerald', 'teal', 'cyan', 'sky',
						'blue', 'indigo', 'violet', 'purple', 'fuchsia',
						'pink', 'rose', 'mauve', 'olive', 'mist', 'taupe'
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
			fmt.Print(" [down migration] Fix theme constraints and add missing options ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_font_preference_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_font_preference_check
					CHECK (theme_font_preference IN (
						'inter', 'roboto', 'opensans', 'lato', 'poppins', 'montserrat'
					));

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_theme_style_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_theme_style_check
					CHECK (theme_style IN ('vega', 'nova', 'maia', 'lyra', 'mira'));

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
