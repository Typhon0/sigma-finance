package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Grant schema permissions ")
			// Grant permissions for sigma_finance user
			_, err := db.ExecContext(ctx, `
				-- Grant schema usage
				GRANT USAGE ON SCHEMA sigma_finance TO sigma_finance;
				
				-- Grant table permissions
				GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA sigma_finance TO sigma_finance;
				GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA sigma_finance TO sigma_finance;
				
				-- Grant function permissions  
				GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA sigma_finance TO sigma_finance;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			return nil
		},
	)
}
