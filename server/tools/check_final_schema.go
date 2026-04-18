//go:build tools
// +build tools

package main

import (
	"database/sql"
	"fmt"
	"github.com/uptrace/bun/driver/pgdriver"
)

func main() {
	dsn := "postgres://postgres:postgres@192.168.1.170:5432/sigma_finance_test?sslmode=disable"
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	
	tables := []string{"tag", "portfolio", "assets", "watchlist", "transaction", "portfolio_asset", "watchlist_asset", "asset_tag", "portfolio_tag", "ownership"}
	for _, table := range tables {
		fmt.Printf("--- %s ---\n", table)
		rows, err := sqldb.Query(fmt.Sprintf(`
			SELECT column_name, data_type 
			FROM information_schema.columns 
			WHERE table_schema = 'sigma_finance' AND table_name = '%s';
		`, table))
		if err != nil {
			fmt.Println("Error:", err)
			continue
		}
		for rows.Next() {
			var col, typ string
			rows.Scan(&col, &typ)
			fmt.Printf("%s: %s\n", col, typ)
		}
		rows.Close()
	}
}
