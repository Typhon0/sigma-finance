import { type ApolloCache, useApolloClient, useMutation } from "@apollo/client";
import { useCallback } from "react";
import { toast } from "sonner";
import { InstrumentAssetType, ValuationMode } from "@/gql/graphql";
import {
	ADD_ASSET_TO_PORTFOLIO,
	CREATE_BANK_ACCOUNT_ASSET,
	CREATE_CRYPTO_ASSET,
	CREATE_LIFE_INSURANCE_ASSET,
	CREATE_LOAN_ASSET,
	CREATE_REAL_ESTATE_ASSET,
	CREATE_STOCK_ASSET,
	CREATE_WATCH_ASSET,
	REFRESH_REAL_ESTATE_VALUATION,
	REFRESH_SINGLE_ASSET_PRICE,
	UPDATE_REAL_ESTATE_ASSET,
} from "@/graphql/mutations/asset";
import { ADD_INSTRUMENT_TO_PORTFOLIO } from "@/graphql/mutations/instruments";
import {
	LATEST_HISTORICAL_DATA_BACKFILL_JOB,
	SEARCH_INSTRUMENTS,
} from "@/graphql/queries/instruments";
import { invalidateDashboardData, invalidatePortfolioQueries } from "@/hooks/use-asset-management";

export type AssetType = "stock" | "fund" | "etf";

export interface AddAssetInput {
	portfolioId: string;
	name: string;
	symbol: string;
	instrumentID?: string;
	type: AssetType;
	quantity: number;
	purchasePrice: number;
	currentPrice?: number;
	purchaseDate?: string;
	sector?: string;
	currency?: string;
	quoteCurrency?: string;
	unitPriceCurrency?: string;
	account?: string;
}

export interface AddBankAccountInput {
	portfolioId: string;
	assetTypeID: string;
	name: string;
	institution: string;
	accountType: string;
	accountNumber: string;
	currency: string;
	currentValue: number;
	interestRate?: number;
	purchaseDate?: string;
	purchasePrice?: number;
}

export interface AddRealEstateInput {
	portfolioId: string;
	name: string;
	assetTypeID: string;
	propertyType: string;
	address: string;
	city: string;
	state?: string;
	country: string;
	zipCode?: string;
	squareFeet?: number;
	yearBuilt?: number;
	bedrooms?: number;
	bathrooms?: number;
	currentValue?: number;
	purchasePrice?: number;
	purchaseDate?: string;

	category?: string;
	landSurface?: number;
	rooms?: number;
	floor?: number;
	totalFloors?: number;
	garages?: number;
	parkingSpaces?: number;
	energyLabel?: string;
	condition?: string;
	agencyFees?: number;
	notaryFees?: number;
	renovationFees?: number;
	furnishingCosts?: number;
	rentalType?: string;
	rentalPeriod?: string;
	monthlyRent?: number;
	utilityCosts?: number;
	yearlyMiscCosts?: number;
	hasGarden?: boolean;
	hasBalcony?: boolean;
	hasLift?: boolean;
	hasPool?: boolean;
	hasSauna?: boolean;
	isFurnished?: boolean;
	isNewConstruction?: boolean;
	kitchenQuality?: string;
	kitchenCondition?: string;
	bathroomQuality?: string;
	bathroomCondition?: string;
	flooringQuality?: string;
	flooringCondition?: string;
	windowsQuality?: string;
	windowsCondition?: string;
	generalQuality?: string;
	generalCondition?: string;

	linkedLoanId?: string;
	ownershipPercentage?: number;
	ownershipStructure?: string;

	// BAN Geocoding
	addressLabel?: string;
	cityCode?: string;
	banId?: string;
	latitude?: number;
	longitude?: number;
	hasOutdoor?: boolean;
	isGroundFloor?: boolean;

	// Financial & Valuation
	valuationMode?: ValuationMode | "AUTO" | "MANUAL";
	manualValue?: number;
}

export interface UpdateRealEstateInput {
	name?: string;
	propertyType?: string;
	category?: string;
	address?: string;
	city?: string;
	state?: string;
	country?: string;
	zipCode?: string;
	squareFeet?: number;
	landSurface?: number;
	yearBuilt?: number;
	bedrooms?: number;
	bathrooms?: number;
	rooms?: number;
	floor?: number;
	totalFloors?: number;
	garages?: number;
	parkingSpaces?: number;
	energyLabel?: string;
	condition?: string;
	currentValue?: number;
	purchasePrice?: number;
	purchaseDate?: string;

	agencyFees?: number;
	notaryFees?: number;
	renovationFees?: number;
	furnishingCosts?: number;
	rentalType?: string;
	rentalPeriod?: string;
	monthlyRent?: number;
	utilityCosts?: number;
	yearlyMiscCosts?: number;
	hasGarden?: boolean;
	hasBalcony?: boolean;
	hasLift?: boolean;
	hasPool?: boolean;
	hasSauna?: boolean;
	isFurnished?: boolean;
	isNewConstruction?: boolean;
	kitchenQuality?: string;
	kitchenCondition?: string;
	bathroomQuality?: string;
	bathroomCondition?: string;
	flooringQuality?: string;
	flooringCondition?: string;
	windowsQuality?: string;
	windowsCondition?: string;
	generalQuality?: string;
	generalCondition?: string;

	linkedLoanId?: string;
	ownershipPercentage?: number;
	ownershipStructure?: string;

	// BAN Geocoding
	addressLabel?: string;
	cityCode?: string;
	banId?: string;
	latitude?: number;
	longitude?: number;
	hasOutdoor?: boolean;
	isGroundFloor?: boolean;

	// Financial & Valuation
	valuationMode?: ValuationMode | "AUTO" | "MANUAL";
	manualValue?: number;
}

export interface AddLifeInsuranceInput {
	portfolioId: string;
	name: string;
	assetTypeID: string;
	policyNumber: string;
	insurer: string;
	policyType: string;
	coverageAmount: number;
	premiumAmount: number;
	premiumFrequency: string;
	beneficiaries: string[];
	maturityDate?: string;
	currentValue?: number;
	purchasePrice?: number;
	purchaseDate?: string;
}

export interface AddWatchInput {
	portfolioId: string;
	name: string;
	assetTypeID: string;
	brand: string;
	model: string;
	serialNumber?: string;
	referenceNumber?: string;
	condition: string;
	yearMade?: number;
	material: string;
	movement: string;
	caseSize?: number;
	waterResistance?: number;
	currentValue?: number;
	purchasePrice?: number;
	purchaseDate?: string;
}

export interface AddLoanInput {
	portfolioId: string;
	name: string;
	assetTypeID: string;
	description?: string;
	loanType: string;
	loanAmount: number;
	remainingBalance: number;
	interestRate: number;
	durationMonths: number;
	monthlyPayment: number;
	startDate: string;
	endDate?: string;
	lender: string;
	loanNumber?: string;
	currency: string;
	downPayment?: number;
	status: string;
	ownershipMode?: string;
	applicationFee?: number;
	brokerFee?: number;
	insuranceFee?: number;
	otherFees?: number;
	earlyRepaymentFee?: number;
	currentValue?: number;
	purchasePrice?: number;
	purchaseDate?: string;
	linkedAssetIDs?: string[];
	ownershipPercentage?: number;
	steps?: Array<{ id: string; date?: string; amount: number; interestRate: number }>;
	coOwners?: Array<{ id: string; type: string; userId?: string; name: string; percentage: number }>;
	companyOwners?: Array<{
		id: string;
		type: string;
		companyId?: string;
		name: string;
		registrationNumber?: string;
		legalForm?: string;
		percentage: number;
	}>;
}

export interface AddCryptoInput {
	portfolioId: string;
	name: string;
	assetTypeID: string;
	instrumentID?: string;
	quantity: number;
	purchasePrice: number;
	currentValue?: number;
	purchaseDate?: string;
	walletAddress?: string;
	blockchainNetwork?: string;
	quoteCurrency?: string;
	unitPriceCurrency?: string;
}

interface AddInstrumentToPortfolioResult {
	addInstrumentToPortfolio?: {
		asset?: {
			id?: string | null;
		} | null;
	} | null;
}

interface LatestBackfillJobQueryResult {
	latestHistoricalDataBackfillJob?: {
		id: string;
		status: string;
		step: string;
		progress: number;
		rowsWritten: number;
		errorCode?: string | null;
		errorMessage?: string | null;
	} | null;
}

interface SearchInstrumentsQueryResult {
	searchInstruments?: {
		localResults?: Array<{
			instrument?: {
				id: string;
				symbol: string;
				assetType: InstrumentAssetType;
			} | null;
		}> | null;
	} | null;
}

/**
 * Cache invalidation shared by every mutation in this hook.
 *
 * These mutations previously had no `update` handler at all, so each caller had
 * to follow up with a full `refetch()` before its own change became visible.
 * Evicting the root `portfolios` / `portfolio` fields makes every *active*
 * observer of them (GET_DASHBOARD_CRITICAL, GET_PORTFOLIO_CARDS, ...) refetch
 * on its own, so the same update arrives without a second network request.
 */
const invalidatePortfolioDerivedQueries = {
	update: (cache: ApolloCache<unknown>) => {
		invalidatePortfolioQueries(cache);
		invalidateDashboardData(cache);
	},
};

/** Same invalidation for mutations issued through the raw client. */
function invalidateDerivedQueries(cache: ApolloCache<unknown>) {
	invalidatePortfolioQueries(cache);
	invalidateDashboardData(cache);
}

export const useAssetMutations = () => {
	const apolloClient = useApolloClient();
	const [createStockAsset, { loading: creatingStock }] = useMutation(
		CREATE_STOCK_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [createCryptoAsset, { loading: creatingCrypto }] = useMutation(
		CREATE_CRYPTO_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [createRealEstateAsset, { loading: creatingRealEstate }] = useMutation(
		CREATE_REAL_ESTATE_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [updateRealEstateAsset, { loading: updatingRealEstate }] = useMutation(
		UPDATE_REAL_ESTATE_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [refreshRealEstateValuationMutation, { loading: refreshingRealEstateValuation }] =
		useMutation(REFRESH_REAL_ESTATE_VALUATION, invalidatePortfolioDerivedQueries);
	const [createLifeInsuranceAsset, { loading: creatingLifeInsurance }] = useMutation(
		CREATE_LIFE_INSURANCE_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [createWatchAsset, { loading: creatingWatch }] = useMutation(
		CREATE_WATCH_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [createBankAccountAsset, { loading: creatingBankAccount }] = useMutation(
		CREATE_BANK_ACCOUNT_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [createLoanAsset, { loading: creatingLoan }] = useMutation(
		CREATE_LOAN_ASSET,
		invalidatePortfolioDerivedQueries,
	);
	const [addAssetToPortfolio, { loading: addingToPortfolio }] = useMutation(
		ADD_ASSET_TO_PORTFOLIO,
		invalidatePortfolioDerivedQueries,
	);
	const [refreshSingleAssetPrice] = useMutation(
		REFRESH_SINGLE_ASSET_PRICE,
		invalidatePortfolioDerivedQueries,
	);

	const monitorHistoricalBackfill = useCallback(
		(portfolioId: string, assetId?: string) => {
			if (!assetId) {
				return;
			}
			const loadingToast = toast.loading("Fetching historical data and calculating performance...");
			let attempts = 0;
			const maxAttempts = 48;
			const poll = async () => {
				attempts += 1;
				try {
					const result = await apolloClient.query<LatestBackfillJobQueryResult>({
						query: LATEST_HISTORICAL_DATA_BACKFILL_JOB,
						variables: { portfolioId, assetId },
						fetchPolicy: "network-only",
					});
					const job = result.data?.latestHistoricalDataBackfillJob;
					if (!job) {
						if (attempts < maxAttempts) {
							setTimeout(poll, 2500);
							return;
						}
						toast.dismiss(loadingToast);
						return;
					}
					if (job.status === "QUEUED" || job.status === "RUNNING") {
						if (attempts < maxAttempts) {
							setTimeout(poll, 2500);
							return;
						}
						toast.dismiss(loadingToast);
						return;
					}
					toast.dismiss(loadingToast);
					if (job.status === "COMPLETE") {
						void apolloClient.reFetchObservableQueries();
						toast.success("Historical data synced. Performance updated.");
						return;
					}
					if (job.status === "SKIPPED_UNSUPPORTED") {
						toast.error("Historical data unavailable from yfinance for this asset.");
						return;
					}
					toast.error(job.errorMessage || "Historical data backfill failed.");
				} catch {
					if (attempts < maxAttempts) {
						setTimeout(poll, 2500);
						return;
					}
					toast.dismiss(loadingToast);
				}
			};
			void poll();
		},
		[apolloClient],
	);

	const refreshAssetPriceBestEffort = useCallback(
		async (assetId?: string) => {
			if (!assetId) {
				return;
			}
			try {
				await refreshSingleAssetPrice({
					variables: { assetId },
				});
			} catch (error) {
				// biome-ignore lint/suspicious/noConsole: refresh failures should not block add flow
				console.warn("refreshSingleAssetPrice failed", { assetId, error });
			}
		},
		[refreshSingleAssetPrice],
	);

	const addAsset = useCallback(
		async (input: AddAssetInput) => {
			let resolvedInstrumentID = input.instrumentID;
			if (!resolvedInstrumentID) {
				const normalizedSymbol = input.symbol.trim().toUpperCase();
				const assetTypes =
					input.type === "fund"
						? [InstrumentAssetType.Fund, InstrumentAssetType.Etf]
						: input.type === "etf"
							? [InstrumentAssetType.Etf, InstrumentAssetType.Fund]
							: [InstrumentAssetType.Stock];
				try {
					const searchResult = await apolloClient.query<SearchInstrumentsQueryResult>({
						query: SEARCH_INSTRUMENTS,
						variables: {
							input: {
								query: normalizedSymbol,
								assetTypes,
								limit: 5,
								offset: 0,
							},
						},
						fetchPolicy: "network-only",
					});
					const exactMatch =
						searchResult.data?.searchInstruments?.localResults?.find((row) => {
							const instrument = row.instrument;
							if (!instrument) return false;
							if (instrument.symbol.trim().toUpperCase() !== normalizedSymbol) return false;
							return assetTypes.includes(instrument.assetType);
						})?.instrument ?? null;
					resolvedInstrumentID = exactMatch?.id;
				} catch {
					// Keep manual fallback path.
				}
			}

			if (resolvedInstrumentID) {
				const unitPriceCurrency = (input.unitPriceCurrency || "").toUpperCase();
				const instrumentResult = await apolloClient.mutate<AddInstrumentToPortfolioResult>({
					mutation: ADD_INSTRUMENT_TO_PORTFOLIO,
					variables: {
						input: {
							portfolioID: input.portfolioId,
							instrumentID: resolvedInstrumentID,
							quantity: input.quantity,
							averagePurchasePrice: input.purchasePrice,
							unitPriceCurrency: unitPriceCurrency || undefined,
							purchaseDate: input.purchaseDate || undefined,
						},
					},
				});

				if (instrumentResult.errors && instrumentResult.errors.length > 0) {
					throw new Error(instrumentResult.errors[0].message);
				}

				// This mutation goes through the raw Apollo client rather than the
				// useMutation hook, so it cannot use the shared `update` handler.
				invalidateDerivedQueries(apolloClient.cache);

				await refreshAssetPriceBestEffort(
					instrumentResult.data?.addInstrumentToPortfolio?.asset?.id ?? undefined,
				);
				monitorHistoricalBackfill(
					input.portfolioId,
					instrumentResult.data?.addInstrumentToPortfolio?.asset?.id ?? undefined,
				);

				return {
					asset: undefined,
					portfolioAsset: instrumentResult.data?.addInstrumentToPortfolio,
				};
			}

			const assetTypeId = input.type === "stock" ? "1" : input.type === "fund" ? "7" : "1";
			const quoteCurrency = (input.quoteCurrency || input.currency || "").toUpperCase();
			if (!quoteCurrency) {
				throw new Error("quoteCurrency is required for manual stock/fund positions");
			}

			const stockInput = {
				name: input.name,
				assetTypeID: assetTypeId,
				ticker: input.symbol.toUpperCase(),
				quantity: input.quantity,
				purchasePrice: input.purchasePrice,
				purchaseDate: input.purchaseDate || new Date().toISOString(),
				currentValue: input.currentPrice ?? input.purchasePrice,
				quoteCurrency,
			};

			const stockResult = await createStockAsset({
				variables: { input: stockInput },
			});

			const assetId = stockResult.data?.createStockAsset?.id;
			if (!assetId) {
				throw new Error("Failed to create stock asset");
			}

			const portfolioInput = {
				portfolioID: input.portfolioId,
				assetID: assetId,
				quantity: input.quantity,
				averagePurchasePrice: input.purchasePrice,
			};

			const portfolioResult = await addAssetToPortfolio({
				variables: { input: portfolioInput },
			});
			await refreshAssetPriceBestEffort(portfolioResult.data?.addAssetToPortfolio?.asset?.id);
			monitorHistoricalBackfill(
				input.portfolioId,
				portfolioResult.data?.addAssetToPortfolio?.asset?.id ?? undefined,
			);

			return {
				asset: stockResult.data?.createStockAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[
			createStockAsset,
			addAssetToPortfolio,
			apolloClient,
			refreshAssetPriceBestEffort,
			monitorHistoricalBackfill,
		],
	);

	const addBankAccount = useCallback(
		async (input: AddBankAccountInput) => {
			const bankAccountInput = {
				name: input.name,
				assetTypeID: input.assetTypeID,
				institution: input.institution,
				accountType: input.accountType,
				accountNumber: input.accountNumber,
				currency: input.currency,
				currentValue: input.currentValue,
				interestRate: input.interestRate,
				purchaseDate: input.purchaseDate || new Date().toISOString(),
				purchasePrice: input.purchasePrice,
			};

			const bankResult = await createBankAccountAsset({
				variables: { input: bankAccountInput },
			});

			const assetId = bankResult.data?.createBankAccountAsset?.id;
			if (!assetId) {
				throw new Error("Failed to create bank account asset");
			}

			const portfolioInput = {
				portfolioID: input.portfolioId,
				assetID: assetId,
				quantity: 1,
				averagePurchasePrice: input.currentValue,
			};

			const portfolioResult = await addAssetToPortfolio({
				variables: { input: portfolioInput },
			});

			return {
				asset: bankResult.data?.createBankAccountAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[createBankAccountAsset, addAssetToPortfolio],
	);

	const addCrypto = useCallback(
		async (input: AddCryptoInput) => {
			if (input.instrumentID) {
				const unitPriceCurrency = (
					input.unitPriceCurrency ||
					input.quoteCurrency ||
					""
				).toUpperCase();
				const instrumentResult = await apolloClient.mutate<AddInstrumentToPortfolioResult>({
					mutation: ADD_INSTRUMENT_TO_PORTFOLIO,
					variables: {
						input: {
							portfolioID: input.portfolioId,
							instrumentID: input.instrumentID,
							quantity: input.quantity,
							averagePurchasePrice: input.purchasePrice,
							unitPriceCurrency: unitPriceCurrency || undefined,
							purchaseDate: input.purchaseDate || undefined,
						},
					},
				});

				if (instrumentResult.errors && instrumentResult.errors.length > 0) {
					throw new Error(instrumentResult.errors[0].message);
				}

				// This mutation goes through the raw Apollo client rather than the
				// useMutation hook, so it cannot use the shared `update` handler.
				invalidateDerivedQueries(apolloClient.cache);

				await refreshAssetPriceBestEffort(
					instrumentResult.data?.addInstrumentToPortfolio?.asset?.id ?? undefined,
				);
				monitorHistoricalBackfill(
					input.portfolioId,
					instrumentResult.data?.addInstrumentToPortfolio?.asset?.id ?? undefined,
				);

				return {
					asset: undefined,
					portfolioAsset: instrumentResult.data?.addInstrumentToPortfolio,
				};
			}

			const cryptoInput = {
				name: input.name,
				assetTypeID: input.assetTypeID,
				quantity: input.quantity,
				purchasePrice: input.purchasePrice,
				currentValue: input.currentValue ?? input.purchasePrice * input.quantity,
				purchaseDate: input.purchaseDate || new Date().toISOString(),
				walletAddress: input.walletAddress,
				blockchainNetwork: input.blockchainNetwork,
				quoteCurrency: (input.quoteCurrency || "").toUpperCase(),
			};
			if (!cryptoInput.quoteCurrency) {
				throw new Error("quoteCurrency is required for manual crypto positions");
			}

			const cryptoResult = await createCryptoAsset({
				variables: { input: cryptoInput },
			});

			const assetId = cryptoResult.data?.createCryptoAsset?.id;
			if (!assetId) {
				throw new Error("Failed to create crypto asset");
			}

			const portfolioInput = {
				portfolioID: input.portfolioId,
				assetID: assetId,
				quantity: input.quantity,
				averagePurchasePrice: input.purchasePrice,
			};

			const portfolioResult = await addAssetToPortfolio({
				variables: { input: portfolioInput },
			});
			await refreshAssetPriceBestEffort(portfolioResult.data?.addAssetToPortfolio?.asset?.id);
			monitorHistoricalBackfill(
				input.portfolioId,
				portfolioResult.data?.addAssetToPortfolio?.asset?.id ?? undefined,
			);

			return {
				asset: cryptoResult.data?.createCryptoAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[
			createCryptoAsset,
			addAssetToPortfolio,
			apolloClient,
			refreshAssetPriceBestEffort,
			monitorHistoricalBackfill,
		],
	);

	const addRealEstate = useCallback(
		async (input: AddRealEstateInput) => {
			const realEstateInput = {
				name: input.name,
				assetTypeID: input.assetTypeID,
				propertyType: input.propertyType,
				address: input.address,
				city: input.city,
				state: input.state,
				country: input.country,
				zipCode: input.zipCode,
				squareFeet: input.squareFeet,
				yearBuilt: input.yearBuilt,
				bedrooms: input.bedrooms,
				bathrooms: input.bathrooms,
				currentValue: input.currentValue,
				purchasePrice: input.purchasePrice,
				purchaseDate: input.purchaseDate,

				category: input.category,
				landSurface: input.landSurface,
				rooms: input.rooms,
				floor: input.floor,
				totalFloors: input.totalFloors,
				garages: input.garages,
				parkingSpaces: input.parkingSpaces,
				energyLabel: input.energyLabel,
				condition: input.condition,
				agencyFees: input.agencyFees,
				notaryFees: input.notaryFees,
				renovationFees: input.renovationFees,
				furnishingCosts: input.furnishingCosts,
				rentalType: input.rentalType,
				rentalPeriod: input.rentalPeriod,
				monthlyRent: input.monthlyRent,
				utilityCosts: input.utilityCosts,
				yearlyMiscCosts: input.yearlyMiscCosts,
				hasGarden: input.hasGarden,
				hasBalcony: input.hasBalcony,
				hasLift: input.hasLift,
				hasPool: input.hasPool,
				hasSauna: input.hasSauna,
				isFurnished: input.isFurnished,
				isNewConstruction: input.isNewConstruction,
				kitchenQuality: input.kitchenQuality,
				kitchenCondition: input.kitchenCondition,
				bathroomQuality: input.bathroomQuality,
				bathroomCondition: input.bathroomCondition,
				flooringQuality: input.flooringQuality,
				flooringCondition: input.flooringCondition,
				windowsQuality: input.windowsQuality,
				windowsCondition: input.windowsCondition,
				generalQuality: input.generalQuality,
				generalCondition: input.generalCondition,
				linkedLoanId: input.linkedLoanId,
				ownershipPercentage: input.ownershipPercentage,
				ownershipStructure: input.ownershipStructure,

				// BAN Geocoding
				addressLabel: input.addressLabel,
				cityCode: input.cityCode,
				banId: input.banId,
				latitude: input.latitude,
				longitude: input.longitude,
				hasOutdoor: input.hasOutdoor,
				isGroundFloor: input.isGroundFloor,

				// Financial & Valuation
				valuationMode: input.valuationMode,
				manualValue: input.manualValue,
			};

			const realEstateResult = await createRealEstateAsset({
				variables: { input: realEstateInput },
			});

			const assetId = realEstateResult.data?.createRealEstateAsset?.id;
			if (!assetId) {
				throw new Error("Failed to create real estate asset");
			}

			const portfolioInput = {
				portfolioID: input.portfolioId,
				assetID: assetId,
				quantity: 1,
				averagePurchasePrice: input.purchasePrice ?? input.currentValue ?? 0,
			};

			const portfolioResult = await addAssetToPortfolio({
				variables: { input: portfolioInput },
			});

			return {
				asset: realEstateResult.data?.createRealEstateAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[createRealEstateAsset, addAssetToPortfolio],
	);

	const updateRealEstate = useCallback(
		async (id: string, input: UpdateRealEstateInput) => {
			const result = await updateRealEstateAsset({
				variables: { id, input },
			});
			return result.data?.updateRealEstateAsset;
		},
		[updateRealEstateAsset],
	);

	const refreshRealEstateValuation = useCallback(
		async (id: string) => {
			const result = await refreshRealEstateValuationMutation({
				variables: { id },
			});
			return result.data?.refreshRealEstateValuation;
		},
		[refreshRealEstateValuationMutation],
	);

	const addLifeInsurance = useCallback(
		async (input: AddLifeInsuranceInput) => {
			const insuranceInput = {
				name: input.name,
				assetTypeID: input.assetTypeID,
				policyNumber: input.policyNumber,
				insurer: input.insurer,
				policyType: input.policyType,
				coverageAmount: input.coverageAmount,
				premiumAmount: input.premiumAmount,
				premiumFrequency: input.premiumFrequency,
				beneficiaries: input.beneficiaries,
				maturityDate: input.maturityDate,
				currentValue: input.currentValue,
				purchasePrice: input.purchasePrice,
				purchaseDate: input.purchaseDate,
			};

			const insuranceResult = await createLifeInsuranceAsset({
				variables: { input: insuranceInput },
			});

			const assetId = insuranceResult.data?.createLifeInsuranceAsset?.id;
			if (!assetId) {
				throw new Error("Failed to create life insurance asset");
			}

			const portfolioInput = {
				portfolioID: input.portfolioId,
				assetID: assetId,
				quantity: 1,
				averagePurchasePrice: input.purchasePrice ?? input.currentValue ?? 0,
			};

			const portfolioResult = await addAssetToPortfolio({
				variables: { input: portfolioInput },
			});

			return {
				asset: insuranceResult.data?.createLifeInsuranceAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[createLifeInsuranceAsset, addAssetToPortfolio],
	);

	const addWatch = useCallback(
		async (input: AddWatchInput) => {
			const watchInput = {
				name: input.name,
				assetTypeID: input.assetTypeID,
				brand: input.brand,
				model: input.model,
				serialNumber: input.serialNumber,
				referenceNumber: input.referenceNumber,
				condition: input.condition,
				yearMade: input.yearMade,
				material: input.material,
				movement: input.movement,
				caseSize: input.caseSize,
				waterResistance: input.waterResistance,
				currentValue: input.currentValue,
				purchasePrice: input.purchasePrice,
				purchaseDate: input.purchaseDate,
			};

			const watchResult = await createWatchAsset({
				variables: { input: watchInput },
			});

			const assetId = watchResult.data?.createWatchAsset?.id;
			if (!assetId) {
				throw new Error("Failed to create watch asset");
			}

			const portfolioInput = {
				portfolioID: input.portfolioId,
				assetID: assetId,
				quantity: 1,
				averagePurchasePrice: input.purchasePrice ?? input.currentValue ?? 0,
			};

			const portfolioResult = await addAssetToPortfolio({
				variables: { input: portfolioInput },
			});

			return {
				asset: watchResult.data?.createWatchAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[createWatchAsset, addAssetToPortfolio],
	);

	const addLoan = useCallback(
		async (input: AddLoanInput) => {
			const loanInput = {
				name: input.name,
				assetTypeID: input.assetTypeID,
				description: input.description,
				loanType: input.loanType,
				loanAmount: input.loanAmount,
				remainingBalance: input.remainingBalance,
				interestRate: input.interestRate,
				durationMonths: input.durationMonths,
				monthlyPayment: input.monthlyPayment,
				startDate: input.startDate,
				endDate: input.endDate,
				lender: input.lender,
				loanNumber: input.loanNumber,
				currency: input.currency,
				downPayment: input.downPayment,
				status: input.status,
				ownershipMode: input.ownershipMode,
				applicationFee: input.applicationFee,
				brokerFee: input.brokerFee,
				insuranceFee: input.insuranceFee,
				otherFees: input.otherFees,
				earlyRepaymentFee: input.earlyRepaymentFee,
				linkedAssetIDs: input.linkedAssetIDs,
				ownershipPercentage: input.ownershipPercentage,
				steps: input.steps,
				coOwners: input.coOwners,
				companyOwners: input.companyOwners,
				currentValue: input.currentValue,
				purchasePrice: input.purchasePrice,
				purchaseDate: input.purchaseDate,
			};

			const loanResult = await createLoanAsset({
				variables: { input: loanInput },
			});

			const assetId = loanResult.data?.createLoanAsset?.id;
			if (!assetId) {
				throw new Error("Failed to create loan asset");
			}

			const portfolioInput = {
				portfolioID: input.portfolioId,
				assetID: assetId,
				quantity: 1,
				averagePurchasePrice: input.purchasePrice ?? input.loanAmount,
			};

			const portfolioResult = await addAssetToPortfolio({
				variables: { input: portfolioInput },
			});

			return {
				asset: loanResult.data?.createLoanAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[createLoanAsset, addAssetToPortfolio],
	);

	return {
		addAsset,
		addCrypto,
		addBankAccount,
		addRealEstate,
		updateRealEstate,
		refreshRealEstateValuation,
		addLifeInsurance,
		addWatch,
		addLoan,
		refreshAssetPrice: refreshAssetPriceBestEffort,
		loading:
			creatingStock ||
			creatingCrypto ||
			creatingBankAccount ||
			creatingRealEstate ||
			updatingRealEstate ||
			refreshingRealEstateValuation ||
			creatingLifeInsurance ||
			creatingWatch ||
			creatingLoan ||
			addingToPortfolio,
	};
};
