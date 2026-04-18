package graphql

import (
	"fmt"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

func mapPerformanceMetricsToGQL(metrics *service.ServicePerformanceMetrics) *gqlModel.PerformanceMetrics {
	if metrics == nil {
		return nil
	}

	twReturn, _ := metrics.TimeWeightedReturn.Float64()
	totalReturnPct, _ := metrics.TotalReturnPercentage.Float64()

	benchmarks := make([]*gqlModel.BenchmarkResult, 0, len(metrics.Benchmarks))
	for k, v := range metrics.Benchmarks {
		val, _ := v.Float64()
		benchmarks = append(benchmarks, &gqlModel.BenchmarkResult{
			Name:  k,
			Value: val,
		})
	}

	return &gqlModel.PerformanceMetrics{
		PortfolioID:           metrics.PortfolioID,
		TotalValue:            metrics.TotalValue.ToFloat(),
		TotalCostBasis:        metrics.TotalCostBasis.ToFloat(),
		UnrealizedGainLoss:    metrics.UnrealizedGainLoss.ToFloat(),
		RealizedGainLoss:      metrics.RealizedGainLoss.ToFloat(),
		TotalReturnPercentage: totalReturnPct,
		TimeWeightedReturn:    twReturn,
		IsValid:               metrics.IsValid,
		ValidationErrors:      metrics.ValidationErrors,
		DataQuality:           mapDataQualityToGQL(metrics.DataQuality),
		CalculationMethod:     mapCalculationMethodToGQL(metrics.CalculationMethod),
		Benchmarks:            benchmarks,
	}
}

func mapAllocationBreakdownToGQL(breakdown *service.AllocationBreakdown) *gqlModel.AllocationBreakdown {
	if breakdown == nil {
		return nil
	}

	allocs := make([]*gqlModel.AssetAllocation, 0, len(breakdown.Allocations))
	for _, a := range breakdown.Allocations {
		pct, _ := a.Percentage.Float64()
		q, _ := a.TotalQuantity.Float64()
		allocs = append(allocs, &gqlModel.AssetAllocation{
			AssetType:  string(a.AssetType),
			Value:      q, // using quantity proxy if value not present
			Percentage: pct,
			Count:      int32(a.PositionCount),
		})
	}

	recs := make([]*gqlModel.RebalanceRecommendation, 0, len(breakdown.RebalanceRecommendations))
	for _, r := range breakdown.RebalanceRecommendations {
		cw, _ := r.CurrentWeight.Float64()
		tw, _ := r.TargetWeight.Float64()
		recs = append(recs, &gqlModel.RebalanceRecommendation{
			AssetType:         string(r.AssetType),
			CurrentWeight:     cw,
			TargetWeight:      tw,
			RecommendedAction: r.RecommendedAction,
			Amount:            r.Amount.ToFloat(),
			Reason:            r.Reason,
		})
	}

	var riskAnalysis *gqlModel.AllocationRiskAnalysis
	cr, _ := breakdown.RiskAnalysis.ConcentrationRisk.Float64()
	corr, _ := breakdown.RiskAnalysis.CorrelationRisk.Float64()
	lr, _ := breakdown.RiskAnalysis.LiquidityRisk.Float64()

	riskByAsset := make([]*gqlModel.AssetTypeRisk, 0, len(breakdown.RiskAnalysis.RiskByAssetType))
	for t, r := range breakdown.RiskAnalysis.RiskByAssetType {
		rl, _ := r.Float64()
		riskByAsset = append(riskByAsset, &gqlModel.AssetTypeRisk{
			AssetType: string(t),
			RiskLevel: rl,
		})
	}

	riskAnalysis = &gqlModel.AllocationRiskAnalysis{
		ConcentrationRisk: cr,
		CorrelationRisk:   corr,
		LiquidityRisk:     lr,
		RiskByAssetType:   riskByAsset,
	}

	divScore, _ := breakdown.DiversificationScore.Float64()

	return &gqlModel.AllocationBreakdown{
		PortfolioID:              breakdown.PortfolioID,
		TotalValue:               breakdown.TotalValue.ToFloat(),
		Allocations:              allocs,
		RebalanceRecommendations: recs,
		RiskAnalysis:             riskAnalysis,
		DiversificationScore:     divScore,
	}
}

func mapPerformanceSnapshotToGQL(snapshot *service.PerformanceSnapshot) *gqlModel.PerformanceSnapshot {
	if snapshot == nil {
		return nil
	}

	ret, _ := snapshot.ReturnPercentage.Float64()

	return &gqlModel.PerformanceSnapshot{
		ID:                 fmt.Sprintf("%d", snapshot.ID),
		PortfolioID:        snapshot.PortfolioID,
		TotalValue:         snapshot.TotalValue.ToFloat(),
		TotalCostBasis:     snapshot.TotalCostBasis.ToFloat(),
		UnrealizedGainLoss: snapshot.UnrealizedGainLoss.ToFloat(),
		RealizedGainLoss:   snapshot.RealizedGainLoss.ToFloat(),
		ReturnPercentage:   ret,
		SnapshotDate:       snapshot.SnapshotDate,
		CreatedAt:          snapshot.CreatedAt,
		DataQuality:        mapDataQualityToGQL(snapshot.DataQuality),
	}
}

func mapBenchmarkComparisonToGQL(comparison *service.BenchmarkComparison) *gqlModel.BenchmarkComparison {
	if comparison == nil {
		return nil
	}

	pr, _ := comparison.PortfolioReturn.Float64()
	br, _ := comparison.BenchmarkReturn.Float64()
	alpha, _ := comparison.Alpha.Float64()
	beta, _ := comparison.Beta.Float64()
	corr, _ := comparison.CorrelationCoeff.Float64()
	te, _ := comparison.TrackingError.Float64()
	ir, _ := comparison.InformationRatio.Float64()
	raa, _ := comparison.RiskAdjustedAlpha.Float64()

	outperformance := make([]*gqlModel.TimeRange, 0, len(comparison.OutperformancePeriods))
	for _, o := range comparison.OutperformancePeriods {
		outperformance = append(outperformance, &gqlModel.TimeRange{
			Start: o.Start,
			End:   o.End,
		})
	}

	return &gqlModel.BenchmarkComparison{
		PortfolioID:           comparison.PortfolioID,
		BenchmarkAssetID:      comparison.BenchmarkAssetID,
		PortfolioReturn:       pr,
		BenchmarkReturn:       br,
		Alpha:                 alpha,
		Beta:                  beta,
		Correlation:           corr,
		TrackingError:         te,
		InformationRatio:      ir,
		OutperformancePeriods: outperformance,
		RiskAdjustedAlpha:     raa,
	}
}

// mapPositionToPositionPerformance maps a model.Position to gqlModel.PositionPerformance
// Deprecated: Use mapPositionPerformanceResultToGQL instead for cost-basis return calculations
func mapPositionToPositionPerformance(position *model.Position) *gqlModel.PositionPerformance {
	if position == nil {
		return nil
	}

	// This assumes the PerformanceRepository augmented the position model
	// or that the caller will inject the missing return/gain metrics
	return &gqlModel.PositionPerformance{
		PositionID:       position.ID,
		AssetName:        position.Asset.Name,
		AssetSymbol:      position.Asset.Symbol,
		ReturnPercentage: 0.0, // Should be calculated if not queried directly
		GainLoss:         0.0,
		Contribution:     0.0,
	}
}

// mapPositionPerformanceResultToGQL maps a repository.PositionPerformanceResult to gqlModel.PositionPerformance
// This function properly calculates ReturnPercentage, GainLoss, and Contribution from the cost-basis data
func mapPositionPerformanceResultToGQL(result *repository.PositionPerformanceResult) *gqlModel.PositionPerformance {
	if result == nil {
		return nil
	}

	returnPercentage, _ := result.ReturnPercentage.Float64()
	gainLossDollars := float64(result.GainLoss) / 100.0 // Convert cents to dollars
	contribution, _ := result.Contribution.Float64()

	return &gqlModel.PositionPerformance{
		PositionID:       result.PositionID,
		AssetName:        result.AssetName,
		AssetSymbol:      result.AssetSymbol,
		ReturnPercentage: returnPercentage,
		GainLoss:         gainLossDollars,
		Contribution:     contribution,
	}
}

func mapPerformanceReportToGQL(report *service.PerformanceReport) *gqlModel.PerformanceReport {
	if report == nil {
		return nil
	}

	tops := make([]*gqlModel.PositionPerformance, 0, len(report.TopPerformers))
	for i := range report.TopPerformers {
		tops = append(tops, mapPositionPerformanceResultToGQL(&report.TopPerformers[i]))
	}

	worst := make([]*gqlModel.PositionPerformance, 0, len(report.WorstPerformers))
	for i := range report.WorstPerformers {
		worst = append(worst, mapPositionPerformanceResultToGQL(&report.WorstPerformers[i]))
	}

	benchmarks := make([]*gqlModel.BenchmarkComparison, 0, len(report.Benchmarks))
	for _, b := range report.Benchmarks {
		benchmarks = append(benchmarks, mapBenchmarkComparisonToGQL(b))
	}

	return &gqlModel.PerformanceReport{
		ID:              fmt.Sprintf("report-%s-%d", report.PortfolioID, report.GeneratedAt.Unix()),
		PortfolioID:     report.PortfolioID,
		ReportType:      gqlModel.ReportType(report.ReportType),
		TimeRange:       &gqlModel.TimeRange{Start: report.TimeRange.Start, End: report.TimeRange.End},
		GeneratedAt:     report.GeneratedAt,
		Metrics:         mapPerformanceMetricsToGQL(report.Metrics),
		Allocation:      mapAllocationBreakdownToGQL(report.Allocation),
		RiskMetrics:     mapServiceRiskMetricsToGQL(report.RiskMetrics),
		TopPerformers:   tops,
		WorstPerformers: worst,
		Benchmarks:      benchmarks,
		Recommendations: report.Recommendations,
		DataQuality:     mapDataQualityToGQL(report.DataQuality),
	}
}

func mapDataQualityToGQL(dq service.DataQuality) *gqlModel.DataQuality {
	score, _ := dq.Score.Float64()
	return &gqlModel.DataQuality{
		Score:               score,
		MissingDataPoints:   int32(dq.MissingDataPoints),
		StaleDataPoints:     int32(dq.StaleDataPoints),
		EstimatedDataPoints: int32(dq.EstimatedDataPoints),
		LastUpdated:         dq.LastUpdated,
	}
}

func mapCalculationMethodToGQL(cm service.CalculationMethod) *gqlModel.CalculationMethod {
	params := make([]*gqlModel.MethodParameter, 0, len(cm.Parameters))
	for k, v := range cm.Parameters {
		params = append(params, &gqlModel.MethodParameter{Key: k, Value: v})
	}

	return &gqlModel.CalculationMethod{
		Method:      cm.Method,
		Parameters:  params,
		Assumptions: cm.Assumptions,
	}
}

func mapServiceRiskMetricsToGQL(rm *service.ServiceRiskMetrics) *gqlModel.RiskMetrics {
	if rm == nil {
		return nil
	}
	vol, _ := rm.Volatility.Float64()
	sharpe, _ := rm.SharpeRatio.Float64()
	md, _ := rm.MaxDrawdown.Float64()

	return &gqlModel.RiskMetrics{
		Volatility:      vol,
		SharpeRatio:     sharpe,
		MaxDrawdown:     md,
		Diversification: 0, // usually from portfolio analytics
	}
}
