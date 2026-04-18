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
		SELECT tablename FROM pg_tables WHERE schemaname='sigma_finance';
	`)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()
	
	fmt.Println("Tables in sigma_finance:")
	for rows.Next() {
		var tbl string
		rows.Scan(&tbl)
		fmt.Printf("- %s\n", tbl)
	}
}
