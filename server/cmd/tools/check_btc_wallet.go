package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"

	"sigma_finance/internal/domain/model"
)

func main() {
	dsn := "postgres://sigma_finance:xQxW%26yATWuC2N3*8@192.168.1.170:5432/sigma_finance?sslmode=disable"
	sqldb, err := sql.Open("postgres", dsn)
	if err != nil {
		panic(err)
	}
	defer sqldb.Close()

	db := bun.NewDB(sqldb, pgdialect.New())
	ctx := context.Background()

	var accounts []model.WalletAccount
	err = db.NewSelect().
		Model(&accounts).
		Where("network = 'BITCOIN'").
		Scan(ctx)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Bitcoin accounts found: %d\n", len(accounts))
	for _, a := range accounts {
		errStr := "nil"
		if a.LastSyncError != nil {
			errStr = *a.LastSyncError
		}
		syncAt := "never"
		if a.LastSyncAt != nil {
			syncAt = a.LastSyncAt.Format(time.RFC3339)
		}
		fmt.Printf("ID: %s | Net: %s | Addr: %s | IsXpub: %v | Status: %s | LastSyncAt: %s | Error: %s\n",
			a.ID, a.Network, a.AddressOrXpub, a.IsXpub, a.HistoryStatus, syncAt, errStr)

		var balances []model.WalletBalance
		_ = db.NewSelect().Model(&balances).Where("wallet_account_id = ?", a.ID).Scan(ctx)
		fmt.Printf("  Balances count: %d\n", len(balances))
		for _, b := range balances {
			fmt.Printf("    Sym: %s | Qty: %s | Raw: %s\n", b.Symbol, b.FormattedQuantity.String(), b.RawBalance)
		}
	}
}
