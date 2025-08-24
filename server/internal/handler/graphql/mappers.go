package graphql

import (
	"strconv"

	"sigma_finance/internal/domain/model"
	graphmodel "sigma_finance/internal/handler/graphql/model"
)

func ToGraphQLUser(user *model.User) *graphmodel.User {
	return &graphmodel.User{
		ID:        strconv.Itoa(user.ID),
		Username:  user.Username,
		Email:     user.Email,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}
}

func ToGraphQLTag(tag *model.Tag) *graphmodel.Tag {
	return &graphmodel.Tag{
		ID:   strconv.Itoa(tag.ID),
		Name: tag.Name,
	}
}

func ToGraphQLAsset(asset *model.Asset) graphmodel.Asset {
	tags := make([]*graphmodel.Tag, len(asset.Tags))
	for i, t := range asset.Tags {
		tags[i] = ToGraphQLTag(&t)
	}

	// This is a simplified asset converter. It defaults to returning a Stock.
	// A more advanced implementation would check asset.AssetTypeID and return
	// either a *graphmodel.Stock or a *graphmodel.Crypto.
	return &graphmodel.Stock{
		ID:            strconv.Itoa(asset.ID),
		Name:          asset.Name,
		CurrentValue:  &asset.CurrentValue,
		PurchaseDate:  &asset.PurchaseDate,
		PurchasePrice: &asset.PurchasePrice,
		Tags:          tags,
	}
}

func ToGraphQLTransaction(transaction *model.Transaction) *graphmodel.Transaction {
	return &graphmodel.Transaction{
		ID:              strconv.Itoa(transaction.ID),
		TransactionType: graphmodel.TransactionType(transaction.TransactionType),
		Quantity:        transaction.Quantity,
		PricePerUnit:    transaction.PricePerUnit,
		TransactionDate: transaction.TransactionDate,
		Notes:           &transaction.Notes,
	}
}

func ToGraphQLPortfolio(p *model.Portfolio) *graphmodel.Portfolio {
	return &graphmodel.Portfolio{
		ID:           strconv.Itoa(p.ID),
		Name:         p.Name,
		Description:  &p.Description,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
		SortOrder:    int32(p.SortOrder),
		Assets:       []*graphmodel.PortfolioAsset{}, // This should be populated by a dedicated resolver
		Tags:         []*graphmodel.Tag{},            // This should be populated by a dedicated resolver
		Transactions: []*graphmodel.Transaction{},    // This should be populated by a dedicated resolver
		Analytics:    nil,                            // This should be populated by a dedicated resolver
	}
}

func ToGraphQLWatchlist(w *model.Watchlist) *graphmodel.Watchlist {
	return &graphmodel.Watchlist{
		ID:        strconv.Itoa(w.ID),
		Name:      w.Name,
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
		Assets:    []graphmodel.Asset{}, // This should be populated by a dedicated resolver
	}
}




