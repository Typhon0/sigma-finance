package graphql

import (
	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"strconv"
)

// mapPortfolioToGQL converts a domain Portfolio to a GraphQL Portfolio
func mapPortfolioToGQL(domainPortfolio model.Portfolio) *gqlModel.Portfolio {
	return &gqlModel.Portfolio{
		ID:        strconv.Itoa(domainPortfolio.ID),
		Name:      domainPortfolio.Name,
		CreatedAt: domainPortfolio.CreatedAt,
		UpdatedAt: domainPortfolio.UpdatedAt,
		// User, Tags, Assets, and Transactions would be populated by separate resolvers
		// or through eager loading if needed
	}
}

// mapPortfolioToGQLWithRelations converts a domain Portfolio to a GraphQL Portfolio with related data
func mapPortfolioToGQLWithRelations(domainPortfolio model.Portfolio, user *model.User, tags []model.Tag, assets []model.PortfolioAsset, transactions []model.Transaction) *gqlModel.Portfolio {
	portfolio := mapPortfolioToGQL(domainPortfolio)

	if user != nil {
		portfolio.User = mapUserToGQL(*user)
	}

	if tags != nil {
		portfolio.Tags = mapTagsToGQL(tags)
	}

	// Note: Assets and Transactions would need special handling since they require
	// additional data loading for complete GraphQL representation

	return portfolio
}

// mapPortfoliosToGQL converts a slice of domain Portfolios to GraphQL Portfolios
func mapPortfoliosToGQL(domainPortfolios []model.Portfolio) []*gqlModel.Portfolio {
	gqlPortfolios := make([]*gqlModel.Portfolio, len(domainPortfolios))
	for i, portfolio := range domainPortfolios {
		gqlPortfolios[i] = mapPortfolioToGQL(portfolio)
	}
	return gqlPortfolios
}

// mapUserToGQL converts a domain User to a GraphQL User
func mapUserToGQL(domainUser model.User) *gqlModel.User {
	return &gqlModel.User{
		ID:        strconv.Itoa(domainUser.ID),
		Username:  domainUser.Username,
		Email:     domainUser.Email,
		CreatedAt: domainUser.CreatedAt,
		UpdatedAt: domainUser.UpdatedAt,
		// Portfolios, Watchlists, Alerts, Reports, and Ownerships would be populated
		// by separate resolvers or through eager loading if needed
	}
}

// mapUsersToGQL converts a slice of domain Users to GraphQL Users
func mapUsersToGQL(domainUsers []model.User) []*gqlModel.User {
	gqlUsers := make([]*gqlModel.User, len(domainUsers))
	for i, user := range domainUsers {
		gqlUsers[i] = mapUserToGQL(user)
	}
	return gqlUsers
}

// mapPortfolioAssetToGQL converts a domain PortfolioAsset to a GraphQL PortfolioAsset
func mapPortfolioAssetToGQL(domainPortfolioAsset model.PortfolioAsset) *gqlModel.PortfolioAsset {
	return &gqlModel.PortfolioAsset{
		Quantity:             domainPortfolioAsset.Quantity,
		AveragePurchasePrice: &domainPortfolioAsset.AveragePurchasePrice,
		// Asset would be populated by a separate resolver or through eager loading
	}
}

// mapAssetTypeToGQL converts a domain AssetType to a GraphQL AssetType
func mapAssetTypeToGQL(domainAssetType model.AssetType) *gqlModel.AssetType {
	return &gqlModel.AssetType{
		ID:   strconv.Itoa(domainAssetType.ID),
		Name: domainAssetType.Name,
	}
}

// mapAssetTypesToGQL converts a slice of domain AssetTypes to GraphQL AssetTypes
func mapAssetTypesToGQL(domainAssetTypes []model.AssetType) []*gqlModel.AssetType {
	gqlAssetTypes := make([]*gqlModel.AssetType, len(domainAssetTypes))
	for i, assetType := range domainAssetTypes {
		gqlAssetTypes[i] = mapAssetTypeToGQL(assetType)
	}
	return gqlAssetTypes
}

// mapTagToGQL converts a domain Tag to a GraphQL Tag
func mapTagToGQL(domainTag model.Tag) *gqlModel.Tag {
	return &gqlModel.Tag{
		ID:   strconv.Itoa(domainTag.ID),
		Name: domainTag.Name,
	}
}

// mapTagsToGQL converts a slice of domain Tags to GraphQL Tags
func mapTagsToGQL(domainTags []model.Tag) []*gqlModel.Tag {
	gqlTags := make([]*gqlModel.Tag, len(domainTags))
	for i, tag := range domainTags {
		gqlTags[i] = mapTagToGQL(tag)
	}
	return gqlTags
}

// mapStockToGQL converts domain Asset and Stock to GraphQL Stock
func mapStockToGQL(domainAsset model.Asset, domainStock model.Stock, assetType *model.AssetType, tags []model.Tag) *gqlModel.Stock {
	stock := &gqlModel.Stock{
		ID:           strconv.Itoa(domainAsset.ID),
		Name:         domainAsset.Name,
		CurrentValue: &domainAsset.CurrentValue,
		Ticker:       domainStock.Ticker,
		Quantity:     domainStock.Quantity,
		BuyingPrice:  &domainStock.BuyingPrice,
		Tags:         mapTagsToGQL(tags),
	}

	if !domainAsset.PurchaseDate.IsZero() {
		stock.PurchaseDate = &domainAsset.PurchaseDate
	}
	if domainAsset.PurchasePrice != 0 {
		stock.PurchasePrice = &domainAsset.PurchasePrice
	}
	if assetType != nil {
		stock.AssetType = mapAssetTypeToGQL(*assetType)
	}

	return stock
}

// mapCryptoToGQL converts domain Asset and Crypto to GraphQL Crypto
func mapCryptoToGQL(domainAsset model.Asset, domainCrypto model.Crypto, assetType *model.AssetType, tags []model.Tag) *gqlModel.Crypto {
	crypto := &gqlModel.Crypto{
		ID:       strconv.Itoa(domainAsset.ID),
		Name:     domainAsset.Name,
		Quantity: domainCrypto.Quantity,
		Tags:     mapTagsToGQL(tags),
	}

	if domainAsset.CurrentValue != 0 {
		crypto.CurrentValue = &domainAsset.CurrentValue
	}
	if !domainAsset.PurchaseDate.IsZero() {
		crypto.PurchaseDate = &domainAsset.PurchaseDate
	}
	if domainAsset.PurchasePrice != 0 {
		crypto.PurchasePrice = &domainAsset.PurchasePrice
	}
	if domainCrypto.WalletAddress != "" {
		crypto.WalletAddress = &domainCrypto.WalletAddress
	}
	if domainCrypto.BlockchainNetwork != "" {
		crypto.BlockchainNetwork = &domainCrypto.BlockchainNetwork
	}
	if assetType != nil {
		crypto.AssetType = mapAssetTypeToGQL(*assetType)
	}

	return crypto
}

// mapTransactionToGQL converts a domain Transaction to a GraphQL Transaction
func mapTransactionToGQL(domainTransaction model.Transaction) *gqlModel.Transaction {
	var transactionType gqlModel.TransactionType
	switch domainTransaction.TransactionType {
	case "BUY":
		transactionType = gqlModel.TransactionTypeBuy
	case "SELL":
		transactionType = gqlModel.TransactionTypeSell
	default:
		transactionType = gqlModel.TransactionTypeBuy // Default fallback
	}

	return &gqlModel.Transaction{
		ID:              strconv.Itoa(domainTransaction.ID),
		TransactionType: transactionType,
		Quantity:        domainTransaction.Quantity,
		PricePerUnit:    domainTransaction.PricePerUnit,
		TransactionDate: domainTransaction.TransactionDate,
		// Portfolio and Asset would be populated by separate resolvers
	}
}

// mapTransactionsToGQL converts a slice of domain Transactions to GraphQL Transactions
func mapTransactionsToGQL(domainTransactions []model.Transaction) []*gqlModel.Transaction {
	gqlTransactions := make([]*gqlModel.Transaction, len(domainTransactions))
	for i, transaction := range domainTransactions {
		gqlTransactions[i] = mapTransactionToGQL(transaction)
	}
	return gqlTransactions
}

// mapWatchlistToGQL converts a domain Watchlist to a GraphQL Watchlist
func mapWatchlistToGQL(domainWatchlist model.Watchlist) *gqlModel.Watchlist {
	return &gqlModel.Watchlist{
		ID:        strconv.Itoa(domainWatchlist.ID),
		Name:      domainWatchlist.Name,
		CreatedAt: domainWatchlist.CreatedAt,
		UpdatedAt: domainWatchlist.UpdatedAt,
		// User and Assets would be populated by separate resolvers
	}
}

// mapWatchlistsToGQL converts a slice of domain Watchlists to GraphQL Watchlists
func mapWatchlistsToGQL(domainWatchlists []model.Watchlist) []*gqlModel.Watchlist {
	gqlWatchlists := make([]*gqlModel.Watchlist, len(domainWatchlists))
	for i, watchlist := range domainWatchlists {
		gqlWatchlists[i] = mapWatchlistToGQL(watchlist)
	}
	return gqlWatchlists
}
