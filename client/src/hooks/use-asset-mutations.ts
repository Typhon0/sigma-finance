import { useApolloClient, useMutation } from "@apollo/client";
import { useCallback } from "react";
import {
	ADD_ASSET_TO_PORTFOLIO,
	CREATE_BANK_ACCOUNT_ASSET,
	CREATE_CRYPTO_ASSET,
	CREATE_LIFE_INSURANCE_ASSET,
	CREATE_LOAN_ASSET,
	CREATE_REAL_ESTATE_ASSET,
	CREATE_STOCK_ASSET,
	CREATE_WATCH_ASSET,
} from "@/graphql/mutations/asset";
import { ADD_INSTRUMENT_TO_PORTFOLIO } from "@/graphql/mutations/instruments";
import type {
	AddInstrumentToPortfolioMutation,
	AddInstrumentToPortfolioMutationVariables,
} from "@/gql/graphql";

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
}

export const useAssetMutations = () => {
	const apolloClient = useApolloClient();
	const [createStockAsset, { loading: creatingStock }] =
		useMutation(CREATE_STOCK_ASSET);
	const [createCryptoAsset, { loading: creatingCrypto }] =
		useMutation(CREATE_CRYPTO_ASSET);
	const [createRealEstateAsset, { loading: creatingRealEstate }] = useMutation(
		CREATE_REAL_ESTATE_ASSET,
	);
	const [createLifeInsuranceAsset, { loading: creatingLifeInsurance }] =
		useMutation(CREATE_LIFE_INSURANCE_ASSET);
	const [createWatchAsset, { loading: creatingWatch }] =
		useMutation(CREATE_WATCH_ASSET);
	const [createBankAccountAsset, { loading: creatingBankAccount }] =
		useMutation(CREATE_BANK_ACCOUNT_ASSET);
	const [createLoanAsset, { loading: creatingLoan }] =
		useMutation(CREATE_LOAN_ASSET);
	const [addAssetToPortfolio, { loading: addingToPortfolio }] = useMutation(
		ADD_ASSET_TO_PORTFOLIO,
	);

	const addAsset = useCallback(
		async (input: AddAssetInput) => {
			if (input.instrumentID) {
				const instrumentResult = await apolloClient.mutate<
					AddInstrumentToPortfolioMutation,
					AddInstrumentToPortfolioMutationVariables
				>({
					mutation: ADD_INSTRUMENT_TO_PORTFOLIO,
					variables: {
						input: {
							portfolioID: input.portfolioId,
							instrumentID: input.instrumentID,
							quantity: input.quantity,
							averagePurchasePrice: input.purchasePrice,
						},
					},
				});

				return {
					asset: undefined,
					portfolioAsset: instrumentResult.data?.addInstrumentToPortfolio,
				};
			}

			const assetTypeID =
				input.type === "stock" ? "1" : input.type === "fund" ? "7" : "1";

			const stockInput = {
				name: input.name,
				assetTypeID,
				ticker: input.symbol.toUpperCase(),
				quantity: input.quantity,
				purchasePrice: input.purchasePrice,
				purchaseDate: input.purchaseDate || new Date().toISOString(),
				currentValue: input.currentPrice ?? input.purchasePrice,
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

			return {
				asset: stockResult.data?.createStockAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[createStockAsset, addAssetToPortfolio, apolloClient],
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
				const instrumentResult = await apolloClient.mutate<
					AddInstrumentToPortfolioMutation,
					AddInstrumentToPortfolioMutationVariables
				>({
					mutation: ADD_INSTRUMENT_TO_PORTFOLIO,
					variables: {
						input: {
							portfolioID: input.portfolioId,
							instrumentID: input.instrumentID,
							quantity: input.quantity,
							averagePurchasePrice: input.purchasePrice,
						},
					},
				});

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
				currentValue:
					input.currentValue ?? input.purchasePrice * input.quantity,
				purchaseDate: input.purchaseDate || new Date().toISOString(),
				walletAddress: input.walletAddress,
				blockchainNetwork: input.blockchainNetwork,
			};

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

			return {
				asset: cryptoResult.data?.createCryptoAsset,
				portfolioAsset: portfolioResult.data?.addAssetToPortfolio,
			};
		},
		[createCryptoAsset, addAssetToPortfolio, apolloClient],
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
		addLifeInsurance,
		addWatch,
		addLoan,
		loading:
			creatingStock ||
			creatingCrypto ||
			creatingBankAccount ||
			creatingRealEstate ||
			creatingLifeInsurance ||
			creatingWatch ||
			creatingLoan ||
			addingToPortfolio,
	};
};
