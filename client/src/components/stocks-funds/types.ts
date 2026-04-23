export interface Asset {
	id: string;
	portfolioId: string;
	symbol: string;
	name: string;
	type: string;
	quantity: number;
	avgCost: number;
	currentPrice: number;
	totalValue: number;
	totalReturn: number;
	totalReturnPercentage: number;
	dayChangePercentage: number;
	account: string;
	sector: string;
	currency: string;
	portfolioWeight: number;
	dividendYield?: number;
	peRatio?: number;
	sparklineData: number[];
}

export interface TargetAllocation {
	sector: string;
	targetPercentage: number;
}
