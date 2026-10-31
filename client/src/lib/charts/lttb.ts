import type { PerformancePoint } from "@/components/charts/PortfolioHeroChart";

/**
 * Downsamples time-series performance data using the Largest Triangle Three Buckets (LTTB) algorithm.
 * Preserves visually prominent peaks, troughs, volatility, and exact endpoints while drastically
 * reducing render complexity and canvas paint time for multi-year datasets.
 *
 * @param data Array of PerformancePoint ordered chronologically
 * @param targetCount Maximum number of points desired (recommended: 250-400 for 1000px charts)
 */
export function downsampleLTTB(
	data: PerformancePoint[],
	targetCount: number,
): PerformancePoint[] {
	if (data.length <= targetCount || targetCount <= 2) {
		return data;
	}

	const sampled: PerformancePoint[] = [];
	const bucketSize = (data.length - 2) / (targetCount - 2);

	// Point 'a' is the previously selected point; start with index 0
	sampled.push(data[0]);
	let a = 0;

	for (let i = 0; i < targetCount - 2; i++) {
		// Range of the next bucket (bucket 'c') used to compute the average centroid
		const nextBucketStart = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
		const nextBucketEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, data.length);

		let avgX = 0;
		let avgY = 0;
		const nextBucketLen = nextBucketEnd - nextBucketStart;

		if (nextBucketLen > 0) {
			for (let j = nextBucketStart; j < nextBucketEnd; j++) {
				avgX += data[j].date.getTime();
				avgY += data[j].portfolioValue;
			}
			avgX /= nextBucketLen;
			avgY /= nextBucketLen;
		} else {
			avgX = data[data.length - 1].date.getTime();
			avgY = data[data.length - 1].portfolioValue;
		}

		// Current bucket (bucket 'b') from which to select the point with maximum triangle area
		const currBucketStart = Math.floor((i + 1) * bucketSize) + 1;
		const currBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

		const pA = data[a];
		const pATime = pA.date.getTime();
		const pAVal = pA.portfolioValue;

		let maxArea = -1;
		let maxIndex = currBucketStart;

		for (let j = currBucketStart; j < currBucketEnd; j++) {
			const pB = data[j];
			// Triangle area = 0.5 * |(x_a - x_c)(y_b - y_a) - (x_a - x_b)(y_c - y_a)|
			const area = Math.abs(
				(pATime - avgX) * (pB.portfolioValue - pAVal) -
					(pATime - pB.date.getTime()) * (avgY - pAVal),
			);

			if (area > maxArea) {
				maxArea = area;
				maxIndex = j;
			}
		}

		sampled.push(data[maxIndex]);
		a = maxIndex;
	}

	// Always preserve the exact final anchor point
	sampled.push(data[data.length - 1]);
	return sampled;
}

