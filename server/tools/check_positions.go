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
	
	rows, err := sqldb.Query(`
		SELECT column_name, data_type 
		FROM information_schema.columns 
		WHERE table_schema = 'sigma_finance' AND table_name IN ('positions', 'asset_tags');
	`)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()
	
	for rows.Next() {
		var col, typ string
		rows.Scan(&col, &typ)
		fmt.Printf("%s: %s\n", col, typ)
	}
}
