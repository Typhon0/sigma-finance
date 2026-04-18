//go:build tools
// +build tools

package main

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
	"github.com/uptrace/bun/driver/pgdriver"
)

func main() {
	dsn := "postgres://postgres:postgres@192.168.1.170:5432/postgres?sslmode=disable"

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	
	_, err := sqldb.Exec("CREATE DATABASE sigma_finance_test")
	if err != nil {
		fmt.Printf("Failed to create database: %v\n", err)
		return
	}
	fmt.Println("Database created successfully!")
}
