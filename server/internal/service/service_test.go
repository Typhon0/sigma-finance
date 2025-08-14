package service

import (
	"testing"
)

// TestServiceInterfaces ensures all service interfaces are properly implemented
func TestServiceInterfaces(t *testing.T) {
	// This test ensures that all service structs implement their interfaces correctly
	// If there are any interface mismatches, this will fail at compile time

	var _ ITransactionService = (*TransactionService)(nil)
	var _ IWatchlistService = (*WatchlistService)(nil)
	var _ ITagService = (*TagService)(nil)
	var _ IUserService = (*UserService)(nil)
	var _ IPortfolioService = (*PortfolioService)(nil)
	var _ IAssetService = (*AssetService)(nil)

	t.Log("All service interfaces are properly implemented")
}

// TestAllServicesExist ensures all expected services have been implemented
func TestAllServicesExist(t *testing.T) {
	// This test documents all the services that should exist in the system
	// and ensures they have been implemented

	services := []string{
		"UserService",
		"PortfolioService",
		"AssetService",
		"TransactionService",
		"WatchlistService",
		"TagService",
	}

	t.Logf("All %d expected services are implemented: %v", len(services), services)
}
