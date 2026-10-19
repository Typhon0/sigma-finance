import { useMutation } from "@apollo/client";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
	type FxResolution,
	indexFxResolutions,
	resolveFxBasis,
} from "@/components/stocks-funds/fx-valuation";
import { CREATE_PORTFOLIO } from "@/graphql/mutations";
import {
	invalidateDashboardData,
	invalidatePortfolioQueries,
	useAssetManagement,
} from "@/hooks/use-asset-management";
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
	/**
	 * The server's `positions.id` for this holding, present only when the
	 * portfolio has exactly one position for the asset. `taxLotsByPosition`
	 * and `dispositionsByPosition` resolve this id — never the asset id — so
	 * consumers must skip the query when it is absent instead of falling back
	 * to `id`. Resolved from `PositionValuation`; see resolvePositionId.
	 */
	positionId?: string;
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
	/** Instrument reference metrics. Absent means unknown, never zero. */
	expenseRatio?: number;
	dividendYield?: number;
	peRatio?: number;
	sparklineData: number[];
	/**
	 * Whether the server can back a percentage return for this position, and
	 * why not when it cannot. Resolved from `PositionValuation`; never
	 * guessed from a currency comparison. See fx-valuation.ts.
	 */
	fx: FxResolution;
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

/**
 * Read an instrument reference metric off a GraphQL asset object.
 *
 * Returns undefined for null, which the server sends when the data provider
 * has no figure. That is not the same as zero, and it must not be defaulted
 * here: a missing expense ratio becomes an annual fee in currency that the
 * user budgets against, and a guessed 0.15% for a fund that really costs 1.8%
 * is a twelve-fold error in the user's favour.
 *
 * The fields live on the concrete GraphQL types (Stock, Fund) rather than the
 * Asset interface, so they arrive on the same object under these names.
 */
function extractOptionalMetric(
	asset: Record<string, unknown>,
	key: "dividendYield" | "peRatio" | "expenseRatio",
): number | undefined {
	const value = asset[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
	// `error` is the combined dashboard-analytics failure (critical || secondary).
	// Consumers must surface it instead of rendering the empty-portfolio state:
	// a failed request and an empty portfolio are different states, and a $0
	// hero shown for the former is a trust bug (see critique #3, P0).
	const { data, loading, error, refetch } = usePortfolioAnalytics(user?.id ?? "");
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
	// Evicting the root `portfolios` field makes every active observer of it
	// (GET_DASHBOARD_CRITICAL, GET_PORTFOLIO_CARDS, ...) refetch on its own, so
	// callers no longer have to force a full refetch() after creating one.
	const [createPortfolioMutation] = useMutation(CREATE_PORTFOLIO, {
		update: (cache) => {
			invalidatePortfolioQueries(cache);
			invalidateDashboardData(cache);
		},
	});

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

	/**
	 * Index a portfolio's FX valuations by asset id.
	 *
	 * The valuations live on `analytics`, not on the asset, so every asset
	 * lookup needs the parent portfolio's index. Memoised per portfolio so the
	 * two asset mappers below do not rebuild it on every render.
	 */
	const fxIndexByPortfolio = useMemo(() => {
		const index = new Map<string, Map<string, FxResolution>>();
		for (const portfolio of data?.portfolios ?? []) {
			index.set(portfolio.id, indexFxResolutions(portfolio.analytics?.positionValuations ?? []));
		}
		return index;
	}, [data?.portfolios]);

	const resolveAssetFx = useCallback(
		(portfolioId: string, assetId: string | undefined): FxResolution => {
			if (!assetId) return resolveFxBasis(null);
			return fxIndexByPortfolio.get(portfolioId)?.get(assetId) ?? resolveFxBasis(null);
		},
		[fxIndexByPortfolio],
	);

	/**
	 * Map (portfolio, asset) to the server position id the tax-lots endpoints
	 * need.
	 *
	 * The UI keys rows by asset id while `taxLotsByPosition` resolves
	 * `positions.id`; `PositionValuation` is the only place the API publishes
	 * that link, so it is read from there rather than guessed from the asset
	 * id. An asset can hold several positions in one portfolio (one per
	 * account); the row-level id would then be ambiguous, so none is published
	 * instead of silently showing one position's lots for the whole row.
	 */
	const positionIdByPortfolioAsset = useMemo(() => {
		const index = new Map<string, Map<string, string>>();
		for (const portfolio of data?.portfolios ?? []) {
			const idsByAsset = new Map<string, Set<string>>();
			for (const valuation of portfolio.analytics?.positionValuations ?? []) {
				if (!valuation.assetId || !valuation.positionId) continue;
				const ids = idsByAsset.get(valuation.assetId) ?? new Set<string>();
				ids.add(valuation.positionId);
				idsByAsset.set(valuation.assetId, ids);
			}
			const resolved = new Map<string, string>();
			for (const [assetId, ids] of idsByAsset) {
				const onlyId = [...ids][0];
				if (ids.size === 1 && onlyId) resolved.set(assetId, onlyId);
			}
			index.set(portfolio.id, resolved);
		}
		return index;
	}, [data?.portfolios]);

	const resolvePositionId = useCallback(
		(portfolioId: string, assetId: string | undefined): string | undefined => {
			if (!assetId) return undefined;
			return positionIdByPortfolioAsset.get(portfolioId)?.get(assetId);
		},
		[positionIdByPortfolioAsset],
	);

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
					expenseRatio: extractOptionalMetric(assetRecord, "expenseRatio"),
					// Real sparkline series do not exist yet: the previous value was a
					// sine-wave synthesis of price + day change, which rendered as a
					// fabricated trend (and powered a fake "ATH observé" on crypto).
					// Empty is the honest state until the server exposes per-holding
					// candles.
					sparklineData: [],
					fx: resolveAssetFx(p.id, a.asset?.id),
					positionId: resolvePositionId(p.id, a.asset?.id),
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
	}, [data, resolveAssetFx, resolvePositionId]);

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
				expenseRatio: extractOptionalMetric(assetRecord, "expenseRatio"),
				// Real sparkline series do not exist yet: the previous value was a
				// sine-wave synthesis of price + day change, which rendered as a
				// fabricated trend (and powered a fake "ATH observé" on crypto).
				// Empty is the honest state until the server exposes per-holding
				// candles.
				sparklineData: [],
				fx: resolveAssetFx(selectedPortfolio.id, a.asset?.id),
				positionId: resolvePositionId(selectedPortfolio.id, a.asset?.id),
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
	}, [selectedPortfolio, resolveAssetFx, resolvePositionId]);

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
			// No refetch(): CREATE_PORTFOLIO evicts the portfolio/dashboard cache
			// fields in its `update`, so the active observers refetch themselves.
			return result.data?.createPortfolio;
		},
		[createPortfolioMutation, user?.id],
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
			// No refetch(): the underlying create/portfolio-add mutations already
			// evict the portfolio/dashboard cache fields in their `update`.
			return result;
		},
		[currentPortfolio, addAssetMutation],
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
			// No refetch(): the underlying create/portfolio-add mutations already
			// evict the portfolio/dashboard cache fields in their `update`.
			return result;
		},
		[currentPortfolio, addCryptoMutation],
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
			// No refetch(): the underlying create/portfolio-add mutations already
			// evict the portfolio/dashboard cache fields in their `update`.
			return result;
		},
		[currentPortfolio, addRealEstateMutation],
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
			// No refetch(): the underlying create/portfolio-add mutations already
			// evict the portfolio/dashboard cache fields in their `update`.
			return result;
		},
		[currentPortfolio, addLifeInsuranceMutation],
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
			// No refetch(): the create mutation evicts the portfolio/dashboard/
			// watchlist cache fields, so the active observers refetch themselves.
			return result;
		},
		[currentPortfolio, addWatchMutation],
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
			// No refetch(): UPDATE_ASSET_IN_PORTFOLIO evicts the portfolio/dashboard
			// cache fields in its `update`, so the active observers refetch on their
			// own. This call used to fire a second, identical request every time.
		},
		[currentPortfolio, assets, updateAssetInPortfolio],
	);
	const deleteAsset = useCallback(
		async (assetId: string, portfolioId?: string) => {
			const pid = portfolioId || currentPortfolio;
			if (!pid) {
				throw new Error("No portfolio selected");
			}
			await removeAssetFromPortfolio(pid, assetId);
			// No refetch(): REMOVE_ASSET_FROM_PORTFOLIO evicts the portfolio/dashboard
			// cache fields in its `update`, so the active observers refetch on their
			// own. This call used to fire a second, identical request every time.
		},
		[currentPortfolio, removeAssetFromPortfolio],
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
			analyticsError: error,
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
			error,
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
