package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	defaultEvmTestAddress    = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"   // vitalik.eth
	defaultSolanaTestAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" // Solana Foundation / Binance hot wallet
	defaultBtcTestAddress    = "bc1qwfgdjyy95aay2686fn74h6a4nu9eev6np7q4fn204dkj3274frlqrskvx0"
	defaultBtcTestXpub       = "xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFEh73bCX27DeNVksux55LE29JKBma442fcx138eLurPNgB"
)

func main() {
	fmt.Println("=================================================================")
	fmt.Println("🚀 Sigma Finance - Alchemy One-Key Qualification Benchmark Tool")
	fmt.Println("=================================================================")

	// 1. Locate and load .env
	_ = godotenv.Load(".env", "../.env", "../../.env", "../../../.env")
	apiKey := os.Getenv("ALCHEMY_API_KEY")
	if strings.TrimSpace(apiKey) == "" {
		log.Fatalf("❌ ALCHEMY_API_KEY is not defined in .env. Please configure it to continue.")
	}
	maskedKey := apiKey
	if len(maskedKey) > 8 {
		maskedKey = maskedKey[:4] + "..." + maskedKey[len(maskedKey)-4:]
	}
	fmt.Printf("🔑 Loaded ALCHEMY_API_KEY: %s\n\n", maskedKey)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	var report strings.Builder
	report.WriteString("# Blockchain Provider Qualification Matrix (Alchemy-First Architecture)\n\n")
	report.WriteString(fmt.Sprintf("**Date:** %s  \n", time.Now().Format("2006-01-02 15:04:05 UTC")))
	report.WriteString("**Test Configuration:** Single ALCHEMY_API_KEY for 7 networks (EVM, Solana, Bitcoin)  \n")
	report.WriteString("**Operating Target:** €0/month operating cost (30,000,000 Compute Units pool)  \n\n")

	// 2. Multichain Portfolio API Benchmark
	fmt.Println("--- 1. Testing Multichain Portfolio API (EVM) ---")
	portfolioResp, portfolioDuration, portfolioErr := BenchmarkPortfolioAPI(ctx, apiKey, defaultEvmTestAddress)
	if portfolioErr != nil {
		fmt.Printf("⚠️ Multichain Portfolio API error: %v\n", portfolioErr)
		report.WriteString(fmt.Sprintf("### 1. Multichain Portfolio API\n- **Status:** ⚠️ Failed / Degraded (%v)\n\n", portfolioErr))
	} else {
		tokens := portfolioResp.Data.Tokens
		fmt.Printf("✅ Multichain Portfolio API succeeded in %v (found %d tokens across networks)\n", portfolioDuration, len(tokens))
		report.WriteString("### 1. Multichain Portfolio API\n")
		report.WriteString(fmt.Sprintf("- **Status:** ✅ Succeeded in %v\n", portfolioDuration))
		report.WriteString(fmt.Sprintf("- **Tokens Ingested:** %d\n", len(tokens)))
		if portfolioResp.Error != nil && len(portfolioResp.Error.PartialErrors) > 0 {
			report.WriteString(fmt.Sprintf("- **Partial Errors Flagged:** %d\n\n", len(portfolioResp.Error.PartialErrors)))
		} else {
			report.WriteString("- **Partial Errors:** None\n\n")
		}

		// Group by network
		networkCounts := make(map[string]int)
		for _, tok := range tokens {
			networkCounts[tok.Network]++
		}
		for net, count := range networkCounts {
			fmt.Printf("   • [%s]: %d token balances\n", net, count)
		}
	}

	// 3. Transfers By Wallet Benchmark across 5 EVM Networks
	fmt.Println("\n--- 2. Testing Transfers By Wallet API across 5 EVM Networks ---")
	evmChains := []struct {
		Name      string
		Subdomain string
	}{
		{"Ethereum", "eth-mainnet"},
		{"Base", "base-mainnet"},
		{"Arbitrum One", "arb-mainnet"},
		{"Optimism", "opt-mainnet"},
		{"Polygon PoS", "polygon-mainnet"},
	}

	report.WriteString("### 2. EVM Historical Transfers By Wallet API\n\n")
	report.WriteString("| Network | Subdomain | Internal Category Support | Status | Latency | Transfers Ingested | Has PageKey? |\n")
	report.WriteString("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n")

	for _, chain := range evmChains {
		res, dur, err := BenchmarkTransfersAPI(ctx, apiKey, chain.Subdomain, defaultEvmTestAddress, "")
		internalSupport := "Supported"
		if strings.Contains(chain.Subdomain, "arb") || strings.Contains(chain.Subdomain, "opt") {
			internalSupport = "Excluded (API Limitation)"
		}

		if err != nil {
			fmt.Printf("❌ [%s] Transfers API failed (%v): %v\n", chain.Name, dur, err)
			report.WriteString(fmt.Sprintf("| %s | %s | %s | ❌ %v | %v | 0 | No |\n", chain.Name, chain.Subdomain, internalSupport, err, dur))
		} else {
			hasPageKey := res.PageKey != nil && *res.PageKey != ""
			fmt.Printf("✅ [%s] Transfers API succeeded in %v (%d transfers, Next Page: %v)\n", chain.Name, dur, len(res.Transfers), hasPageKey)
			report.WriteString(fmt.Sprintf("| %s | %s | %s | ✅ Succeeded | %v | %d | %v |\n", chain.Name, chain.Subdomain, internalSupport, dur, len(res.Transfers), hasPageKey))
		}
		time.Sleep(100 * time.Millisecond) // avoid burst rate limits
	}

	// 4. Solana RPC Benchmark
	fmt.Println("\n--- 3. Testing Solana RPC (Balance & Signatures) ---")
	solLamports, solSigs, solDur, solErr := BenchmarkSolanaRPC(ctx, apiKey, defaultSolanaTestAddress)
	report.WriteString("\n### 3. Solana API (Balance & History)\n")
	if solErr != nil {
		fmt.Printf("⚠️ Solana RPC failed (%v): %v\n", solDur, solErr)
		report.WriteString(fmt.Sprintf("- **Status:** ⚠️ Failed (%v)\n", solErr))
	} else {
		solValue := float64(solLamports) / 1e9
		fmt.Printf("✅ Solana RPC succeeded in %v (Balance: %.4f SOL, Signatures retrieved: %d)\n", solDur, solValue, len(solSigs))
		report.WriteString(fmt.Sprintf("- **Status:** ✅ Succeeded in %v\n", solDur))
		report.WriteString(fmt.Sprintf("- **Balance:** %.4f SOL (%d lamports)\n", solValue, solLamports))
		report.WriteString(fmt.Sprintf("- **Signatures Ingested:** %d\n", len(solSigs)))
	}

	// 5. Bitcoin UTXO REST Benchmark
	fmt.Println("\n--- 4. Testing Bitcoin UTXO REST API ---")
	btcUtxos, btcDur, btcErr := BenchmarkBitcoinAPI(ctx, apiKey, defaultBtcTestAddress)
	report.WriteString("\n### 4. Bitcoin UTXO REST API\n")
	if btcErr != nil {
		fmt.Printf("ℹ️ Bitcoin UTXO endpoint response (%v): %v\n", btcDur, btcErr)
		report.WriteString(fmt.Sprintf("- **UTXO Endpoint:** %v\n", btcErr))
		report.WriteString("- **Note:** Ensure 'Bitcoin' is added and UTXO is enabled in your Alchemy App dashboard.\n")
	} else {
		var totalSat uint64
		for _, u := range btcUtxos {
			totalSat += u.ValueSat
		}
		btcBal := float64(totalSat) / 1e8
		fmt.Printf("✅ Bitcoin UTXO endpoint succeeded in %v (UTXOs: %d, Balance: %.8f BTC)\n", btcDur, len(btcUtxos), btcBal)
		report.WriteString(fmt.Sprintf("- **Status:** ✅ Succeeded in %v\n", btcDur))
		report.WriteString(fmt.Sprintf("- **UTXOs Count:** %d\n", len(btcUtxos)))
		report.WriteString(fmt.Sprintf("- **Total Balance:** %.8f BTC (%d satoshis)\n", btcBal, totalSat))
	}

	// 6. Write Report to docs/superpowers/specs/2026-10-28-wallet-provider-matrix.md
	repoRoot := ".."
	if _, err := os.Stat(filepath.Join(repoRoot, "docs")); err != nil {
		repoRoot = "."
	}
	outputPath := filepath.Join(repoRoot, "docs", "superpowers", "specs", "2026-10-28-wallet-provider-matrix.md")
	_ = os.MkdirAll(filepath.Dir(outputPath), 0755)
	if err := os.WriteFile(outputPath, []byte(report.String()), 0644); err != nil {
		log.Printf("⚠️ Failed to write report file: %v", err)
	} else {
		fmt.Printf("\n📄 Detailed Qualification Report saved to %s\n", outputPath)
	}

	fmt.Println("\n=================================================================")
	fmt.Println("🎉 Phase 1 Provider Qualification Complete!")
	fmt.Println("=================================================================")
}
