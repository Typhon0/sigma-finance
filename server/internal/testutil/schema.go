package testutil

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// testTableModels lists every model table the test suites touch, in an order
// that keeps referenced tables ahead of the tables that reference them.
//
// Tests build their schema from these models instead of replaying
// cmd/bun/migrations. The migration chain cannot run against an empty
// database: its first migrations assume a base schema that was built outside
// the repository (0001_init.go is an empty stub, and 12042026_add_fund_type.go
// already writes to sigma_finance.assets, which nothing before it creates).
// Deriving the tables from the models keeps the test tables and the queries in
// step by construction, and needs no external schema dump.
func testTableModels() []any {
	return []any{
		(*model.User)(nil),
		(*model.Account)(nil),
		(*model.Asset)(nil),
		(*model.AssetPrice)(nil),
		(*model.Stock)(nil),
		(*model.Fund)(nil),
		(*model.Crypto)(nil),
		(*model.Candle)(nil),
		(*model.FXRate)(nil),
		(*model.Ownership)(nil),
		(*model.Portfolio)(nil),
		(*model.PortfolioAsset)(nil),
		(*model.Position)(nil),
		(*model.Transaction)(nil),
		(*model.TaxLot)(nil),
		(*model.TaxLotDisposition)(nil),
		(*model.Watchlist)(nil),
		(*model.WatchlistAsset)(nil),
		(*model.Tag)(nil),
		(*model.AssetTag)(nil),
		(*model.PortfolioTag)(nil),
		(*model.Report)(nil),
		(*model.Session)(nil),
		(*model.AuthEvent)(nil),
		(*model.AuthMethod)(nil),
		(*model.EmailVerificationToken)(nil),
		(*model.PasswordResetToken)(nil),
		(*model.Instrument)(nil),
		(*model.InstrumentAlias)(nil),
		(*model.InstrumentSyncState)(nil),
		(*model.DiscoveryLog)(nil),
		(*model.InstrumentProviderMapping)(nil),
		(*model.CatalogSyncRun)(nil),
		(*model.HistoricalDataBackfillJob)(nil),
		(*model.MarketDataPack)(nil),
		(*model.MarketDataPackCoverage)(nil),
		(*model.MarketDataPackJob)(nil),
		(*model.MarketDataPackBuildJob)(nil),
		(*model.MarketDataPackBuildJobItem)(nil),
		(*model.FinanceDatabaseSyncSetting)(nil),
		(*model.FinanceDatabaseSyncHistory)(nil),
		(*model.SyncCredential)(nil),
		(*model.SyncConnection)(nil),
		(*model.SyncRun)(nil),
		(*model.SyncAuthSession)(nil),
		(*model.SyncRawEvent)(nil),
		(*model.WalletDevice)(nil),
		(*model.WalletAccount)(nil),
		(*model.WalletBalance)(nil),
		(*model.WalletActivity)(nil),
		(*model.WalletActivityReview)(nil),
		(*model.WalletCUTracking)(nil),
		(*model.BlockchainNetworkConfig)(nil),
	}
}

// createTestSchema creates any missing test tables. It is idempotent, so a
// test database can be reused between runs.
func createTestSchema(ctx context.Context, db *bun.DB) error {
	_, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS sigma_finance")
	if err != nil {
		return fmt.Errorf("create test schema: %w", err)
	}

	for _, m := range testTableModels() {
		ddl, err := createTableSQL(m)
		if err != nil {
			return err
		}
		if _, err := db.ExecContext(ctx, ddl); err != nil {
			return fmt.Errorf("create test table for %T: %w\n%s", m, err, ddl)
		}
	}

	return nil
}

// createTableSQL renders a permissive CREATE TABLE IF NOT EXISTS for a model.
//
// It reads column names from the bun tags, so queries written against the
// models find the columns they expect, but it deliberately drops the tag's
// defaults, NOT NULLs and enum types: several tags carry SQL that only holds
// against the production DDL (such as `default:USER`, which is not valid
// syntax), and tests should not fail because of that. Types are derived from
// the Go fields instead.
func createTableSQL(m any) (string, error) {
	t := reflect.TypeOf(m)
	if t == nil || t.Kind() != reflect.Ptr || t.Elem().Kind() != reflect.Struct {
		return "", fmt.Errorf("test schema: %T is not a pointer to a struct", m)
	}
	t = t.Elem()

	name := tableName(t)
	if name == "" {
		return "", fmt.Errorf("test schema: %T has no bun table tag", m)
	}

	var cols []string
	var pk []string
	seen := map[string]bool{}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.PkgPath != "" {
			continue // unexported
		}
		tag := f.Tag.Get("bun")
		if tag == "" || tag == "-" {
			continue
		}
		parts := strings.Split(tag, ",")
		col := strings.TrimSpace(parts[0])
		if col == "" || col == "table:" || strings.HasPrefix(col, "table:") || strings.HasPrefix(col, "rel:") ||
			strings.Contains(tag, "rel:") || strings.Contains(tag, "scanonly") {
			continue
		}
		if seen[col] {
			continue
		}
		seen[col] = true

		opts := parts[1:]
		typ := sqlType(f.Type, opts)
		if override, ok := columnTypeOverrides[plainTableName(t)+"."+col]; ok {
			typ = override
		}
		def := quoteIdent(col) + " " + typ
		d := sqlDefault(opts)
		if d == "" && typ == "text" && containsOpt(opts, "pk") {
			// Text primary keys are UUIDs in production, where the column
			// default generates them. Several inserts rely on that default and
			// omit the id entirely, so a missing one fails the whole statement.
			d = "(gen_random_uuid())::text"
		}
		if d != "" {
			def += " DEFAULT " + d
		}
		if containsOpt(opts, "unique") {
			def += " UNIQUE"
		}
		cols = append(cols, def)
		if containsOpt(opts, "pk") {
			pk = append(pk, quoteIdent(col))
		}
	}

	if len(cols) == 0 {
		return "", fmt.Errorf("test schema: %T has no bun columns", m)
	}

	// Composite keys are declared once at table level: a primary key per
	// column is only valid when there is a single one.
	if len(pk) > 0 {
		cols = append(cols, "PRIMARY KEY ("+strings.Join(pk, ", ")+")")
	}

	for _, unique := range uniqueConstraints[plainTableName(t)] {
		quoted := make([]string, len(unique))
		for i, c := range unique {
			quoted[i] = quoteIdent(c)
		}
		cols = append(cols, "UNIQUE ("+strings.Join(quoted, ", ")+")")
	}

	return fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (\n    %s\n)", name, strings.Join(cols, ",\n    ")), nil
}

// uniqueConstraints lists the composite unique constraints that the bun tags do
// not express but that the repositories' ON CONFLICT clauses name explicitly.
// Each entry mirrors the constraint the production schema carries.
var uniqueConstraints = map[string][][]string{
	"sigma_finance.instrument_provider_mappings": {{"instrument_id", "provider", "provider_asset_id"}},
	"sigma_finance.portfolio_asset":              {{"portfolio_id", "asset_id"}},
	"sigma_finance.positions":                    {{"portfolio_id", "asset_id"}},
}

// columnTypeOverrides pins the columns whose PostgreSQL type cannot be read off
// the Go field, because the model stores them as a type that would not accept
// the SQL the repository writes (or reads) against them.
var columnTypeOverrides = map[string]string{
	// The instrument search ranks by ts_rank(), which needs a real tsvector.
	"sigma_finance.instruments.search_vector": "tsvector",
}

// plainTableName returns the unqualified table name, e.g. "instruments".
func plainTableName(t reflect.Type) string {
	return strings.ReplaceAll(tableName(t), `"`, "")
}

// tableName returns the quoted, fully qualified table name of a model.
//
// bun keeps the name in the tag of the embedded bun.BaseModel, e.g.
// `bun.BaseModel `bun:"table:sigma_finance.assets,alias:a"“, so it is read
// from that field rather than from the struct itself.
func tableName(t reflect.Type) string {
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		tag := f.Tag.Get("bun")
		var name string
		for _, part := range strings.Split(tag, ",") {
			if strings.HasPrefix(part, "table:") {
				name = strings.TrimPrefix(part, "table:")
			}
		}
		if name == "" {
			continue
		}
		bits := strings.Split(name, ".")
		for j, b := range bits {
			if b != "" {
				bits[j] = quoteIdent(b)
			}
		}
		return strings.Join(bits, ".")
	}
	return ""
}

// sqlDefault turns a bun `default:` option into a DEFAULT clause, or an empty
// string when the option is missing or unusable.
//
// The tags mix real SQL with bare identifiers: `default:gen_random_uuid()` and
// `default:current_timestamp` must be kept verbatim, while `default:USER` is an
// enum value that has to be quoted or PostgreSQL rejects the statement.
func sqlDefault(opts []string) string {
	var raw string
	for _, o := range opts {
		o = strings.TrimSpace(o)
		if strings.HasPrefix(o, "default:") {
			raw = strings.TrimSpace(strings.TrimPrefix(o, "default:"))
		}
	}
	if raw == "" {
		return ""
	}

	lower := strings.ToLower(raw)
	switch {
	case lower == "null":
		return "NULL"
	case lower == "true" || lower == "false" || lower == "current_timestamp" || lower == "current_date":
		return lower
	case strings.HasPrefix(raw, "'") || strings.HasPrefix(raw, "\""):
		return raw
	case strings.Contains(raw, "gen_random_uuid()"):
		// The column is text, so the generated uuid has to be cast.
		return "(gen_random_uuid())::text"
	case strings.ContainsAny(raw, "():") || strings.Contains(raw, "::"):
		// Function calls and casts, e.g. now() or '{}'::jsonb.
		return raw
	case isNumeric(raw):
		return raw
	default:
		// A bare identifier used as a value, e.g. default:USER.
		return "'" + strings.ReplaceAll(raw, "'", "''") + "'"
	}
}

func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	for i, r := range s {
		if r >= '0' && r <= '9' {
			continue
		}
		if (r == '-' || r == '+' || r == '.') && i == 0 {
			continue
		}
		if r == '.' {
			continue
		}
		return false
	}
	return true
}

func containsOpt(opts []string, want string) bool {
	for _, o := range opts {
		if strings.TrimSpace(o) == want {
			return true
		}
	}
	return false
}

func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

var (
	decimalType = reflect.TypeOf(decimal.Decimal{})
	timeType    = reflect.TypeOf(time.Time{})
)

// sqlType maps a Go field type onto a PostgreSQL type loose enough that the
// tests can write any value the model allows.
func sqlType(t reflect.Type, opts []string) string {
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	for _, o := range opts {
		if strings.TrimSpace(o) == "type:jsonb" {
			return "jsonb"
		}
	}

	// `type:uuid` is deliberately not honoured: the repositories pass these
	// IDs around as plain strings, and PostgreSQL has no `uuid = text`
	// operator, so such columns stay text and their default is cast instead
	// (see sqlDefault).

	switch t {
	case decimalType:
		return "numeric"
	case timeType:
		return "timestamptz"
	}

	switch t.Kind() {
	case reflect.Bool:
		return "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "bigint"
	case reflect.Float32, reflect.Float64:
		return "double precision"
	case reflect.String:
		return "text"
	case reflect.Slice:
		if t.Elem().Kind() == reflect.Uint8 {
			return "bytea"
		}
		return "jsonb"
	case reflect.Map, reflect.Struct, reflect.Interface:
		return "jsonb"
	default:
		return "text"
	}
}
