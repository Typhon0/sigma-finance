import { useMutation } from "@apollo/client";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CREATE_PORTFOLIO } from "@/graphql/mutations";
import { useAssetManagement } from "@/hooks/use-asset-management";
import type {
	AddAssetInput,
	AddCryptoInput,
	AddLifeInsuranceInput,
	AddRealEstateInput,
	AddWatchInput,
} from "@/hooks/use-asset-mutations";
import { useAssetMutations } from "@/hooks/use-asset-mutations";
import { usePortfolioAnalytics } from "@/hooks/use-portfolio-analytics";
import { useAuth } from "@/lib/auth-context";

// biome-ignore lint/suspicious/noExplicitAny: unavoidable
export const PortfolioContext = createContext<any>(null);

/** Asset item as exposed by PortfolioProvider, including optional BankAccount metadata */
export interface PortfolioAssetItem {
	id: string;
	portfolioId: string;
	type: string;
	name: string;
	symbol: string;
	currentPrice: number;
	purchasePrice: number;
	quantity: number;
	currentValue: number;
	sector: string | null;
	exchange: string | null;
	dayChange: number | null;
	dayChangePercent: number | null;
	portfolioWeight: number;
	dividendYield?: number;
	peRatio?: number;
	sparklineData: number[];
	// BankAccount-specific metadata
	accountType?: string;
	institution?: string;
	accountNumber?: string;
	currency?: string;
	interestRate?: number | null;
	balance?: number | null;
}

/** Extract BankAccount-specific fields from a GraphQL asset object */
function extractBankAccountFields(
	asset: { __typename?: string } & Record<string, unknown>,
): Partial<PortfolioAssetItem> {
	const isBankAccount = asset.__typename === "BankAccount";
	if (!isBankAccount) return {};
	return {
		type: "bank",
		accountType: asset.accountType as string | undefined,
		institution: asset.institution as string | undefined,
		accountNumber: asset.accountNumber as string | undefined,
		currency: asset.currency as string | undefined,
		interestRate: asset.interestRate as number | null | undefined,
		balance: asset.balance as number | null | undefined,
	};
}

function extractOptionalMetric(
	asset: Record<string, unknown>,
	key: "dividendYield" | "peRatio",
): number | undefined {
	const value = asset[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function buildSparklineData(
	currentPrice: number,
	dayChangePercent: number | null | undefined,
): number[] {
	const safeCurrentPrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 0;
	const safeDayChange =
		typeof dayChangePercent === "number" && Number.isFinite(dayChangePercent)
			? dayChangePercent
			: 0;

	if (safeCurrentPrice === 0) {
		return [0, 0, 0, 0, 0, 0, 0];
	}

	const points = 7;
	const startPrice = safeCurrentPrice / (1 + safeDayChange / 100);
	const drift = safeCurrentPrice - startPrice;
	const volatility =
		Math.max(Math.abs(safeDayChange) / 100, 0.004) * Math.max(safeCurrentPrice, startPrice);
	const seed = (Math.round(safeCurrentPrice * 100) % 37) / 37;
	const phaseA = seed * Math.PI * 2;
	const phaseB = seed * Math.PI;

	const series = Array.from({ length: points }, (_, index) => {
		const progress = points > 1 ? index / (points - 1) : 1;
		const baseline = startPrice + drift * progress;
		const waveA = Math.sin(progress * Math.PI * 1.8 + phaseA) * volatility * 0.25;
		const waveB = Math.sin(progress * Math.PI * 3.2 + phaseB) * volatility * 0.12;
		return Math.max(0, baseline + waveA + waveB);
	});

	series[0] = startPrice;
	series[series.length - 1] = safeCurrentPrice;

	return series.map((value) => Number(value.toFixed(4)));
}

export const usePortfolio = () => {
	const context = useContext(PortfolioContext);
	if (!context) {
		throw new Error("usePortfolio must be used within a PortfolioProvider");
	}
	return context;
};

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
	const { user, isLoading: authLoading } = useAuth();
	const isAuthenticated = !!user?.id;
	const { data, loading, refetch } = usePortfolioAnalytics(user?.id ?? "");
	const {
		addAsset: addAssetMutation,
		addCrypto: addCryptoMutation,
		addRealEstate: addRealEstateMutation,
		addLifeInsurance: addLifeInsuranceMutation,
		addWatch: addWatchMutation,
		refreshAssetPrice,
		loading: addingAsset,
	} = useAssetMutations();

	// Portfolio mutations - use mutations directly instead of usePortfolioManagement to avoid duplicate queries
	const [createPortfolioMutation] = useMutation(CREATE_PORTFOLIO);

	const [currentPortfolio, setCurrentPortfolio] = useState("");

	// Only set portfolio when authenticated and data is available
	useEffect(() => {
		if (isAuthenticated && !currentPortfolio && data?.portfolios?.length) {
			setCurrentPortfolio(data.portfolios[0].id);
		} else if (!isAuthenticated && currentPortfolio) {
			setCurrentPortfolio("");
		}
	}, [isAuthenticated, data?.portfolios?.length, currentPortfolio, data?.portfolios?.[0]?.id]);

	const allPortfolios = data?.portfolios || [];

	const selectedPortfolio = useMemo(() => {
		if (!currentPortfolio || !allPortfolios.length) return null;
		return allPortfolios.find((p) => p.id === currentPortfolio) || null;
	}, [currentPortfolio, allPortfolios]);

	const allAssets = useMemo((): PortfolioAssetItem[] => {
		if (!data) return [];
		const mappedAssets = data.portfolios.flatMap((p) =>
			(p.assets ?? []).map((a) => {
				const assetType = a.asset?.assetType?.name?.toLowerCase() || "stock";
				const assetRecord = (a.asset ?? {}) as Record<string, unknown>;
				const bankFields = extractBankAccountFields(
					a.asset as { __typename?: string } & Record<string, unknown>,
				);
				const currentPrice =
					typeof a.asset?.currentValue === "number" && Number.isFinite(a.asset.currentValue)
						? a.asset.currentValue
						: 0;
				const currentValue =
					typeof a.currentValue === "number" && Number.isFinite(a.currentValue)
						? a.currentValue
						: 0;
				const purchasePrice =
					typeof a.asset?.purchasePrice === "number" && Number.isFinite(a.asset.purchasePrice)
						? a.asset.purchasePrice
						: typeof a.averagePurchasePrice === "number" && Number.isFinite(a.averagePurchasePrice)
							? a.averagePurchasePrice
							: 0;
				const dayChangePercent = a.dayChangePercent ?? null;

				return {
					id: a.asset?.id ?? "",
					portfolioId: p.id,
					name: a.asset?.name || "Unnamed Asset",
					symbol: a.asset?.symbol || "",
					currentPrice,
					purchasePrice,
					quantity: a.quantity ?? 1,
					currentValue,
					sector: a.asset?.sector ?? null,
					exchange: a.asset?.exchange ?? null,
					dayChange: a.dayChange ?? null,
					dayChangePercent,
					portfolioWeight: 0,
					dividendYield: extractOptionalMetric(assetRecord, "dividendYield"),
					peRatio: extractOptionalMetric(assetRecord, "peRatio"),
					sparklineData: buildSparklineData(currentPrice, dayChangePercent),
					...bankFields,
					// Ensure type is set correctly after spread (bankFields may override)
					type: bankFields.type || assetType,
				};
			}),
		);

		const totalValue = mappedAssets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

		return mappedAssets.map((asset) => ({
			...asset,
			portfolioWeight:
				totalValue > 0 ? Number(((asset.currentValue / totalValue) * 100).toFixed(2)) : 0,
		}));
	}, [data]);

	const assets = useMemo((): PortfolioAssetItem[] => {
		if (!selectedPortfolio) return [];
		const mappedAssets = (selectedPortfolio.assets ?? []).map((a) => {
			const assetType = a.asset?.assetType?.name?.toLowerCase() || "stock";
			const assetRecord = (a.asset ?? {}) as Record<string, unknown>;
			const bankFields = extractBankAccountFields(
				a.asset as { __typename?: string } & Record<string, unknown>,
			);
			const currentPrice =
				typeof a.asset?.currentValue === "number" && Number.isFinite(a.asset.currentValue)
					? a.asset.currentValue
					: 0;
			const currentValue =
				typeof a.currentValue === "number" && Number.isFinite(a.currentValue) ? a.currentValue : 0;
			const purchasePrice =
				typeof a.asset?.purchasePrice === "number" && Number.isFinite(a.asset.purchasePrice)
					? a.asset.purchasePrice
					: typeof a.averagePurchasePrice === "number" && Number.isFinite(a.averagePurchasePrice)
						? a.averagePurchasePrice
						: 0;
			const dayChangePercent = a.dayChangePercent ?? null;

			return {
				id: a.asset?.id ?? "",
				portfolioId: selectedPortfolio.id,
				name: a.asset?.name || "Unnamed Asset",
				symbol: a.asset?.symbol || "",
				currentPrice,
				purchasePrice,
				quantity: a.quantity ?? 1,
				currentValue,
				sector: a.asset?.sector ?? null,
				exchange: a.asset?.exchange ?? null,
				dayChange: a.dayChange ?? null,
				dayChangePercent,
				portfolioWeight: 0,
				dividendYield: extractOptionalMetric(assetRecord, "dividendYield"),
				peRatio: extractOptionalMetric(assetRecord, "peRatio"),
				sparklineData: buildSparklineData(currentPrice, dayChangePercent),
				...bankFields,
				// Ensure type is set correctly after spread (bankFields may override)
				type: bankFields.type || assetType,
			};
		});

		const totalValue = mappedAssets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

		return mappedAssets.map((asset) => ({
			...asset,
			portfolioWeight:
				totalValue > 0 ? Number(((asset.currentValue / totalValue) * 100).toFixed(2)) : 0,
		}));
	}, [selectedPortfolio]);

	const transactions = useMemo(() => {
		if (!data?.recentTransactions) return [];
		// biome-ignore lint/suspicious/noExplicitAny: unavoidable
		return data.recentTransactions.map((t: any) => ({
			id: t.id,
			assetId: t.asset?.id ?? "",
			assetSymbol: t.asset?.symbol ?? "",
			assetName: t.asset?.name ?? "",
			type: t.transactionType?.toLowerCase() ?? "buy",
			date: t.executedAt,
			total: (t.quantity ?? 0) * (t.unitPriceAmount ?? 0),
			quantity: t.quantity ?? 0,
			pricePerUnit: t.unitPriceAmount ?? 0,
			fees: t.feesAmount ?? 0,
			feesCurrency: t.feesCurrency ?? null,
			notes: t.notes,
			portfolioId: t.portfolio?.id ?? currentPortfolio,
		}));
	}, [data?.recentTransactions, currentPortfolio]);

	const getPortfolioValue = useCallback(() => {
		if (selectedPortfolio?.analytics?.totalValue) {
			return selectedPortfolio.analytics.totalValue;
		}
		return assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
	}, [selectedPortfolio, assets]);

	const getPortfolioGainLoss = useCallback(() => {
		if (
			selectedPortfolio?.analytics?.totalValue &&
			selectedPortfolio?.analytics?.totalCost !== undefined
		) {
			const analytics = selectedPortfolio.analytics;
			const gain = (analytics.totalValue ?? 0) - (analytics.totalCost ?? 0);
			const gainPercent = analytics.totalCost ? (gain / analytics.totalCost) * 100 : 0;
			return {
				gain,
				gainPercent,
				totalCurrent: analytics.totalValue ?? 0,
				totalPurchase: analytics.totalCost ?? 0,
			};
		}
		const totalCurrent = assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
		const totalPurchase = assets.reduce(
			(sum, a) => sum + (a.purchasePrice || 0) * (a.quantity || 1),
			0,
		);
		const gain = totalCurrent - totalPurchase;
		const gainPercent = totalPurchase > 0 ? (gain / totalPurchase) * 100 : 0;
		return { gain, gainPercent, totalCurrent, totalPurchase };
	}, [selectedPortfolio, assets]);

	const createPortfolio = useCallback(
		async (input: { name: string; description?: string | null }) => {
			if (!user?.id) {
				throw new Error("User must be authenticated to create a portfolio");
			}
			const result = await createPortfolioMutation({
				variables: {
					input: {
						...input,
						userID: user.id,
					},
				},
			});
			await refetch();
			return result.data?.createPortfolio;
		},
		[createPortfolioMutation, user?.id, refetch],
	);

	const addAsset = useCallback(
		async (input: Omit<AddAssetInput, "portfolioId">) => {
			if (!currentPortfolio) {
				throw new Error("No portfolio selected");
			}
			const result = await addAssetMutation({
				...input,
				portfolioId: currentPortfolio,
			});
			await refetch();
			return result;
		},
		[currentPortfolio, addAssetMutation, refetch],
	);

	const addCrypto = useCallback(
		async (input: Omit<AddCryptoInput, "portfolioId">) => {
			if (!currentPortfolio) {
				throw new Error("No portfolio selected");
			}
			const result = await addCryptoMutation({
				...input,
				portfolioId: currentPortfolio,
			});
			await refetch();
			return result;
		},
		[currentPortfolio, addCryptoMutation, refetch],
	);

	const addRealEstate = useCallback(
		async (input: Omit<AddRealEstateInput, "portfolioId">) => {
			if (!currentPortfolio) {
				throw new Error("No portfolio selected");
			}
			const result = await addRealEstateMutation({
				...input,
				portfolioId: currentPortfolio,
			});
			await refetch();
			return result;
		},
		[currentPortfolio, addRealEstateMutation, refetch],
	);

	const addLifeInsurance = useCallback(
		async (input: Omit<AddLifeInsuranceInput, "portfolioId">) => {
			if (!currentPortfolio) {
				throw new Error("No portfolio selected");
			}
			const result = await addLifeInsuranceMutation({
				...input,
				portfolioId: currentPortfolio,
			});
			await refetch();
			return result;
		},
		[currentPortfolio, addLifeInsuranceMutation, refetch],
	);

	const addWatch = useCallback(
		async (input: Omit<AddWatchInput, "portfolioId">) => {
			if (!currentPortfolio) {
				throw new Error("No portfolio selected");
			}
			const result = await addWatchMutation({
				...input,
				portfolioId: currentPortfolio,
			});
			await refetch();
			return result;
		},
		[currentPortfolio, addWatchMutation, refetch],
	);

	const { removeAssetFromPortfolio, updateAssetInPortfolio } = useAssetManagement();

	const updateAsset = useCallback(
		async (
			assetId: string,
			updates: {
				quantity?: number;
				purchasePrice?: number;
				averagePurchasePrice?: number;
				portfolioId?: string;
			},
		) => {
			const pid = updates.portfolioId || currentPortfolio;
			if (!pid) {
				throw new Error("No portfolio selected");
			}
			const hasQuantityUpdate = Number.isFinite(updates.quantity);
			const hasPriceUpdate =
				Number.isFinite(updates.averagePurchasePrice) || Number.isFinite(updates.purchasePrice);
			if (!hasQuantityUpdate && !hasPriceUpdate) {
				return;
			}

			const current = assets.find((asset) => asset.id === assetId && asset.portfolioId === pid);
			const nextQuantity = Number.isFinite(updates.quantity) ? updates.quantity : current?.quantity;
			const nextAveragePurchasePrice = Number.isFinite(updates.averagePurchasePrice)
				? updates.averagePurchasePrice
				: Number.isFinite(updates.purchasePrice)
					? updates.purchasePrice
					: current?.purchasePrice;

			if (!Number.isFinite(nextQuantity) || nextQuantity === undefined || nextQuantity <= 0) {
				throw new Error("Quantity must be greater than 0");
			}

			await updateAssetInPortfolio({
				portfolioID: pid,
				assetID: assetId,
				quantity: nextQuantity,
				averagePurchasePrice:
					typeof nextAveragePurchasePrice === "number" &&
					Number.isFinite(nextAveragePurchasePrice) &&
					nextAveragePurchasePrice >= 0
						? nextAveragePurchasePrice
						: undefined,
			});
			await refetch();
		},
		[currentPortfolio, assets, refetch, updateAssetInPortfolio],
	);
	const deleteAsset = useCallback(
		async (assetId: string, portfolioId?: string) => {
			const pid = portfolioId || currentPortfolio;
			if (!pid) {
				throw new Error("No portfolio selected");
			}
			await removeAssetFromPortfolio(pid, assetId);
			await refetch();
		},
		[currentPortfolio, removeAssetFromPortfolio, refetch],
	);
	const addTransaction = useCallback(() => {}, []);
	const addToWatchlist = useCallback(() => {}, []);
	const removeFromWatchlist = useCallback(() => {}, []);

	const value = useMemo(
		() => ({
			portfolios: allPortfolios,
			selectedPortfolio,
			loading,
			authLoading,
			currentPortfolio,
			setCurrentPortfolio,
			assets,
			allAssets,
			transactions,
			watchlist: [],
			getPortfolioValue,
			getPortfolioGainLoss,
			createPortfolio,
			addAsset,
			addCrypto,
			addRealEstate,
			addLifeInsurance,
			addWatch,
			updateAsset,
			deleteAsset,
			refreshAssetPrice,
			addTransaction,
			addToWatchlist,
			removeFromWatchlist,
			user,
			addingAsset,
			refetch,
		}),
		[
			allPortfolios,
			selectedPortfolio,
			loading,
			authLoading,
			currentPortfolio,
			assets,
			allAssets,
			transactions,
			getPortfolioValue,
			getPortfolioGainLoss,
			createPortfolio,
			addAsset,
			addCrypto,
			addRealEstate,
			addLifeInsurance,
			addWatch,
			deleteAsset,
			refreshAssetPrice,
			user,
			addingAsset,
			refetch,
			addTransaction,
			updateAsset,
			removeFromWatchlist,
			addToWatchlist,
		],
	);

	return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}
