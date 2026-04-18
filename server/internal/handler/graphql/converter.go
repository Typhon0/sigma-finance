package graphql

import (
	"encoding/json"
	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/service"
)

func mapUserToGQL(domainUser model.User) *gqlModel.User {
	return &gqlModel.User{
		ID:        domainUser.ID,
		Username:  domainUser.Name,
		Email:     domainUser.Email,
		CreatedAt: domainUser.CreatedAt,
		UpdatedAt: domainUser.UpdatedAt,
	}
}

func mapTagToGQL(tag model.Tag) *gqlModel.Tag {
	return &gqlModel.Tag{
		ID:   tag.ID,
		Name: tag.Name,
	}
}

func mapPortfolioToGQL(p model.Portfolio) *gqlModel.Portfolio {
	return &gqlModel.Portfolio{
		ID:           p.ID,
		Name:         p.Name,
		Description:  &p.Description,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
		SortOrder:    int32(p.SortOrder),
		Assets:       []*gqlModel.PortfolioAsset{},
		Tags:         []*gqlModel.Tag{},
		Transactions: []*gqlModel.Transaction{},
	}
}

func mapWatchlistToGQL(w model.Watchlist) *gqlModel.Watchlist {
	return &gqlModel.Watchlist{
		ID:        w.ID,
		Name:      w.Name,
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
		Assets:    []gqlModel.Asset{},
	}
}

func mapPositionToGQL(p model.Position) *gqlModel.Position {
	quantity, _ := p.Quantity.Float64()
	var avgPrice *float64
	if p.AverageCostBasis != nil {
		f, _ := p.AverageCostBasis.Float64()
		avgPrice = &f
	}
	ownership, _ := p.OwnershipPercentage.Float64()

	return &gqlModel.Position{
		ID:                   p.ID,
		Quantity:             quantity,
		AveragePurchasePrice: avgPrice,
		OwnershipPct:         &ownership,
	}
}

func mapPortfolioAssetToGQL(pa model.PortfolioAsset) *gqlModel.PortfolioAsset {
	return &gqlModel.PortfolioAsset{
		InstrumentID:         pa.InstrumentID,
		Quantity:             pa.Quantity,
		AveragePurchasePrice: &pa.AveragePurchasePrice,
	}
}

func mapPortfolioAssetToGQLWithAsset(pa model.PortfolioAsset, asset gqlModel.Asset) *gqlModel.PortfolioAsset {
	return &gqlModel.PortfolioAsset{
		Asset:                asset,
		InstrumentID:         pa.InstrumentID,
		Quantity:             pa.Quantity,
		AveragePurchasePrice: &pa.AveragePurchasePrice,
	}
}

// mapAssetTypeToGQL converts a domain AssetType to a GraphQL AssetType
func mapAssetTypeToGQL(domainAssetType model.AssetType) *gqlModel.AssetType {
	displayName := string(domainAssetType)
	switch domainAssetType {
	case model.AssetTypeStock:
		displayName = "Stock"
	case model.AssetTypeFund:
		displayName = "Fund"
	case model.AssetTypeCrypto:
		displayName = "Crypto"
	case model.AssetTypeBankAccount:
		displayName = "Bank Account"
	case model.AssetTypeRealEstate:
		displayName = "Real Estate"
	case model.AssetTypeLifeInsurance:
		displayName = "Life Insurance"
	case model.AssetTypeWatch:
		displayName = "Watch"
	case model.AssetTypeLoan:
		displayName = "Loan"
	case model.AssetTypeOtherValuable:
		displayName = "Other Valuable"
	}
	return &gqlModel.AssetType{
		ID:   string(domainAssetType),
		Name: displayName,
	}
}

// mapTagsToGQL converts a slice of domain Tags to GraphQL Tags
func mapTagsToGQL(domainTags []model.Tag) []*gqlModel.Tag {
	gqlTags := make([]*gqlModel.Tag, len(domainTags))
	for i, tag := range domainTags {
		gqlTags[i] = &gqlModel.Tag{
			ID:   tag.ID,
			Name: tag.Name,
		}
	}
	return gqlTags
}

// mapStockToGQL converts domain Asset and its metadata to GraphQL Stock
func mapStockToGQL(domainAsset model.Asset, stockDetails *model.Stock, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.Stock {
	var metadata model.StockMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	stock := &gqlModel.Stock{
		ID:               domainAsset.ID,
		Name:             domainAsset.Name,
		Symbol:           domainAsset.Symbol,
		Ticker:           metadata.Exchange,
		Tags:             mapTagsToGQL(tags),
		Sector:           &metadata.Sector,
		Exchange:         &metadata.Exchange,
		DayChange:        dayChange,
		DayChangePercent: dayChangePercent,
		CurrentValue:     currentValue,
	}

	if domainAsset.Symbol != nil {
		stock.Ticker = *domainAsset.Symbol
	}

	if stockDetails != nil {
		stock.Ticker = stockDetails.Ticker
		stock.Quantity = stockDetails.Quantity
		stock.BuyingPrice = &stockDetails.BuyingPrice
	}

	stock.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return stock
}

// mapFundToGQL converts domain Asset and its metadata to GraphQL Fund
func mapFundToGQL(domainAsset model.Asset, fundDetails *model.Fund, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.Fund {
	var metadata model.FundMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	fund := &gqlModel.Fund{
		ID:               domainAsset.ID,
		Name:             domainAsset.Name,
		Symbol:           domainAsset.Symbol,
		Ticker:           metadata.Exchange,
		Tags:             mapTagsToGQL(tags),
		Sector:           &metadata.Sector,
		Exchange:         &metadata.Exchange,
		FundType:         &metadata.FundType,
		DayChange:        dayChange,
		DayChangePercent: dayChangePercent,
		CurrentValue:     currentValue,
	}

	if domainAsset.Symbol != nil {
		fund.Ticker = *domainAsset.Symbol
	}

	if fundDetails != nil {
		fund.Ticker = fundDetails.Ticker
		fund.Quantity = fundDetails.Quantity
		fund.BuyingPrice = &fundDetails.BuyingPrice
	}

	fund.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return fund
}

// mapCryptoToGQL converts domain Asset and its metadata to GraphQL Crypto
func mapCryptoToGQL(domainAsset model.Asset, cryptoDetails *model.Crypto, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.Crypto {
	var metadata model.CryptoMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	crypto := &gqlModel.Crypto{
		ID:                domainAsset.ID,
		Name:              domainAsset.Name,
		Symbol:            domainAsset.Symbol,
		WalletAddress:     &metadata.WalletAddress,
		BlockchainNetwork: &metadata.Blockchain,
		Tags:              mapTagsToGQL(tags),
		DayChange:         dayChange,
		DayChangePercent:  dayChangePercent,
		CurrentValue:      currentValue,
	}

	if cryptoDetails != nil {
		crypto.Quantity = cryptoDetails.Quantity
		if cryptoDetails.WalletAddress != "" {
			crypto.WalletAddress = &cryptoDetails.WalletAddress
		}
		if cryptoDetails.BlockchainNetwork != "" {
			crypto.BlockchainNetwork = &cryptoDetails.BlockchainNetwork
		}
	}

	crypto.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return crypto
}

// mapBankAccountToGQL converts domain Asset and its metadata to GraphQL BankAccount
func mapBankAccountToGQL(domainAsset model.Asset, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.BankAccount {
	var metadata model.BankAccountMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	bankAccount := &gqlModel.BankAccount{
		ID:               domainAsset.ID,
		Name:             domainAsset.Name,
		Symbol:           domainAsset.Symbol,
		Tags:             mapTagsToGQL(tags),
		AccountType:      metadata.AccountType,
		Institution:      metadata.Institution,
		AccountNumber:    metadata.AccountNumber,
		Currency:         metadata.Currency,
		InterestRate:     metadata.InterestRate,
		DayChange:        dayChange,
		DayChangePercent: dayChangePercent,
		CurrentValue:     currentValue,
		Balance:          currentValue, // Balance is the same as currentValue for bank accounts
	}

	bankAccount.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return bankAccount
}

// mapRealEstateToGQL converts domain Asset and its metadata to GraphQL RealEstate
func mapRealEstateToGQL(domainAsset model.Asset, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.RealEstate {
	var metadata model.RealEstateMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	realEstate := &gqlModel.RealEstate{
		ID:               domainAsset.ID,
		Name:             domainAsset.Name,
		Symbol:           domainAsset.Symbol,
		Tags:             mapTagsToGQL(tags),
		PropertyType:     metadata.PropertyType,
		Address:          metadata.Address,
		City:             metadata.City,
		State:            &metadata.State,
		Country:          metadata.Country,
		ZipCode:          &metadata.ZipCode,
		SquareFeet:       intToInt32(metadata.SquareFeet),
		YearBuilt:        intToInt32(metadata.YearBuilt),
		Bedrooms:         intToInt32(metadata.Bedrooms),
		Bathrooms:        metadata.Bathrooms,
		DayChange:        dayChange,
		DayChangePercent: dayChangePercent,
		CurrentValue:     currentValue,
	}

	realEstate.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return realEstate
}

// mapLifeInsuranceToGQL converts domain Asset and its metadata to GraphQL LifeInsurance
func mapLifeInsuranceToGQL(domainAsset model.Asset, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.LifeInsurance {
	var metadata model.LifeInsuranceMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	// Convert cents back to dollars for display
	coverageAmount := float64(metadata.CoverageAmount) / 100.0
	premiumAmount := float64(metadata.PremiumAmount) / 100.0

	lifeInsurance := &gqlModel.LifeInsurance{
		ID:               domainAsset.ID,
		Name:             domainAsset.Name,
		Symbol:           domainAsset.Symbol,
		Tags:             mapTagsToGQL(tags),
		PolicyNumber:     metadata.PolicyNumber,
		Insurer:          metadata.Insurer,
		PolicyType:       metadata.PolicyType,
		CoverageAmount:   coverageAmount,
		PremiumAmount:    premiumAmount,
		PremiumFrequency: metadata.PremiumFrequency,
		Beneficiaries:    metadata.Beneficiaries,
		MaturityDate:     metadata.MaturityDate,
		DayChange:        dayChange,
		DayChangePercent: dayChangePercent,
		CurrentValue:     currentValue,
	}

	lifeInsurance.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return lifeInsurance
}

// mapWatchToGQL converts domain Asset and its metadata to GraphQL Watch
func mapWatchToGQL(domainAsset model.Asset, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.Watch {
	var metadata model.WatchMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	watch := &gqlModel.Watch{
		ID:               domainAsset.ID,
		Name:             domainAsset.Name,
		Symbol:           domainAsset.Symbol,
		Tags:             mapTagsToGQL(tags),
		Brand:            metadata.Brand,
		Model:            metadata.Model,
		SerialNumber:     metadata.SerialNumber,
		ReferenceNumber:  metadata.ReferenceNumber,
		Condition:        metadata.Condition,
		YearMade:         intToInt32(metadata.YearMade),
		Material:         metadata.Material,
		Movement:         metadata.Movement,
		CaseSize:         metadata.CaseSize,
		WaterResistance:  intToInt32(metadata.WaterResistance),
		DayChange:        dayChange,
		DayChangePercent: dayChangePercent,
		CurrentValue:     currentValue,
	}

	watch.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return watch
}

// mapLoanToGQL converts domain Asset and its metadata to GraphQL Loan
func mapLoanToGQL(domainAsset model.Asset, tags []model.Tag, dayChange, dayChangePercent, currentValue *float64) *gqlModel.Loan {
	var metadata model.LoanMetadata
	_ = json.Unmarshal(domainAsset.Metadata, &metadata)

	// Convert cents back to dollars for display
	loanAmount := float64(metadata.LoanAmount) / 100.0
	remainingBalance := float64(metadata.RemainingBalance) / 100.0
	monthlyPayment := float64(metadata.MonthlyPayment) / 100.0
	downPayment := float64(metadata.DownPayment) / 100.0
	applicationFee := float64(metadata.ApplicationFee) / 100.0
	brokerFee := float64(metadata.BrokerFee) / 100.0
	insuranceFee := float64(metadata.InsuranceFee) / 100.0
	otherFees := float64(metadata.OtherFees) / 100.0

	loan := &gqlModel.Loan{
		ID:               domainAsset.ID,
		Name:             domainAsset.Name,
		Symbol:           domainAsset.Symbol,
		Tags:             mapTagsToGQL(tags),
		Description:      stringPtrIfNotEmpty(metadata.Description),
		LoanType:         metadata.LoanType,
		LoanAmount:       loanAmount,
		RemainingBalance: remainingBalance,
		InterestRate:     metadata.InterestRate,
		DurationMonths:   int32(metadata.DurationMonths),
		MonthlyPayment:   monthlyPayment,
		StartDate:        metadata.StartDate,
		Lender:           metadata.Lender,
		Currency:         metadata.Currency,
		Status:           metadata.Status,
		DayChange:        dayChange,
		DayChangePercent: dayChangePercent,
		CurrentValue:     currentValue,
	}

	if metadata.EndDate != "" {
		loan.EndDate = &metadata.EndDate
	}
	if metadata.LoanNumber != "" {
		loan.LoanNumber = &metadata.LoanNumber
	}
	if metadata.DownPayment != 0 {
		loan.DownPayment = &downPayment
	}
	if metadata.OwnershipMode != "" {
		loan.OwnershipMode = &metadata.OwnershipMode
	}
	if metadata.ApplicationFee != 0 {
		loan.ApplicationFee = &applicationFee
	}
	if metadata.BrokerFee != 0 {
		loan.BrokerFee = &brokerFee
	}
	if metadata.InsuranceFee != 0 {
		loan.InsuranceFee = &insuranceFee
	}
	if metadata.OtherFees != 0 {
		loan.OtherFees = &otherFees
	}
	if metadata.EarlyRepaymentFee != 0 {
		loan.EarlyRepaymentFee = &metadata.EarlyRepaymentFee
	}

	loan.AssetType = mapAssetTypeToGQL(domainAsset.Type)

	return loan
}

// mapPortfolioAnalyticsToGQL converts service PortfolioAnalytics to GraphQL PortfolioAnalytics
func mapPortfolioAnalyticsToGQL(analytics service.PortfolioAnalytics) *gqlModel.PortfolioAnalytics {
	history := make([]*gqlModel.PerformancePoint, len(analytics.PerformanceHistory))
	for i, p := range analytics.PerformanceHistory {
		history[i] = mapPerformancePointToGQL(p)
	}

	return &gqlModel.PortfolioAnalytics{
		TotalValue:           analytics.TotalValue,
		TotalCost:            analytics.TotalCost,
		TotalGainLoss:        analytics.TotalGainLoss,
		TotalGainLossPercent: analytics.TotalGainLossPercent,
		AssetAllocation:      mapAssetAllocationsToGQL(analytics.AssetAllocation),
		RiskMetrics:          mapRiskMetricsToGQL(analytics.RiskMetrics),
		PerformanceHistory:   history,
	}
}

// mapAuthErrorToGQL converts service AuthError to GraphQL AuthError
func mapAuthErrorToGQL(err *service.AuthError) *gqlModel.AuthError {
	if err == nil {
		return nil
	}
	var field *string
	if err.Field != "" {
		field = &err.Field
	}
	return &gqlModel.AuthError{
		Code:    err.Code,
		Message: err.Message,
		Field:   field,
	}
}

// mapRiskMetricsToGQL converts service RiskMetrics to GraphQL RiskMetrics
func mapRiskMetricsToGQL(risk service.RiskMetrics) *gqlModel.RiskMetrics {
	return &gqlModel.RiskMetrics{
		Volatility:      risk.Volatility,
		SharpeRatio:     risk.SharpeRatio,
		MaxDrawdown:     risk.MaxDrawdown,
		Diversification: risk.Diversification,
	}
}

// mapPerformancePointToGQL converts service PerformancePoint to GraphQL PerformancePoint
func mapPerformancePointToGQL(p service.PerformancePoint) *gqlModel.PerformancePoint {
	return &gqlModel.PerformancePoint{
		Date:  p.Date,
		Value: p.Value,
	}
}

// mapTransactionToGQL converts a domain Transaction to a GraphQL Transaction
func mapTransactionToGQL(t model.Transaction) *gqlModel.Transaction {
	quantity := 0.0
	if t.Quantity != nil {
		quantity, _ = t.Quantity.Float64()
	}

	pricePerUnit := 0.0
	if t.PricePerUnit != nil {
		pricePerUnit, _ = t.PricePerUnit.Float64()
	}

	return &gqlModel.Transaction{
		ID:              t.ID,
		TransactionType: gqlModel.TransactionType(t.Type),
		Quantity:        quantity,
		PricePerUnit:    pricePerUnit,
		TransactionDate: t.TransactionDate,
		Notes:           t.Notes,
		// Portfolio and Asset are lazy loaded or set by the resolver
	}
}

// mapAuthResponseToGQL converts service AuthResponse to GraphQL AuthResponse
func mapAuthResponseToGQL(resp *service.AuthResponse) *gqlModel.AuthResponse {
	if resp == nil {
		return &gqlModel.AuthResponse{Success: false}
	}

	return &gqlModel.AuthResponse{
		Success: true,
		Data: &gqlModel.AuthData{
			Token:        resp.Token,
			RefreshToken: resp.RefreshToken,
			ExpiresAt:    resp.ExpiresAt,
			User: &gqlModel.AuthUser{
				ID:            resp.User.ID,
				Email:         resp.User.Email,
				Name:          resp.User.Name,
				EmailVerified: resp.User.EmailVerified,
			},
		},
	}
}

// mapAssetAllocationsToGQL converts service AssetAllocation slice to GraphQL AssetAllocation slice
func mapAssetAllocationsToGQL(allocations []service.AssetAllocation) []*gqlModel.AssetAllocation {
	gqlAllocations := make([]*gqlModel.AssetAllocation, len(allocations))
	for i, allocation := range allocations {
		gqlAllocations[i] = &gqlModel.AssetAllocation{
			AssetType:  allocation.AssetType,
			Value:      allocation.Value,
			Percentage: allocation.Percentage,
			Count:      int32(allocation.Count),
		}
	}
	return gqlAllocations
}
