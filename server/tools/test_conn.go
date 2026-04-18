//go:build tools
// +build tools

package main
import (
"fmt"
"sigma_finance/internal/config"
)
func main() {
  db, err := config.NewTestDB()
  if err != nil {
    fmt.Printf("Error: %v\n", err)
    return
  }
  fmt.Println("Success!")
  db.Close()
}
