package graphql

import (
	"context"
	"encoding/json"
	"time"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/handler/middleware"
	marketdatapacks "sigma_finance/internal/service/marketdata/packs"
)

func (r *queryResolver) AvailableMarketDataPacks(ctx context.Context) ([]*gqlModel.MarketDataPackRegistryEntry, error) {
	if _, err := middleware.RequireAuth(ctx); err != nil {
		return nil, err
	}
	packs, err := r.Resolver.MarketDataPackService.ListAvailablePacks(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*gqlModel.MarketDataPackRegistryEntry, 0, len(packs))
	for _, pack := range packs {
		out = append(out, mapRegistryPackToGraphQL(pack))
	}
	return out, nil
}

func (r *queryResolver) InstalledMarketDataPacks(ctx context.Context) ([]*gqlModel.MarketDataPack, error) {
	if _, err := middleware.RequireAuth(ctx); err != nil {
		return nil, err
	}
	packs, err := r.Resolver.MarketDataPackService.ListInstalledPacks(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*gqlModel.MarketDataPack, 0, len(packs))
	for _, pack := range packs {
		out = append(out, &gqlModel.MarketDataPack{
			ID:                pack.ID,
			Version:           pack.Version,
			Name:              pack.Name,
			Description:       pack.Description,
			FormatVersion:     int32(pack.FormatVersion),
			Status:            pack.Status,
			ParentPackID:      pack.ParentPackID,
			PackPriority:      int32(pack.PackPriority),
			FilePath:          pack.FilePath,
			Checksum:          pack.Checksum,
			SignatureVerified: pack.SignatureVerified,
			AssetsCount:       int(pack.AssetsCount),
			RowsCount:         int(pack.RowsCount),
			InstalledAt:       pack.InstalledAt,
			UpdatedAt:         pack.UpdatedAt,
			CreatedAt:         pack.CreatedAt,
		})
	}
	return out, nil
}

func (r *queryResolver) MarketDataPackJob(ctx context.Context, id string) (*gqlModel.MarketDataPackJob, error) {
	if _, err := middleware.RequireAuth(ctx); err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.GetPackJob(ctx, id)
	if err != nil {
		return nil, err
	}
	return mapPackJobToGraphQL(job), nil
}

func (r *queryResolver) MarketDataCoverage(ctx context.Context, instrumentID string) ([]*gqlModel.MarketDataPackCoverage, error) {
	if _, err := middleware.RequireAuth(ctx); err != nil {
		return nil, err
	}
	coverage, err := r.Resolver.MarketDataPackService.GetCoverage(ctx, instrumentID)
	if err != nil {
		return nil, err
	}
	out := make([]*gqlModel.MarketDataPackCoverage, 0, len(coverage))
	for _, item := range coverage {
		var paths []string
		_ = json.Unmarshal(item.FilePaths, &paths)
		out = append(out, &gqlModel.MarketDataPackCoverage{
			PackID:        item.PackID,
			InstrumentID:  item.InstrumentID,
			Symbol:        item.Symbol,
			AssetType:     item.AssetType,
			Interval:      string(item.Interval),
			QuoteCurrency: item.QuoteCurrency,
			FirstDate:     item.FirstDate,
			LastDate:      item.LastDate,
			RowCount:      int(item.RowCount),
			FilePaths:     paths,
		})
	}
	return out, nil
}

func (r *queryResolver) PackBuildJob(ctx context.Context, id string) (*gqlModel.MarketDataPackBuildJob, error) {
	user, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.GetLocalPackBuildJob(ctx, user.ID, id)
	if err != nil {
		return nil, err
	}
	return mapLocalBuildJobToGraphQL(job), nil
}

func (r *queryResolver) PackBuildJobs(ctx context.Context, limit *int32) ([]*gqlModel.MarketDataPackBuildJob, error) {
	user, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}
	requested := 20
	if limit != nil && *limit > 0 {
		requested = int(*limit)
	}
	rows, err := r.Resolver.MarketDataPackService.ListLocalPackBuildJobs(ctx, user.ID, requested)
	if err != nil {
		return nil, err
	}
	out := make([]*gqlModel.MarketDataPackBuildJob, 0, len(rows))
	for i := range rows {
		out = append(out, mapLocalBuildJobToGraphQL(&rows[i]))
	}
	return out, nil
}

func (r *mutationResolver) InstallMarketDataPack(ctx context.Context, packID string) (*gqlModel.MarketDataPackJob, error) {
	if _, err := requireCatalogAdmin(ctx, r.Resolver); err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.InstallPack(ctx, packID)
	if err != nil {
		return nil, err
	}
	return mapPackJobToGraphQL(job), nil
}

func (r *mutationResolver) UpdateMarketDataPack(ctx context.Context, packID string) (*gqlModel.MarketDataPackJob, error) {
	if _, err := requireCatalogAdmin(ctx, r.Resolver); err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.UpdatePack(ctx, packID)
	if err != nil {
		return nil, err
	}
	return mapPackJobToGraphQL(job), nil
}

func (r *mutationResolver) RemoveMarketDataPack(ctx context.Context, packID string) (*gqlModel.MarketDataPackJob, error) {
	if _, err := requireCatalogAdmin(ctx, r.Resolver); err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.RemovePack(ctx, packID)
	if err != nil {
		return nil, err
	}
	return mapPackJobToGraphQL(job), nil
}

func (r *mutationResolver) RepairMarketDataPack(ctx context.Context, packID string) (*gqlModel.MarketDataPackJob, error) {
	if _, err := requireCatalogAdmin(ctx, r.Resolver); err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.RepairPack(ctx, packID)
	if err != nil {
		return nil, err
	}
	return mapPackJobToGraphQL(job), nil
}

func (r *mutationResolver) CancelMarketDataPackJob(ctx context.Context, jobID string) (*gqlModel.MarketDataPackJob, error) {
	if _, err := requireCatalogAdmin(ctx, r.Resolver); err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.CancelPackJob(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return mapPackJobToGraphQL(job), nil
}

func (r *mutationResolver) StartLocalPackBuild(ctx context.Context, input gqlModel.StartLocalPackBuildInput) (*gqlModel.MarketDataPackBuildJob, error) {
	user, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}
	var packID *string
	if input.PackID != nil {
		trimmed := *input.PackID
		packID = &trimmed
	}
	var historyStart *time.Time
	if input.HistoryStart != nil {
		value := *input.HistoryStart
		historyStart = &value
	}
	var historyEnd *time.Time
	if input.HistoryEnd != nil {
		value := *input.HistoryEnd
		historyEnd = &value
	}
	var requestsPerMinute *int
	if input.RequestsPerMinute != nil {
		value := int(*input.RequestsPerMinute)
		requestsPerMinute = &value
	}
	var requestsPerDay *int
	if input.RequestsPerDay != nil {
		value := int(*input.RequestsPerDay)
		requestsPerDay = &value
	}
	var concurrentRequests *int
	if input.ConcurrentRequests != nil {
		value := int(*input.ConcurrentRequests)
		concurrentRequests = &value
	}
	portfolioFirst := true
	if input.PortfolioFirst != nil {
		portfolioFirst = *input.PortfolioFirst
	}
	job, err := r.Resolver.MarketDataPackService.StartLocalPackBuild(ctx, user.ID, marketdatapacks.StartLocalPackBuildInput{
		PackID:                packID,
		SourceProvider:        input.SourceProvider,
		AssetTypes:            input.AssetTypes,
		HistoryStart:          historyStart,
		HistoryEnd:            historyEnd,
		PortfolioFirst:        portfolioFirst,
		UniverseInstrumentIDs: input.UniverseInstrumentIds,
		RequestsPerMinute:     requestsPerMinute,
		RequestsPerDay:        requestsPerDay,
		ConcurrentRequests:    concurrentRequests,
	})
	if err != nil {
		return nil, err
	}
	return mapLocalBuildJobToGraphQL(job), nil
}

func (r *mutationResolver) CancelPackBuildJob(ctx context.Context, id string) (*gqlModel.MarketDataPackBuildJob, error) {
	user, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, err
	}
	job, err := r.Resolver.MarketDataPackService.CancelLocalPackBuild(ctx, user.ID, id)
	if err != nil {
		return nil, err
	}
	return mapLocalBuildJobToGraphQL(job), nil
}

func mapRegistryPackToGraphQL(pack marketdatapacks.RegistryPack) *gqlModel.MarketDataPackRegistryEntry {
	signatureURL := pack.SignatureURL
	var signatureURLPtr *string
	if signatureURL != "" {
		signatureURLPtr = &signatureURL
	}
	return &gqlModel.MarketDataPackRegistryEntry{
		PackID:              pack.PackID,
		Version:             pack.Version,
		Name:                pack.Name,
		Description:         &pack.Description,
		SizeBytes:           int(pack.SizeBytes),
		CompressedSizeBytes: int(pack.CompressedSizeBytes),
		AssetsCount:         int(pack.AssetsCount),
		RowsCount:           int(pack.RowsCount),
		Interval:            pack.Interval,
		AssetTypes:          pack.AssetTypes,
		QuoteCurrencies:     pack.QuoteCurrencies,
		DownloadURL:         pack.DownloadURL,
		Checksum:            pack.Checksum,
		SignatureURL:        signatureURLPtr,
		CreatedAt:           pack.CreatedAt,
		Recommended:         pack.Recommended,
	}
}

func mapPackJobToGraphQL(job *model.MarketDataPackJob) *gqlModel.MarketDataPackJob {
	progress, _ := job.ProgressPercent.Float64()
	return &gqlModel.MarketDataPackJob{
		ID:              job.ID,
		PackID:          job.PackID,
		JobType:         job.JobType,
		Status:          job.Status,
		ProgressPercent: progress,
		DownloadedBytes: int(job.DownloadedBytes),
		TotalBytes:      int(job.TotalBytes),
		ImportedRows:    int(job.ImportedRows),
		ErrorMessage:    job.ErrorMessage,
		CreatedAt:       job.CreatedAt,
		StartedAt:       job.StartedAt,
		FinishedAt:      job.FinishedAt,
	}
}

func mapLocalBuildJobToGraphQL(job *model.MarketDataPackBuildJob) *gqlModel.MarketDataPackBuildJob {
	progress, _ := job.ProgressPercent.Float64()
	return &gqlModel.MarketDataPackBuildJob{
		ID:               job.ID,
		PackID:           job.PackID,
		SourceProvider:   job.SourceProvider,
		Status:           job.Status,
		ProgressPercent:  progress,
		CurrentSymbol:    job.CurrentSymbol,
		TotalSymbols:     int32(job.TotalSymbols),
		CompletedSymbols: int32(job.CompletedSymbols),
		FailedSymbols:    int32(job.FailedSymbols),
		ErrorMessage:     job.ErrorMessage,
		CreatedAt:        job.CreatedAt,
		StartedAt:        job.StartedAt,
		FinishedAt:       job.FinishedAt,
	}
}
