package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"sigma_finance/internal/marketdata/packs/ciutil"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "serve-fixtures":
		err = runServeFixtures(os.Args[2:])
	case "aggregate-registry":
		err = runAggregateRegistry(os.Args[2:])
	case "validate-registry":
		err = runValidateRegistry(os.Args[2:])
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		log.Fatalf("market-data-pack-ci: %v", err)
	}
}

func usage() {
	log.Println("usage: market-data-pack-ci <serve-fixtures|aggregate-registry|validate-registry> [flags]")
}

func runServeFixtures(args []string) error {
	fs := flag.NewFlagSet("serve-fixtures", flag.ContinueOnError)
	addr := fs.String("addr", "127.0.0.1:18080", "listen address")
	if err := fs.Parse(args); err != nil {
		return err
	}

	data, err := ciutil.LoadDefaultFixtureServerData()
	if err != nil {
		return err
	}
	handler, err := ciutil.NewFixtureHandler(data)
	if err != nil {
		return err
	}

	server := &http.Server{
		Addr:         strings.TrimSpace(*addr),
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Printf("fixture server listening on %s", server.Addr)
	err = server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func runAggregateRegistry(args []string) error {
	fs := flag.NewFlagSet("aggregate-registry", flag.ContinueOnError)
	input := fs.String("input", "", "directory containing *.registry.json files")
	output := fs.String("out", "", "output registry.json path")
	latestVersion := fs.String("latest-version", "", "latest_version value")
	if err := fs.Parse(args); err != nil {
		return err
	}

	registry, err := ciutil.AggregateRegistry(ciutil.AggregateRegistryOptions{
		InputDir:      strings.TrimSpace(*input),
		OutputPath:    strings.TrimSpace(*output),
		LatestVersion: strings.TrimSpace(*latestVersion),
	})
	if err != nil {
		return err
	}
	log.Printf("registry written packs=%d latest_version=%s", len(registry.Packs), registry.LatestVersion)
	return nil
}

func runValidateRegistry(args []string) error {
	fs := flag.NewFlagSet("validate-registry", flag.ContinueOnError)
	registry := fs.String("registry", "", "registry.json path")
	distDir := fs.String("dist-dir", "", "dist directory containing .sfpack and .sig")
	packIDs := fs.String("expected-pack-ids", "", "comma-separated pack ids")
	if err := fs.Parse(args); err != nil {
		return err
	}

	var expected []string
	if strings.TrimSpace(*packIDs) != "" {
		for _, value := range strings.Split(*packIDs, ",") {
			trimmed := strings.TrimSpace(value)
			if trimmed != "" {
				expected = append(expected, trimmed)
			}
		}
	}
	if err := ciutil.ValidateRegistry(ciutil.ValidateRegistryOptions{
		RegistryPath:   strings.TrimSpace(*registry),
		DistDir:        strings.TrimSpace(*distDir),
		ExpectedPackID: expected,
	}); err != nil {
		return err
	}
	fmt.Println("registry validation ok")
	return nil
}
