import { graphql } from "@/gql";

export const BENCHMARK_COMPARISON = graphql(/* GraphQL */ `
	query BenchmarkComparison(
		$portfolioId: ID!
		$benchmarkAssetId: ID!
		$timeRange: PerformanceTimeRangeInput!
	) {
		benchmarkComparison(
			portfolioId: $portfolioId
			benchmarkAssetId: $benchmarkAssetId
			timeRange: $timeRange
		) {
			portfolioReturn
			benchmarkReturn
			alpha
			beta
			correlation
			trackingError
			informationRatio
			riskAdjustedAlpha
			outperformancePeriods {
				start
				end
			}
		}
	}
`);
