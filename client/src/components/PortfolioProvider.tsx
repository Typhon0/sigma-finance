import { useMutation } from "@apollo/client";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
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
	}, [isAuthenticated, data?.portfolios?.length, currentPortfolio, loading]);

	const allPortfolios = data?.portfolios || [];

	const selectedPortfolio = useMemo(() => {
		if (!currentPortfolio || !allPortfolios.length) return null;
		return allPortfolios.find((p) => p.id === currentPortfolio) || null;
	}, [currentPortfolio, allPortfolios]);

	const allAssets = useMemo((): PortfolioAssetItem[] => {
		if (!data) return [];
		return data.portfolios.flatMap((p) =>
			(p.assets ?? []).map((a) => {
				const assetType = a.asset?.assetType?.name?.toLowerCase() || "stock";
				const bankFields = extractBankAccountFields(
					a.asset as { __typename?: string } & Record<string, unknown>,
				);
				return {
					id: a.asset?.id ?? "",
					portfolioId: p.id,
					name: a.asset?.name || "Unnamed Asset",
					symbol: a.asset?.symbol || "",
					currentPrice: a.asset?.currentValue ?? 0,
					purchasePrice: a.asset?.purchasePrice ?? a.averagePurchasePrice ?? 0,
					quantity: a.quantity ?? 1,
					currentValue:
						a.currentValue ??
						(a.quantity ?? 1) *
							(a.asset?.purchasePrice ?? a.averagePurchasePrice ?? 0),
					sector: a.asset?.sector ?? null,
					exchange: a.asset?.exchange ?? null,
					dayChange: a.dayChange ?? null,
					dayChangePercent: a.dayChangePercent ?? null,
					...bankFields,
					// Ensure type is set correctly after spread (bankFields may override)
					type: bankFields.type || assetType,
				};
			}),
		);
	}, [data]);

	const assets = useMemo((): PortfolioAssetItem[] => {
		if (!selectedPortfolio) return [];
		return (selectedPortfolio.assets ?? []).map((a) => {
			const assetType = a.asset?.assetType?.name?.toLowerCase() || "stock";
			const bankFields = extractBankAccountFields(
				a.asset as { __typename?: string } & Record<string, unknown>,
			);
			return {
				id: a.asset?.id ?? "",
				portfolioId: selectedPortfolio.id,
				name: a.asset?.name || "Unnamed Asset",
				symbol: a.asset?.symbol || "",
				currentPrice: a.asset?.currentValue ?? 0,
				purchasePrice: a.asset?.purchasePrice ?? a.averagePurchasePrice ?? 0,
				quantity: a.quantity ?? 1,
				currentValue:
					a.currentValue ??
					(a.quantity ?? 1) *
						(a.asset?.purchasePrice ?? a.averagePurchasePrice ?? 0),
				sector: a.asset?.sector ?? null,
				exchange: a.asset?.exchange ?? null,
				dayChange: a.dayChange ?? null,
				dayChangePercent: a.dayChangePercent ?? null,
				...bankFields,
				// Ensure type is set correctly after spread (bankFields may override)
				type: bankFields.type || assetType,
			};
		});
	}, [selectedPortfolio]);

	const transactions = useMemo(() => {
		if (!data?.recentTransactions) return [];
		return data.recentTransactions.map((t: any) => ({
			id: t.id,
			assetId: t.asset?.id ?? "",
			type: t.transactionType?.toLowerCase() ?? "buy",
			date: t.transactionDate,
			total: (t.quantity ?? 0) * (t.pricePerUnit ?? 0),
			quantity: t.quantity ?? 0,
			pricePerUnit: t.pricePerUnit ?? 0,
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
			const gainPercent = analytics.totalCost
				? (gain / analytics.totalCost) * 100
				: 0;
			return {
				gain,
				gainPercent,
				totalCurrent: analytics.totalValue ?? 0,
				totalPurchase: analytics.totalCost ?? 0,
			};
		}
		const totalCurrent = assets.reduce(
			(sum, a) => sum + (a.currentValue || 0),
			0,
		);
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

	const { removeAssetFromPortfolio } = useAssetManagement();

	const updateAsset = useCallback(() => {}, []);
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
			user,
			addingAsset,
			refetch,
		],
	);

	return (
		<PortfolioContext.Provider value={value}>
			{children}
		</PortfolioContext.Provider>
	);
}
