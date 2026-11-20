/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Custom scalar for DateTime */
  DateTime: { input: any; output: any; }
  Int64: { input: any; output: any; }
  /** Custom scalar for JSON data */
  JSON: { input: any; output: any; }
  Time: { input: any; output: any; }
};

export type AdemeDpeResult = {
  __typename?: 'ADEMEDpeResult';
  diagnosticDate?: Maybe<Scalars['String']['output']>;
  rating: Scalars['String']['output'];
  sourceDataset?: Maybe<Scalars['String']['output']>;
  surfaceM2?: Maybe<Scalars['Float']['output']>;
};

export type Account = {
  __typename?: 'Account';
  accountNumber?: Maybe<Scalars['String']['output']>;
  coOwnerName?: Maybe<Scalars['String']['output']>;
  coOwnerUser?: Maybe<User>;
  coOwnerUserId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['Time']['output'];
  currency: Scalars['String']['output'];
  externalId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  institution?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  ownershipPercentage: Scalars['Float']['output'];
  portfolio: Portfolio;
  portfolioId: Scalars['ID']['output'];
  positions: Array<Position>;
  positionsCount: Scalars['Int']['output'];
  syncConnection?: Maybe<SyncConnection>;
  syncProvider: Scalars['String']['output'];
  taxWrapper: TaxWrapperType;
  totalValue?: Maybe<Scalars['Float']['output']>;
  type: AccountType;
  updatedAt: Scalars['Time']['output'];
};

export enum AccountType {
  Bank = 'BANK',
  Broker = 'BROKER',
  CryptoExchange = 'CRYPTO_EXCHANGE',
  CryptoWallet = 'CRYPTO_WALLET',
  Other = 'OTHER'
}

export type AddCustomTokenInput = {
  tokenAddress: Scalars['String']['input'];
  walletAccountId: Scalars['ID']['input'];
};

export type AddInstrumentHoldingInput = {
  averagePurchasePrice: Scalars['Float']['input'];
  instrumentID: Scalars['ID']['input'];
  portfolioID: Scalars['ID']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  quantity: Scalars['Float']['input'];
  unitPriceCurrency?: InputMaybe<Scalars['String']['input']>;
};

export type AddMultiChainWalletInput = {
  bitcoinAddressOrXpub?: InputMaybe<Scalars['String']['input']>;
  deviceType: WalletDeviceType;
  evmAddress?: InputMaybe<Scalars['String']['input']>;
  evmNetworks?: InputMaybe<Array<BlockchainNetwork>>;
  name: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
  solanaAddress?: InputMaybe<Scalars['String']['input']>;
};

export type AddMultiNetworkWalletInput = {
  address: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<WalletDeviceType>;
  label?: InputMaybe<Scalars['String']['input']>;
  networks: Array<BlockchainNetwork>;
  portfolioId: Scalars['ID']['input'];
};

export type AddWalletAccountInput = {
  addressOrXpub: Scalars['String']['input'];
  deviceId?: InputMaybe<Scalars['ID']['input']>;
  isXpub?: InputMaybe<Scalars['Boolean']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  network: BlockchainNetwork;
  portfolioId: Scalars['ID']['input'];
};

export type AdminCreateUserInput = {
  email: Scalars['String']['input'];
  emailVerified?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
  role?: InputMaybe<Scalars['String']['input']>;
};

export type AdminUpdateUserInput = {
  displayCurrency?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
  taxJurisdiction?: InputMaybe<Scalars['String']['input']>;
};

export type AdminUserFilter = {
  emailVerified?: InputMaybe<Scalars['Boolean']['input']>;
  isLocked?: InputMaybe<Scalars['Boolean']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type AdminUserStats = {
  __typename?: 'AdminUserStats';
  activeUsers: Scalars['Int']['output'];
  adminUsers: Scalars['Int']['output'];
  lockedUsers: Scalars['Int']['output'];
  totalUsers: Scalars['Int']['output'];
  unverifiedUsers: Scalars['Int']['output'];
};

export type AdminUsersResponse = {
  __typename?: 'AdminUsersResponse';
  totalCount: Scalars['Int']['output'];
  users: Array<User>;
};

export type AggregatorAuthSession = {
  __typename?: 'AggregatorAuthSession';
  link: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  sessionToken: Scalars['String']['output'];
};

export type Alert = {
  __typename?: 'Alert';
  alertType: AlertType;
  assetId?: Maybe<Scalars['ID']['output']>;
  conditionType: ConditionType;
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  lastTriggered?: Maybe<Scalars['Time']['output']>;
  notificationMethods: Array<AlertNotificationMethod>;
  portfolioId?: Maybe<Scalars['ID']['output']>;
  thresholdPercentage?: Maybe<Scalars['Float']['output']>;
  thresholdValue?: Maybe<Scalars['Float']['output']>;
  updatedAt: Scalars['Time']['output'];
  userId: Scalars['ID']['output'];
};

export type AlertError = {
  __typename?: 'AlertError';
  index: Scalars['Int']['output'];
  message: Scalars['String']['output'];
};

export type AlertFilter = {
  alertType?: InputMaybe<AlertType>;
  assetId?: InputMaybe<Scalars['ID']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
  triggeredAfter?: InputMaybe<Scalars['Time']['input']>;
};

export type AlertHistoryFilter = {
  alertType?: InputMaybe<AlertType>;
  assetId?: InputMaybe<Scalars['ID']['input']>;
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
  timeRange?: InputMaybe<PerformanceTimeRangeInput>;
};

export enum AlertNotificationMethod {
  Email = 'EMAIL',
  InApp = 'IN_APP',
  Push = 'PUSH',
  Sms = 'SMS'
}

export type AlertTriggerEvent = {
  __typename?: 'AlertTriggerEvent';
  acknowledged: Scalars['Boolean']['output'];
  acknowledgedAt?: Maybe<Scalars['Time']['output']>;
  alertId: Scalars['ID']['output'];
  currentValue: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  thresholdValue: Scalars['Float']['output'];
  triggeredAt: Scalars['Time']['output'];
};

export enum AlertType {
  Allocation = 'ALLOCATION',
  PercentageChange = 'PERCENTAGE_CHANGE',
  Performance = 'PERFORMANCE',
  PortfolioValue = 'PORTFOLIO_VALUE',
  Price = 'PRICE'
}

export type AllocationBreakdown = {
  __typename?: 'AllocationBreakdown';
  allocations: Array<AssetAllocation>;
  diversificationScore: Scalars['Float']['output'];
  portfolioId: Scalars['ID']['output'];
  rebalanceRecommendations: Array<RebalanceRecommendation>;
  riskAnalysis: AllocationRiskAnalysis;
  totalValue: Scalars['Float']['output'];
};

export type AllocationRiskAnalysis = {
  __typename?: 'AllocationRiskAnalysis';
  concentrationRisk: Scalars['Float']['output'];
  correlationRisk: Scalars['Float']['output'];
  liquidityRisk: Scalars['Float']['output'];
  riskByAssetType: Array<AssetTypeRisk>;
};

export type Asset = {
  assetType: AssetType;
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
};

export type AssetAllocation = {
  __typename?: 'AssetAllocation';
  assetType: Scalars['String']['output'];
  count: Scalars['Int']['output'];
  percentage: Scalars['Float']['output'];
  value: Scalars['Float']['output'];
};

export type AssetFilter = {
  assetTypeID?: InputMaybe<Scalars['ID']['input']>;
  hasTagIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  nameContains?: InputMaybe<Scalars['String']['input']>;
  userID?: InputMaybe<Scalars['ID']['input']>;
};

export type AssetOrder = {
  direction?: SortDirection;
  field?: AssetOrderField;
};

export enum AssetOrderField {
  CurrentValue = 'CURRENT_VALUE',
  Name = 'NAME',
  PurchaseDate = 'PURCHASE_DATE'
}

export type AssetPricePoint = {
  __typename?: 'AssetPricePoint';
  assetId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  marketCap?: Maybe<Scalars['Float']['output']>;
  price: Scalars['Float']['output'];
  source: Scalars['String']['output'];
  timestamp: Scalars['Time']['output'];
  volume?: Maybe<Scalars['Float']['output']>;
};

export type AssetPriceStatistics = {
  __typename?: 'AssetPriceStatistics';
  assetId: Scalars['ID']['output'];
  averageVolume?: Maybe<Scalars['Float']['output']>;
  change: Scalars['Float']['output'];
  changePercent: Scalars['Float']['output'];
  currentPrice: Scalars['Float']['output'];
  dayHigh: Scalars['Float']['output'];
  dayLow: Scalars['Float']['output'];
  isStale: Scalars['Boolean']['output'];
  lastUpdated: Scalars['Time']['output'];
  monthHigh: Scalars['Float']['output'];
  monthLow: Scalars['Float']['output'];
  previousPrice: Scalars['Float']['output'];
  weekHigh: Scalars['Float']['output'];
  weekLow: Scalars['Float']['output'];
  yearHigh: Scalars['Float']['output'];
  yearLow: Scalars['Float']['output'];
};

export enum AssetSyncType {
  Cryptocurrencies = 'CRYPTOCURRENCIES',
  Currencies = 'CURRENCIES',
  Equities = 'EQUITIES',
  Etfs = 'ETFS',
  Funds = 'FUNDS',
  Indices = 'INDICES',
  MoneyMarkets = 'MONEY_MARKETS'
}

export type AssetType = {
  __typename?: 'AssetType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type AssetTypeRisk = {
  __typename?: 'AssetTypeRisk';
  assetType: Scalars['String']['output'];
  riskLevel: Scalars['Float']['output'];
};

export type AuthData = {
  __typename?: 'AuthData';
  expiresAt: Scalars['Time']['output'];
  refreshToken: Scalars['String']['output'];
  token: Scalars['String']['output'];
  user: AuthUser;
};

export type AuthError = {
  __typename?: 'AuthError';
  code: Scalars['String']['output'];
  field?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
};

export type AuthResponse = {
  __typename?: 'AuthResponse';
  data?: Maybe<AuthData>;
  errors?: Maybe<Array<AuthError>>;
  success: Scalars['Boolean']['output'];
};

export type AuthUser = {
  __typename?: 'AuthUser';
  displayCurrency: Scalars['String']['output'];
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  role: Scalars['String']['output'];
  themeAccentColor: Scalars['String']['output'];
  themeBaseColor: Scalars['String']['output'];
  themeFontPreference: Scalars['String']['output'];
  themeHeadingFont: Scalars['String']['output'];
  themeMenuAccent: Scalars['String']['output'];
  themeMenuColor: Scalars['String']['output'];
  themePreference: Scalars['String']['output'];
  themeRTL: Scalars['Boolean']['output'];
  themeRadius: Scalars['Float']['output'];
  themeStyle: Scalars['String']['output'];
};

export type AvailableProvider = {
  __typename?: 'AvailableProvider';
  capability: Scalars['Boolean']['output'];
  credentialEnabled: Scalars['Boolean']['output'];
  credentialValid: Scalars['Boolean']['output'];
  effectiveEnabled: Scalars['Boolean']['output'];
  hasCredential: Scalars['Boolean']['output'];
  mappingStatus: Scalars['String']['output'];
  priority: Scalars['Int']['output'];
  provider: Scalars['String']['output'];
  requiresApiKey: Scalars['Boolean']['output'];
};

export type BankAccount = Asset & {
  __typename?: 'BankAccount';
  accountNumber: Scalars['String']['output'];
  accountType: Scalars['String']['output'];
  assetType: AssetType;
  balance?: Maybe<Scalars['Float']['output']>;
  currency: Scalars['String']['output'];
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  institution: Scalars['String']['output'];
  interestRate?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
};

export type BatchAlertInput = {
  alerts: Array<CreateAlertInput>;
};

export type BatchAlertResult = {
  __typename?: 'BatchAlertResult';
  failedAlerts: Array<AlertError>;
  failureCount: Scalars['Int']['output'];
  successCount: Scalars['Int']['output'];
  successfulAlerts: Array<Alert>;
  totalProcessed: Scalars['Int']['output'];
};

export type BatchDeactivateInput = {
  alertIds: Array<Scalars['ID']['input']>;
};

export type BatchDeactivateResult = {
  __typename?: 'BatchDeactivateResult';
  failedDeactivations: Array<DeactivationError>;
  failureCount: Scalars['Int']['output'];
  successCount: Scalars['Int']['output'];
  successfulIds: Array<Scalars['String']['output']>;
  totalProcessed: Scalars['Int']['output'];
};

export type BenchmarkComparison = {
  __typename?: 'BenchmarkComparison';
  alpha: Scalars['Float']['output'];
  benchmarkAssetId: Scalars['ID']['output'];
  benchmarkReturn: Scalars['Float']['output'];
  beta: Scalars['Float']['output'];
  correlation: Scalars['Float']['output'];
  informationRatio: Scalars['Float']['output'];
  outperformancePeriods: Array<TimeRange>;
  portfolioId: Scalars['ID']['output'];
  portfolioReturn: Scalars['Float']['output'];
  riskAdjustedAlpha: Scalars['Float']['output'];
  trackingError: Scalars['Float']['output'];
};

export type BenchmarkResult = {
  __typename?: 'BenchmarkResult';
  name: Scalars['String']['output'];
  value: Scalars['Float']['output'];
};

export enum BlockchainNetwork {
  Arbitrum = 'ARBITRUM',
  Base = 'BASE',
  Bitcoin = 'BITCOIN',
  Ethereum = 'ETHEREUM',
  Optimism = 'OPTIMISM',
  Polygon = 'POLYGON',
  Solana = 'SOLANA'
}

export type BlockchainNetworkConfig = {
  __typename?: 'BlockchainNetworkConfig';
  explorerApiUrl?: Maybe<Scalars['String']['output']>;
  network: BlockchainNetwork;
  rpcUrl: Scalars['String']['output'];
  source: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
};

export type CalculationMethod = {
  __typename?: 'CalculationMethod';
  assumptions: Array<Scalars['String']['output']>;
  method: Scalars['String']['output'];
  parameters: Array<MethodParameter>;
};

export type Candle = {
  __typename?: 'Candle';
  assetType: Scalars['String']['output'];
  close: Scalars['Float']['output'];
  high: Scalars['Float']['output'];
  interval: Scalars['String']['output'];
  low: Scalars['Float']['output'];
  open: Scalars['Float']['output'];
  source: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  timestamp: Scalars['Time']['output'];
  volume?: Maybe<Scalars['Float']['output']>;
};

export enum CatalogSource {
  Trustwallet = 'TRUSTWALLET'
}

export type CatalogSyncRun = {
  __typename?: 'CatalogSyncRun';
  cursor?: Maybe<Scalars['String']['output']>;
  errorText?: Maybe<Scalars['String']['output']>;
  finishedAt?: Maybe<Scalars['Time']['output']>;
  id: Scalars['ID']['output'];
  mode: Scalars['String']['output'];
  source: CatalogSource;
  startedAt: Scalars['Time']['output'];
  statsJson?: Maybe<Scalars['JSON']['output']>;
  status: Scalars['String']['output'];
};

export type ChartDataInput = {
  aggregation: TimeAggregation;
  assetId?: InputMaybe<Scalars['ID']['input']>;
  includeVolume?: InputMaybe<Scalars['Boolean']['input']>;
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
  timeRange: PerformanceTimeRangeInput;
};

export type ChartDataPoint = {
  __typename?: 'ChartDataPoint';
  metadata?: Maybe<ChartMetadata>;
  timestamp: Scalars['Time']['output'];
  value: Scalars['Float']['output'];
  volume?: Maybe<Scalars['Float']['output']>;
};

export type ChartMetadata = {
  __typename?: 'ChartMetadata';
  additionalData?: Maybe<Array<KeyValuePair>>;
  color?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
};

export type CoOwnerCandidate = {
  __typename?: 'CoOwnerCandidate';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export enum ConditionType {
  Above = 'ABOVE',
  Below = 'BELOW',
  DecreaseBy = 'DECREASE_BY',
  Equals = 'EQUALS',
  IncreaseBy = 'INCREASE_BY'
}

export enum CoverageStatus {
  Full = 'FULL',
  Partial = 'PARTIAL'
}

export type CreateAccountInput = {
  accountNumber?: InputMaybe<Scalars['String']['input']>;
  coOwnerName?: InputMaybe<Scalars['String']['input']>;
  coOwnerUserId?: InputMaybe<Scalars['ID']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  institution?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  ownershipPercentage?: InputMaybe<Scalars['Float']['input']>;
  portfolioId: Scalars['ID']['input'];
  syncProvider?: InputMaybe<Scalars['String']['input']>;
  taxWrapper: TaxWrapperType;
  type: AccountType;
};

export type CreateAlertInput = {
  alertType: AlertType;
  assetId?: InputMaybe<Scalars['ID']['input']>;
  conditionType: ConditionType;
  notificationMethods: Array<AlertNotificationMethod>;
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
  thresholdPercentage?: InputMaybe<Scalars['Float']['input']>;
  thresholdValue?: InputMaybe<Scalars['Float']['input']>;
};

export type CreateBankAccountInput = {
  accountNumber: Scalars['String']['input'];
  accountType: Scalars['String']['input'];
  assetTypeID: Scalars['ID']['input'];
  currency: Scalars['String']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  institution: Scalars['String']['input'];
  interestRate?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
};

export type CreateCryptoInput = {
  assetTypeID: Scalars['ID']['input'];
  blockchainNetwork?: InputMaybe<Scalars['String']['input']>;
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  quantity: Scalars['Float']['input'];
  quoteCurrency: Scalars['String']['input'];
  walletAddress?: InputMaybe<Scalars['String']['input']>;
};

export type CreateFundInput = {
  assetTypeID: Scalars['ID']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  quantity: Scalars['Float']['input'];
  ticker: Scalars['String']['input'];
};

export type CreateLifeInsuranceInput = {
  assetTypeID: Scalars['ID']['input'];
  beneficiaries: Array<Scalars['String']['input']>;
  coverageAmount: Scalars['Float']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  insurer: Scalars['String']['input'];
  maturityDate?: InputMaybe<Scalars['Time']['input']>;
  name: Scalars['String']['input'];
  policyNumber: Scalars['String']['input'];
  policyType: Scalars['String']['input'];
  premiumAmount: Scalars['Float']['input'];
  premiumFrequency: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
};

export type CreateLoanInput = {
  applicationFee?: InputMaybe<Scalars['Float']['input']>;
  assetTypeID: Scalars['ID']['input'];
  brokerFee?: InputMaybe<Scalars['Float']['input']>;
  coOwners?: InputMaybe<Array<LoanCoOwnerInput>>;
  companyOwners?: InputMaybe<Array<LoanCompanyOwnerInput>>;
  currency: Scalars['String']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  downPayment?: InputMaybe<Scalars['Float']['input']>;
  durationMonths: Scalars['Int']['input'];
  earlyRepaymentFee?: InputMaybe<Scalars['Float']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
  insuranceFee?: InputMaybe<Scalars['Float']['input']>;
  interestRate: Scalars['Float']['input'];
  lender: Scalars['String']['input'];
  linkedAssetIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  loanAmount: Scalars['Float']['input'];
  loanNumber?: InputMaybe<Scalars['String']['input']>;
  loanType: Scalars['String']['input'];
  monthlyPayment: Scalars['Float']['input'];
  name: Scalars['String']['input'];
  otherFees?: InputMaybe<Scalars['Float']['input']>;
  ownershipMode?: InputMaybe<Scalars['String']['input']>;
  ownershipPercentage?: InputMaybe<Scalars['Float']['input']>;
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  remainingBalance: Scalars['Float']['input'];
  startDate: Scalars['String']['input'];
  status: Scalars['String']['input'];
  steps?: InputMaybe<Array<LoanStepInput>>;
};

export type CreatePortfolioInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  taxWrapper?: InputMaybe<TaxWrapperType>;
  userID: Scalars['ID']['input'];
};

export type CreateRealEstateInput = {
  address: Scalars['String']['input'];
  addressLabel?: InputMaybe<Scalars['String']['input']>;
  agencyFees?: InputMaybe<Scalars['Float']['input']>;
  assetTypeID: Scalars['ID']['input'];
  banId?: InputMaybe<Scalars['String']['input']>;
  bathroomCondition?: InputMaybe<Scalars['String']['input']>;
  bathroomQuality?: InputMaybe<Scalars['String']['input']>;
  bathrooms?: InputMaybe<Scalars['Float']['input']>;
  bedrooms?: InputMaybe<Scalars['Int']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  city: Scalars['String']['input'];
  cityCode?: InputMaybe<Scalars['String']['input']>;
  condition?: InputMaybe<Scalars['String']['input']>;
  country: Scalars['String']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  energyLabel?: InputMaybe<Scalars['String']['input']>;
  floor?: InputMaybe<Scalars['Int']['input']>;
  flooringCondition?: InputMaybe<Scalars['String']['input']>;
  flooringQuality?: InputMaybe<Scalars['String']['input']>;
  furnishingCosts?: InputMaybe<Scalars['Float']['input']>;
  garages?: InputMaybe<Scalars['Int']['input']>;
  generalCondition?: InputMaybe<Scalars['String']['input']>;
  generalQuality?: InputMaybe<Scalars['String']['input']>;
  hasBalcony?: InputMaybe<Scalars['Boolean']['input']>;
  hasGarden?: InputMaybe<Scalars['Boolean']['input']>;
  hasLift?: InputMaybe<Scalars['Boolean']['input']>;
  hasOutdoor?: InputMaybe<Scalars['Boolean']['input']>;
  hasPool?: InputMaybe<Scalars['Boolean']['input']>;
  hasSauna?: InputMaybe<Scalars['Boolean']['input']>;
  isFurnished?: InputMaybe<Scalars['Boolean']['input']>;
  isGroundFloor?: InputMaybe<Scalars['Boolean']['input']>;
  isNewConstruction?: InputMaybe<Scalars['Boolean']['input']>;
  kitchenCondition?: InputMaybe<Scalars['String']['input']>;
  kitchenQuality?: InputMaybe<Scalars['String']['input']>;
  landSurface?: InputMaybe<Scalars['Float']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  linkedLoanId?: InputMaybe<Scalars['ID']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  manualValue?: InputMaybe<Scalars['Float']['input']>;
  monthlyRent?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  notaryFees?: InputMaybe<Scalars['Float']['input']>;
  ownershipPercentage?: InputMaybe<Scalars['Float']['input']>;
  ownershipStructure?: InputMaybe<Scalars['String']['input']>;
  parkingSpaces?: InputMaybe<Scalars['Int']['input']>;
  propertyType: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  renovationFees?: InputMaybe<Scalars['Float']['input']>;
  rentalPeriod?: InputMaybe<Scalars['String']['input']>;
  rentalType?: InputMaybe<Scalars['String']['input']>;
  rooms?: InputMaybe<Scalars['Int']['input']>;
  squareFeet?: InputMaybe<Scalars['Int']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  totalFloors?: InputMaybe<Scalars['Int']['input']>;
  utilityCosts?: InputMaybe<Scalars['Float']['input']>;
  valuationMode?: InputMaybe<ValuationMode>;
  windowsCondition?: InputMaybe<Scalars['String']['input']>;
  windowsQuality?: InputMaybe<Scalars['String']['input']>;
  yearBuilt?: InputMaybe<Scalars['Int']['input']>;
  yearlyMiscCosts?: InputMaybe<Scalars['Float']['input']>;
  zipCode?: InputMaybe<Scalars['String']['input']>;
};

export type CreateStockInput = {
  assetTypeID: Scalars['ID']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  quantity: Scalars['Float']['input'];
  quoteCurrency: Scalars['String']['input'];
  ticker: Scalars['String']['input'];
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type CreateWalletDeviceInput = {
  deviceType: WalletDeviceType;
  name: Scalars['String']['input'];
};

export type CreateWatchInput = {
  assetTypeID: Scalars['ID']['input'];
  brand: Scalars['String']['input'];
  caseSize?: InputMaybe<Scalars['Float']['input']>;
  condition: Scalars['String']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  material: Scalars['String']['input'];
  model: Scalars['String']['input'];
  movement: Scalars['String']['input'];
  name: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  referenceNumber?: InputMaybe<Scalars['String']['input']>;
  serialNumber?: InputMaybe<Scalars['String']['input']>;
  waterResistance?: InputMaybe<Scalars['Int']['input']>;
  yearMade?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateWatchlistInput = {
  name: Scalars['String']['input'];
  userID: Scalars['ID']['input'];
};

export type Crypto = Asset & {
  __typename?: 'Crypto';
  assetType: AssetType;
  blockchainNetwork?: Maybe<Scalars['String']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  quantity: Scalars['Float']['output'];
  sector?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  walletAddress?: Maybe<Scalars['String']['output']>;
};

export type DataQuality = {
  __typename?: 'DataQuality';
  estimatedDataPoints: Scalars['Int']['output'];
  lastUpdated: Scalars['Time']['output'];
  missingDataPoints: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
  staleDataPoints: Scalars['Int']['output'];
};

export type DeactivationError = {
  __typename?: 'DeactivationError';
  alertId: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

export type DuplicatePortfolioInput = {
  copyAssets?: Scalars['Boolean']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  newName: Scalars['String']['input'];
  sourcePortfolioID: Scalars['ID']['input'];
};

export type EmailVerificationInput = {
  token: Scalars['String']['input'];
};

export type EmailVerificationResponse = {
  __typename?: 'EmailVerificationResponse';
  errors?: Maybe<Array<AuthError>>;
  success: Scalars['Boolean']['output'];
};

export type EnableBankingAuthSession = {
  __typename?: 'EnableBankingAuthSession';
  authSessionId: Scalars['ID']['output'];
  authUrl: Scalars['String']['output'];
  expiresAt: Scalars['Time']['output'];
  state: Scalars['String']['output'];
};

export type EnableBankingInstitution = {
  __typename?: 'EnableBankingInstitution';
  country: Scalars['String']['output'];
  logo?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  psuTypes?: Maybe<Array<Scalars['String']['output']>>;
  title: Scalars['String']['output'];
};

export enum EstimationMethod {
  AcquisitionCost = 'ACQUISITION_COST',
  DvfComparables = 'DVF_COMPARABLES',
  InseeIndex = 'INSEE_INDEX'
}

export type ExportData = {
  __typename?: 'ExportData';
  data: Scalars['String']['output'];
  downloadUrl: Scalars['String']['output'];
  expiresAt: Scalars['Time']['output'];
  format: ExportFormat;
  generatedAt: Scalars['Time']['output'];
  portfolioId: Scalars['ID']['output'];
};

export type ExportDataInput = {
  format: ExportFormat;
  includeAllocations?: InputMaybe<Scalars['Boolean']['input']>;
  includePerformance?: InputMaybe<Scalars['Boolean']['input']>;
  includeTransactions?: InputMaybe<Scalars['Boolean']['input']>;
  portfolioId: Scalars['ID']['input'];
  timeRange?: InputMaybe<PerformanceTimeRangeInput>;
};

export enum ExportFormat {
  Csv = 'CSV',
  Excel = 'EXCEL',
  Pdf = 'PDF'
}

export type ExportPortfolioInput = {
  format: ExportFormat;
  includeAnalytics?: Scalars['Boolean']['input'];
  includeTransactions?: Scalars['Boolean']['input'];
  portfolioID: Scalars['ID']['input'];
};

export type ExportResult = {
  __typename?: 'ExportResult';
  downloadUrl?: Maybe<Scalars['String']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type FinanceDatabasePreviewItem = {
  __typename?: 'FinanceDatabasePreviewItem';
  country?: Maybe<Scalars['String']['output']>;
  exchange: Scalars['String']['output'];
  name: Scalars['String']['output'];
  sector?: Maybe<Scalars['String']['output']>;
  symbol: Scalars['String']['output'];
};

export type FinanceDatabaseSyncHistoryEntry = {
  __typename?: 'FinanceDatabaseSyncHistoryEntry';
  assetType: AssetSyncType;
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  recordCount: Scalars['Int']['output'];
  status: SyncStatus;
  timestamp: Scalars['Time']['output'];
};

export type FinanceDatabaseSyncItem = {
  __typename?: 'FinanceDatabaseSyncItem';
  assetType: AssetSyncType;
  currentRecord?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  isEnabled: Scalars['Boolean']['output'];
  lastSynced?: Maybe<Scalars['Time']['output']>;
  progress?: Maybe<Scalars['Int']['output']>;
  recordCount: Scalars['Int']['output'];
  syncStatus: SyncStatus;
};

export type FinanceDatabaseSyncStatusPayload = {
  __typename?: 'FinanceDatabaseSyncStatusPayload';
  assetTypes: Array<FinanceDatabaseSyncItem>;
};

export type Fund = Asset & {
  __typename?: 'Fund';
  assetType: AssetType;
  buyingPrice?: Maybe<Scalars['Float']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  dividendYield?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  expenseRatio?: Maybe<Scalars['Float']['output']>;
  fundType?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  quantity: Scalars['Float']['output'];
  sector?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  ticker: Scalars['String']['output'];
};

export type GenerateReportInput = {
  benchmarkAssetIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  includeComparisons?: InputMaybe<Scalars['Boolean']['input']>;
  portfolioId: Scalars['ID']['input'];
  reportType: ReportType;
  timeRange: PerformanceTimeRangeInput;
};

export type HistoricalDataBackfillJob = {
  __typename?: 'HistoricalDataBackfillJob';
  assetId: Scalars['ID']['output'];
  createdAt: Scalars['Time']['output'];
  errorCode?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  finishedAt?: Maybe<Scalars['Time']['output']>;
  id: Scalars['ID']['output'];
  instrumentId: Scalars['ID']['output'];
  portfolioId: Scalars['ID']['output'];
  progress: Scalars['Int']['output'];
  provider: Scalars['String']['output'];
  requestedFrom: Scalars['Time']['output'];
  requestedTo: Scalars['Time']['output'];
  rowsWritten: Scalars['Int']['output'];
  startedAt?: Maybe<Scalars['Time']['output']>;
  status: Scalars['String']['output'];
  step: Scalars['String']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type HistoricalDataBackfillJobFilterInput = {
  provider?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};

export type ImportFinanceDatabaseAssetsPayload = {
  __typename?: 'ImportFinanceDatabaseAssetsPayload';
  errors: Array<Scalars['String']['output']>;
  importedCount: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type ImportInstrumentFromSourceInput = {
  externalId: Scalars['String']['input'];
  forceEnrich?: InputMaybe<Scalars['Boolean']['input']>;
  source: CatalogSource;
};

export type ImportInstrumentFromSourcePayload = {
  __typename?: 'ImportInstrumentFromSourcePayload';
  instrument?: Maybe<Instrument>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type Instrument = {
  __typename?: 'Instrument';
  aliases: Array<InstrumentAlias>;
  assetType: InstrumentAssetType;
  baseCurrency?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  categoryGroup?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['Time']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  cusip?: Maybe<Scalars['String']['output']>;
  dividendYield?: Maybe<Scalars['Float']['output']>;
  exchange: Scalars['String']['output'];
  exchangeCode?: Maybe<Scalars['String']['output']>;
  expenseRatio?: Maybe<Scalars['Float']['output']>;
  externalId?: Maybe<Scalars['String']['output']>;
  externalSource?: Maybe<Scalars['String']['output']>;
  family?: Maybe<Scalars['String']['output']>;
  figi?: Maybe<Scalars['String']['output']>;
  firstSeenAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  industry?: Maybe<Scalars['String']['output']>;
  industryGroup?: Maybe<Scalars['String']['output']>;
  instrumentStatus?: Maybe<Scalars['String']['output']>;
  isin?: Maybe<Scalars['String']['output']>;
  lastUsedAt?: Maybe<Scalars['Time']['output']>;
  lastVerifiedAt?: Maybe<Scalars['Time']['output']>;
  marketCap?: Maybe<Scalars['String']['output']>;
  metadataUpdatedAt?: Maybe<Scalars['Time']['output']>;
  name: Scalars['String']['output'];
  normalizedName: Scalars['String']['output'];
  normalizedSymbol: Scalars['String']['output'];
  platforms?: Maybe<Array<PlatformAddress>>;
  primaryContractAddress?: Maybe<Scalars['String']['output']>;
  providerExternalId?: Maybe<Scalars['String']['output']>;
  providerSource: Scalars['String']['output'];
  quoteCurrency?: Maybe<Scalars['String']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  summary?: Maybe<Scalars['String']['output']>;
  symbol: Scalars['String']['output'];
  syncState?: Maybe<InstrumentSyncState>;
  underlyingSymbol?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Time']['output'];
  website?: Maybe<Scalars['String']['output']>;
  zipcode?: Maybe<Scalars['String']['output']>;
};

export type InstrumentAlias = {
  __typename?: 'InstrumentAlias';
  aliasText: Scalars['String']['output'];
  aliasType: Scalars['String']['output'];
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  instrumentID: Scalars['ID']['output'];
  normalizedAliasText: Scalars['String']['output'];
};

export enum InstrumentAssetType {
  Crypto = 'CRYPTO',
  Currency = 'CURRENCY',
  Etf = 'ETF',
  Fund = 'FUND',
  Index = 'INDEX',
  MoneyMarket = 'MONEY_MARKET',
  Stock = 'STOCK'
}

export type InstrumentQueryMetadata = {
  __typename?: 'InstrumentQueryMetadata';
  limit: Scalars['Int']['output'];
  localCount: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  query: Scalars['String']['output'];
  searchOnlineHint: Scalars['Boolean']['output'];
  topScore: Scalars['Float']['output'];
  weakResults: Scalars['Boolean']['output'];
};

export type InstrumentSearchInput = {
  assetTypes?: InputMaybe<Array<InstrumentAssetType>>;
  exchange?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};

export type InstrumentSearchPayload = {
  __typename?: 'InstrumentSearchPayload';
  canSearchOnline: Scalars['Boolean']['output'];
  localResults: Array<InstrumentSearchResult>;
  onlineResults?: Maybe<Array<OnlineInstrumentResult>>;
  queryMetadata: InstrumentQueryMetadata;
};

export type InstrumentSearchResult = {
  __typename?: 'InstrumentSearchResult';
  instrument: Instrument;
  matchedAlias?: Maybe<Scalars['String']['output']>;
  score: Scalars['Float']['output'];
};

export type InstrumentSyncState = {
  __typename?: 'InstrumentSyncState';
  createdAt: Scalars['Time']['output'];
  instrumentID: Scalars['ID']['output'];
  lastSyncAttempt?: Maybe<Scalars['Time']['output']>;
  lastSyncSource?: Maybe<Scalars['String']['output']>;
  lastSyncSuccess?: Maybe<Scalars['Time']['output']>;
  stale: Scalars['Boolean']['output'];
  syncErrorMessage?: Maybe<Scalars['String']['output']>;
  syncStatus: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
  verificationConfidence: Scalars['Int']['output'];
};

export type KeyValuePair = {
  __typename?: 'KeyValuePair';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type LifeInsurance = Asset & {
  __typename?: 'LifeInsurance';
  assetType: AssetType;
  beneficiaries: Array<Scalars['String']['output']>;
  coverageAmount: Scalars['Float']['output'];
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  insurer: Scalars['String']['output'];
  maturityDate?: Maybe<Scalars['Time']['output']>;
  name: Scalars['String']['output'];
  policyNumber: Scalars['String']['output'];
  policyType: Scalars['String']['output'];
  positions: Array<Position>;
  premiumAmount: Scalars['Float']['output'];
  premiumFrequency: Scalars['String']['output'];
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
};

export type Loan = Asset & {
  __typename?: 'Loan';
  applicationFee?: Maybe<Scalars['Float']['output']>;
  assetType: AssetType;
  brokerFee?: Maybe<Scalars['Float']['output']>;
  coOwners?: Maybe<Array<LoanCoOwner>>;
  companyOwners?: Maybe<Array<LoanCompanyOwner>>;
  currency: Scalars['String']['output'];
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  downPayment?: Maybe<Scalars['Float']['output']>;
  durationMonths: Scalars['Int']['output'];
  earlyRepaymentFee?: Maybe<Scalars['Float']['output']>;
  endDate?: Maybe<Scalars['String']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  insuranceFee?: Maybe<Scalars['Float']['output']>;
  interestRate?: Maybe<Scalars['Float']['output']>;
  lender: Scalars['String']['output'];
  linkedAssetIDs?: Maybe<Array<Scalars['ID']['output']>>;
  loanAmount: Scalars['Float']['output'];
  loanNumber?: Maybe<Scalars['String']['output']>;
  loanType: Scalars['String']['output'];
  monthlyPayment: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  otherFees?: Maybe<Scalars['Float']['output']>;
  ownershipMode?: Maybe<Scalars['String']['output']>;
  ownershipPercentage?: Maybe<Scalars['Float']['output']>;
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  remainingBalance: Scalars['Float']['output'];
  sector?: Maybe<Scalars['String']['output']>;
  startDate: Scalars['String']['output'];
  status: Scalars['String']['output'];
  steps?: Maybe<Array<LoanStep>>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
};

export type LoanCoOwner = {
  __typename?: 'LoanCoOwner';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  percentage: Scalars['Float']['output'];
  type: Scalars['String']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type LoanCoOwnerInput = {
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  percentage: Scalars['Float']['input'];
  type: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type LoanCompanyOwner = {
  __typename?: 'LoanCompanyOwner';
  companyId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  legalForm?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  percentage: Scalars['Float']['output'];
  registrationNumber?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
};

export type LoanCompanyOwnerInput = {
  companyId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  legalForm?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  percentage: Scalars['Float']['input'];
  registrationNumber?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};

export type LoanStep = {
  __typename?: 'LoanStep';
  amount: Scalars['Float']['output'];
  date?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  interestRate: Scalars['Float']['output'];
};

export type LoanStepInput = {
  amount: Scalars['Float']['input'];
  date?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  interestRate: Scalars['Float']['input'];
};

export type LoginInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type LogoutInput = {
  token: Scalars['String']['input'];
};

export type LogoutResponse = {
  __typename?: 'LogoutResponse';
  errors?: Maybe<Array<AuthError>>;
  success: Scalars['Boolean']['output'];
};

export type ManualInstrumentFilterInput = {
  assetTypes?: InputMaybe<Array<InstrumentAssetType>>;
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
};

export type ManualInstrumentPayload = {
  __typename?: 'ManualInstrumentPayload';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Instrument>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
};

export type MarketDataCandlePayload = {
  __typename?: 'MarketDataCandlePayload';
  candle?: Maybe<Candle>;
  failures: Array<ProviderFailure>;
  fallbackUsed: Scalars['Boolean']['output'];
  sourceProvider: Scalars['String']['output'];
};

export type MarketDataCandlesPayload = {
  __typename?: 'MarketDataCandlesPayload';
  candles: Array<Candle>;
  failures: Array<ProviderFailure>;
  fallbackUsed: Scalars['Boolean']['output'];
  sourceProvider: Scalars['String']['output'];
};

export type MarketDataCredential = {
  __typename?: 'MarketDataCredential';
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  isEnabled: Scalars['Boolean']['output'];
  lastValidatedAt?: Maybe<Scalars['Time']['output']>;
  priority: Scalars['Int']['output'];
  provider: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Time']['output'];
};

export type MarketDataPack = {
  __typename?: 'MarketDataPack';
  assetsCount: Scalars['Int64']['output'];
  checksum: Scalars['String']['output'];
  createdAt: Scalars['Time']['output'];
  description?: Maybe<Scalars['String']['output']>;
  filePath: Scalars['String']['output'];
  formatVersion: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  installedAt?: Maybe<Scalars['Time']['output']>;
  name: Scalars['String']['output'];
  packPriority: Scalars['Int']['output'];
  parentPackId?: Maybe<Scalars['ID']['output']>;
  rowsCount: Scalars['Int64']['output'];
  signatureVerified: Scalars['Boolean']['output'];
  status: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['Time']['output']>;
  version: Scalars['String']['output'];
};

export type MarketDataPackBuildJob = {
  __typename?: 'MarketDataPackBuildJob';
  completedDates: Scalars['Int']['output'];
  completedSymbols: Scalars['Int']['output'];
  createdAt: Scalars['Time']['output'];
  currentAssetType?: Maybe<Scalars['String']['output']>;
  currentDate?: Maybe<Scalars['Time']['output']>;
  currentSymbol?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  failedSymbols: Scalars['Int']['output'];
  finishedAt?: Maybe<Scalars['Time']['output']>;
  id: Scalars['ID']['output'];
  packId: Scalars['ID']['output'];
  progressPercent: Scalars['Float']['output'];
  rowsWritten: Scalars['Int64']['output'];
  sourceProvider: Scalars['String']['output'];
  startedAt?: Maybe<Scalars['Time']['output']>;
  status: Scalars['String']['output'];
  totalDates: Scalars['Int']['output'];
  totalSymbols: Scalars['Int']['output'];
};

export type MarketDataPackCoverage = {
  __typename?: 'MarketDataPackCoverage';
  assetType: Scalars['String']['output'];
  filePaths: Array<Scalars['String']['output']>;
  firstDate: Scalars['Time']['output'];
  instrumentId: Scalars['ID']['output'];
  interval: Scalars['String']['output'];
  lastDate: Scalars['Time']['output'];
  packId: Scalars['ID']['output'];
  quoteCurrency: Scalars['String']['output'];
  rowCount: Scalars['Int64']['output'];
  symbol: Scalars['String']['output'];
};

export type MarketDataPackJob = {
  __typename?: 'MarketDataPackJob';
  createdAt: Scalars['Time']['output'];
  downloadedBytes: Scalars['Int64']['output'];
  errorMessage?: Maybe<Scalars['String']['output']>;
  finishedAt?: Maybe<Scalars['Time']['output']>;
  id: Scalars['ID']['output'];
  importedRows: Scalars['Int64']['output'];
  jobType: Scalars['String']['output'];
  packId: Scalars['ID']['output'];
  progressPercent: Scalars['Float']['output'];
  startedAt?: Maybe<Scalars['Time']['output']>;
  status: Scalars['String']['output'];
  totalBytes: Scalars['Int64']['output'];
};

export type MarketDataPackRegistryEntry = {
  __typename?: 'MarketDataPackRegistryEntry';
  assetTypes: Array<Scalars['String']['output']>;
  assetsCount: Scalars['Int64']['output'];
  checksum: Scalars['String']['output'];
  compressedSizeBytes: Scalars['Int64']['output'];
  createdAt: Scalars['Time']['output'];
  description?: Maybe<Scalars['String']['output']>;
  downloadUrl: Scalars['String']['output'];
  interval: Scalars['String']['output'];
  name: Scalars['String']['output'];
  packId: Scalars['ID']['output'];
  quoteCurrencies: Array<Scalars['String']['output']>;
  recommended: Scalars['Boolean']['output'];
  rowsCount: Scalars['Int64']['output'];
  signatureUrl?: Maybe<Scalars['String']['output']>;
  sizeBytes: Scalars['Int64']['output'];
  version: Scalars['String']['output'];
};

export type MethodParameter = {
  __typename?: 'MethodParameter';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  acknowledgeAlert: Scalars['Boolean']['output'];
  addAssetToPortfolio: PortfolioAsset;
  addAssetToWatchlist: Watchlist;
  addCustomToken: WalletBalance;
  addInstrumentToPortfolio: PortfolioAsset;
  addMultiChainWallet: WalletDevice;
  addMultiNetworkWallet: Array<WalletAccount>;
  addWalletAccount: WalletAccount;
  adminCreateUser: User;
  adminDeleteUser: Scalars['Boolean']['output'];
  adminSetUserEmailVerified: User;
  adminSetUserLock: User;
  adminSetUserPassword: Scalars['Boolean']['output'];
  adminSetUserRole: User;
  adminUpdateUser: User;
  archiveManualInstrument: Instrument;
  assignWalletDevice: Scalars['Boolean']['output'];
  cancelMarketDataPackJob: MarketDataPackJob;
  cancelPackBuildJob: MarketDataPackBuildJob;
  completeAggregatorAuth: Array<SyncConnection>;
  completeEnableBankingAuth: Array<SyncConnection>;
  configureAlchemyKey: Scalars['Boolean']['output'];
  confirmPasswordReset: PasswordResetResponse;
  createAccount: Account;
  createAlert: Alert;
  createBankAccountAsset: BankAccount;
  createBatchAlerts: BatchAlertResult;
  createCryptoAsset: Crypto;
  createLifeInsuranceAsset: LifeInsurance;
  createLoanAsset: Loan;
  createPerformanceSnapshot: PerformanceSnapshot;
  createPortfolio: Portfolio;
  createRealEstateAsset: RealEstate;
  createStockAsset: Stock;
  createUser: User;
  createWalletDevice: WalletDevice;
  createWatchAsset: Watch;
  createWatchlist: Watchlist;
  deactivateBatchAlerts: BatchDeactivateResult;
  deleteAccount: Scalars['Boolean']['output'];
  deleteAlert: Scalars['Boolean']['output'];
  deleteMarketDataCredential: Scalars['ID']['output'];
  deletePortfolio: Scalars['ID']['output'];
  deleteTransaction: Scalars['ID']['output'];
  deleteUser: Scalars['ID']['output'];
  deleteWatchlist: Scalars['ID']['output'];
  duplicatePortfolio: Portfolio;
  exportPortfolio: ExportResult;
  generateAggregatorLink: AggregatorAuthSession;
  importFinanceDatabaseAssets: ImportFinanceDatabaseAssetsPayload;
  importInstrumentFromCatalog: ImportInstrumentFromSourcePayload;
  importInstrumentFromSource: ImportInstrumentFromSourcePayload;
  initiateEnableBankingAuth: EnableBankingAuthSession;
  initiateTradeRepublicAuth: TradeRepublicAuthSession;
  initiateWoobAuth: WoobAuthSession;
  installMarketDataPack: MarketDataPackJob;
  linkSyncAccount: SyncConnection;
  login: AuthResponse;
  logout: LogoutResponse;
  persistDiscoveredInstrument: Instrument;
  pollTradeRepublicAuth: TradeRepublicAuthPollResult;
  pollWoobAuth: WoobAuthPollResult;
  refreshAssetPrices: RefreshAssetPricesResult;
  refreshRealEstateValuation: RealEstate;
  refreshSingleAssetPrice: AssetPricePoint;
  refreshToken: AuthResponse;
  refreshWalletBalancePrice: WalletBalance;
  register: AuthResponse;
  registerSyncCredential: SyncCredential;
  removeAssetFromPortfolio: Scalars['ID']['output'];
  removeAssetFromWatchlist: Watchlist;
  removeMarketDataPack: MarketDataPackJob;
  removeWalletAccount: Scalars['Boolean']['output'];
  removeWalletDevice: Scalars['Boolean']['output'];
  reorderPortfolios: Array<Portfolio>;
  repairMarketDataPack: MarketDataPackJob;
  resendVerification: EmailVerificationResponse;
  resetBlockchainNetworkConfig: BlockchainNetworkConfig;
  resetPassword: PasswordResetResponse;
  resetWalletBalanceCostBasis: Scalars['Boolean']['output'];
  resolveWalletReview: Scalars['Boolean']['output'];
  restoreManualInstrument: Instrument;
  retryHistoricalDataBackfillJob: HistoricalDataBackfillJob;
  setWalletBalanceCostBasis: Scalars['Boolean']['output'];
  startLocalPackBuild: MarketDataPackBuildJob;
  tagAsset: Asset;
  tagPortfolio: Portfolio;
  toggleSpamToken: Scalars['Boolean']['output'];
  triggerAccountSync: SyncRun;
  triggerFinanceDatabaseSync: TriggerFinanceDatabaseSyncPayload;
  triggerWalletSync: Scalars['Boolean']['output'];
  untagAsset: Asset;
  untagPortfolio: Portfolio;
  updateAccount: Account;
  updateAlert: Alert;
  updateAssetInPortfolio: PortfolioAsset;
  updateBlockchainNetworkConfig: BlockchainNetworkConfig;
  updateFinanceDatabaseSyncEnabled: FinanceDatabaseSyncItem;
  updateManualInstrument: Instrument;
  updateMarketDataPack: MarketDataPackJob;
  updatePerformanceSnapshots: Scalars['Boolean']['output'];
  updatePortfolio: Portfolio;
  updateProviderRoutingPreferences: ProviderRoutingPreferences;
  updateRealEstateAsset: RealEstate;
  updateTransaction: Transaction;
  updateUser: User;
  updateUserDisplayCurrency: User;
  updateUserTaxJurisdiction: User;
  updateUserThemePreferences: User;
  updateWalletDevice: WalletDevice;
  upsertMarketDataCredential: MarketDataCredential;
  validateProviderCredentials: ValidationResult;
  verifyEmail: EmailVerificationResponse;
};


export type MutationAcknowledgeAlertArgs = {
  alertId: Scalars['ID']['input'];
};


export type MutationAddAssetToPortfolioArgs = {
  input: PortfolioAssetInput;
};


export type MutationAddAssetToWatchlistArgs = {
  assetID: Scalars['ID']['input'];
  watchlistID: Scalars['ID']['input'];
};


export type MutationAddCustomTokenArgs = {
  input: AddCustomTokenInput;
};


export type MutationAddInstrumentToPortfolioArgs = {
  input: AddInstrumentHoldingInput;
};


export type MutationAddMultiChainWalletArgs = {
  input: AddMultiChainWalletInput;
};


export type MutationAddMultiNetworkWalletArgs = {
  input: AddMultiNetworkWalletInput;
};


export type MutationAddWalletAccountArgs = {
  input: AddWalletAccountInput;
};


export type MutationAdminCreateUserArgs = {
  input: AdminCreateUserInput;
};


export type MutationAdminDeleteUserArgs = {
  hardDelete?: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};


export type MutationAdminSetUserEmailVerifiedArgs = {
  id: Scalars['ID']['input'];
  verified: Scalars['Boolean']['input'];
};


export type MutationAdminSetUserLockArgs = {
  id: Scalars['ID']['input'];
  lockUntil?: InputMaybe<Scalars['Time']['input']>;
  locked: Scalars['Boolean']['input'];
};


export type MutationAdminSetUserPasswordArgs = {
  id: Scalars['ID']['input'];
  password: Scalars['String']['input'];
};


export type MutationAdminSetUserRoleArgs = {
  id: Scalars['ID']['input'];
  role: Scalars['String']['input'];
};


export type MutationAdminUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: AdminUpdateUserInput;
};


export type MutationArchiveManualInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAssignWalletDeviceArgs = {
  deviceId?: InputMaybe<Scalars['ID']['input']>;
  walletAccountId: Scalars['ID']['input'];
};


export type MutationCancelMarketDataPackJobArgs = {
  jobId: Scalars['ID']['input'];
};


export type MutationCancelPackBuildJobArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCompleteAggregatorAuthArgs = {
  connectionId: Scalars['ID']['input'];
  sessionToken: Scalars['String']['input'];
};


export type MutationCompleteEnableBankingAuthArgs = {
  code: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
  state: Scalars['String']['input'];
};


export type MutationConfigureAlchemyKeyArgs = {
  apiKey: Scalars['String']['input'];
};


export type MutationConfirmPasswordResetArgs = {
  input: PasswordResetConfirmInput;
};


export type MutationCreateAccountArgs = {
  input: CreateAccountInput;
};


export type MutationCreateAlertArgs = {
  input: CreateAlertInput;
};


export type MutationCreateBankAccountAssetArgs = {
  input: CreateBankAccountInput;
};


export type MutationCreateBatchAlertsArgs = {
  input: BatchAlertInput;
};


export type MutationCreateCryptoAssetArgs = {
  input: CreateCryptoInput;
};


export type MutationCreateLifeInsuranceAssetArgs = {
  input: CreateLifeInsuranceInput;
};


export type MutationCreateLoanAssetArgs = {
  input: CreateLoanInput;
};


export type MutationCreatePerformanceSnapshotArgs = {
  asOfDate: Scalars['Time']['input'];
  portfolioId: Scalars['ID']['input'];
};


export type MutationCreatePortfolioArgs = {
  input: CreatePortfolioInput;
};


export type MutationCreateRealEstateAssetArgs = {
  input: CreateRealEstateInput;
};


export type MutationCreateStockAssetArgs = {
  input: CreateStockInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationCreateWalletDeviceArgs = {
  input: CreateWalletDeviceInput;
};


export type MutationCreateWatchAssetArgs = {
  input: CreateWatchInput;
};


export type MutationCreateWatchlistArgs = {
  input: CreateWatchlistInput;
};


export type MutationDeactivateBatchAlertsArgs = {
  input: BatchDeactivateInput;
};


export type MutationDeleteAccountArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAlertArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMarketDataCredentialArgs = {
  provider: Scalars['String']['input'];
};


export type MutationDeletePortfolioArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteWatchlistArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDuplicatePortfolioArgs = {
  input: DuplicatePortfolioInput;
};


export type MutationExportPortfolioArgs = {
  input: ExportPortfolioInput;
};


export type MutationGenerateAggregatorLinkArgs = {
  provider: Scalars['String']['input'];
  redirectUrl: Scalars['String']['input'];
};


export type MutationImportFinanceDatabaseAssetsArgs = {
  assetType: AssetSyncType;
  symbols: Array<Scalars['String']['input']>;
};


export type MutationImportInstrumentFromCatalogArgs = {
  externalId: Scalars['String']['input'];
  forceEnrich?: InputMaybe<Scalars['Boolean']['input']>;
  source: CatalogSource;
};


export type MutationImportInstrumentFromSourceArgs = {
  input: ImportInstrumentFromSourceInput;
};


export type MutationInitiateEnableBankingAuthArgs = {
  aspspCountry: Scalars['String']['input'];
  aspspName: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
  redirectUrl: Scalars['String']['input'];
};


export type MutationInitiateTradeRepublicAuthArgs = {
  phoneNumber: Scalars['String']['input'];
  pin: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
};


export type MutationInitiateWoobAuthArgs = {
  institution: Scalars['String']['input'];
  login: Scalars['String']['input'];
  password: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
  region?: InputMaybe<Scalars['String']['input']>;
};


export type MutationInstallMarketDataPackArgs = {
  packId: Scalars['ID']['input'];
};


export type MutationLinkSyncAccountArgs = {
  accountId?: InputMaybe<Scalars['ID']['input']>;
  autoCreate?: InputMaybe<Scalars['Boolean']['input']>;
  connectionId: Scalars['ID']['input'];
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationLogoutArgs = {
  input: LogoutInput;
};


export type MutationPersistDiscoveredInstrumentArgs = {
  input: PersistDiscoveredInstrumentInput;
};


export type MutationPollTradeRepublicAuthArgs = {
  authSessionId: Scalars['ID']['input'];
};


export type MutationPollWoobAuthArgs = {
  authSessionId: Scalars['ID']['input'];
  otpCode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRefreshAssetPricesArgs = {
  assetId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationRefreshRealEstateValuationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRefreshSingleAssetPriceArgs = {
  assetId: Scalars['ID']['input'];
};


export type MutationRefreshTokenArgs = {
  input: RefreshTokenInput;
};


export type MutationRefreshWalletBalancePriceArgs = {
  balanceId: Scalars['ID']['input'];
};


export type MutationRegisterArgs = {
  input: RegisterInput;
};


export type MutationRegisterSyncCredentialArgs = {
  credentials: Scalars['JSON']['input'];
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
  provider: Scalars['String']['input'];
};


export type MutationRemoveAssetFromPortfolioArgs = {
  accountID?: InputMaybe<Scalars['ID']['input']>;
  assetID: Scalars['ID']['input'];
  portfolioID: Scalars['ID']['input'];
};


export type MutationRemoveAssetFromWatchlistArgs = {
  assetID: Scalars['ID']['input'];
  watchlistID: Scalars['ID']['input'];
};


export type MutationRemoveMarketDataPackArgs = {
  packId: Scalars['ID']['input'];
};


export type MutationRemoveWalletAccountArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveWalletDeviceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationReorderPortfoliosArgs = {
  input: ReorderPortfoliosInput;
};


export type MutationRepairMarketDataPackArgs = {
  packId: Scalars['ID']['input'];
};


export type MutationResendVerificationArgs = {
  input: ResendVerificationInput;
};


export type MutationResetBlockchainNetworkConfigArgs = {
  network: BlockchainNetwork;
};


export type MutationResetPasswordArgs = {
  input: PasswordResetInput;
};


export type MutationResetWalletBalanceCostBasisArgs = {
  balanceId: Scalars['ID']['input'];
};


export type MutationResolveWalletReviewArgs = {
  action: Scalars['String']['input'];
  customType?: InputMaybe<Scalars['String']['input']>;
  reviewId: Scalars['ID']['input'];
};


export type MutationRestoreManualInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRetryHistoricalDataBackfillJobArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSetWalletBalanceCostBasisArgs = {
  balanceId: Scalars['ID']['input'];
  costBasisPerUnit: Scalars['Float']['input'];
  currency?: InputMaybe<Scalars['String']['input']>;
};


export type MutationStartLocalPackBuildArgs = {
  input: StartLocalPackBuildInput;
};


export type MutationTagAssetArgs = {
  assetID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationTagPortfolioArgs = {
  portfolioID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationToggleSpamTokenArgs = {
  balanceId: Scalars['ID']['input'];
  isHidden: Scalars['Boolean']['input'];
};


export type MutationTriggerAccountSyncArgs = {
  accountId: Scalars['ID']['input'];
};


export type MutationTriggerFinanceDatabaseSyncArgs = {
  assetType: AssetSyncType;
};


export type MutationTriggerWalletSyncArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUntagAssetArgs = {
  assetID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationUntagPortfolioArgs = {
  portfolioID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationUpdateAccountArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAccountInput;
};


export type MutationUpdateAlertArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAlertInput;
};


export type MutationUpdateAssetInPortfolioArgs = {
  input: PortfolioAssetInput;
};


export type MutationUpdateBlockchainNetworkConfigArgs = {
  input: UpdateBlockchainNetworkConfigInput;
};


export type MutationUpdateFinanceDatabaseSyncEnabledArgs = {
  assetType: AssetSyncType;
  enabled: Scalars['Boolean']['input'];
};


export type MutationUpdateManualInstrumentArgs = {
  id: Scalars['ID']['input'];
  input: UpdateManualInstrumentInput;
};


export type MutationUpdateMarketDataPackArgs = {
  packId: Scalars['ID']['input'];
};


export type MutationUpdatePerformanceSnapshotsArgs = {
  asOfDate: Scalars['Time']['input'];
  portfolioIds: Array<Scalars['ID']['input']>;
};


export type MutationUpdatePortfolioArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePortfolioInput;
};


export type MutationUpdateProviderRoutingPreferencesArgs = {
  input: ProviderRoutingPreferencesInput;
};


export type MutationUpdateRealEstateAssetArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRealEstateInput;
};


export type MutationUpdateTransactionArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTransactionInput;
};


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};


export type MutationUpdateUserDisplayCurrencyArgs = {
  input: UpdateUserDisplayCurrencyInput;
};


export type MutationUpdateUserTaxJurisdictionArgs = {
  input: UpdateUserTaxJurisdictionInput;
};


export type MutationUpdateUserThemePreferencesArgs = {
  input: UpdateUserThemePreferencesInput;
};


export type MutationUpdateWalletDeviceArgs = {
  deviceType: WalletDeviceType;
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};


export type MutationUpsertMarketDataCredentialArgs = {
  apiKey: Scalars['String']['input'];
  isEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  provider: Scalars['String']['input'];
};


export type MutationValidateProviderCredentialsArgs = {
  apiKey: Scalars['String']['input'];
  provider: Scalars['String']['input'];
};


export type MutationVerifyEmailArgs = {
  input: EmailVerificationInput;
};

export type OnlineInstrumentInput = {
  assetType: InstrumentAssetType;
  country?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  cusip?: InputMaybe<Scalars['String']['input']>;
  exchange: Scalars['String']['input'];
  exchangeCode?: InputMaybe<Scalars['String']['input']>;
  figi?: InputMaybe<Scalars['String']['input']>;
  isin?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  providerExternalId?: InputMaybe<Scalars['String']['input']>;
  providerSource: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
};

export type OnlineInstrumentResult = {
  __typename?: 'OnlineInstrumentResult';
  assetType: InstrumentAssetType;
  country?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  cusip?: Maybe<Scalars['String']['output']>;
  exchange: Scalars['String']['output'];
  exchangeCode?: Maybe<Scalars['String']['output']>;
  externalId?: Maybe<Scalars['String']['output']>;
  figi?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  isin?: Maybe<Scalars['String']['output']>;
  marketCapRank?: Maybe<Scalars['Int']['output']>;
  name: Scalars['String']['output'];
  platforms?: Maybe<Array<PlatformAddress>>;
  providerExternalId?: Maybe<Scalars['String']['output']>;
  providerSource: Scalars['String']['output'];
  source: CatalogSource;
  symbol: Scalars['String']['output'];
};

export type OnlineInstrumentSearchPayload = {
  __typename?: 'OnlineInstrumentSearchPayload';
  coverageStatus: CoverageStatus;
  errorMessage?: Maybe<Scalars['String']['output']>;
  onlineResults: Array<OnlineInstrumentResult>;
  providerUsed: Scalars['String']['output'];
  queryMetadata: InstrumentQueryMetadata;
};

export type Ownership = {
  __typename?: 'Ownership';
  asset: Asset;
  ownershipPercentage: Scalars['Float']['output'];
  user: User;
};

export type PaginationInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type PasswordResetConfirmInput = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type PasswordResetInput = {
  email: Scalars['String']['input'];
};

export type PasswordResetResponse = {
  __typename?: 'PasswordResetResponse';
  errors?: Maybe<Array<AuthError>>;
  success: Scalars['Boolean']['output'];
};

export type PerformanceMetrics = {
  __typename?: 'PerformanceMetrics';
  benchmarks: Array<BenchmarkResult>;
  calculationMethod: CalculationMethod;
  dataQuality: DataQuality;
  isValid: Scalars['Boolean']['output'];
  portfolioId: Scalars['ID']['output'];
  realizedGainLoss: Scalars['Float']['output'];
  timeWeightedReturn: Scalars['Float']['output'];
  totalCostBasis: Scalars['Float']['output'];
  totalReturnPercentage: Scalars['Float']['output'];
  totalValue: Scalars['Float']['output'];
  unrealizedGainLoss: Scalars['Float']['output'];
  validationErrors: Array<Scalars['String']['output']>;
};

export type PerformancePoint = {
  __typename?: 'PerformancePoint';
  date: Scalars['Time']['output'];
  value: Scalars['Float']['output'];
};

export type PerformanceReport = {
  __typename?: 'PerformanceReport';
  allocation: AllocationBreakdown;
  benchmarks: Array<BenchmarkComparison>;
  dataQuality: DataQuality;
  downloadUrl?: Maybe<Scalars['String']['output']>;
  generatedAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  metrics: PerformanceMetrics;
  portfolioId: Scalars['ID']['output'];
  recommendations: Array<Scalars['String']['output']>;
  reportType: ReportType;
  riskMetrics: RiskMetrics;
  timeRange: TimeRange;
  topPerformers: Array<PositionPerformance>;
  worstPerformers: Array<PositionPerformance>;
};

export type PerformanceSnapshot = {
  __typename?: 'PerformanceSnapshot';
  createdAt: Scalars['Time']['output'];
  dataQuality: DataQuality;
  id: Scalars['ID']['output'];
  portfolioId: Scalars['ID']['output'];
  realizedGainLoss: Scalars['Float']['output'];
  returnPercentage: Scalars['Float']['output'];
  snapshotDate: Scalars['Time']['output'];
  totalCostBasis: Scalars['Float']['output'];
  totalValue: Scalars['Float']['output'];
  unrealizedGainLoss: Scalars['Float']['output'];
};

export type PerformanceTimeRangeInput = {
  end: Scalars['Time']['input'];
  start: Scalars['Time']['input'];
};

export type PersistDiscoveredInstrumentInput = {
  instrument: OnlineInstrumentInput;
};

export type PlatformAddress = {
  __typename?: 'PlatformAddress';
  address: Scalars['String']['output'];
  platform: Scalars['String']['output'];
};

export type Portfolio = {
  __typename?: 'Portfolio';
  accounts: Array<Account>;
  analytics?: Maybe<PortfolioAnalytics>;
  assets: Array<PortfolioAsset>;
  createdAt: Scalars['Time']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  tags: Array<Tag>;
  taxWrapper: TaxWrapperType;
  transactions: Array<Transaction>;
  updatedAt: Scalars['Time']['output'];
  user: User;
};

export type PortfolioAnalytics = {
  __typename?: 'PortfolioAnalytics';
  assetAllocation: Array<AssetAllocation>;
  coveredValueRatio?: Maybe<Scalars['Float']['output']>;
  displayCurrency?: Maybe<Scalars['String']['output']>;
  excludedPositionCount?: Maybe<Scalars['Int']['output']>;
  fxAsOf?: Maybe<Scalars['Time']['output']>;
  fxGranularity?: Maybe<Scalars['String']['output']>;
  fxSource?: Maybe<Scalars['String']['output']>;
  fxState?: Maybe<Scalars['String']['output']>;
  isStale?: Maybe<Scalars['Boolean']['output']>;
  performanceHistory: Array<PerformancePoint>;
  positionValuations?: Maybe<Array<PositionValuation>>;
  quoteCurrency?: Maybe<Scalars['String']['output']>;
  riskMetrics: RiskMetrics;
  totalCost: Scalars['Float']['output'];
  totalDisplayValue?: Maybe<Scalars['Float']['output']>;
  totalGainLoss: Scalars['Float']['output'];
  totalGainLossPercent: Scalars['Float']['output'];
  totalNativeValue?: Maybe<Scalars['Float']['output']>;
  totalValue: Scalars['Float']['output'];
};

export type PortfolioAsset = {
  __typename?: 'PortfolioAsset';
  accountID?: Maybe<Scalars['ID']['output']>;
  accountName?: Maybe<Scalars['String']['output']>;
  asset: Asset;
  averagePurchasePrice?: Maybe<Scalars['Float']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  instrumentID?: Maybe<Scalars['ID']['output']>;
  ownershipPct?: Maybe<Scalars['Float']['output']>;
  positionID?: Maybe<Scalars['ID']['output']>;
  quantity: Scalars['Float']['output'];
  quoteCurrency?: Maybe<Scalars['String']['output']>;
};

export type PortfolioAssetInput = {
  assetID: Scalars['ID']['input'];
  averagePurchasePrice?: InputMaybe<Scalars['Float']['input']>;
  portfolioID: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
};

export type PortfolioFilter = {
  hasTagIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  nameContains?: InputMaybe<Scalars['String']['input']>;
  userID?: InputMaybe<Scalars['ID']['input']>;
};

export type PortfolioOrder = {
  direction?: SortDirection;
  field?: PortfolioOrderField;
};

export enum PortfolioOrderField {
  CreatedAt = 'CREATED_AT',
  Name = 'NAME',
  SortOrder = 'SORT_ORDER',
  UpdatedAt = 'UPDATED_AT'
}

export type PortfolioOrderInput = {
  portfolioID: Scalars['ID']['input'];
  sortOrder: Scalars['Int']['input'];
};

export type Position = {
  __typename?: 'Position';
  account: Account;
  accountId: Scalars['ID']['output'];
  asset: Asset;
  averagePurchasePrice?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  ownershipPct?: Maybe<Scalars['Float']['output']>;
  portfolio: Portfolio;
  quantity: Scalars['Float']['output'];
};

export type PositionPerformance = {
  __typename?: 'PositionPerformance';
  assetName: Scalars['String']['output'];
  assetSymbol?: Maybe<Scalars['String']['output']>;
  contribution: Scalars['Float']['output'];
  gainLoss: Scalars['Float']['output'];
  positionId: Scalars['ID']['output'];
  returnPercentage: Scalars['Float']['output'];
};

export type PositionValuation = {
  __typename?: 'PositionValuation';
  assetId: Scalars['ID']['output'];
  costBasisConverted: Scalars['Boolean']['output'];
  costBasisCurrency: Scalars['String']['output'];
  costBasisDisplay: Scalars['Float']['output'];
  costBasisNative: Scalars['Float']['output'];
  displayCurrency: Scalars['String']['output'];
  displayValue: Scalars['Float']['output'];
  exclusionReason?: Maybe<Scalars['String']['output']>;
  fxAsOf?: Maybe<Scalars['Time']['output']>;
  fxGranularity?: Maybe<Scalars['String']['output']>;
  fxRate: Scalars['Float']['output'];
  fxSource?: Maybe<Scalars['String']['output']>;
  hasDisplayValue: Scalars['Boolean']['output'];
  isExcluded: Scalars['Boolean']['output'];
  isStale: Scalars['Boolean']['output'];
  nativeValue: Scalars['Float']['output'];
  positionId: Scalars['ID']['output'];
  quoteCurrency: Scalars['String']['output'];
};

export type ProviderFailure = {
  __typename?: 'ProviderFailure';
  provider: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

export type ProviderHealth = {
  __typename?: 'ProviderHealth';
  apiKeyValid?: Maybe<Scalars['Boolean']['output']>;
  assetType: Scalars['String']['output'];
  healthy: Scalars['Boolean']['output'];
  lastChecked: Scalars['Time']['output'];
  provider: Scalars['String']['output'];
};

export type ProviderInfo = {
  __typename?: 'ProviderInfo';
  id: Scalars['String']['output'];
  intervals: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  rateLimit: RateLimit;
  requiresKey: Scalars['Boolean']['output'];
  supportsRealtime: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
};

export type ProviderPreference = {
  __typename?: 'ProviderPreference';
  enabled: Scalars['Boolean']['output'];
  priority: Scalars['Int']['output'];
  provider: Scalars['String']['output'];
};

export type ProviderPreferenceInput = {
  enabled: Scalars['Boolean']['input'];
  priority: Scalars['Int']['input'];
  provider: Scalars['String']['input'];
};

export type ProviderRoutingPreferences = {
  __typename?: 'ProviderRoutingPreferences';
  createdAt: Scalars['Time']['output'];
  enableFallback: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  preferredProviders: Array<ProviderPreference>;
  staleDataThresholdMinutes: Scalars['Int']['output'];
  updatedAt: Scalars['Time']['output'];
  useIntelligentRouting: Scalars['Boolean']['output'];
  userId: Scalars['String']['output'];
};

export type ProviderRoutingPreferencesInput = {
  enableFallback?: InputMaybe<Scalars['Boolean']['input']>;
  preferredProviders: Array<ProviderPreferenceInput>;
  staleDataThresholdMinutes?: InputMaybe<Scalars['Int']['input']>;
  useIntelligentRouting?: InputMaybe<Scalars['Boolean']['input']>;
};

export type Query = {
  __typename?: 'Query';
  GetPortfoliosWithAnalytics: Array<Portfolio>;
  account?: Maybe<Account>;
  accounts: Array<Account>;
  adminUserStats: AdminUserStats;
  adminUsers: AdminUsersResponse;
  alert?: Maybe<Alert>;
  alertHistory: Array<AlertTriggerEvent>;
  alerts: Array<Alert>;
  allocationChartData: Array<ChartDataPoint>;
  asset?: Maybe<Asset>;
  assetChartData: TimeSeriesData;
  assetPriceHistory: Array<AssetPricePoint>;
  assetPriceStatistics: AssetPriceStatistics;
  assetTypes: Array<AssetType>;
  assets: Array<Asset>;
  availableMarketDataPacks: Array<MarketDataPackRegistryEntry>;
  availableProviders: Array<AvailableProvider>;
  benchmarkComparison: BenchmarkComparison;
  blockchainNetworkConfigs: Array<BlockchainNetworkConfig>;
  candles: Array<Candle>;
  candlesByInstrument: MarketDataCandlesPayload;
  catalogSyncStatus?: Maybe<CatalogSyncRun>;
  coOwnerCandidates: Array<CoOwnerCandidate>;
  comparePortfolios: Array<PerformanceMetrics>;
  dispositionsByPosition: Array<TaxLotDisposition>;
  enableBankingInstitutions: Array<EnableBankingInstitution>;
  estimateRealEstate: RealEstateEstimationResult;
  fetchADEMEDpe?: Maybe<AdemeDpeResult>;
  financeDatabasePreview: Array<FinanceDatabasePreviewItem>;
  financeDatabaseSyncHistory: Array<FinanceDatabaseSyncHistoryEntry>;
  financeDatabaseSyncStatus: FinanceDatabaseSyncStatusPayload;
  generatePerformanceReport: PerformanceReport;
  getCommuneRentalIndicators?: Maybe<RealEstateRentalMarket>;
  historicalDataBackfillJob?: Maybe<HistoricalDataBackfillJob>;
  historicalDataBackfillJobs: Array<HistoricalDataBackfillJob>;
  installedMarketDataPacks: Array<MarketDataPack>;
  instrument?: Maybe<Instrument>;
  latestHistoricalDataBackfillJob?: Maybe<HistoricalDataBackfillJob>;
  latestPerformanceSnapshot?: Maybe<PerformanceSnapshot>;
  manualInstruments: ManualInstrumentPayload;
  marketDataCoverage: Array<MarketDataPackCoverage>;
  marketDataCredentials: Array<MarketDataCredential>;
  marketDataPackJob?: Maybe<MarketDataPackJob>;
  me?: Maybe<AuthUser>;
  packBuildJob?: Maybe<MarketDataPackBuildJob>;
  packBuildJobs: Array<MarketDataPackBuildJob>;
  pendingWalletReviews: Array<WalletActivityReview>;
  performanceSnapshots: Array<PerformanceSnapshot>;
  portfolio?: Maybe<Portfolio>;
  portfolioAllocation: AllocationBreakdown;
  portfolioChartData: TimeSeriesData;
  portfolioPerformance: PerformanceMetrics;
  portfolioRiskMetrics: RiskMetrics;
  portfolios: Array<Portfolio>;
  providerHealth: Array<ProviderHealth>;
  providerRoutingPreferences: ProviderRoutingPreferences;
  realTimePrice?: Maybe<Candle>;
  realTimePriceByInstrument?: Maybe<MarketDataCandlePayload>;
  realizedGains: RealizedGainsSummary;
  scopedPerformanceHistory: Array<PerformancePoint>;
  searchInstruments: InstrumentSearchPayload;
  searchInstrumentsOnline: OnlineInstrumentSearchPayload;
  supportedProviders: Array<ProviderInfo>;
  syncConnections: Array<SyncConnection>;
  syncCredentials: Array<SyncCredential>;
  tag?: Maybe<Tag>;
  tags: Array<Tag>;
  taxHarvestOpportunities: Array<TaxHarvestOpportunity>;
  taxLotsByPosition: Array<TaxLot>;
  technicalIndicator: TechnicalIndicatorResponse;
  topPerformingAssets: Array<PositionPerformance>;
  transaction?: Maybe<Transaction>;
  transactions: Array<Transaction>;
  user?: Maybe<User>;
  users: Array<User>;
  walletAccounts: Array<WalletAccount>;
  walletCUUsage: WalletCuUsage;
  walletDevices: Array<WalletDevice>;
  watchlist?: Maybe<Watchlist>;
  watchlists: Array<Watchlist>;
  worstPerformingAssets: Array<PositionPerformance>;
};


export type QueryGetPortfoliosWithAnalyticsArgs = {
  userID: Scalars['ID']['input'];
};


export type QueryAccountArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAccountsArgs = {
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAdminUsersArgs = {
  filter?: InputMaybe<AdminUserFilter>;
  orderBy?: InputMaybe<UserOrder>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryAlertArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAlertHistoryArgs = {
  filter?: InputMaybe<AlertHistoryFilter>;
  pagination?: InputMaybe<PaginationInput>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAlertsArgs = {
  filter?: InputMaybe<AlertFilter>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryAllocationChartDataArgs = {
  portfolioId: Scalars['ID']['input'];
  timeRange?: InputMaybe<PerformanceTimeRangeInput>;
};


export type QueryAssetArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAssetChartDataArgs = {
  input: ChartDataInput;
};


export type QueryAssetPriceHistoryArgs = {
  assetId: Scalars['ID']['input'];
  from: Scalars['Time']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  to: Scalars['Time']['input'];
};


export type QueryAssetPriceStatisticsArgs = {
  assetId: Scalars['ID']['input'];
};


export type QueryAssetsArgs = {
  filter?: InputMaybe<AssetFilter>;
  orderBy?: InputMaybe<AssetOrder>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryAvailableProvidersArgs = {
  dataType: Scalars['String']['input'];
  instrumentId: Scalars['ID']['input'];
};


export type QueryBenchmarkComparisonArgs = {
  benchmarkAssetId: Scalars['ID']['input'];
  portfolioId: Scalars['ID']['input'];
  timeRange: PerformanceTimeRangeInput;
};


export type QueryCandlesArgs = {
  assetType: Scalars['String']['input'];
  from: Scalars['Time']['input'];
  interval: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  symbol: Scalars['String']['input'];
  to: Scalars['Time']['input'];
};


export type QueryCandlesByInstrumentArgs = {
  from: Scalars['Time']['input'];
  instrumentId: Scalars['ID']['input'];
  interval: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  preferredProvider?: InputMaybe<Scalars['String']['input']>;
  to: Scalars['Time']['input'];
};


export type QueryCatalogSyncStatusArgs = {
  source: CatalogSource;
};


export type QueryCoOwnerCandidatesArgs = {
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryComparePortfoliosArgs = {
  portfolioIds: Array<Scalars['ID']['input']>;
  timeRange: PerformanceTimeRangeInput;
};


export type QueryDispositionsByPositionArgs = {
  positionId: Scalars['ID']['input'];
};


export type QueryEnableBankingInstitutionsArgs = {
  country: Scalars['String']['input'];
};


export type QueryEstimateRealEstateArgs = {
  input: RealEstateEstimationInput;
};


export type QueryFetchAdemeDpeArgs = {
  banId: Scalars['String']['input'];
  propertyType?: InputMaybe<Scalars['String']['input']>;
  surfaceM2: Scalars['Float']['input'];
};


export type QueryFinanceDatabasePreviewArgs = {
  assetType: AssetSyncType;
  limit?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryFinanceDatabaseSyncHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGeneratePerformanceReportArgs = {
  input: GenerateReportInput;
};


export type QueryGetCommuneRentalIndicatorsArgs = {
  cityCode: Scalars['String']['input'];
  propertyType?: InputMaybe<Scalars['String']['input']>;
  propertyValue?: InputMaybe<Scalars['Float']['input']>;
  roomsCount?: InputMaybe<Scalars['Int']['input']>;
  surfaceM2?: InputMaybe<Scalars['Float']['input']>;
};


export type QueryHistoricalDataBackfillJobArgs = {
  id: Scalars['ID']['input'];
};


export type QueryHistoricalDataBackfillJobsArgs = {
  filter?: InputMaybe<HistoricalDataBackfillJobFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryLatestHistoricalDataBackfillJobArgs = {
  assetId: Scalars['ID']['input'];
  portfolioId: Scalars['ID']['input'];
};


export type QueryLatestPerformanceSnapshotArgs = {
  portfolioId: Scalars['ID']['input'];
};


export type QueryManualInstrumentsArgs = {
  filter?: InputMaybe<ManualInstrumentFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryMarketDataCoverageArgs = {
  instrumentId: Scalars['ID']['input'];
};


export type QueryMarketDataPackJobArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPackBuildJobArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPackBuildJobsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPendingWalletReviewsArgs = {
  portfolioId: Scalars['ID']['input'];
};


export type QueryPerformanceSnapshotsArgs = {
  portfolioId: Scalars['ID']['input'];
  timeRange: PerformanceTimeRangeInput;
};


export type QueryPortfolioArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPortfolioAllocationArgs = {
  asOfDate?: InputMaybe<Scalars['Time']['input']>;
  portfolioId: Scalars['ID']['input'];
};


export type QueryPortfolioChartDataArgs = {
  input: ChartDataInput;
};


export type QueryPortfolioPerformanceArgs = {
  asOfDate?: InputMaybe<Scalars['Time']['input']>;
  portfolioId: Scalars['ID']['input'];
};


export type QueryPortfolioRiskMetricsArgs = {
  portfolioId: Scalars['ID']['input'];
  timeRange: PerformanceTimeRangeInput;
};


export type QueryPortfoliosArgs = {
  filter?: InputMaybe<PortfolioFilter>;
  orderBy?: InputMaybe<PortfolioOrder>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryRealTimePriceArgs = {
  assetType: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
};


export type QueryRealTimePriceByInstrumentArgs = {
  instrumentId: Scalars['ID']['input'];
  preferredProvider?: InputMaybe<Scalars['String']['input']>;
};


export type QueryRealizedGainsArgs = {
  dateFrom: Scalars['Time']['input'];
  dateTo: Scalars['Time']['input'];
  portfolioId: Scalars['ID']['input'];
};


export type QueryScopedPerformanceHistoryArgs = {
  assetTypes: Array<Scalars['String']['input']>;
  portfolioID: Scalars['ID']['input'];
};


export type QuerySearchInstrumentsArgs = {
  input: InstrumentSearchInput;
};


export type QuerySearchInstrumentsOnlineArgs = {
  input: InstrumentSearchInput;
};


export type QuerySupportedProvidersArgs = {
  assetType?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySyncConnectionsArgs = {
  portfolioId: Scalars['ID']['input'];
};


export type QueryTagArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTaxHarvestOpportunitiesArgs = {
  portfolioId: Scalars['ID']['input'];
};


export type QueryTaxLotsByPositionArgs = {
  positionId: Scalars['ID']['input'];
};


export type QueryTechnicalIndicatorArgs = {
  assetType: Scalars['String']['input'];
  from?: InputMaybe<Scalars['Time']['input']>;
  indicator: Scalars['String']['input'];
  interval: Scalars['String']['input'];
  seriesType: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
  timePeriod: Scalars['Int']['input'];
  to?: InputMaybe<Scalars['Time']['input']>;
};


export type QueryTopPerformingAssetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  portfolioId: Scalars['ID']['input'];
  timeRange: PerformanceTimeRangeInput;
};


export type QueryTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTransactionsArgs = {
  filter?: InputMaybe<TransactionFilter>;
  orderBy?: InputMaybe<TransactionOrder>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUsersArgs = {
  filter?: InputMaybe<UserFilter>;
  orderBy?: InputMaybe<UserOrder>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryWalletAccountsArgs = {
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryWatchlistArgs = {
  id: Scalars['ID']['input'];
};


export type QueryWatchlistsArgs = {
  filter?: InputMaybe<WatchlistFilter>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryWorstPerformingAssetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  portfolioId: Scalars['ID']['input'];
  timeRange: PerformanceTimeRangeInput;
};

export type RateLimit = {
  __typename?: 'RateLimit';
  burstLimit: Scalars['Int']['output'];
  requestsPerDay: Scalars['Int']['output'];
  requestsPerMinute: Scalars['Int']['output'];
};

export type RealEstate = Asset & {
  __typename?: 'RealEstate';
  address: Scalars['String']['output'];
  addressLabel?: Maybe<Scalars['String']['output']>;
  agencyFees?: Maybe<Scalars['Float']['output']>;
  assetType: AssetType;
  banId?: Maybe<Scalars['String']['output']>;
  basePricePerM2?: Maybe<Scalars['Float']['output']>;
  bathroomCondition?: Maybe<Scalars['String']['output']>;
  bathroomQuality?: Maybe<Scalars['String']['output']>;
  bathrooms?: Maybe<Scalars['Float']['output']>;
  bedrooms?: Maybe<Scalars['Int']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  city: Scalars['String']['output'];
  cityCode?: Maybe<Scalars['String']['output']>;
  comparablesCount?: Maybe<Scalars['Int']['output']>;
  condition?: Maybe<Scalars['String']['output']>;
  country: Scalars['String']['output'];
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  energyLabel?: Maybe<Scalars['String']['output']>;
  estimatedGrossYield?: Maybe<Scalars['Float']['output']>;
  estimatedMax?: Maybe<Scalars['Float']['output']>;
  estimatedMin?: Maybe<Scalars['Float']['output']>;
  estimatedMonthlyRent?: Maybe<Scalars['Float']['output']>;
  estimatedPricePerM2?: Maybe<Scalars['Float']['output']>;
  estimatedValue?: Maybe<Scalars['Float']['output']>;
  estimationMethod?: Maybe<EstimationMethod>;
  exchange?: Maybe<Scalars['String']['output']>;
  floor?: Maybe<Scalars['Int']['output']>;
  flooringCondition?: Maybe<Scalars['String']['output']>;
  flooringQuality?: Maybe<Scalars['String']['output']>;
  furnishingCosts?: Maybe<Scalars['Float']['output']>;
  garages?: Maybe<Scalars['Int']['output']>;
  generalCondition?: Maybe<Scalars['String']['output']>;
  generalQuality?: Maybe<Scalars['String']['output']>;
  hasBalcony?: Maybe<Scalars['Boolean']['output']>;
  hasGarden?: Maybe<Scalars['Boolean']['output']>;
  hasLift?: Maybe<Scalars['Boolean']['output']>;
  hasOutdoor?: Maybe<Scalars['Boolean']['output']>;
  hasPool?: Maybe<Scalars['Boolean']['output']>;
  hasSauna?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  isFurnished?: Maybe<Scalars['Boolean']['output']>;
  isGroundFloor?: Maybe<Scalars['Boolean']['output']>;
  isNewConstruction?: Maybe<Scalars['Boolean']['output']>;
  kitchenCondition?: Maybe<Scalars['String']['output']>;
  kitchenQuality?: Maybe<Scalars['String']['output']>;
  landSurface?: Maybe<Scalars['Float']['output']>;
  lastEstimatedAt?: Maybe<Scalars['Time']['output']>;
  latitude?: Maybe<Scalars['Float']['output']>;
  linkedLoanId?: Maybe<Scalars['ID']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  manualValue?: Maybe<Scalars['Float']['output']>;
  marketRentPerM2?: Maybe<Scalars['Float']['output']>;
  monthlyRent?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  notaryFees?: Maybe<Scalars['Float']['output']>;
  ownershipPercentage?: Maybe<Scalars['Float']['output']>;
  ownershipStructure?: Maybe<Scalars['String']['output']>;
  parkingSpaces?: Maybe<Scalars['Int']['output']>;
  positions: Array<Position>;
  propertyType: Scalars['String']['output'];
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  renovationFees?: Maybe<Scalars['Float']['output']>;
  rentalPeriod?: Maybe<Scalars['String']['output']>;
  rentalR2Adjusted?: Maybe<Scalars['Float']['output']>;
  rentalType?: Maybe<Scalars['String']['output']>;
  rooms?: Maybe<Scalars['Int']['output']>;
  searchRadiusMeters?: Maybe<Scalars['Int']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  squareFeet?: Maybe<Scalars['Int']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  totalFloors?: Maybe<Scalars['Int']['output']>;
  utilityCosts?: Maybe<Scalars['Float']['output']>;
  valuationConfidence?: Maybe<ValuationConfidence>;
  valuationHistory?: Maybe<Array<RealEstateValuationPoint>>;
  valuationMode?: Maybe<ValuationMode>;
  windowsCondition?: Maybe<Scalars['String']['output']>;
  windowsQuality?: Maybe<Scalars['String']['output']>;
  yearBuilt?: Maybe<Scalars['Int']['output']>;
  yearlyMiscCosts?: Maybe<Scalars['Float']['output']>;
  zipCode?: Maybe<Scalars['String']['output']>;
};

export type RealEstateEstimationInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  banId?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  cityCode?: InputMaybe<Scalars['String']['input']>;
  condition?: InputMaybe<Scalars['String']['input']>;
  energyLabel?: InputMaybe<Scalars['String']['input']>;
  hasOutdoor?: InputMaybe<Scalars['Boolean']['input']>;
  isGroundFloor?: InputMaybe<Scalars['Boolean']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  postcode?: InputMaybe<Scalars['String']['input']>;
  propertyType: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  roomsCount?: InputMaybe<Scalars['Int']['input']>;
  surfaceM2: Scalars['Float']['input'];
};

export type RealEstateEstimationResult = {
  __typename?: 'RealEstateEstimationResult';
  basePricePerM2?: Maybe<Scalars['Float']['output']>;
  comparablesCount: Scalars['Int']['output'];
  confidence: ValuationConfidence;
  estimatedMax?: Maybe<Scalars['Float']['output']>;
  estimatedMin?: Maybe<Scalars['Float']['output']>;
  estimatedPricePerM2?: Maybe<Scalars['Float']['output']>;
  estimatedValue?: Maybe<Scalars['Float']['output']>;
  lastEstimatedAt: Scalars['Time']['output'];
  method: EstimationMethod;
  rentalMarket?: Maybe<RealEstateRentalMarket>;
  searchRadiusMeters?: Maybe<Scalars['Int']['output']>;
};

export type RealEstateRentalMarket = {
  __typename?: 'RealEstateRentalMarket';
  estimatedGrossYield?: Maybe<Scalars['Float']['output']>;
  estimatedMonthlyRent?: Maybe<Scalars['Float']['output']>;
  isCommuneLevel: Scalars['Boolean']['output'];
  marketRentPerM2?: Maybe<Scalars['Float']['output']>;
  r2Adjusted?: Maybe<Scalars['Float']['output']>;
  sourceLabel: Scalars['String']['output'];
};

export type RealEstateValuationPoint = {
  __typename?: 'RealEstateValuationPoint';
  date: Scalars['Time']['output'];
  estimatedMax?: Maybe<Scalars['Float']['output']>;
  estimatedMin?: Maybe<Scalars['Float']['output']>;
  mode?: Maybe<Scalars['String']['output']>;
  value: Scalars['Float']['output'];
};

export type RealizedGainsSummary = {
  __typename?: 'RealizedGainsSummary';
  dateFrom: Scalars['Time']['output'];
  dateTo: Scalars['Time']['output'];
  dispositionCount: Scalars['Int']['output'];
  isTaxExempt: Scalars['Boolean']['output'];
  longTermGains: Scalars['Float']['output'];
  portfolioId: Scalars['ID']['output'];
  shortTermGains: Scalars['Float']['output'];
  taxJurisdiction: Scalars['String']['output'];
  taxWrapper: Scalars['String']['output'];
  totalRealized: Scalars['Float']['output'];
  transactionCount: Scalars['Int']['output'];
};

export type RebalanceRecommendation = {
  __typename?: 'RebalanceRecommendation';
  amount: Scalars['Float']['output'];
  assetType: Scalars['String']['output'];
  currentWeight: Scalars['Float']['output'];
  reason: Scalars['String']['output'];
  recommendedAction: Scalars['String']['output'];
  targetWeight: Scalars['Float']['output'];
};

export type RefreshAssetPricesResult = {
  __typename?: 'RefreshAssetPricesResult';
  errors?: Maybe<Array<Scalars['String']['output']>>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  updatedCount?: Maybe<Scalars['Int']['output']>;
};

export type RefreshTokenInput = {
  refreshToken: Scalars['String']['input'];
};

export type RegisterInput = {
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type ReorderPortfoliosInput = {
  portfolioOrders: Array<PortfolioOrderInput>;
  userID: Scalars['ID']['input'];
};

export enum ReportType {
  Annual = 'ANNUAL',
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Quarterly = 'QUARTERLY',
  Weekly = 'WEEKLY'
}

export type ResendVerificationInput = {
  email: Scalars['String']['input'];
};

export type RiskMetrics = {
  __typename?: 'RiskMetrics';
  diversification?: Maybe<Scalars['Float']['output']>;
  maxDrawdown?: Maybe<Scalars['Float']['output']>;
  sharpeRatio?: Maybe<Scalars['Float']['output']>;
  sortinoRatio?: Maybe<Scalars['Float']['output']>;
  volatility?: Maybe<Scalars['Float']['output']>;
};

export enum SortDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type StartLocalPackBuildInput = {
  assetTypes: Array<Scalars['String']['input']>;
  concurrentRequests?: InputMaybe<Scalars['Int']['input']>;
  historyEnd?: InputMaybe<Scalars['Time']['input']>;
  historyStart?: InputMaybe<Scalars['Time']['input']>;
  importPath?: InputMaybe<Scalars['String']['input']>;
  marketParquetLocalPath?: InputMaybe<Scalars['String']['input']>;
  marketParquetSourceMode?: InputMaybe<Scalars['String']['input']>;
  packId?: InputMaybe<Scalars['String']['input']>;
  portfolioFirst?: InputMaybe<Scalars['Boolean']['input']>;
  requestsPerDay?: InputMaybe<Scalars['Int']['input']>;
  requestsPerMinute?: InputMaybe<Scalars['Int']['input']>;
  sourceMode?: InputMaybe<Scalars['String']['input']>;
  sourceProvider: Scalars['String']['input'];
  universeInstrumentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type Stock = Asset & {
  __typename?: 'Stock';
  assetType: AssetType;
  buyingPrice?: Maybe<Scalars['Float']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  dividendYield?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  peRatio?: Maybe<Scalars['Float']['output']>;
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  quantity: Scalars['Float']['output'];
  sector?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  ticker: Scalars['String']['output'];
};

export type SyncConnection = {
  __typename?: 'SyncConnection';
  account?: Maybe<Account>;
  accountId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['Time']['output'];
  externalAccountId: Scalars['String']['output'];
  externalInstitutionId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  institutionName: Scalars['String']['output'];
  lastError?: Maybe<Scalars['String']['output']>;
  lastSyncAt?: Maybe<Scalars['Time']['output']>;
  portfolioId: Scalars['ID']['output'];
  provider: Scalars['String']['output'];
  syncStatus: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
};

export enum SyncConnectionStatus {
  Failed = 'FAILED',
  Idle = 'IDLE',
  Success = 'SUCCESS',
  Syncing = 'SYNCING'
}

export type SyncCredential = {
  __typename?: 'SyncCredential';
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  provider: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
};

export enum SyncProvider {
  Enablebanking = 'ENABLEBANKING',
  Gocardless = 'GOCARDLESS',
  Kraken = 'KRAKEN',
  Manual = 'MANUAL',
  Snaptrade = 'SNAPTRADE',
  Traderepublic = 'TRADEREPUBLIC',
  Woob = 'WOOB'
}

export type SyncRun = {
  __typename?: 'SyncRun';
  completedAt?: Maybe<Scalars['Time']['output']>;
  connectionId: Scalars['ID']['output'];
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  itemsImported: Scalars['Int']['output'];
  itemsUpdated: Scalars['Int']['output'];
  startedAt: Scalars['Time']['output'];
  status: Scalars['String']['output'];
};

export enum SyncRunStatus {
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  InProgress = 'IN_PROGRESS'
}

export enum SyncStatus {
  Complete = 'COMPLETE',
  Error = 'ERROR',
  Idle = 'IDLE',
  Syncing = 'SYNCING'
}

export type Tag = {
  __typename?: 'Tag';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type TaxHarvestOpportunity = {
  __typename?: 'TaxHarvestOpportunity';
  eligibleLotsCount: Scalars['Int']['output'];
  harvestableLoss: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  positionId: Scalars['ID']['output'];
  symbol: Scalars['String']['output'];
};

export type TaxLot = {
  __typename?: 'TaxLot';
  acquiredAt: Scalars['Time']['output'];
  assetId: Scalars['ID']['output'];
  costBasisPerUnit: Scalars['Float']['output'];
  currency: Scalars['String']['output'];
  currentPrice?: Maybe<Scalars['Float']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  holdingPeriodDays: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  initialQuantity: Scalars['Float']['output'];
  isLongTerm: Scalars['Boolean']['output'];
  portfolioId: Scalars['ID']['output'];
  positionId: Scalars['ID']['output'];
  remainingQuantity: Scalars['Float']['output'];
  status: Scalars['String']['output'];
  totalCostBasis: Scalars['Float']['output'];
  transactionId?: Maybe<Scalars['ID']['output']>;
  unrealizedGainLoss?: Maybe<Scalars['Float']['output']>;
  unrealizedGainLossPercent?: Maybe<Scalars['Float']['output']>;
};

export enum TaxLotAccountingMethod {
  Fifo = 'FIFO',
  Hifo = 'HIFO',
  Lifo = 'LIFO',
  LowestCost = 'LOWEST_COST',
  Pmp = 'PMP'
}

export type TaxLotDisposition = {
  __typename?: 'TaxLotDisposition';
  acquiredAt: Scalars['Time']['output'];
  assetId: Scalars['ID']['output'];
  costBasis: Scalars['Float']['output'];
  costBasisPerUnit: Scalars['Float']['output'];
  holdingPeriodDays: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isLongTerm: Scalars['Boolean']['output'];
  isTaxExempt: Scalars['Boolean']['output'];
  lotId: Scalars['ID']['output'];
  method: Scalars['String']['output'];
  portfolioId: Scalars['ID']['output'];
  positionId: Scalars['ID']['output'];
  proceeds: Scalars['Float']['output'];
  quantity: Scalars['Float']['output'];
  realizedGainLoss: Scalars['Float']['output'];
  sellPricePerUnit: Scalars['Float']['output'];
  soldAt: Scalars['Time']['output'];
  transactionId?: Maybe<Scalars['ID']['output']>;
};

export enum TaxWrapperType {
  CryptoVault = 'CRYPTO_VAULT',
  Pea = 'PEA',
  RetirementSheltered = 'RETIREMENT_SHELTERED',
  StandardTaxable = 'STANDARD_TAXABLE'
}

export type TechnicalIndicatorPoint = {
  __typename?: 'TechnicalIndicatorPoint';
  histogram?: Maybe<Scalars['Float']['output']>;
  lowerBand?: Maybe<Scalars['Float']['output']>;
  signal?: Maybe<Scalars['Float']['output']>;
  timestamp: Scalars['Time']['output'];
  upperBand?: Maybe<Scalars['Float']['output']>;
  value: Scalars['Float']['output'];
};

export type TechnicalIndicatorResponse = {
  __typename?: 'TechnicalIndicatorResponse';
  data: Array<TechnicalIndicatorPoint>;
  indicator: Scalars['String']['output'];
  source: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  timestamp: Scalars['Time']['output'];
};

export enum TimeAggregation {
  Day = 'DAY',
  Hour = 'HOUR',
  Minute = 'MINUTE',
  Month = 'MONTH',
  Quarter = 'QUARTER',
  Week = 'WEEK',
  Year = 'YEAR'
}

export type TimeRange = {
  __typename?: 'TimeRange';
  end: Scalars['Time']['output'];
  start: Scalars['Time']['output'];
};

export type TimeSeriesData = {
  __typename?: 'TimeSeriesData';
  aggregation: TimeAggregation;
  assetId?: Maybe<Scalars['ID']['output']>;
  dataPoints: Array<ChartDataPoint>;
  portfolioId?: Maybe<Scalars['ID']['output']>;
  timeRange: TimeRange;
};

export type TradeRepublicAuthPollResult = {
  __typename?: 'TradeRepublicAuthPollResult';
  connections?: Maybe<Array<SyncConnection>>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  status: TradeRepublicAuthStatus;
};

export type TradeRepublicAuthSession = {
  __typename?: 'TradeRepublicAuthSession';
  authSessionId: Scalars['ID']['output'];
  countdownSeconds: Scalars['Int']['output'];
  expiresAt: Scalars['Time']['output'];
  status: TradeRepublicAuthStatus;
};

export enum TradeRepublicAuthStatus {
  Completed = 'COMPLETED',
  Expired = 'EXPIRED',
  Rejected = 'REJECTED',
  WaitingForConfirmation = 'WAITING_FOR_CONFIRMATION'
}

export type Transaction = {
  __typename?: 'Transaction';
  account?: Maybe<Account>;
  accountId?: Maybe<Scalars['ID']['output']>;
  amount?: Maybe<Scalars['Float']['output']>;
  asset?: Maybe<Asset>;
  executedAt: Scalars['Time']['output'];
  feesAmount: Scalars['Float']['output'];
  feesCurrency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  portfolio: Portfolio;
  quantity: Scalars['Float']['output'];
  transactionType: TransactionType;
  unitPriceAmount?: Maybe<Scalars['Float']['output']>;
  unitPriceCurrency: Scalars['String']['output'];
};

export type TransactionFilter = {
  accountID?: InputMaybe<Scalars['ID']['input']>;
  assetID?: InputMaybe<Scalars['ID']['input']>;
  dateFrom?: InputMaybe<Scalars['Time']['input']>;
  dateTo?: InputMaybe<Scalars['Time']['input']>;
  portfolioID?: InputMaybe<Scalars['ID']['input']>;
  transactionType?: InputMaybe<TransactionType>;
  userID?: InputMaybe<Scalars['ID']['input']>;
};

export type TransactionOrder = {
  direction?: SortDirection;
  field?: TransactionOrderField;
};

export enum TransactionOrderField {
  ExecutedAt = 'EXECUTED_AT',
  Quantity = 'QUANTITY',
  UnitPriceAmount = 'UNIT_PRICE_AMOUNT'
}

export enum TransactionType {
  Adjustment = 'ADJUSTMENT',
  Buy = 'BUY',
  Deposit = 'DEPOSIT',
  Dividend = 'DIVIDEND',
  Fee = 'FEE',
  Interest = 'INTEREST',
  Sell = 'SELL',
  TransferIn = 'TRANSFER_IN',
  TransferOut = 'TRANSFER_OUT',
  Withdrawal = 'WITHDRAWAL'
}

export type TriggerFinanceDatabaseSyncPayload = {
  __typename?: 'TriggerFinanceDatabaseSyncPayload';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  syncStatus: FinanceDatabaseSyncItem;
};

export type UpdateAccountInput = {
  accountNumber?: InputMaybe<Scalars['String']['input']>;
  coOwnerName?: InputMaybe<Scalars['String']['input']>;
  coOwnerUserId?: InputMaybe<Scalars['ID']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  institution?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  ownershipPercentage?: InputMaybe<Scalars['Float']['input']>;
  taxWrapper?: InputMaybe<TaxWrapperType>;
  type?: InputMaybe<AccountType>;
};

export type UpdateAlertInput = {
  alertType?: InputMaybe<AlertType>;
  conditionType?: InputMaybe<ConditionType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  notificationMethods?: InputMaybe<Array<AlertNotificationMethod>>;
  thresholdPercentage?: InputMaybe<Scalars['Float']['input']>;
  thresholdValue?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateBlockchainNetworkConfigInput = {
  explorerApiUrl?: InputMaybe<Scalars['String']['input']>;
  network: BlockchainNetwork;
  rpcUrl: Scalars['String']['input'];
};

export type UpdateManualInstrumentInput = {
  assetType: InstrumentAssetType;
  baseCurrency?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  categoryGroup?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  exchange: Scalars['String']['input'];
  exchangeCode?: InputMaybe<Scalars['String']['input']>;
  family?: InputMaybe<Scalars['String']['input']>;
  industry?: InputMaybe<Scalars['String']['input']>;
  industryGroup?: InputMaybe<Scalars['String']['input']>;
  marketCap?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  quoteCurrency?: InputMaybe<Scalars['String']['input']>;
  sector?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  summary?: InputMaybe<Scalars['String']['input']>;
  symbol: Scalars['String']['input'];
  underlyingSymbol?: InputMaybe<Scalars['String']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
  zipcode?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePortfolioInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  taxWrapper?: InputMaybe<TaxWrapperType>;
};

export type UpdateRealEstateInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  addressLabel?: InputMaybe<Scalars['String']['input']>;
  agencyFees?: InputMaybe<Scalars['Float']['input']>;
  banId?: InputMaybe<Scalars['String']['input']>;
  bathroomCondition?: InputMaybe<Scalars['String']['input']>;
  bathroomQuality?: InputMaybe<Scalars['String']['input']>;
  bathrooms?: InputMaybe<Scalars['Float']['input']>;
  bedrooms?: InputMaybe<Scalars['Int']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  cityCode?: InputMaybe<Scalars['String']['input']>;
  condition?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  energyLabel?: InputMaybe<Scalars['String']['input']>;
  floor?: InputMaybe<Scalars['Int']['input']>;
  flooringCondition?: InputMaybe<Scalars['String']['input']>;
  flooringQuality?: InputMaybe<Scalars['String']['input']>;
  furnishingCosts?: InputMaybe<Scalars['Float']['input']>;
  garages?: InputMaybe<Scalars['Int']['input']>;
  generalCondition?: InputMaybe<Scalars['String']['input']>;
  generalQuality?: InputMaybe<Scalars['String']['input']>;
  hasBalcony?: InputMaybe<Scalars['Boolean']['input']>;
  hasGarden?: InputMaybe<Scalars['Boolean']['input']>;
  hasLift?: InputMaybe<Scalars['Boolean']['input']>;
  hasOutdoor?: InputMaybe<Scalars['Boolean']['input']>;
  hasPool?: InputMaybe<Scalars['Boolean']['input']>;
  hasSauna?: InputMaybe<Scalars['Boolean']['input']>;
  isFurnished?: InputMaybe<Scalars['Boolean']['input']>;
  isGroundFloor?: InputMaybe<Scalars['Boolean']['input']>;
  isNewConstruction?: InputMaybe<Scalars['Boolean']['input']>;
  kitchenCondition?: InputMaybe<Scalars['String']['input']>;
  kitchenQuality?: InputMaybe<Scalars['String']['input']>;
  landSurface?: InputMaybe<Scalars['Float']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  linkedLoanId?: InputMaybe<Scalars['ID']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  manualValue?: InputMaybe<Scalars['Float']['input']>;
  monthlyRent?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notaryFees?: InputMaybe<Scalars['Float']['input']>;
  ownershipPercentage?: InputMaybe<Scalars['Float']['input']>;
  ownershipStructure?: InputMaybe<Scalars['String']['input']>;
  parkingSpaces?: InputMaybe<Scalars['Int']['input']>;
  propertyType?: InputMaybe<Scalars['String']['input']>;
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  renovationFees?: InputMaybe<Scalars['Float']['input']>;
  rentalPeriod?: InputMaybe<Scalars['String']['input']>;
  rentalType?: InputMaybe<Scalars['String']['input']>;
  rooms?: InputMaybe<Scalars['Int']['input']>;
  squareFeet?: InputMaybe<Scalars['Int']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  totalFloors?: InputMaybe<Scalars['Int']['input']>;
  utilityCosts?: InputMaybe<Scalars['Float']['input']>;
  valuationMode?: InputMaybe<ValuationMode>;
  windowsCondition?: InputMaybe<Scalars['String']['input']>;
  windowsQuality?: InputMaybe<Scalars['String']['input']>;
  yearBuilt?: InputMaybe<Scalars['Int']['input']>;
  yearlyMiscCosts?: InputMaybe<Scalars['Float']['input']>;
  zipCode?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTransactionInput = {
  executedAt?: InputMaybe<Scalars['Time']['input']>;
  feesAmount?: InputMaybe<Scalars['Float']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  unitPriceAmount?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateUserDisplayCurrencyInput = {
  displayCurrency: Scalars['String']['input'];
};

export type UpdateUserInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
  taxJurisdiction?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserTaxJurisdictionInput = {
  taxJurisdiction: Scalars['String']['input'];
};

export type UpdateUserThemePreferencesInput = {
  themeAccentColor: Scalars['String']['input'];
  themeBaseColor: Scalars['String']['input'];
  themeFontPreference: Scalars['String']['input'];
  themeHeadingFont: Scalars['String']['input'];
  themeMenuAccent: Scalars['String']['input'];
  themeMenuColor: Scalars['String']['input'];
  themePreference: Scalars['String']['input'];
  themeRTL: Scalars['Boolean']['input'];
  themeRadius: Scalars['Float']['input'];
  themeStyle: Scalars['String']['input'];
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['Time']['output'];
  displayCurrency: Scalars['String']['output'];
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  failedLoginCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isLocked: Scalars['Boolean']['output'];
  lastLoginAt?: Maybe<Scalars['Time']['output']>;
  lockedUntil?: Maybe<Scalars['Time']['output']>;
  portfolios: Array<Portfolio>;
  role: Scalars['String']['output'];
  taxJurisdiction: Scalars['String']['output'];
  themeAccentColor: Scalars['String']['output'];
  themeBaseColor: Scalars['String']['output'];
  themeFontPreference: Scalars['String']['output'];
  themeHeadingFont: Scalars['String']['output'];
  themeMenuAccent: Scalars['String']['output'];
  themeMenuColor: Scalars['String']['output'];
  themePreference: Scalars['String']['output'];
  themeRTL: Scalars['Boolean']['output'];
  themeRadius: Scalars['Float']['output'];
  themeStyle: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
  username: Scalars['String']['output'];
  watchlists: Array<Watchlist>;
};

export type UserFilter = {
  email?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  usernameContains?: InputMaybe<Scalars['String']['input']>;
};

export type UserOrder = {
  direction?: SortDirection;
  field?: UserOrderField;
};

export enum UserOrderField {
  CreatedAt = 'CREATED_AT',
  Email = 'EMAIL',
  Username = 'USERNAME'
}

export type ValidationResult = {
  __typename?: 'ValidationResult';
  message?: Maybe<Scalars['String']['output']>;
  valid: Scalars['Boolean']['output'];
};

export enum ValuationConfidence {
  High = 'HIGH',
  Low = 'LOW',
  Medium = 'MEDIUM',
  Unavailable = 'UNAVAILABLE'
}

export enum ValuationMode {
  Auto = 'AUTO',
  Manual = 'MANUAL'
}

export type WalletAccount = {
  __typename?: 'WalletAccount';
  addressOrXpub: Scalars['String']['output'];
  balances: Array<WalletBalance>;
  capabilityLevel: WalletCapabilityLevel;
  createdAt: Scalars['Time']['output'];
  device?: Maybe<WalletDevice>;
  deviceId?: Maybe<Scalars['ID']['output']>;
  discoveredAddresses?: Maybe<Scalars['String']['output']>;
  historyStatus: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isXpub: Scalars['Boolean']['output'];
  label?: Maybe<Scalars['String']['output']>;
  lastSyncAt?: Maybe<Scalars['Time']['output']>;
  lastSyncError?: Maybe<Scalars['String']['output']>;
  network: BlockchainNetwork;
  portfolioId?: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['Time']['output'];
};


export type WalletAccountBalancesArgs = {
  includeSpam?: InputMaybe<Scalars['Boolean']['input']>;
};

export type WalletActivityReview = {
  __typename?: 'WalletActivityReview';
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  reviewStatus: Scalars['String']['output'];
  suggestedType: Scalars['String']['output'];
  walletActivityId: Scalars['ID']['output'];
};

export type WalletBalance = {
  __typename?: 'WalletBalance';
  acquiredAt?: Maybe<Scalars['Time']['output']>;
  autoEstimatedBasis?: Maybe<Scalars['Float']['output']>;
  costBasisCurrency?: Maybe<Scalars['String']['output']>;
  costBasisPerUnit?: Maybe<Scalars['Float']['output']>;
  costBasisType?: Maybe<Scalars['String']['output']>;
  currentPrice?: Maybe<Scalars['Float']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange24h?: Maybe<Scalars['Float']['output']>;
  decimals: Scalars['Int']['output'];
  formattedQuantity: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  isHidden: Scalars['Boolean']['output'];
  isPriceResolved: Scalars['Boolean']['output'];
  isSpam: Scalars['Boolean']['output'];
  isStale: Scalars['Boolean']['output'];
  lastUpdatedAt: Scalars['Time']['output'];
  name?: Maybe<Scalars['String']['output']>;
  priceSource?: Maybe<Scalars['String']['output']>;
  priceUpdatedAt?: Maybe<Scalars['Time']['output']>;
  rawBalance: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  tokenAddress?: Maybe<Scalars['String']['output']>;
};

export type WalletCuUsage = {
  __typename?: 'WalletCUUsage';
  billingMonth: Scalars['String']['output'];
  consumedUnits: Scalars['Int']['output'];
  hasKey: Scalars['Boolean']['output'];
  isThrottled: Scalars['Boolean']['output'];
  keySource?: Maybe<Scalars['String']['output']>;
  maskedKey?: Maybe<Scalars['String']['output']>;
  maxQuota: Scalars['Int']['output'];
};

export enum WalletCapabilityLevel {
  ActivityIndexed = 'ACTIVITY_INDEXED',
  BalanceOnly = 'BALANCE_ONLY',
  EnhancedHistory = 'ENHANCED_HISTORY'
}

export type WalletDevice = {
  __typename?: 'WalletDevice';
  accounts: Array<WalletAccount>;
  createdAt: Scalars['Time']['output'];
  deviceType: WalletDeviceType;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
};

export enum WalletDeviceType {
  Hardware = 'HARDWARE',
  Software = 'SOFTWARE',
  Standalone = 'STANDALONE'
}

export type Watch = Asset & {
  __typename?: 'Watch';
  assetType: AssetType;
  brand: Scalars['String']['output'];
  caseSize?: Maybe<Scalars['Float']['output']>;
  condition: Scalars['String']['output'];
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  material: Scalars['String']['output'];
  model: Scalars['String']['output'];
  movement: Scalars['String']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  referenceNumber?: Maybe<Scalars['String']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  serialNumber?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  waterResistance?: Maybe<Scalars['Int']['output']>;
  yearMade?: Maybe<Scalars['Int']['output']>;
};

export type Watchlist = {
  __typename?: 'Watchlist';
  assets: Array<Asset>;
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
  user: User;
};

export type WatchlistFilter = {
  userID: Scalars['ID']['input'];
};

export type WoobAuthPollResult = {
  __typename?: 'WoobAuthPollResult';
  connections?: Maybe<Array<SyncConnection>>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  status: WoobAuthStatus;
};

export type WoobAuthSession = {
  __typename?: 'WoobAuthSession';
  authSessionId: Scalars['ID']['output'];
  challengeMessage?: Maybe<Scalars['String']['output']>;
  countdownSeconds: Scalars['Int']['output'];
  expiresAt: Scalars['Time']['output'];
  status: WoobAuthStatus;
};

export enum WoobAuthStatus {
  Completed = 'COMPLETED',
  Expired = 'EXPIRED',
  Rejected = 'REJECTED',
  WaitingForCode = 'WAITING_FOR_CODE',
  WaitingForConfirmation = 'WAITING_FOR_CONFIRMATION'
}

export type CreateAccountMutationVariables = Exact<{
  input: CreateAccountInput;
}>;


export type CreateAccountMutation = { __typename?: 'Mutation', createAccount: { __typename?: 'Account', id: string, portfolioId: string, name: string, type: AccountType, taxWrapper: TaxWrapperType, institution?: string | null, accountNumber?: string | null, currency: string, syncProvider: string, ownershipPercentage: number, coOwnerName?: string | null, coOwnerUserId?: string | null, externalId?: string | null, positionsCount: number, totalValue?: number | null, createdAt: any, updatedAt: any, coOwnerUser?: { __typename?: 'User', id: string, username: string, email: string } | null, syncConnection?: { __typename?: 'SyncConnection', id: string, provider: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null } | null } };

export type UpdateAccountMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAccountInput;
}>;


export type UpdateAccountMutation = { __typename?: 'Mutation', updateAccount: { __typename?: 'Account', id: string, portfolioId: string, name: string, type: AccountType, taxWrapper: TaxWrapperType, institution?: string | null, accountNumber?: string | null, currency: string, syncProvider: string, ownershipPercentage: number, coOwnerName?: string | null, coOwnerUserId?: string | null, externalId?: string | null, positionsCount: number, totalValue?: number | null, createdAt: any, updatedAt: any, coOwnerUser?: { __typename?: 'User', id: string, username: string, email: string } | null, syncConnection?: { __typename?: 'SyncConnection', id: string, provider: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null } | null } };

export type DeleteAccountMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAccountMutation = { __typename?: 'Mutation', deleteAccount: boolean };

export type AdminCreateUserMutationVariables = Exact<{
  input: AdminCreateUserInput;
}>;


export type AdminCreateUserMutation = { __typename?: 'Mutation', adminCreateUser: { __typename?: 'User', id: string, username: string, email: string, role: string, emailVerified: boolean, createdAt: any, updatedAt: any, displayCurrency: string, taxJurisdiction: string, isLocked: boolean, failedLoginCount: number } };

export type AdminUpdateUserMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: AdminUpdateUserInput;
}>;


export type AdminUpdateUserMutation = { __typename?: 'Mutation', adminUpdateUser: { __typename?: 'User', id: string, username: string, email: string, role: string, displayCurrency: string, taxJurisdiction: string, updatedAt: any } };

export type AdminSetUserRoleMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  role: Scalars['String']['input'];
}>;


export type AdminSetUserRoleMutation = { __typename?: 'Mutation', adminSetUserRole: { __typename?: 'User', id: string, role: string, updatedAt: any } };

export type AdminSetUserLockMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  locked: Scalars['Boolean']['input'];
  lockUntil?: InputMaybe<Scalars['Time']['input']>;
}>;


export type AdminSetUserLockMutation = { __typename?: 'Mutation', adminSetUserLock: { __typename?: 'User', id: string, lockedUntil?: any | null, isLocked: boolean, failedLoginCount: number, updatedAt: any } };

export type AdminSetUserPasswordMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  password: Scalars['String']['input'];
}>;


export type AdminSetUserPasswordMutation = { __typename?: 'Mutation', adminSetUserPassword: boolean };

export type AdminSetUserEmailVerifiedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  verified: Scalars['Boolean']['input'];
}>;


export type AdminSetUserEmailVerifiedMutation = { __typename?: 'Mutation', adminSetUserEmailVerified: { __typename?: 'User', id: string, emailVerified: boolean, updatedAt: any } };

export type AdminDeleteUserMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  hardDelete?: Scalars['Boolean']['input'];
}>;


export type AdminDeleteUserMutation = { __typename?: 'Mutation', adminDeleteUser: boolean };

export type AlertResultFragment = { __typename?: 'Alert', id: string, userId: string, assetId?: string | null, portfolioId?: string | null, alertType: AlertType, conditionType: ConditionType, thresholdValue?: number | null, thresholdPercentage?: number | null, isActive: boolean, lastTriggered?: any | null, notificationMethods: Array<AlertNotificationMethod>, createdAt: any, updatedAt: any } & { ' $fragmentName'?: 'AlertResultFragment' };

export type CreateAlertMutationVariables = Exact<{
  input: CreateAlertInput;
}>;


export type CreateAlertMutation = { __typename?: 'Mutation', createAlert: (
    { __typename?: 'Alert' }
    & { ' $fragmentRefs'?: { 'AlertResultFragment': AlertResultFragment } }
  ) };

export type CreateStockAssetMutationVariables = Exact<{
  input: CreateStockInput;
}>;


export type CreateStockAssetMutation = { __typename?: 'Mutation', createStockAsset: { __typename?: 'Stock', id: string, name: string, symbol?: string | null, ticker: string, quantity: number, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type CreateBankAccountAssetMutationVariables = Exact<{
  input: CreateBankAccountInput;
}>;


export type CreateBankAccountAssetMutation = { __typename?: 'Mutation', createBankAccountAsset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, accountType: string, institution: string, accountNumber: string, currency: string, interestRate?: number | null, balance?: number | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type CreateCryptoAssetMutationVariables = Exact<{
  input: CreateCryptoInput;
}>;


export type CreateCryptoAssetMutation = { __typename?: 'Mutation', createCryptoAsset: { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, walletAddress?: string | null, blockchainNetwork?: string | null, quantity: number, currentValue?: number | null, purchasePrice?: number | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type CreateRealEstateAssetMutationVariables = Exact<{
  input: CreateRealEstateInput;
}>;


export type CreateRealEstateAssetMutation = { __typename?: 'Mutation', createRealEstateAsset: { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, propertyType: string, category?: string | null, address: string, city: string, state?: string | null, country: string, zipCode?: string | null, squareFeet?: number | null, landSurface?: number | null, yearBuilt?: number | null, bedrooms?: number | null, bathrooms?: number | null, rooms?: number | null, floor?: number | null, totalFloors?: number | null, garages?: number | null, parkingSpaces?: number | null, energyLabel?: string | null, condition?: string | null, agencyFees?: number | null, notaryFees?: number | null, renovationFees?: number | null, furnishingCosts?: number | null, rentalType?: string | null, rentalPeriod?: string | null, monthlyRent?: number | null, utilityCosts?: number | null, yearlyMiscCosts?: number | null, hasGarden?: boolean | null, hasBalcony?: boolean | null, hasLift?: boolean | null, hasPool?: boolean | null, hasSauna?: boolean | null, isFurnished?: boolean | null, isNewConstruction?: boolean | null, kitchenQuality?: string | null, kitchenCondition?: string | null, bathroomQuality?: string | null, bathroomCondition?: string | null, flooringQuality?: string | null, flooringCondition?: string | null, windowsQuality?: string | null, windowsCondition?: string | null, generalQuality?: string | null, generalCondition?: string | null, linkedLoanId?: string | null, ownershipPercentage?: number | null, ownershipStructure?: string | null, addressLabel?: string | null, cityCode?: string | null, banId?: string | null, latitude?: number | null, longitude?: number | null, hasOutdoor?: boolean | null, isGroundFloor?: boolean | null, valuationMode?: ValuationMode | null, estimationMethod?: EstimationMethod | null, manualValue?: number | null, estimatedValue?: number | null, estimatedMin?: number | null, estimatedMax?: number | null, estimatedPricePerM2?: number | null, basePricePerM2?: number | null, valuationConfidence?: ValuationConfidence | null, comparablesCount?: number | null, searchRadiusMeters?: number | null, lastEstimatedAt?: any | null, marketRentPerM2?: number | null, estimatedMonthlyRent?: number | null, estimatedGrossYield?: number | null, rentalR2Adjusted?: number | null, dayChange?: number | null, dayChangePercent?: number | null, valuationHistory?: Array<{ __typename?: 'RealEstateValuationPoint', date: any, value: number, mode?: string | null, estimatedMin?: number | null, estimatedMax?: number | null }> | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type UpdateRealEstateAssetMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateRealEstateInput;
}>;


export type UpdateRealEstateAssetMutation = { __typename?: 'Mutation', updateRealEstateAsset: { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, propertyType: string, category?: string | null, address: string, city: string, state?: string | null, country: string, zipCode?: string | null, squareFeet?: number | null, landSurface?: number | null, yearBuilt?: number | null, bedrooms?: number | null, bathrooms?: number | null, rooms?: number | null, floor?: number | null, totalFloors?: number | null, garages?: number | null, parkingSpaces?: number | null, energyLabel?: string | null, condition?: string | null, agencyFees?: number | null, notaryFees?: number | null, renovationFees?: number | null, furnishingCosts?: number | null, rentalType?: string | null, rentalPeriod?: string | null, monthlyRent?: number | null, utilityCosts?: number | null, yearlyMiscCosts?: number | null, hasGarden?: boolean | null, hasBalcony?: boolean | null, hasLift?: boolean | null, hasPool?: boolean | null, hasSauna?: boolean | null, isFurnished?: boolean | null, isNewConstruction?: boolean | null, kitchenQuality?: string | null, kitchenCondition?: string | null, bathroomQuality?: string | null, bathroomCondition?: string | null, flooringQuality?: string | null, flooringCondition?: string | null, windowsQuality?: string | null, windowsCondition?: string | null, generalQuality?: string | null, generalCondition?: string | null, linkedLoanId?: string | null, ownershipPercentage?: number | null, ownershipStructure?: string | null, addressLabel?: string | null, cityCode?: string | null, banId?: string | null, latitude?: number | null, longitude?: number | null, hasOutdoor?: boolean | null, isGroundFloor?: boolean | null, valuationMode?: ValuationMode | null, estimationMethod?: EstimationMethod | null, manualValue?: number | null, estimatedValue?: number | null, estimatedMin?: number | null, estimatedMax?: number | null, estimatedPricePerM2?: number | null, basePricePerM2?: number | null, valuationConfidence?: ValuationConfidence | null, comparablesCount?: number | null, searchRadiusMeters?: number | null, lastEstimatedAt?: any | null, marketRentPerM2?: number | null, estimatedMonthlyRent?: number | null, estimatedGrossYield?: number | null, rentalR2Adjusted?: number | null, dayChange?: number | null, dayChangePercent?: number | null, valuationHistory?: Array<{ __typename?: 'RealEstateValuationPoint', date: any, value: number, mode?: string | null, estimatedMin?: number | null, estimatedMax?: number | null }> | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type CreateLifeInsuranceAssetMutationVariables = Exact<{
  input: CreateLifeInsuranceInput;
}>;


export type CreateLifeInsuranceAssetMutation = { __typename?: 'Mutation', createLifeInsuranceAsset: { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, policyNumber: string, insurer: string, policyType: string, coverageAmount: number, premiumAmount: number, premiumFrequency: string, beneficiaries: Array<string>, maturityDate?: any | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type CreateWatchAssetMutationVariables = Exact<{
  input: CreateWatchInput;
}>;


export type CreateWatchAssetMutation = { __typename?: 'Mutation', createWatchAsset: { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, brand: string, model: string, serialNumber?: string | null, referenceNumber?: string | null, condition: string, yearMade?: number | null, material: string, movement: string, caseSize?: number | null, waterResistance?: number | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type CreateLoanAssetMutationVariables = Exact<{
  input: CreateLoanInput;
}>;


export type CreateLoanAssetMutation = { __typename?: 'Mutation', createLoanAsset: { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, description?: string | null, loanType: string, loanAmount: number, remainingBalance: number, interestRate?: number | null, durationMonths: number, monthlyPayment: number, startDate: string, endDate?: string | null, lender: string, loanNumber?: string | null, currency: string, downPayment?: number | null, status: string, ownershipMode?: string | null, applicationFee?: number | null, brokerFee?: number | null, insuranceFee?: number | null, otherFees?: number | null, earlyRepaymentFee?: number | null, linkedAssetIDs?: Array<string> | null, ownershipPercentage?: number | null, dayChange?: number | null, dayChangePercent?: number | null, steps?: Array<{ __typename?: 'LoanStep', id: string, date?: string | null, amount: number, interestRate: number }> | null, coOwners?: Array<{ __typename?: 'LoanCoOwner', id: string, type: string, userId?: string | null, name: string, percentage: number }> | null, companyOwners?: Array<{ __typename?: 'LoanCompanyOwner', id: string, type: string, companyId?: string | null, name: string, registrationNumber?: string | null, legalForm?: string | null, percentage: number }> | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type AddAssetToPortfolioMutationVariables = Exact<{
  input: PortfolioAssetInput;
}>;


export type AddAssetToPortfolioMutation = { __typename?: 'Mutation', addAssetToPortfolio: { __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } } };

export type RefreshSingleAssetPriceMutationVariables = Exact<{
  assetId: Scalars['ID']['input'];
}>;


export type RefreshSingleAssetPriceMutation = { __typename?: 'Mutation', refreshSingleAssetPrice: { __typename?: 'AssetPricePoint', id: string, assetId: string, price: number, timestamp: any, source: string } };

export type RefreshRealEstateValuationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RefreshRealEstateValuationMutation = { __typename?: 'Mutation', refreshRealEstateValuation: { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, propertyType: string, category?: string | null, address: string, city: string, state?: string | null, country: string, zipCode?: string | null, squareFeet?: number | null, landSurface?: number | null, yearBuilt?: number | null, bedrooms?: number | null, bathrooms?: number | null, rooms?: number | null, floor?: number | null, totalFloors?: number | null, garages?: number | null, parkingSpaces?: number | null, energyLabel?: string | null, condition?: string | null, addressLabel?: string | null, cityCode?: string | null, banId?: string | null, latitude?: number | null, longitude?: number | null, hasOutdoor?: boolean | null, isGroundFloor?: boolean | null, valuationMode?: ValuationMode | null, estimationMethod?: EstimationMethod | null, manualValue?: number | null, estimatedValue?: number | null, estimatedMin?: number | null, estimatedMax?: number | null, estimatedPricePerM2?: number | null, basePricePerM2?: number | null, valuationConfidence?: ValuationConfidence | null, comparablesCount?: number | null, searchRadiusMeters?: number | null, lastEstimatedAt?: any | null, marketRentPerM2?: number | null, estimatedMonthlyRent?: number | null, estimatedGrossYield?: number | null, rentalR2Adjusted?: number | null, dayChange?: number | null, dayChangePercent?: number | null, valuationHistory?: Array<{ __typename?: 'RealEstateValuationPoint', date: any, value: number, mode?: string | null, estimatedMin?: number | null, estimatedMax?: number | null }> | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type RegisterMutationVariables = Exact<{
  input: RegisterInput;
}>;


export type RegisterMutation = { __typename?: 'Mutation', register: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean, displayCurrency: string, themePreference: string, themeBaseColor: string, themeAccentColor: string, themeFontPreference: string, themeHeadingFont: string, themeMenuAccent: string, themeMenuColor: string, themeStyle: string, themeRadius: number, themeRTL: boolean } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean, displayCurrency: string, themePreference: string, themeBaseColor: string, themeAccentColor: string, themeFontPreference: string, themeHeadingFont: string, themeMenuAccent: string, themeMenuColor: string, themeStyle: string, themeRadius: number, themeRTL: boolean } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type LogoutMutationVariables = Exact<{
  input: LogoutInput;
}>;


export type LogoutMutation = { __typename?: 'Mutation', logout: { __typename?: 'LogoutResponse', success: boolean, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type ResetPasswordMutationVariables = Exact<{
  input: PasswordResetInput;
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', resetPassword: { __typename?: 'PasswordResetResponse', success: boolean, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type ConfirmPasswordResetMutationVariables = Exact<{
  input: PasswordResetConfirmInput;
}>;


export type ConfirmPasswordResetMutation = { __typename?: 'Mutation', confirmPasswordReset: { __typename?: 'PasswordResetResponse', success: boolean, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type VerifyEmailMutationVariables = Exact<{
  input: EmailVerificationInput;
}>;


export type VerifyEmailMutation = { __typename?: 'Mutation', verifyEmail: { __typename?: 'EmailVerificationResponse', success: boolean, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type ResendVerificationMutationVariables = Exact<{
  input: ResendVerificationInput;
}>;


export type ResendVerificationMutation = { __typename?: 'Mutation', resendVerification: { __typename?: 'EmailVerificationResponse', success: boolean, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type RefreshTokenMutationVariables = Exact<{
  input: RefreshTokenInput;
}>;


export type RefreshTokenMutation = { __typename?: 'Mutation', refreshToken: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean, displayCurrency: string, themePreference: string, themeBaseColor: string, themeAccentColor: string, themeFontPreference: string, themeHeadingFont: string, themeMenuAccent: string, themeMenuColor: string, themeStyle: string, themeRadius: number, themeRTL: boolean } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type PersistDiscoveredInstrumentMutationVariables = Exact<{
  input: PersistDiscoveredInstrumentInput;
}>;


export type PersistDiscoveredInstrumentMutation = { __typename?: 'Mutation', persistDiscoveredInstrument: { __typename?: 'Instrument', id: string, symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, sector?: string | null, assetType: InstrumentAssetType, providerSource: string, providerExternalId?: string | null, isin?: string | null, figi?: string | null, cusip?: string | null, firstSeenAt: any, lastVerifiedAt?: any | null, lastUsedAt?: any | null, createdAt: any, updatedAt: any } };

export type ImportInstrumentFromSourceMutationVariables = Exact<{
  input: ImportInstrumentFromSourceInput;
}>;


export type ImportInstrumentFromSourceMutation = { __typename?: 'Mutation', importInstrumentFromSource: { __typename?: 'ImportInstrumentFromSourcePayload', success: boolean, message: string, instrument?: { __typename?: 'Instrument', id: string, symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, sector?: string | null, assetType: InstrumentAssetType, providerSource: string, providerExternalId?: string | null, isin?: string | null, figi?: string | null, cusip?: string | null, firstSeenAt: any, lastVerifiedAt?: any | null, lastUsedAt?: any | null, createdAt: any, updatedAt: any } | null } };

export type ImportInstrumentFromCatalogMutationVariables = Exact<{
  source: CatalogSource;
  externalId: Scalars['String']['input'];
  forceEnrich?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type ImportInstrumentFromCatalogMutation = { __typename?: 'Mutation', importInstrumentFromCatalog: { __typename?: 'ImportInstrumentFromSourcePayload', success: boolean, message: string, instrument?: { __typename?: 'Instrument', id: string, symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, sector?: string | null, assetType: InstrumentAssetType, providerSource: string, providerExternalId?: string | null, isin?: string | null, figi?: string | null, cusip?: string | null, firstSeenAt: any, lastVerifiedAt?: any | null, lastUsedAt?: any | null, createdAt: any, updatedAt: any } | null } };

export type AddInstrumentToPortfolioMutationVariables = Exact<{
  input: AddInstrumentHoldingInput;
}>;


export type AddInstrumentToPortfolioMutation = { __typename?: 'Mutation', addInstrumentToPortfolio: { __typename?: 'PortfolioAsset', instrumentID?: string | null, quantity: number, averagePurchasePrice?: number | null, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null, asset: { __typename?: 'BankAccount', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } | { __typename?: 'Crypto', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } | { __typename?: 'Fund', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } | { __typename?: 'LifeInsurance', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } | { __typename?: 'Loan', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } | { __typename?: 'RealEstate', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } | { __typename?: 'Stock', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } | { __typename?: 'Watch', id: string, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } } };

export type UpdateManualInstrumentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateManualInstrumentInput;
}>;


export type UpdateManualInstrumentMutation = { __typename?: 'Mutation', updateManualInstrument: { __typename?: 'Instrument', id: string, symbol: string, normalizedSymbol: string, name: string, normalizedName: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, baseCurrency?: string | null, quoteCurrency?: string | null, underlyingSymbol?: string | null, assetType: InstrumentAssetType, status: string, providerSource: string, providerExternalId?: string | null, firstSeenAt: any, lastVerifiedAt?: any | null, lastUsedAt?: any | null, createdAt: any, updatedAt: any, syncState?: { __typename?: 'InstrumentSyncState', instrumentID: string, syncStatus: string, stale: boolean, verificationConfidence: number, lastSyncAttempt?: any | null, lastSyncSuccess?: any | null, lastSyncSource?: string | null, syncErrorMessage?: string | null, createdAt: any, updatedAt: any } | null } };

export type ArchiveManualInstrumentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ArchiveManualInstrumentMutation = { __typename?: 'Mutation', archiveManualInstrument: { __typename?: 'Instrument', id: string, status: string, syncState?: { __typename?: 'InstrumentSyncState', instrumentID: string, syncStatus: string, stale: boolean, verificationConfidence: number, lastSyncAttempt?: any | null, lastSyncSuccess?: any | null, lastSyncSource?: string | null, syncErrorMessage?: string | null, createdAt: any, updatedAt: any } | null } };

export type RestoreManualInstrumentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RestoreManualInstrumentMutation = { __typename?: 'Mutation', restoreManualInstrument: { __typename?: 'Instrument', id: string, status: string, syncState?: { __typename?: 'InstrumentSyncState', instrumentID: string, syncStatus: string, stale: boolean, verificationConfidence: number, lastSyncAttempt?: any | null, lastSyncSuccess?: any | null, lastSyncSource?: string | null, syncErrorMessage?: string | null, createdAt: any, updatedAt: any } | null } };

export type RetryHistoricalDataBackfillJobMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RetryHistoricalDataBackfillJobMutation = { __typename?: 'Mutation', retryHistoricalDataBackfillJob: { __typename?: 'HistoricalDataBackfillJob', id: string, status: string, step: string, progress: number, errorCode?: string | null, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type UpsertMarketDataCredentialMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  apiKey: Scalars['String']['input'];
  isEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UpsertMarketDataCredentialMutation = { __typename?: 'Mutation', upsertMarketDataCredential: { __typename?: 'MarketDataCredential', id: string, provider: string, isEnabled: boolean, priority: number, lastValidatedAt?: any | null, createdAt: any, updatedAt: any } };

export type DeleteMarketDataCredentialMutationVariables = Exact<{
  provider: Scalars['String']['input'];
}>;


export type DeleteMarketDataCredentialMutation = { __typename?: 'Mutation', deleteMarketDataCredential: string };

export type ValidateProviderCredentialsMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  apiKey: Scalars['String']['input'];
}>;


export type ValidateProviderCredentialsMutation = { __typename?: 'Mutation', validateProviderCredentials: { __typename?: 'ValidationResult', valid: boolean, message?: string | null } };

export type UpdateProviderRoutingPreferencesMutationVariables = Exact<{
  input: ProviderRoutingPreferencesInput;
}>;


export type UpdateProviderRoutingPreferencesMutation = { __typename?: 'Mutation', updateProviderRoutingPreferences: { __typename?: 'ProviderRoutingPreferences', id: string, userId: string, useIntelligentRouting: boolean, enableFallback: boolean, staleDataThresholdMinutes: number, createdAt: any, updatedAt: any, preferredProviders: Array<{ __typename?: 'ProviderPreference', provider: string, priority: number, enabled: boolean }> } };

export type InstallMarketDataPackMutationVariables = Exact<{
  packId: Scalars['ID']['input'];
}>;


export type InstallMarketDataPackMutation = { __typename?: 'Mutation', installMarketDataPack: { __typename?: 'MarketDataPackJob', id: string, packId: string, jobType: string, status: string, progressPercent: number, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type UpdateMarketDataPackMutationVariables = Exact<{
  packId: Scalars['ID']['input'];
}>;


export type UpdateMarketDataPackMutation = { __typename?: 'Mutation', updateMarketDataPack: { __typename?: 'MarketDataPackJob', id: string, packId: string, jobType: string, status: string, progressPercent: number, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type RemoveMarketDataPackMutationVariables = Exact<{
  packId: Scalars['ID']['input'];
}>;


export type RemoveMarketDataPackMutation = { __typename?: 'Mutation', removeMarketDataPack: { __typename?: 'MarketDataPackJob', id: string, packId: string, jobType: string, status: string, progressPercent: number, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type RepairMarketDataPackMutationVariables = Exact<{
  packId: Scalars['ID']['input'];
}>;


export type RepairMarketDataPackMutation = { __typename?: 'Mutation', repairMarketDataPack: { __typename?: 'MarketDataPackJob', id: string, packId: string, jobType: string, status: string, progressPercent: number, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type CancelMarketDataPackJobMutationVariables = Exact<{
  jobId: Scalars['ID']['input'];
}>;


export type CancelMarketDataPackJobMutation = { __typename?: 'Mutation', cancelMarketDataPackJob: { __typename?: 'MarketDataPackJob', id: string, packId: string, jobType: string, status: string, progressPercent: number, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type StartLocalPackBuildMutationVariables = Exact<{
  input: StartLocalPackBuildInput;
}>;


export type StartLocalPackBuildMutation = { __typename?: 'Mutation', startLocalPackBuild: { __typename?: 'MarketDataPackBuildJob', id: string, packId: string, sourceProvider: string, status: string, progressPercent: number, currentSymbol?: string | null, currentDate?: any | null, currentAssetType?: string | null, totalSymbols: number, completedSymbols: number, failedSymbols: number, completedDates: number, totalDates: number, rowsWritten: any, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type CancelPackBuildJobMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type CancelPackBuildJobMutation = { __typename?: 'Mutation', cancelPackBuildJob: { __typename?: 'MarketDataPackBuildJob', id: string, packId: string, sourceProvider: string, status: string, progressPercent: number, currentSymbol?: string | null, currentDate?: any | null, currentAssetType?: string | null, totalSymbols: number, completedSymbols: number, failedSymbols: number, completedDates: number, totalDates: number, rowsWritten: any, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } };

export type CreatePortfolioMutationVariables = Exact<{
  input: CreatePortfolioInput;
}>;


export type CreatePortfolioMutation = { __typename?: 'Mutation', createPortfolio: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, taxWrapper: TaxWrapperType, sortOrder: number } };

export type UpdatePortfolioMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePortfolioInput;
}>;


export type UpdatePortfolioMutation = { __typename?: 'Mutation', updatePortfolio: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, taxWrapper: TaxWrapperType, sortOrder: number } };

export type DeletePortfolioMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePortfolioMutation = { __typename?: 'Mutation', deletePortfolio: string };

export type DuplicatePortfolioMutationVariables = Exact<{
  input: DuplicatePortfolioInput;
}>;


export type DuplicatePortfolioMutation = { __typename?: 'Mutation', duplicatePortfolio: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, sortOrder: number } };

export type TriggerFinanceDatabaseSyncMutationVariables = Exact<{
  assetType: AssetSyncType;
}>;


export type TriggerFinanceDatabaseSyncMutation = { __typename?: 'Mutation', triggerFinanceDatabaseSync: { __typename?: 'TriggerFinanceDatabaseSyncPayload', success: boolean, message: string, syncStatus: { __typename?: 'FinanceDatabaseSyncItem', assetType: AssetSyncType, syncStatus: SyncStatus, progress?: number | null } } };

export type UpdateFinanceDatabaseSyncEnabledMutationVariables = Exact<{
  assetType: AssetSyncType;
  enabled: Scalars['Boolean']['input'];
}>;


export type UpdateFinanceDatabaseSyncEnabledMutation = { __typename?: 'Mutation', updateFinanceDatabaseSyncEnabled: { __typename?: 'FinanceDatabaseSyncItem', assetType: AssetSyncType, isEnabled: boolean } };

export type ImportFinanceDatabaseAssetsMutationVariables = Exact<{
  assetType: AssetSyncType;
  symbols: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type ImportFinanceDatabaseAssetsMutation = { __typename?: 'Mutation', importFinanceDatabaseAssets: { __typename?: 'ImportFinanceDatabaseAssetsPayload', success: boolean, importedCount: number, errors: Array<string> } };

export type RegisterSyncCredentialMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  credentials: Scalars['JSON']['input'];
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type RegisterSyncCredentialMutation = { __typename?: 'Mutation', registerSyncCredential: { __typename?: 'SyncCredential', id: string, provider: string, status: string, createdAt: any, updatedAt: any } };

export type GenerateAggregatorLinkMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  redirectUrl: Scalars['String']['input'];
}>;


export type GenerateAggregatorLinkMutation = { __typename?: 'Mutation', generateAggregatorLink: { __typename?: 'AggregatorAuthSession', link: string, sessionToken: string, provider: string } };

export type CompleteAggregatorAuthMutationVariables = Exact<{
  connectionId: Scalars['ID']['input'];
  sessionToken: Scalars['String']['input'];
}>;


export type CompleteAggregatorAuthMutation = { __typename?: 'Mutation', completeAggregatorAuth: Array<{ __typename?: 'SyncConnection', id: string, portfolioId: string, accountId?: string | null, provider: string, externalInstitutionId: string, externalAccountId: string, institutionName: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null, createdAt: any, updatedAt: any }> };

export type LinkSyncAccountMutationVariables = Exact<{
  connectionId: Scalars['ID']['input'];
  accountId?: InputMaybe<Scalars['ID']['input']>;
  autoCreate?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type LinkSyncAccountMutation = { __typename?: 'Mutation', linkSyncAccount: { __typename?: 'SyncConnection', id: string, portfolioId: string, accountId?: string | null, provider: string, externalInstitutionId: string, externalAccountId: string, institutionName: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null, createdAt: any, updatedAt: any } };

export type TriggerAccountSyncMutationVariables = Exact<{
  accountId: Scalars['ID']['input'];
}>;


export type TriggerAccountSyncMutation = { __typename?: 'Mutation', triggerAccountSync: { __typename?: 'SyncRun', id: string, connectionId: string, status: string, itemsImported: number, itemsUpdated: number, errorMessage?: string | null, startedAt: any, completedAt?: any | null } };

export type InitiateWoobAuthMutationVariables = Exact<{
  institution: Scalars['String']['input'];
  login: Scalars['String']['input'];
  password: Scalars['String']['input'];
  region?: InputMaybe<Scalars['String']['input']>;
  portfolioId: Scalars['ID']['input'];
}>;


export type InitiateWoobAuthMutation = { __typename?: 'Mutation', initiateWoobAuth: { __typename?: 'WoobAuthSession', authSessionId: string, status: WoobAuthStatus, countdownSeconds: number, challengeMessage?: string | null, expiresAt: any } };

export type PollWoobAuthMutationVariables = Exact<{
  authSessionId: Scalars['ID']['input'];
  otpCode?: InputMaybe<Scalars['String']['input']>;
}>;


export type PollWoobAuthMutation = { __typename?: 'Mutation', pollWoobAuth: { __typename?: 'WoobAuthPollResult', status: WoobAuthStatus, errorMessage?: string | null, connections?: Array<{ __typename?: 'SyncConnection', id: string, portfolioId: string, accountId?: string | null, provider: string, externalInstitutionId: string, externalAccountId: string, institutionName: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null, createdAt: any, updatedAt: any }> | null } };

export type InitiateTradeRepublicAuthMutationVariables = Exact<{
  phoneNumber: Scalars['String']['input'];
  pin: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
}>;


export type InitiateTradeRepublicAuthMutation = { __typename?: 'Mutation', initiateTradeRepublicAuth: { __typename?: 'TradeRepublicAuthSession', authSessionId: string, status: TradeRepublicAuthStatus, countdownSeconds: number, expiresAt: any } };

export type PollTradeRepublicAuthMutationVariables = Exact<{
  authSessionId: Scalars['ID']['input'];
}>;


export type PollTradeRepublicAuthMutation = { __typename?: 'Mutation', pollTradeRepublicAuth: { __typename?: 'TradeRepublicAuthPollResult', status: TradeRepublicAuthStatus, errorMessage?: string | null, connections?: Array<{ __typename?: 'SyncConnection', id: string, portfolioId: string, accountId?: string | null, provider: string, externalInstitutionId: string, externalAccountId: string, institutionName: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null, createdAt: any, updatedAt: any }> | null } };

export type InitiateEnableBankingAuthMutationVariables = Exact<{
  aspspName: Scalars['String']['input'];
  aspspCountry: Scalars['String']['input'];
  redirectUrl: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
}>;


export type InitiateEnableBankingAuthMutation = { __typename?: 'Mutation', initiateEnableBankingAuth: { __typename?: 'EnableBankingAuthSession', authSessionId: string, authUrl: string, state: string, expiresAt: any } };

export type CompleteEnableBankingAuthMutationVariables = Exact<{
  code: Scalars['String']['input'];
  state: Scalars['String']['input'];
  portfolioId: Scalars['ID']['input'];
}>;


export type CompleteEnableBankingAuthMutation = { __typename?: 'Mutation', completeEnableBankingAuth: Array<{ __typename?: 'SyncConnection', id: string, portfolioId: string, accountId?: string | null, provider: string, externalInstitutionId: string, externalAccountId: string, institutionName: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null, createdAt: any, updatedAt: any }> };

export type UpdateTransactionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateTransactionInput;
}>;


export type UpdateTransactionMutation = { __typename?: 'Mutation', updateTransaction: { __typename?: 'Transaction', id: string, quantity: number, unitPriceAmount?: number | null, executedAt: any, notes?: string | null, transactionType: TransactionType, feesAmount: number, feesCurrency: string } };

export type DeleteTransactionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTransactionMutation = { __typename?: 'Mutation', deleteTransaction: string };

export type UpdateUserDisplayCurrencyMutationVariables = Exact<{
  input: UpdateUserDisplayCurrencyInput;
}>;


export type UpdateUserDisplayCurrencyMutation = { __typename?: 'Mutation', updateUserDisplayCurrency: { __typename?: 'User', id: string, displayCurrency: string } };

export type UpdateUserThemePreferencesMutationVariables = Exact<{
  input: UpdateUserThemePreferencesInput;
}>;


export type UpdateUserThemePreferencesMutation = { __typename?: 'Mutation', updateUserThemePreferences: { __typename?: 'User', id: string, themePreference: string, themeBaseColor: string, themeAccentColor: string, themeFontPreference: string, themeHeadingFont: string, themeMenuAccent: string, themeMenuColor: string, themeStyle: string, themeRadius: number, themeRTL: boolean } };

export type UpdateUserTaxJurisdictionMutationVariables = Exact<{
  input: UpdateUserTaxJurisdictionInput;
}>;


export type UpdateUserTaxJurisdictionMutation = { __typename?: 'Mutation', updateUserTaxJurisdiction: { __typename?: 'User', id: string, taxJurisdiction: string } };

export type CreateWalletDeviceMutationVariables = Exact<{
  input: CreateWalletDeviceInput;
}>;


export type CreateWalletDeviceMutation = { __typename?: 'Mutation', createWalletDevice: { __typename?: 'WalletDevice', id: string, name: string, deviceType: WalletDeviceType, createdAt: any, updatedAt: any } };

export type AddWalletAccountMutationVariables = Exact<{
  input: AddWalletAccountInput;
}>;


export type AddWalletAccountMutation = { __typename?: 'Mutation', addWalletAccount: { __typename?: 'WalletAccount', id: string, portfolioId?: string | null, network: BlockchainNetwork, addressOrXpub: string, isXpub: boolean, label?: string | null, isActive: boolean, historyStatus: string, createdAt: any, balances: Array<{ __typename?: 'WalletBalance', id: string, symbol: string, formattedQuantity: number }> } };

export type RemoveWalletAccountMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveWalletAccountMutation = { __typename?: 'Mutation', removeWalletAccount: boolean };

export type TriggerWalletSyncMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TriggerWalletSyncMutation = { __typename?: 'Mutation', triggerWalletSync: boolean };

export type ToggleSpamTokenMutationVariables = Exact<{
  balanceId: Scalars['ID']['input'];
  isHidden: Scalars['Boolean']['input'];
}>;


export type ToggleSpamTokenMutation = { __typename?: 'Mutation', toggleSpamToken: boolean };

export type RefreshWalletBalancePriceMutationVariables = Exact<{
  balanceId: Scalars['ID']['input'];
}>;


export type RefreshWalletBalancePriceMutation = { __typename?: 'Mutation', refreshWalletBalancePrice: { __typename?: 'WalletBalance', id: string, symbol: string, currentPrice?: number | null, currentValue?: number | null, dayChange24h?: number | null, priceUpdatedAt?: any | null, priceSource?: string | null, isPriceResolved: boolean } };

export type ResolveWalletReviewMutationVariables = Exact<{
  reviewId: Scalars['ID']['input'];
  action: Scalars['String']['input'];
  customType?: InputMaybe<Scalars['String']['input']>;
}>;


export type ResolveWalletReviewMutation = { __typename?: 'Mutation', resolveWalletReview: boolean };

export type ConfigureAlchemyKeyMutationVariables = Exact<{
  apiKey: Scalars['String']['input'];
}>;


export type ConfigureAlchemyKeyMutation = { __typename?: 'Mutation', configureAlchemyKey: boolean };

export type SetWalletBalanceCostBasisMutationVariables = Exact<{
  balanceId: Scalars['ID']['input'];
  costBasisPerUnit: Scalars['Float']['input'];
  currency?: InputMaybe<Scalars['String']['input']>;
}>;


export type SetWalletBalanceCostBasisMutation = { __typename?: 'Mutation', setWalletBalanceCostBasis: boolean };

export type ResetWalletBalanceCostBasisMutationVariables = Exact<{
  balanceId: Scalars['ID']['input'];
}>;


export type ResetWalletBalanceCostBasisMutation = { __typename?: 'Mutation', resetWalletBalanceCostBasis: boolean };

export type AssignWalletDeviceMutationVariables = Exact<{
  walletAccountId: Scalars['ID']['input'];
  deviceId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type AssignWalletDeviceMutation = { __typename?: 'Mutation', assignWalletDevice: boolean };

export type UpdateWalletDeviceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  deviceType: WalletDeviceType;
}>;


export type UpdateWalletDeviceMutation = { __typename?: 'Mutation', updateWalletDevice: { __typename?: 'WalletDevice', id: string, name: string, deviceType: WalletDeviceType, updatedAt: any } };

export type RemoveWalletDeviceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveWalletDeviceMutation = { __typename?: 'Mutation', removeWalletDevice: boolean };

export type AddMultiNetworkWalletMutationVariables = Exact<{
  input: AddMultiNetworkWalletInput;
}>;


export type AddMultiNetworkWalletMutation = { __typename?: 'Mutation', addMultiNetworkWallet: Array<{ __typename?: 'WalletAccount', id: string, portfolioId?: string | null, deviceId?: string | null, network: BlockchainNetwork, addressOrXpub: string, label?: string | null, isActive: boolean, historyStatus: string, capabilityLevel: WalletCapabilityLevel, createdAt: any }> };

export type AddMultiChainWalletMutationVariables = Exact<{
  input: AddMultiChainWalletInput;
}>;


export type AddMultiChainWalletMutation = { __typename?: 'Mutation', addMultiChainWallet: { __typename?: 'WalletDevice', id: string, name: string, deviceType: WalletDeviceType, createdAt: any, updatedAt: any, accounts: Array<{ __typename?: 'WalletAccount', id: string, network: BlockchainNetwork, addressOrXpub: string, label?: string | null, capabilityLevel: WalletCapabilityLevel, lastSyncAt?: any | null }> } };

export type AddCustomTokenMutationVariables = Exact<{
  input: AddCustomTokenInput;
}>;


export type AddCustomTokenMutation = { __typename?: 'Mutation', addCustomToken: { __typename?: 'WalletBalance', id: string, symbol: string, name?: string | null, decimals: number, formattedQuantity: number, rawBalance: string, tokenAddress?: string | null } };

export type UpdateBlockchainNetworkConfigMutationVariables = Exact<{
  input: UpdateBlockchainNetworkConfigInput;
}>;


export type UpdateBlockchainNetworkConfigMutation = { __typename?: 'Mutation', updateBlockchainNetworkConfig: { __typename?: 'BlockchainNetworkConfig', network: BlockchainNetwork, rpcUrl: string, explorerApiUrl?: string | null, source: string, updatedAt: any } };

export type ResetBlockchainNetworkConfigMutationVariables = Exact<{
  network: BlockchainNetwork;
}>;


export type ResetBlockchainNetworkConfigMutation = { __typename?: 'Mutation', resetBlockchainNetworkConfig: { __typename?: 'BlockchainNetworkConfig', network: BlockchainNetwork, rpcUrl: string, explorerApiUrl?: string | null, source: string, updatedAt: any } };

export type WatchlistResultFragment = { __typename?: 'Watchlist', id: string, name: string, createdAt: any } & { ' $fragmentName'?: 'WatchlistResultFragment' };

export type CreateWatchlistMutationVariables = Exact<{
  input: CreateWatchlistInput;
}>;


export type CreateWatchlistMutation = { __typename?: 'Mutation', createWatchlist: { __typename?: 'Watchlist', id: string, name: string } };

export type AddAssetToWatchlistMutationVariables = Exact<{
  watchlistID: Scalars['ID']['input'];
  assetID: Scalars['ID']['input'];
}>;


export type AddAssetToWatchlistMutation = { __typename?: 'Mutation', addAssetToWatchlist: (
    { __typename?: 'Watchlist' }
    & { ' $fragmentRefs'?: { 'WatchlistResultFragment': WatchlistResultFragment } }
  ) };

export type RemoveAssetFromWatchlistMutationVariables = Exact<{
  watchlistID: Scalars['ID']['input'];
  assetID: Scalars['ID']['input'];
}>;


export type RemoveAssetFromWatchlistMutation = { __typename?: 'Mutation', removeAssetFromWatchlist: { __typename?: 'Watchlist', id: string, name: string, assets: Array<{ __typename?: 'BankAccount', id: string } | { __typename?: 'Crypto', id: string } | { __typename?: 'Fund', id: string } | { __typename?: 'LifeInsurance', id: string } | { __typename?: 'Loan', id: string } | { __typename?: 'RealEstate', id: string } | { __typename?: 'Stock', id: string } | { __typename?: 'Watch', id: string }> } };

export type GetAccountsQueryVariables = Exact<{
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetAccountsQuery = { __typename?: 'Query', accounts: Array<{ __typename?: 'Account', id: string, portfolioId: string, name: string, type: AccountType, taxWrapper: TaxWrapperType, institution?: string | null, accountNumber?: string | null, currency: string, syncProvider: string, ownershipPercentage: number, coOwnerName?: string | null, coOwnerUserId?: string | null, externalId?: string | null, positionsCount: number, totalValue?: number | null, createdAt: any, updatedAt: any, coOwnerUser?: { __typename?: 'User', id: string, username: string, email: string } | null, syncConnection?: { __typename?: 'SyncConnection', id: string, provider: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null } | null }> };

export type GetAccountQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetAccountQuery = { __typename?: 'Query', account?: { __typename?: 'Account', id: string, portfolioId: string, name: string, type: AccountType, taxWrapper: TaxWrapperType, institution?: string | null, accountNumber?: string | null, currency: string, syncProvider: string, ownershipPercentage: number, coOwnerName?: string | null, coOwnerUserId?: string | null, externalId?: string | null, positionsCount: number, totalValue?: number | null, createdAt: any, updatedAt: any, coOwnerUser?: { __typename?: 'User', id: string, username: string, email: string } | null, syncConnection?: { __typename?: 'SyncConnection', id: string, provider: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null } | null } | null };

export type GetCoOwnerCandidatesQueryVariables = Exact<{
  search?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetCoOwnerCandidatesQuery = { __typename?: 'Query', coOwnerCandidates: Array<{ __typename?: 'CoOwnerCandidate', id: string, name: string, email: string }> };

export type AdminUsersQueryVariables = Exact<{
  filter?: InputMaybe<AdminUserFilter>;
  pagination?: InputMaybe<PaginationInput>;
  orderBy?: InputMaybe<UserOrder>;
}>;


export type AdminUsersQuery = { __typename?: 'Query', adminUsers: { __typename?: 'AdminUsersResponse', totalCount: number, users: Array<{ __typename?: 'User', id: string, username: string, email: string, role: string, emailVerified: boolean, lastLoginAt?: any | null, failedLoginCount: number, lockedUntil?: any | null, isLocked: boolean, displayCurrency: string, taxJurisdiction: string, createdAt: any, updatedAt: any, portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string }>, watchlists: Array<{ __typename?: 'Watchlist', id: string, name: string }> }> } };

export type AdminUserStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminUserStatsQuery = { __typename?: 'Query', adminUserStats: { __typename?: 'AdminUserStats', totalUsers: number, activeUsers: number, lockedUsers: number, adminUsers: number, unverifiedUsers: number } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'AuthUser', id: string, email: string, role: string, name: string, emailVerified: boolean, displayCurrency: string, themePreference: string, themeBaseColor: string, themeAccentColor: string, themeFontPreference: string, themeHeadingFont: string, themeMenuAccent: string, themeMenuColor: string, themeStyle: string, themeRadius: number, themeRTL: boolean } | null };

export type BenchmarkComparisonQueryVariables = Exact<{
  portfolioId: Scalars['ID']['input'];
  benchmarkAssetId: Scalars['ID']['input'];
  timeRange: PerformanceTimeRangeInput;
}>;


export type BenchmarkComparisonQuery = { __typename?: 'Query', benchmarkComparison: { __typename?: 'BenchmarkComparison', portfolioReturn: number, benchmarkReturn: number, alpha: number, beta: number, correlation: number, trackingError: number, informationRatio: number, riskAdjustedAlpha: number, outperformancePeriods: Array<{ __typename?: 'TimeRange', start: any, end: any }> } };

export type GetDashboardCriticalQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetDashboardCriticalQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, displayCurrency?: string | null, quoteCurrency?: string | null, isStale?: boolean | null, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number, count: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility?: number | null, sharpeRatio?: number | null, maxDrawdown?: number | null, diversification?: number | null }, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }>, positionValuations?: Array<{ __typename?: 'PositionValuation', positionId: string, assetId: string, nativeValue: number, displayValue: number, costBasisNative: number, costBasisDisplay: number, costBasisCurrency: string, costBasisConverted: boolean, hasDisplayValue: boolean, isExcluded: boolean, exclusionReason?: string | null, fxRate: number, fxAsOf?: any | null, isStale: boolean, quoteCurrency: string, displayCurrency: string }> | null } | null, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null, quoteCurrency?: string | null, accountName?: string | null, accountID?: string | null, asset: { __typename?: 'BankAccount', accountType: string, institution: string, accountNumber: string, currency: string, interestRate?: number | null, balance?: number | null, id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Fund', expenseRatio?: number | null, dividendYield?: number | null, id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Loan', loanType: string, loanAmount: number, remainingBalance: number, interestRate?: number | null, durationMonths: number, monthlyPayment: number, startDate: string, endDate?: string | null, lender: string, loanNumber?: string | null, currency: string, downPayment?: number | null, status: string, ownershipMode?: string | null, applicationFee?: number | null, brokerFee?: number | null, insuranceFee?: number | null, otherFees?: number | null, earlyRepaymentFee?: number | null, linkedAssetIDs?: Array<string> | null, ownershipPercentage?: number | null, id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, steps?: Array<{ __typename?: 'LoanStep', id: string, date?: string | null, amount: number, interestRate: number }> | null, coOwners?: Array<{ __typename?: 'LoanCoOwner', id: string, type: string, userId?: string | null, name: string, percentage: number }> | null, companyOwners?: Array<{ __typename?: 'LoanCompanyOwner', id: string, type: string, companyId?: string | null, name: string, registrationNumber?: string | null, legalForm?: string | null, percentage: number }> | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'RealEstate', propertyType: string, category?: string | null, address: string, city: string, state?: string | null, country: string, zipCode?: string | null, squareFeet?: number | null, landSurface?: number | null, yearBuilt?: number | null, bedrooms?: number | null, bathrooms?: number | null, rooms?: number | null, floor?: number | null, totalFloors?: number | null, garages?: number | null, parkingSpaces?: number | null, energyLabel?: string | null, condition?: string | null, agencyFees?: number | null, notaryFees?: number | null, renovationFees?: number | null, furnishingCosts?: number | null, rentalType?: string | null, rentalPeriod?: string | null, monthlyRent?: number | null, utilityCosts?: number | null, yearlyMiscCosts?: number | null, hasGarden?: boolean | null, hasBalcony?: boolean | null, hasLift?: boolean | null, hasPool?: boolean | null, hasSauna?: boolean | null, isFurnished?: boolean | null, isNewConstruction?: boolean | null, kitchenQuality?: string | null, kitchenCondition?: string | null, bathroomQuality?: string | null, bathroomCondition?: string | null, flooringQuality?: string | null, flooringCondition?: string | null, windowsQuality?: string | null, windowsCondition?: string | null, generalQuality?: string | null, generalCondition?: string | null, linkedLoanId?: string | null, ownershipPercentage?: number | null, ownershipStructure?: string | null, addressLabel?: string | null, cityCode?: string | null, banId?: string | null, latitude?: number | null, longitude?: number | null, hasOutdoor?: boolean | null, isGroundFloor?: boolean | null, valuationMode?: ValuationMode | null, estimationMethod?: EstimationMethod | null, manualValue?: number | null, estimatedValue?: number | null, estimatedMin?: number | null, estimatedMax?: number | null, estimatedPricePerM2?: number | null, basePricePerM2?: number | null, valuationConfidence?: ValuationConfidence | null, comparablesCount?: number | null, searchRadiusMeters?: number | null, lastEstimatedAt?: any | null, marketRentPerM2?: number | null, estimatedMonthlyRent?: number | null, estimatedGrossYield?: number | null, rentalR2Adjusted?: number | null, id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, valuationHistory?: Array<{ __typename?: 'RealEstateValuationPoint', date: any, value: number, mode?: string | null, estimatedMin?: number | null, estimatedMax?: number | null }> | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', peRatio?: number | null, dividendYield?: number | null, id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } }> }>, watchlists: Array<{ __typename?: 'Watchlist', id: string, name: string, assets: Array<{ __typename?: 'BankAccount', id: string, symbol?: string | null } | { __typename?: 'Crypto', id: string, symbol?: string | null } | { __typename?: 'Fund', id: string, symbol?: string | null } | { __typename?: 'LifeInsurance', id: string, symbol?: string | null } | { __typename?: 'Loan', id: string, symbol?: string | null } | { __typename?: 'RealEstate', id: string, symbol?: string | null } | { __typename?: 'Stock', id: string, symbol?: string | null } | { __typename?: 'Watch', id: string, symbol?: string | null }> }> };

export type GetDashboardSecondaryQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetDashboardSecondaryQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, accountId?: string | null, amount?: number | null, notes?: string | null, quantity: number, unitPriceAmount?: number | null, unitPriceCurrency: string, executedAt: any, feesAmount: number, feesCurrency: string, transactionType: TransactionType, account?: { __typename?: 'Account', id: string, name: string, institution?: string | null } | null, asset?: { __typename?: 'BankAccount', id: string, symbol?: string | null, name: string } | { __typename?: 'Crypto', id: string, symbol?: string | null, name: string } | { __typename?: 'Fund', id: string, symbol?: string | null, name: string } | { __typename?: 'LifeInsurance', id: string, symbol?: string | null, name: string } | { __typename?: 'Loan', id: string, symbol?: string | null, name: string } | { __typename?: 'RealEstate', id: string, symbol?: string | null, name: string } | { __typename?: 'Stock', id: string, symbol?: string | null, name: string } | { __typename?: 'Watch', id: string, symbol?: string | null, name: string } | null, portfolio: { __typename?: 'Portfolio', id: string } }> };

export type GetRecentTransactionsMinimalQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetRecentTransactionsMinimalQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, accountId?: string | null, amount?: number | null, notes?: string | null, quantity: number, unitPriceAmount?: number | null, unitPriceCurrency: string, executedAt: any, transactionType: TransactionType, account?: { __typename?: 'Account', id: string, name: string, institution?: string | null } | null, asset?: { __typename?: 'BankAccount', id: string, symbol?: string | null, name: string } | { __typename?: 'Crypto', id: string, symbol?: string | null, name: string } | { __typename?: 'Fund', id: string, symbol?: string | null, name: string } | { __typename?: 'LifeInsurance', id: string, symbol?: string | null, name: string } | { __typename?: 'Loan', id: string, symbol?: string | null, name: string } | { __typename?: 'RealEstate', id: string, symbol?: string | null, name: string } | { __typename?: 'Stock', id: string, symbol?: string | null, name: string } | { __typename?: 'Watch', id: string, symbol?: string | null, name: string } | null, portfolio: { __typename?: 'Portfolio', id: string } }> };

export type GetAssetPerformanceOptimizedQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAssetPerformanceOptimizedQuery = { __typename?: 'Query', assets: Array<{ __typename?: 'BankAccount', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Crypto', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Fund', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'LifeInsurance', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Loan', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'RealEstate', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Stock', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Watch', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null }> };

export type ExportPortfolioQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ExportPortfolioQuery = { __typename?: 'Query', portfolio?: { __typename?: 'Portfolio', id: string, name: string, createdAt: any, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, displayCurrency?: string | null, isStale?: boolean | null } | null, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, currentValue?: number | null, ownershipPct?: number | null, quoteCurrency?: string | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } }> } | null };

export type ExportTransactionsQueryVariables = Exact<{
  filter?: InputMaybe<TransactionFilter>;
  pagination?: InputMaybe<PaginationInput>;
}>;


export type ExportTransactionsQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, transactionType: TransactionType, quantity: number, unitPriceAmount?: number | null, unitPriceCurrency: string, feesAmount: number, feesCurrency: string, executedAt: any, notes?: string | null, asset?: { __typename?: 'BankAccount', name: string, symbol?: string | null } | { __typename?: 'Crypto', name: string, symbol?: string | null } | { __typename?: 'Fund', name: string, symbol?: string | null } | { __typename?: 'LifeInsurance', name: string, symbol?: string | null } | { __typename?: 'Loan', name: string, symbol?: string | null } | { __typename?: 'RealEstate', name: string, symbol?: string | null } | { __typename?: 'Stock', name: string, symbol?: string | null } | { __typename?: 'Watch', name: string, symbol?: string | null } | null }> };

export type ExportUserPortfoliosQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type ExportUserPortfoliosQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string }> };

export type SearchInstrumentsQueryVariables = Exact<{
  input: InstrumentSearchInput;
}>;


export type SearchInstrumentsQuery = { __typename?: 'Query', searchInstruments: { __typename?: 'InstrumentSearchPayload', canSearchOnline: boolean, localResults: Array<{ __typename?: 'InstrumentSearchResult', score: number, matchedAlias?: string | null, instrument: { __typename?: 'Instrument', id: string, symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, sector?: string | null, assetType: InstrumentAssetType, providerSource: string, providerExternalId?: string | null, isin?: string | null, figi?: string | null, cusip?: string | null, industry?: string | null, website?: string | null, summary?: string | null, family?: string | null, category?: string | null, city?: string | null, state?: string | null } }>, queryMetadata: { __typename?: 'InstrumentQueryMetadata', query: string, limit: number, offset: number, localCount: number, topScore: number, weakResults: boolean, searchOnlineHint: boolean } } };

export type SearchInstrumentsOnlineQueryVariables = Exact<{
  input: InstrumentSearchInput;
}>;


export type SearchInstrumentsOnlineQuery = { __typename?: 'Query', searchInstrumentsOnline: { __typename?: 'OnlineInstrumentSearchPayload', providerUsed: string, coverageStatus: CoverageStatus, errorMessage?: string | null, onlineResults: Array<{ __typename?: 'OnlineInstrumentResult', symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, assetType: InstrumentAssetType, source: CatalogSource, externalId?: string | null, marketCapRank?: number | null, imageUrl?: string | null, providerSource: string, providerExternalId?: string | null, isin?: string | null, figi?: string | null, cusip?: string | null, platforms?: Array<{ __typename?: 'PlatformAddress', platform: string, address: string }> | null }>, queryMetadata: { __typename?: 'InstrumentQueryMetadata', query: string, limit: number, offset: number, localCount: number, topScore: number, weakResults: boolean, searchOnlineHint: boolean } } };

export type ManualInstrumentsQueryVariables = Exact<{
  filter?: InputMaybe<ManualInstrumentFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
}>;


export type ManualInstrumentsQuery = { __typename?: 'Query', manualInstruments: { __typename?: 'ManualInstrumentPayload', hasMore: boolean, limit: number, offset: number, items: Array<{ __typename?: 'Instrument', id: string, symbol: string, normalizedSymbol: string, name: string, normalizedName: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, baseCurrency?: string | null, quoteCurrency?: string | null, underlyingSymbol?: string | null, assetType: InstrumentAssetType, status: string, providerSource: string, providerExternalId?: string | null, summary?: string | null, sector?: string | null, industryGroup?: string | null, industry?: string | null, categoryGroup?: string | null, category?: string | null, family?: string | null, website?: string | null, marketCap?: string | null, state?: string | null, city?: string | null, zipcode?: string | null, firstSeenAt: any, lastVerifiedAt?: any | null, lastUsedAt?: any | null, createdAt: any, updatedAt: any, syncState?: { __typename?: 'InstrumentSyncState', instrumentID: string, syncStatus: string, stale: boolean, verificationConfidence: number, lastSyncAttempt?: any | null, lastSyncSuccess?: any | null, lastSyncSource?: string | null, syncErrorMessage?: string | null, createdAt: any, updatedAt: any } | null }> } };

export type LatestHistoricalDataBackfillJobQueryVariables = Exact<{
  portfolioId: Scalars['ID']['input'];
  assetId: Scalars['ID']['input'];
}>;


export type LatestHistoricalDataBackfillJobQuery = { __typename?: 'Query', latestHistoricalDataBackfillJob?: { __typename?: 'HistoricalDataBackfillJob', id: string, status: string, step: string, progress: number, rowsWritten: number, errorCode?: string | null, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } | null };

export type HistoricalDataBackfillJobsQueryVariables = Exact<{
  filter?: InputMaybe<HistoricalDataBackfillJobFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
}>;


export type HistoricalDataBackfillJobsQuery = { __typename?: 'Query', historicalDataBackfillJobs: Array<{ __typename?: 'HistoricalDataBackfillJob', id: string, userId?: string | null, portfolioId: string, assetId: string, instrumentId: string, provider: string, status: string, step: string, progress: number, rowsWritten: number, errorCode?: string | null, errorMessage?: string | null, requestedFrom: any, requestedTo: any, createdAt: any, startedAt?: any | null, finishedAt?: any | null }> };

export type GetMarketDataCredentialsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMarketDataCredentialsQuery = { __typename?: 'Query', marketDataCredentials: Array<{ __typename?: 'MarketDataCredential', id: string, provider: string, isEnabled: boolean, priority: number, source?: string | null, lastValidatedAt?: any | null, createdAt: any, updatedAt: any }> };

export type GetAvailableProvidersQueryVariables = Exact<{
  instrumentId: Scalars['ID']['input'];
  dataType: Scalars['String']['input'];
}>;


export type GetAvailableProvidersQuery = { __typename?: 'Query', availableProviders: Array<{ __typename?: 'AvailableProvider', provider: string, capability: boolean, requiresApiKey: boolean, hasCredential: boolean, credentialValid: boolean, credentialEnabled: boolean, priority: number, mappingStatus: string, effectiveEnabled: boolean }> };

export type GetSupportedProvidersQueryVariables = Exact<{
  assetType?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetSupportedProvidersQuery = { __typename?: 'Query', supportedProviders: Array<{ __typename?: 'ProviderInfo', id: string, name: string, type: string, requiresKey: boolean, intervals: Array<string>, supportsRealtime: boolean, rateLimit: { __typename?: 'RateLimit', requestsPerMinute: number, requestsPerDay: number, burstLimit: number } }> };

export type GetProviderHealthQueryVariables = Exact<{ [key: string]: never; }>;


export type GetProviderHealthQuery = { __typename?: 'Query', providerHealth: Array<{ __typename?: 'ProviderHealth', provider: string, assetType: string, healthy: boolean, lastChecked: any }> };

export type GetProviderRoutingPreferencesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetProviderRoutingPreferencesQuery = { __typename?: 'Query', providerRoutingPreferences: { __typename?: 'ProviderRoutingPreferences', id: string, userId: string, useIntelligentRouting: boolean, enableFallback: boolean, staleDataThresholdMinutes: number, createdAt: any, updatedAt: any, preferredProviders: Array<{ __typename?: 'ProviderPreference', provider: string, priority: number, enabled: boolean }> } };

export type GetMarketDataSettingsQueryVariables = Exact<{
  assetType?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetMarketDataSettingsQuery = { __typename?: 'Query', marketDataCredentials: Array<{ __typename?: 'MarketDataCredential', id: string, provider: string, isEnabled: boolean, priority: number, source?: string | null, lastValidatedAt?: any | null, createdAt: any, updatedAt: any }>, supportedProviders: Array<{ __typename?: 'ProviderInfo', id: string, name: string, type: string, requiresKey: boolean, intervals: Array<string>, supportsRealtime: boolean, rateLimit: { __typename?: 'RateLimit', requestsPerMinute: number, requestsPerDay: number, burstLimit: number } }>, providerHealth: Array<{ __typename?: 'ProviderHealth', provider: string, assetType: string, healthy: boolean, apiKeyValid?: boolean | null, lastChecked: any }>, providerRoutingPreferences: { __typename?: 'ProviderRoutingPreferences', id: string, userId: string, useIntelligentRouting: boolean, enableFallback: boolean, staleDataThresholdMinutes: number, createdAt: any, updatedAt: any, preferredProviders: Array<{ __typename?: 'ProviderPreference', provider: string, priority: number, enabled: boolean }> } };

export type GetMarketDataPacksCenterQueryVariables = Exact<{
  instrumentId: Scalars['ID']['input'];
}>;


export type GetMarketDataPacksCenterQuery = { __typename?: 'Query', availableMarketDataPacks: Array<{ __typename?: 'MarketDataPackRegistryEntry', packId: string, version: string, name: string, description?: string | null, sizeBytes: any, compressedSizeBytes: any, assetsCount: any, rowsCount: any, interval: string, assetTypes: Array<string>, quoteCurrencies: Array<string>, downloadUrl: string, checksum: string, signatureUrl?: string | null, createdAt: any, recommended: boolean }>, installedMarketDataPacks: Array<{ __typename?: 'MarketDataPack', id: string, version: string, name: string, description?: string | null, formatVersion: number, status: string, parentPackId?: string | null, packPriority: number, filePath: string, checksum: string, signatureVerified: boolean, assetsCount: any, rowsCount: any, installedAt?: any | null, updatedAt?: any | null, createdAt: any }>, marketDataCoverage: Array<{ __typename?: 'MarketDataPackCoverage', packId: string, instrumentId: string, symbol: string, assetType: string, interval: string, quoteCurrency: string, firstDate: any, lastDate: any, rowCount: any, filePaths: Array<string> }> };

export type GetMarketDataPackJobQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetMarketDataPackJobQuery = { __typename?: 'Query', marketDataPackJob?: { __typename?: 'MarketDataPackJob', id: string, packId: string, jobType: string, status: string, progressPercent: number, downloadedBytes: any, totalBytes: any, importedRows: any, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } | null };

export type GetPackBuildJobQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPackBuildJobQuery = { __typename?: 'Query', packBuildJob?: { __typename?: 'MarketDataPackBuildJob', id: string, packId: string, sourceProvider: string, status: string, progressPercent: number, currentSymbol?: string | null, currentDate?: any | null, currentAssetType?: string | null, totalSymbols: number, completedSymbols: number, failedSymbols: number, completedDates: number, totalDates: number, rowsWritten: any, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null } | null };

export type GetPackBuildJobsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetPackBuildJobsQuery = { __typename?: 'Query', packBuildJobs: Array<{ __typename?: 'MarketDataPackBuildJob', id: string, packId: string, sourceProvider: string, status: string, progressPercent: number, currentSymbol?: string | null, currentDate?: any | null, currentAssetType?: string | null, totalSymbols: number, completedSymbols: number, failedSymbols: number, completedDates: number, totalDates: number, rowsWritten: any, errorMessage?: string | null, createdAt: any, startedAt?: any | null, finishedAt?: any | null }> };

export type GetPortfolioRiskMetricsQueryVariables = Exact<{
  portfolioId: Scalars['ID']['input'];
  timeRange: PerformanceTimeRangeInput;
}>;


export type GetPortfolioRiskMetricsQuery = { __typename?: 'Query', portfolioRiskMetrics: { __typename?: 'RiskMetrics', volatility?: number | null, sharpeRatio?: number | null, sortinoRatio?: number | null, maxDrawdown?: number | null, diversification?: number | null } };

export type GetPortfoliosWithAnalyticsQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetPortfoliosWithAnalyticsQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, description?: string | null, taxWrapper: TaxWrapperType, createdAt: any, updatedAt: any, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'BankAccount', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Crypto', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Fund', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'LifeInsurance', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Loan', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'RealEstate', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Stock', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Watch', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } }>, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, totalNativeValue?: number | null, totalDisplayValue?: number | null, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale?: boolean | null, fxState?: string | null, excludedPositionCount?: number | null, coveredValueRatio?: number | null, displayCurrency?: string | null, quoteCurrency?: string | null, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number }>, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility?: number | null, sharpeRatio?: number | null, maxDrawdown?: number | null }, positionValuations?: Array<{ __typename?: 'PositionValuation', positionId: string, assetId: string, nativeValue: number, displayValue: number, costBasisNative: number, costBasisDisplay: number, costBasisCurrency: string, costBasisConverted: boolean, hasDisplayValue: boolean, isExcluded: boolean, exclusionReason?: string | null, fxRate: number, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale: boolean, quoteCurrency: string, displayCurrency: string }> | null } | null }> };

export type GetPortfolioQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPortfolioQuery = { __typename?: 'Query', portfolio?: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, taxWrapper: TaxWrapperType, createdAt: any, updatedAt: any, sortOrder: number, user: { __typename?: 'User', id: string }, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } }>, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, totalNativeValue?: number | null, totalDisplayValue?: number | null, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale?: boolean | null, fxState?: string | null, excludedPositionCount?: number | null, coveredValueRatio?: number | null, displayCurrency?: string | null, quoteCurrency?: string | null, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number }>, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility?: number | null, sharpeRatio?: number | null, maxDrawdown?: number | null }, positionValuations?: Array<{ __typename?: 'PositionValuation', positionId: string, assetId: string, nativeValue: number, displayValue: number, costBasisNative: number, costBasisDisplay: number, costBasisCurrency: string, costBasisConverted: boolean, hasDisplayValue: boolean, isExcluded: boolean, exclusionReason?: string | null, fxRate: number, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale: boolean, quoteCurrency: string, displayCurrency: string }> | null } | null, tags: Array<{ __typename?: 'Tag', id: string, name: string }> } | null };

export type GetScopedPerformanceHistoryQueryVariables = Exact<{
  portfolioID: Scalars['ID']['input'];
  assetTypes: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type GetScopedPerformanceHistoryQuery = { __typename?: 'Query', scopedPerformanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }> };

export type EstimateRealEstateQueryVariables = Exact<{
  input: RealEstateEstimationInput;
}>;


export type EstimateRealEstateQuery = { __typename?: 'Query', estimateRealEstate: { __typename?: 'RealEstateEstimationResult', estimatedValue?: number | null, estimatedMin?: number | null, estimatedMax?: number | null, estimatedPricePerM2?: number | null, basePricePerM2?: number | null, confidence: ValuationConfidence, method: EstimationMethod, comparablesCount: number, searchRadiusMeters?: number | null, lastEstimatedAt: any, rentalMarket?: { __typename?: 'RealEstateRentalMarket', marketRentPerM2?: number | null, estimatedMonthlyRent?: number | null, estimatedGrossYield?: number | null, isCommuneLevel: boolean, r2Adjusted?: number | null, sourceLabel: string } | null } };

export type FetchAdemeDpeQueryVariables = Exact<{
  banId: Scalars['String']['input'];
  surfaceM2: Scalars['Float']['input'];
  propertyType?: InputMaybe<Scalars['String']['input']>;
}>;


export type FetchAdemeDpeQuery = { __typename?: 'Query', fetchADEMEDpe?: { __typename?: 'ADEMEDpeResult', rating: string, surfaceM2?: number | null, diagnosticDate?: string | null, sourceDataset?: string | null } | null };

export type GetCommuneRentalIndicatorsQueryVariables = Exact<{
  cityCode: Scalars['String']['input'];
  propertyType?: InputMaybe<Scalars['String']['input']>;
  roomsCount?: InputMaybe<Scalars['Int']['input']>;
  surfaceM2?: InputMaybe<Scalars['Float']['input']>;
  propertyValue?: InputMaybe<Scalars['Float']['input']>;
}>;


export type GetCommuneRentalIndicatorsQuery = { __typename?: 'Query', getCommuneRentalIndicators?: { __typename?: 'RealEstateRentalMarket', marketRentPerM2?: number | null, estimatedMonthlyRent?: number | null, estimatedGrossYield?: number | null, isCommuneLevel: boolean, r2Adjusted?: number | null, sourceLabel: string } | null };

export type GetFinanceDatabaseSyncStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type GetFinanceDatabaseSyncStatusQuery = { __typename?: 'Query', financeDatabaseSyncStatus: { __typename?: 'FinanceDatabaseSyncStatusPayload', assetTypes: Array<{ __typename?: 'FinanceDatabaseSyncItem', assetType: AssetSyncType, isEnabled: boolean, lastSynced?: any | null, recordCount: number, syncStatus: SyncStatus, progress?: number | null, currentRecord?: string | null, errorMessage?: string | null }> } };

export type GetFinanceDatabaseSyncHistoryQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetFinanceDatabaseSyncHistoryQuery = { __typename?: 'Query', financeDatabaseSyncHistory: Array<{ __typename?: 'FinanceDatabaseSyncHistoryEntry', id: string, timestamp: any, assetType: AssetSyncType, recordCount: number, status: SyncStatus, errorMessage?: string | null }> };

export type GetFinanceDatabasePreviewQueryVariables = Exact<{
  assetType: AssetSyncType;
  search?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetFinanceDatabasePreviewQuery = { __typename?: 'Query', financeDatabasePreview: Array<{ __typename?: 'FinanceDatabasePreviewItem', symbol: string, name: string, exchange: string, sector?: string | null, country?: string | null }> };

export type GetSyncConnectionsQueryVariables = Exact<{
  portfolioId: Scalars['ID']['input'];
}>;


export type GetSyncConnectionsQuery = { __typename?: 'Query', syncConnections: Array<{ __typename?: 'SyncConnection', id: string, portfolioId: string, accountId?: string | null, provider: string, externalInstitutionId: string, externalAccountId: string, institutionName: string, syncStatus: string, lastSyncAt?: any | null, lastError?: string | null, createdAt: any, updatedAt: any, account?: { __typename?: 'Account', id: string, name: string, institution?: string | null } | null }> };

export type GetSyncCredentialsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSyncCredentialsQuery = { __typename?: 'Query', syncCredentials: Array<{ __typename?: 'SyncCredential', id: string, provider: string, status: string, source?: string | null, createdAt: any, updatedAt: any }> };

export type GetEnableBankingInstitutionsQueryVariables = Exact<{
  country: Scalars['String']['input'];
}>;


export type GetEnableBankingInstitutionsQuery = { __typename?: 'Query', enableBankingInstitutions: Array<{ __typename?: 'EnableBankingInstitution', name: string, title: string, country: string, logo?: string | null, psuTypes?: Array<string> | null }> };

export type GetTaxLotsByPositionQueryVariables = Exact<{
  positionId: Scalars['ID']['input'];
}>;


export type GetTaxLotsByPositionQuery = { __typename?: 'Query', taxLotsByPosition: Array<{ __typename?: 'TaxLot', id: string, portfolioId: string, positionId: string, assetId: string, transactionId?: string | null, acquiredAt: any, initialQuantity: number, remainingQuantity: number, costBasisPerUnit: number, totalCostBasis: number, currency: string, status: string, holdingPeriodDays: number, isLongTerm: boolean, currentPrice?: number | null, currentValue?: number | null, unrealizedGainLoss?: number | null, unrealizedGainLossPercent?: number | null }> };

export type GetDispositionsByPositionQueryVariables = Exact<{
  positionId: Scalars['ID']['input'];
}>;


export type GetDispositionsByPositionQuery = { __typename?: 'Query', dispositionsByPosition: Array<{ __typename?: 'TaxLotDisposition', id: string, lotId: string, positionId: string, portfolioId: string, assetId: string, transactionId?: string | null, acquiredAt: any, soldAt: any, quantity: number, costBasisPerUnit: number, sellPricePerUnit: number, costBasis: number, proceeds: number, realizedGainLoss: number, method: string, holdingPeriodDays: number, isLongTerm: boolean, isTaxExempt: boolean }> };

export type GetTaxHarvestOpportunitiesQueryVariables = Exact<{
  portfolioId: Scalars['ID']['input'];
}>;


export type GetTaxHarvestOpportunitiesQuery = { __typename?: 'Query', taxHarvestOpportunities: Array<{ __typename?: 'TaxHarvestOpportunity', positionId: string, symbol: string, name: string, harvestableLoss: number, eligibleLotsCount: number }> };

export type GetRealizedGainsQueryVariables = Exact<{
  portfolioId: Scalars['ID']['input'];
  dateFrom: Scalars['Time']['input'];
  dateTo: Scalars['Time']['input'];
}>;


export type GetRealizedGainsQuery = { __typename?: 'Query', realizedGains: { __typename?: 'RealizedGainsSummary', portfolioId: string, dateFrom: any, dateTo: any, totalRealized: number, shortTermGains: number, longTermGains: number, dispositionCount: number, transactionCount: number, taxWrapper: string, taxJurisdiction: string, isTaxExempt: boolean } };

export type GetTransactionsByAccountQueryVariables = Exact<{
  filter?: InputMaybe<TransactionFilter>;
  pagination?: InputMaybe<PaginationInput>;
}>;


export type GetTransactionsByAccountQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, accountId?: string | null, transactionType: TransactionType, quantity: number, amount?: number | null, unitPriceAmount?: number | null, unitPriceCurrency: string, feesAmount: number, feesCurrency: string, executedAt: any, notes?: string | null, account?: { __typename?: 'Account', id: string, name: string, institution?: string | null } | null, asset?: { __typename?: 'BankAccount', id: string, symbol?: string | null, name: string } | { __typename?: 'Crypto', id: string, symbol?: string | null, name: string } | { __typename?: 'Fund', id: string, symbol?: string | null, name: string } | { __typename?: 'LifeInsurance', id: string, symbol?: string | null, name: string } | { __typename?: 'Loan', id: string, symbol?: string | null, name: string } | { __typename?: 'RealEstate', id: string, symbol?: string | null, name: string } | { __typename?: 'Stock', id: string, symbol?: string | null, name: string } | { __typename?: 'Watch', id: string, symbol?: string | null, name: string } | null, portfolio: { __typename?: 'Portfolio', id: string, name: string } }> };

export type GetAllTransactionsQueryVariables = Exact<{
  filter?: InputMaybe<TransactionFilter>;
  pagination?: InputMaybe<PaginationInput>;
}>;


export type GetAllTransactionsQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, accountId?: string | null, transactionType: TransactionType, quantity: number, amount?: number | null, unitPriceAmount?: number | null, unitPriceCurrency: string, feesAmount: number, feesCurrency: string, executedAt: any, notes?: string | null, account?: { __typename?: 'Account', id: string, name: string, institution?: string | null } | null, asset?: { __typename?: 'BankAccount', id: string, symbol?: string | null, name: string } | { __typename?: 'Crypto', id: string, symbol?: string | null, name: string } | { __typename?: 'Fund', id: string, symbol?: string | null, name: string } | { __typename?: 'LifeInsurance', id: string, symbol?: string | null, name: string } | { __typename?: 'Loan', id: string, symbol?: string | null, name: string } | { __typename?: 'RealEstate', id: string, symbol?: string | null, name: string } | { __typename?: 'Stock', id: string, symbol?: string | null, name: string } | { __typename?: 'Watch', id: string, symbol?: string | null, name: string } | null, portfolio: { __typename?: 'Portfolio', id: string, name: string } }> };

export type GetWalletDevicesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetWalletDevicesQuery = { __typename?: 'Query', walletDevices: Array<{ __typename?: 'WalletDevice', id: string, name: string, deviceType: WalletDeviceType, createdAt: any, accounts: Array<{ __typename?: 'WalletAccount', id: string, portfolioId?: string | null, network: BlockchainNetwork, addressOrXpub: string, isActive: boolean, lastSyncAt?: any | null, historyStatus: string, capabilityLevel: WalletCapabilityLevel, balances: Array<{ __typename?: 'WalletBalance', id: string, symbol: string, name?: string | null, decimals: number, formattedQuantity: number, rawBalance: string, tokenAddress?: string | null, isSpam: boolean, isHidden: boolean, isStale: boolean, costBasisPerUnit?: number | null, costBasisCurrency?: string | null, costBasisType?: string | null, autoEstimatedBasis?: number | null, acquiredAt?: any | null, currentPrice?: number | null, currentValue?: number | null, dayChange24h?: number | null, priceUpdatedAt?: any | null, priceSource?: string | null, isPriceResolved: boolean }> }> }> };

export type GetWalletAccountsQueryVariables = Exact<{
  portfolioId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetWalletAccountsQuery = { __typename?: 'Query', walletAccounts: Array<{ __typename?: 'WalletAccount', id: string, portfolioId?: string | null, deviceId?: string | null, network: BlockchainNetwork, addressOrXpub: string, isXpub: boolean, label?: string | null, isActive: boolean, lastSyncAt?: any | null, historyStatus: string, capabilityLevel: WalletCapabilityLevel, lastSyncError?: string | null, createdAt: any, updatedAt: any, device?: { __typename?: 'WalletDevice', id: string, name: string, deviceType: WalletDeviceType } | null, balances: Array<{ __typename?: 'WalletBalance', id: string, symbol: string, name?: string | null, decimals: number, formattedQuantity: number, rawBalance: string, tokenAddress?: string | null, isSpam: boolean, isHidden: boolean, isStale: boolean, costBasisPerUnit?: number | null, costBasisCurrency?: string | null, costBasisType?: string | null, autoEstimatedBasis?: number | null, acquiredAt?: any | null, currentPrice?: number | null, currentValue?: number | null, dayChange24h?: number | null, priceUpdatedAt?: any | null, priceSource?: string | null, isPriceResolved: boolean, lastUpdatedAt: any }> }> };

export type GetWalletCuUsageQueryVariables = Exact<{ [key: string]: never; }>;


export type GetWalletCuUsageQuery = { __typename?: 'Query', walletCUUsage: { __typename?: 'WalletCUUsage', billingMonth: string, consumedUnits: number, maxQuota: number, isThrottled: boolean, hasKey: boolean, keySource?: string | null, maskedKey?: string | null } };

export type GetPendingWalletReviewsQueryVariables = Exact<{
  portfolioId: Scalars['ID']['input'];
}>;


export type GetPendingWalletReviewsQuery = { __typename?: 'Query', pendingWalletReviews: Array<{ __typename?: 'WalletActivityReview', id: string, walletActivityId: string, reviewStatus: string, suggestedType: string, notes?: string | null, createdAt: any }> };

export type GetBlockchainNetworkConfigsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetBlockchainNetworkConfigsQuery = { __typename?: 'Query', blockchainNetworkConfigs: Array<{ __typename?: 'BlockchainNetworkConfig', network: BlockchainNetwork, rpcUrl: string, explorerApiUrl?: string | null, source: string, updatedAt: any }> };

export type InvalidationProbeQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type InvalidationProbeQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string }>, watchlists: Array<{ __typename?: 'Watchlist', id: string, name: string }> };

export type GetAssetsQueryVariables = Exact<{
  filter?: InputMaybe<AssetFilter>;
  pagination?: InputMaybe<PaginationInput>;
  orderBy?: InputMaybe<AssetOrder>;
}>;


export type GetAssetsQuery = { __typename?: 'Query', assets: Array<{ __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } }> };

export type GetAssetTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAssetTypesQuery = { __typename?: 'Query', assetTypes: Array<{ __typename?: 'AssetType', id: string, name: string }> };

export type AddAssetToPortfolioHookMutationVariables = Exact<{
  input: PortfolioAssetInput;
}>;


export type AddAssetToPortfolioHookMutation = { __typename?: 'Mutation', addAssetToPortfolio: { __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } } };

export type RemoveAssetFromPortfolioMutationVariables = Exact<{
  portfolioID: Scalars['ID']['input'];
  assetID: Scalars['ID']['input'];
  accountID?: InputMaybe<Scalars['ID']['input']>;
}>;


export type RemoveAssetFromPortfolioMutation = { __typename?: 'Mutation', removeAssetFromPortfolio: string };

export type UpdateAssetInPortfolioMutationVariables = Exact<{
  input: PortfolioAssetInput;
}>;


export type UpdateAssetInPortfolioMutation = { __typename?: 'Mutation', updateAssetInPortfolio: { __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } } };

export type PortfolioFieldsFragment = { __typename?: 'Portfolio', id: string, name: string, description?: string | null, createdAt: any, updatedAt: any } & { ' $fragmentName'?: 'PortfolioFieldsFragment' };

export type GetFinanceDatabaseSyncStatusHookQueryVariables = Exact<{ [key: string]: never; }>;


export type GetFinanceDatabaseSyncStatusHookQuery = { __typename?: 'Query', financeDatabaseSyncStatus: { __typename?: 'FinanceDatabaseSyncStatusPayload', assetTypes: Array<{ __typename?: 'FinanceDatabaseSyncItem', assetType: AssetSyncType, isEnabled: boolean, lastSynced?: any | null, recordCount: number, syncStatus: SyncStatus, progress?: number | null, currentRecord?: string | null, errorMessage?: string | null }> } };

export type GetFinanceDatabaseSyncHistoryHookQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetFinanceDatabaseSyncHistoryHookQuery = { __typename?: 'Query', financeDatabaseSyncHistory: Array<{ __typename?: 'FinanceDatabaseSyncHistoryEntry', id: string, timestamp: any, assetType: AssetSyncType, recordCount: number, status: SyncStatus, errorMessage?: string | null }> };

export type GetFinanceDatabasePreviewHookQueryVariables = Exact<{
  assetType: AssetSyncType;
  search?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetFinanceDatabasePreviewHookQuery = { __typename?: 'Query', financeDatabasePreview: Array<{ __typename?: 'FinanceDatabasePreviewItem', symbol: string, name: string, exchange: string, sector?: string | null, country?: string | null }> };

export type TriggerFinanceDatabaseSyncHookMutationVariables = Exact<{
  assetType: AssetSyncType;
}>;


export type TriggerFinanceDatabaseSyncHookMutation = { __typename?: 'Mutation', triggerFinanceDatabaseSync: { __typename?: 'TriggerFinanceDatabaseSyncPayload', success: boolean, message: string, syncStatus: { __typename?: 'FinanceDatabaseSyncItem', assetType: AssetSyncType, syncStatus: SyncStatus, progress?: number | null } } };

export type UpdateFinanceDatabaseSyncEnabledHookMutationVariables = Exact<{
  assetType: AssetSyncType;
  enabled: Scalars['Boolean']['input'];
}>;


export type UpdateFinanceDatabaseSyncEnabledHookMutation = { __typename?: 'Mutation', updateFinanceDatabaseSyncEnabled: { __typename?: 'FinanceDatabaseSyncItem', assetType: AssetSyncType, isEnabled: boolean } };

export type ImportFinanceDatabaseAssetsHookMutationVariables = Exact<{
  assetType: AssetSyncType;
  symbols: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type ImportFinanceDatabaseAssetsHookMutation = { __typename?: 'Mutation', importFinanceDatabaseAssets: { __typename?: 'ImportFinanceDatabaseAssetsPayload', success: boolean, importedCount: number, errors: Array<string> } };

export type GetMarketDataBySymbolQueryVariables = Exact<{
  symbol: Scalars['String']['input'];
  assetType: Scalars['String']['input'];
  interval: Scalars['String']['input'];
  from: Scalars['Time']['input'];
  to: Scalars['Time']['input'];
  limit: Scalars['Int']['input'];
}>;


export type GetMarketDataBySymbolQuery = { __typename?: 'Query', candles: Array<{ __typename?: 'Candle', timestamp: any, open: number, high: number, low: number, close: number, volume?: number | null }>, realTimePrice?: { __typename?: 'Candle', close: number, timestamp: any } | null };

export type GetMarketDataByInstrumentQueryVariables = Exact<{
  instrumentId: Scalars['ID']['input'];
  interval: Scalars['String']['input'];
  from: Scalars['Time']['input'];
  to: Scalars['Time']['input'];
  limit: Scalars['Int']['input'];
  preferredProvider?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetMarketDataByInstrumentQuery = { __typename?: 'Query', candlesByInstrument: { __typename?: 'MarketDataCandlesPayload', sourceProvider: string, fallbackUsed: boolean, candles: Array<{ __typename?: 'Candle', timestamp: any, open: number, high: number, low: number, close: number, volume?: number | null }> }, realTimePriceByInstrument?: { __typename?: 'MarketDataCandlePayload', sourceProvider: string, fallbackUsed: boolean, candle?: { __typename?: 'Candle', close: number, timestamp: any } | null } | null };

export type GetMarketDataChartQueryVariables = Exact<{
  instrumentId: Scalars['ID']['input'];
  interval: Scalars['String']['input'];
  from: Scalars['Time']['input'];
  to: Scalars['Time']['input'];
  limit: Scalars['Int']['input'];
  preferredProvider?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetMarketDataChartQuery = { __typename?: 'Query', candlesByInstrument: { __typename?: 'MarketDataCandlesPayload', candles: Array<{ __typename?: 'Candle', timestamp: any, close: number }> } };

export const AlertResultFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlertResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Alert"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"alertType"}},{"kind":"Field","name":{"kind":"Name","value":"conditionType"}},{"kind":"Field","name":{"kind":"Name","value":"thresholdValue"}},{"kind":"Field","name":{"kind":"Name","value":"thresholdPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"lastTriggered"}},{"kind":"Field","name":{"kind":"Name","value":"notificationMethods"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<AlertResultFragment, unknown>;
export const WatchlistResultFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WatchlistResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Watchlist"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<WatchlistResultFragment, unknown>;
export const PortfolioFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PortfolioFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Portfolio"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<PortfolioFieldsFragment, unknown>;
export const CreateAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateAccountInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"syncProvider"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerName"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUserId"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"syncConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}}]}},{"kind":"Field","name":{"kind":"Name","value":"positionsCount"}},{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CreateAccountMutation, CreateAccountMutationVariables>;
export const UpdateAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateAccountInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"syncProvider"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerName"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUserId"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"syncConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}}]}},{"kind":"Field","name":{"kind":"Name","value":"positionsCount"}},{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateAccountMutation, UpdateAccountMutationVariables>;
export const DeleteAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteAccountMutation, DeleteAccountMutationVariables>;
export const AdminCreateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminCreateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AdminCreateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminCreateUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"taxJurisdiction"}},{"kind":"Field","name":{"kind":"Name","value":"isLocked"}},{"kind":"Field","name":{"kind":"Name","value":"failedLoginCount"}}]}}]}}]} as unknown as DocumentNode<AdminCreateUserMutation, AdminCreateUserMutationVariables>;
export const AdminUpdateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminUpdateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AdminUpdateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminUpdateUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"taxJurisdiction"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<AdminUpdateUserMutation, AdminUpdateUserMutationVariables>;
export const AdminSetUserRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminSetUserRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"role"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminSetUserRole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"role"},"value":{"kind":"Variable","name":{"kind":"Name","value":"role"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<AdminSetUserRoleMutation, AdminSetUserRoleMutationVariables>;
export const AdminSetUserLockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminSetUserLock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locked"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lockUntil"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminSetUserLock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"locked"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locked"}}},{"kind":"Argument","name":{"kind":"Name","value":"lockUntil"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lockUntil"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lockedUntil"}},{"kind":"Field","name":{"kind":"Name","value":"isLocked"}},{"kind":"Field","name":{"kind":"Name","value":"failedLoginCount"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<AdminSetUserLockMutation, AdminSetUserLockMutationVariables>;
export const AdminSetUserPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminSetUserPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminSetUserPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<AdminSetUserPasswordMutation, AdminSetUserPasswordMutationVariables>;
export const AdminSetUserEmailVerifiedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminSetUserEmailVerified"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"verified"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminSetUserEmailVerified"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"verified"},"value":{"kind":"Variable","name":{"kind":"Name","value":"verified"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<AdminSetUserEmailVerifiedMutation, AdminSetUserEmailVerifiedMutationVariables>;
export const AdminDeleteUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminDeleteUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hardDelete"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},"defaultValue":{"kind":"BooleanValue","value":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminDeleteUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"hardDelete"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hardDelete"}}}]}]}}]} as unknown as DocumentNode<AdminDeleteUserMutation, AdminDeleteUserMutationVariables>;
export const CreateAlertDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateAlert"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateAlertInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAlert"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlertResult"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlertResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Alert"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"alertType"}},{"kind":"Field","name":{"kind":"Name","value":"conditionType"}},{"kind":"Field","name":{"kind":"Name","value":"thresholdValue"}},{"kind":"Field","name":{"kind":"Name","value":"thresholdPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"lastTriggered"}},{"kind":"Field","name":{"kind":"Name","value":"notificationMethods"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<CreateAlertMutation, CreateAlertMutationVariables>;
export const CreateStockAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateStockAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateStockInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createStockAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"ticker"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateStockAssetMutation, CreateStockAssetMutationVariables>;
export const CreateBankAccountAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBankAccountAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBankAccountInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBankAccountAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"accountType"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}},{"kind":"Field","name":{"kind":"Name","value":"balance"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateBankAccountAssetMutation, CreateBankAccountAssetMutationVariables>;
export const CreateCryptoAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateCryptoAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateCryptoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCryptoAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"walletAddress"}},{"kind":"Field","name":{"kind":"Name","value":"blockchainNetwork"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateCryptoAssetMutation, CreateCryptoAssetMutationVariables>;
export const CreateRealEstateAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRealEstateAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRealEstateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRealEstateAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"propertyType"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"zipCode"}},{"kind":"Field","name":{"kind":"Name","value":"squareFeet"}},{"kind":"Field","name":{"kind":"Name","value":"landSurface"}},{"kind":"Field","name":{"kind":"Name","value":"yearBuilt"}},{"kind":"Field","name":{"kind":"Name","value":"bedrooms"}},{"kind":"Field","name":{"kind":"Name","value":"bathrooms"}},{"kind":"Field","name":{"kind":"Name","value":"rooms"}},{"kind":"Field","name":{"kind":"Name","value":"floor"}},{"kind":"Field","name":{"kind":"Name","value":"totalFloors"}},{"kind":"Field","name":{"kind":"Name","value":"garages"}},{"kind":"Field","name":{"kind":"Name","value":"parkingSpaces"}},{"kind":"Field","name":{"kind":"Name","value":"energyLabel"}},{"kind":"Field","name":{"kind":"Name","value":"condition"}},{"kind":"Field","name":{"kind":"Name","value":"agencyFees"}},{"kind":"Field","name":{"kind":"Name","value":"notaryFees"}},{"kind":"Field","name":{"kind":"Name","value":"renovationFees"}},{"kind":"Field","name":{"kind":"Name","value":"furnishingCosts"}},{"kind":"Field","name":{"kind":"Name","value":"rentalType"}},{"kind":"Field","name":{"kind":"Name","value":"rentalPeriod"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"utilityCosts"}},{"kind":"Field","name":{"kind":"Name","value":"yearlyMiscCosts"}},{"kind":"Field","name":{"kind":"Name","value":"hasGarden"}},{"kind":"Field","name":{"kind":"Name","value":"hasBalcony"}},{"kind":"Field","name":{"kind":"Name","value":"hasLift"}},{"kind":"Field","name":{"kind":"Name","value":"hasPool"}},{"kind":"Field","name":{"kind":"Name","value":"hasSauna"}},{"kind":"Field","name":{"kind":"Name","value":"isFurnished"}},{"kind":"Field","name":{"kind":"Name","value":"isNewConstruction"}},{"kind":"Field","name":{"kind":"Name","value":"kitchenQuality"}},{"kind":"Field","name":{"kind":"Name","value":"kitchenCondition"}},{"kind":"Field","name":{"kind":"Name","value":"bathroomQuality"}},{"kind":"Field","name":{"kind":"Name","value":"bathroomCondition"}},{"kind":"Field","name":{"kind":"Name","value":"flooringQuality"}},{"kind":"Field","name":{"kind":"Name","value":"flooringCondition"}},{"kind":"Field","name":{"kind":"Name","value":"windowsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"windowsCondition"}},{"kind":"Field","name":{"kind":"Name","value":"generalQuality"}},{"kind":"Field","name":{"kind":"Name","value":"generalCondition"}},{"kind":"Field","name":{"kind":"Name","value":"linkedLoanId"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipStructure"}},{"kind":"Field","name":{"kind":"Name","value":"addressLabel"}},{"kind":"Field","name":{"kind":"Name","value":"cityCode"}},{"kind":"Field","name":{"kind":"Name","value":"banId"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"hasOutdoor"}},{"kind":"Field","name":{"kind":"Name","value":"isGroundFloor"}},{"kind":"Field","name":{"kind":"Name","value":"valuationMode"}},{"kind":"Field","name":{"kind":"Name","value":"estimationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"manualValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedPricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"basePricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"valuationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"comparablesCount"}},{"kind":"Field","name":{"kind":"Name","value":"searchRadiusMeters"}},{"kind":"Field","name":{"kind":"Name","value":"lastEstimatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"valuationHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}}]}},{"kind":"Field","name":{"kind":"Name","value":"marketRentPerM2"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMonthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedGrossYield"}},{"kind":"Field","name":{"kind":"Name","value":"rentalR2Adjusted"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateRealEstateAssetMutation, CreateRealEstateAssetMutationVariables>;
export const UpdateRealEstateAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRealEstateAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateRealEstateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRealEstateAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"propertyType"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"zipCode"}},{"kind":"Field","name":{"kind":"Name","value":"squareFeet"}},{"kind":"Field","name":{"kind":"Name","value":"landSurface"}},{"kind":"Field","name":{"kind":"Name","value":"yearBuilt"}},{"kind":"Field","name":{"kind":"Name","value":"bedrooms"}},{"kind":"Field","name":{"kind":"Name","value":"bathrooms"}},{"kind":"Field","name":{"kind":"Name","value":"rooms"}},{"kind":"Field","name":{"kind":"Name","value":"floor"}},{"kind":"Field","name":{"kind":"Name","value":"totalFloors"}},{"kind":"Field","name":{"kind":"Name","value":"garages"}},{"kind":"Field","name":{"kind":"Name","value":"parkingSpaces"}},{"kind":"Field","name":{"kind":"Name","value":"energyLabel"}},{"kind":"Field","name":{"kind":"Name","value":"condition"}},{"kind":"Field","name":{"kind":"Name","value":"agencyFees"}},{"kind":"Field","name":{"kind":"Name","value":"notaryFees"}},{"kind":"Field","name":{"kind":"Name","value":"renovationFees"}},{"kind":"Field","name":{"kind":"Name","value":"furnishingCosts"}},{"kind":"Field","name":{"kind":"Name","value":"rentalType"}},{"kind":"Field","name":{"kind":"Name","value":"rentalPeriod"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"utilityCosts"}},{"kind":"Field","name":{"kind":"Name","value":"yearlyMiscCosts"}},{"kind":"Field","name":{"kind":"Name","value":"hasGarden"}},{"kind":"Field","name":{"kind":"Name","value":"hasBalcony"}},{"kind":"Field","name":{"kind":"Name","value":"hasLift"}},{"kind":"Field","name":{"kind":"Name","value":"hasPool"}},{"kind":"Field","name":{"kind":"Name","value":"hasSauna"}},{"kind":"Field","name":{"kind":"Name","value":"isFurnished"}},{"kind":"Field","name":{"kind":"Name","value":"isNewConstruction"}},{"kind":"Field","name":{"kind":"Name","value":"kitchenQuality"}},{"kind":"Field","name":{"kind":"Name","value":"kitchenCondition"}},{"kind":"Field","name":{"kind":"Name","value":"bathroomQuality"}},{"kind":"Field","name":{"kind":"Name","value":"bathroomCondition"}},{"kind":"Field","name":{"kind":"Name","value":"flooringQuality"}},{"kind":"Field","name":{"kind":"Name","value":"flooringCondition"}},{"kind":"Field","name":{"kind":"Name","value":"windowsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"windowsCondition"}},{"kind":"Field","name":{"kind":"Name","value":"generalQuality"}},{"kind":"Field","name":{"kind":"Name","value":"generalCondition"}},{"kind":"Field","name":{"kind":"Name","value":"linkedLoanId"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipStructure"}},{"kind":"Field","name":{"kind":"Name","value":"addressLabel"}},{"kind":"Field","name":{"kind":"Name","value":"cityCode"}},{"kind":"Field","name":{"kind":"Name","value":"banId"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"hasOutdoor"}},{"kind":"Field","name":{"kind":"Name","value":"isGroundFloor"}},{"kind":"Field","name":{"kind":"Name","value":"valuationMode"}},{"kind":"Field","name":{"kind":"Name","value":"estimationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"manualValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedPricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"basePricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"valuationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"comparablesCount"}},{"kind":"Field","name":{"kind":"Name","value":"searchRadiusMeters"}},{"kind":"Field","name":{"kind":"Name","value":"lastEstimatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"valuationHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}}]}},{"kind":"Field","name":{"kind":"Name","value":"marketRentPerM2"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMonthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedGrossYield"}},{"kind":"Field","name":{"kind":"Name","value":"rentalR2Adjusted"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateRealEstateAssetMutation, UpdateRealEstateAssetMutationVariables>;
export const CreateLifeInsuranceAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateLifeInsuranceAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateLifeInsuranceInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createLifeInsuranceAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"policyNumber"}},{"kind":"Field","name":{"kind":"Name","value":"insurer"}},{"kind":"Field","name":{"kind":"Name","value":"policyType"}},{"kind":"Field","name":{"kind":"Name","value":"coverageAmount"}},{"kind":"Field","name":{"kind":"Name","value":"premiumAmount"}},{"kind":"Field","name":{"kind":"Name","value":"premiumFrequency"}},{"kind":"Field","name":{"kind":"Name","value":"beneficiaries"}},{"kind":"Field","name":{"kind":"Name","value":"maturityDate"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateLifeInsuranceAssetMutation, CreateLifeInsuranceAssetMutationVariables>;
export const CreateWatchAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWatchAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateWatchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createWatchAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"brand"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"serialNumber"}},{"kind":"Field","name":{"kind":"Name","value":"referenceNumber"}},{"kind":"Field","name":{"kind":"Name","value":"condition"}},{"kind":"Field","name":{"kind":"Name","value":"yearMade"}},{"kind":"Field","name":{"kind":"Name","value":"material"}},{"kind":"Field","name":{"kind":"Name","value":"movement"}},{"kind":"Field","name":{"kind":"Name","value":"caseSize"}},{"kind":"Field","name":{"kind":"Name","value":"waterResistance"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateWatchAssetMutation, CreateWatchAssetMutationVariables>;
export const CreateLoanAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateLoanAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateLoanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createLoanAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"loanType"}},{"kind":"Field","name":{"kind":"Name","value":"loanAmount"}},{"kind":"Field","name":{"kind":"Name","value":"remainingBalance"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}},{"kind":"Field","name":{"kind":"Name","value":"durationMonths"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyPayment"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"lender"}},{"kind":"Field","name":{"kind":"Name","value":"loanNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"downPayment"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipMode"}},{"kind":"Field","name":{"kind":"Name","value":"applicationFee"}},{"kind":"Field","name":{"kind":"Name","value":"brokerFee"}},{"kind":"Field","name":{"kind":"Name","value":"insuranceFee"}},{"kind":"Field","name":{"kind":"Name","value":"otherFees"}},{"kind":"Field","name":{"kind":"Name","value":"earlyRepaymentFee"}},{"kind":"Field","name":{"kind":"Name","value":"linkedAssetIDs"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}}]}},{"kind":"Field","name":{"kind":"Name","value":"coOwners"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"companyOwners"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"companyId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"registrationNumber"}},{"kind":"Field","name":{"kind":"Name","value":"legalForm"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateLoanAssetMutation, CreateLoanAssetMutationVariables>;
export const AddAssetToPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAssetToPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PortfolioAssetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAssetToPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}}]}}]}}]} as unknown as DocumentNode<AddAssetToPortfolioMutation, AddAssetToPortfolioMutationVariables>;
export const RefreshSingleAssetPriceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshSingleAssetPrice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshSingleAssetPrice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"price"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}}]}}]} as unknown as DocumentNode<RefreshSingleAssetPriceMutation, RefreshSingleAssetPriceMutationVariables>;
export const RefreshRealEstateValuationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshRealEstateValuation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshRealEstateValuation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"propertyType"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"zipCode"}},{"kind":"Field","name":{"kind":"Name","value":"squareFeet"}},{"kind":"Field","name":{"kind":"Name","value":"landSurface"}},{"kind":"Field","name":{"kind":"Name","value":"yearBuilt"}},{"kind":"Field","name":{"kind":"Name","value":"bedrooms"}},{"kind":"Field","name":{"kind":"Name","value":"bathrooms"}},{"kind":"Field","name":{"kind":"Name","value":"rooms"}},{"kind":"Field","name":{"kind":"Name","value":"floor"}},{"kind":"Field","name":{"kind":"Name","value":"totalFloors"}},{"kind":"Field","name":{"kind":"Name","value":"garages"}},{"kind":"Field","name":{"kind":"Name","value":"parkingSpaces"}},{"kind":"Field","name":{"kind":"Name","value":"energyLabel"}},{"kind":"Field","name":{"kind":"Name","value":"condition"}},{"kind":"Field","name":{"kind":"Name","value":"addressLabel"}},{"kind":"Field","name":{"kind":"Name","value":"cityCode"}},{"kind":"Field","name":{"kind":"Name","value":"banId"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"hasOutdoor"}},{"kind":"Field","name":{"kind":"Name","value":"isGroundFloor"}},{"kind":"Field","name":{"kind":"Name","value":"valuationMode"}},{"kind":"Field","name":{"kind":"Name","value":"estimationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"manualValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedPricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"basePricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"valuationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"comparablesCount"}},{"kind":"Field","name":{"kind":"Name","value":"searchRadiusMeters"}},{"kind":"Field","name":{"kind":"Name","value":"lastEstimatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"valuationHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}}]}},{"kind":"Field","name":{"kind":"Name","value":"marketRentPerM2"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMonthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedGrossYield"}},{"kind":"Field","name":{"kind":"Name","value":"rentalR2Adjusted"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<RefreshRealEstateValuationMutation, RefreshRealEstateValuationMutationVariables>;
export const RegisterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Register"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"register"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"themePreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeBaseColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeAccentColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeFontPreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeHeadingFont"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuAccent"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeStyle"}},{"kind":"Field","name":{"kind":"Name","value":"themeRadius"}},{"kind":"Field","name":{"kind":"Name","value":"themeRTL"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterMutation, RegisterMutationVariables>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"themePreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeBaseColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeAccentColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeFontPreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeHeadingFont"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuAccent"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeStyle"}},{"kind":"Field","name":{"kind":"Name","value":"themeRadius"}},{"kind":"Field","name":{"kind":"Name","value":"themeRTL"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogoutInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const ResetPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PasswordResetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const ConfirmPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PasswordResetConfirmInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ConfirmPasswordResetMutation, ConfirmPasswordResetMutationVariables>;
export const VerifyEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EmailVerificationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<VerifyEmailMutation, VerifyEmailMutationVariables>;
export const ResendVerificationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendVerification"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResendVerificationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resendVerification"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ResendVerificationMutation, ResendVerificationMutationVariables>;
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RefreshTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"themePreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeBaseColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeAccentColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeFontPreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeHeadingFont"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuAccent"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeStyle"}},{"kind":"Field","name":{"kind":"Name","value":"themeRadius"}},{"kind":"Field","name":{"kind":"Name","value":"themeRTL"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const PersistDiscoveredInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PersistDiscoveredInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PersistDiscoveredInstrumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"persistDiscoveredInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"isin"}},{"kind":"Field","name":{"kind":"Name","value":"figi"}},{"kind":"Field","name":{"kind":"Name","value":"cusip"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<PersistDiscoveredInstrumentMutation, PersistDiscoveredInstrumentMutationVariables>;
export const ImportInstrumentFromSourceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportInstrumentFromSource"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ImportInstrumentFromSourceInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importInstrumentFromSource"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"instrument"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"isin"}},{"kind":"Field","name":{"kind":"Name","value":"figi"}},{"kind":"Field","name":{"kind":"Name","value":"cusip"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<ImportInstrumentFromSourceMutation, ImportInstrumentFromSourceMutationVariables>;
export const ImportInstrumentFromCatalogDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportInstrumentFromCatalog"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"source"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CatalogSource"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"externalId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"forceEnrich"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importInstrumentFromCatalog"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"source"},"value":{"kind":"Variable","name":{"kind":"Name","value":"source"}}},{"kind":"Argument","name":{"kind":"Name","value":"externalId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"externalId"}}},{"kind":"Argument","name":{"kind":"Name","value":"forceEnrich"},"value":{"kind":"Variable","name":{"kind":"Name","value":"forceEnrich"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"instrument"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"isin"}},{"kind":"Field","name":{"kind":"Name","value":"figi"}},{"kind":"Field","name":{"kind":"Name","value":"cusip"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<ImportInstrumentFromCatalogMutation, ImportInstrumentFromCatalogMutationVariables>;
export const AddInstrumentToPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddInstrumentToPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddInstrumentHoldingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addInstrumentToPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}}]}}]}}]}}]} as unknown as DocumentNode<AddInstrumentToPortfolioMutation, AddInstrumentToPortfolioMutationVariables>;
export const UpdateManualInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateManualInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateManualInstrumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateManualInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedName"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"baseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"underlyingSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateManualInstrumentMutation, UpdateManualInstrumentMutationVariables>;
export const ArchiveManualInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchiveManualInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiveManualInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<ArchiveManualInstrumentMutation, ArchiveManualInstrumentMutationVariables>;
export const RestoreManualInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestoreManualInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restoreManualInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<RestoreManualInstrumentMutation, RestoreManualInstrumentMutationVariables>;
export const RetryHistoricalDataBackfillJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetryHistoricalDataBackfillJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retryHistoricalDataBackfillJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"step"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<RetryHistoricalDataBackfillJobMutation, RetryHistoricalDataBackfillJobMutationVariables>;
export const UpsertMarketDataCredentialDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpsertMarketDataCredential"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"priority"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upsertMarketDataCredential"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"apiKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}}},{"kind":"Argument","name":{"kind":"Name","value":"isEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"priority"},"value":{"kind":"Variable","name":{"kind":"Name","value":"priority"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"lastValidatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpsertMarketDataCredentialMutation, UpsertMarketDataCredentialMutationVariables>;
export const DeleteMarketDataCredentialDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMarketDataCredential"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMarketDataCredential"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}]}]}}]} as unknown as DocumentNode<DeleteMarketDataCredentialMutation, DeleteMarketDataCredentialMutationVariables>;
export const ValidateProviderCredentialsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ValidateProviderCredentials"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"validateProviderCredentials"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"apiKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<ValidateProviderCredentialsMutation, ValidateProviderCredentialsMutationVariables>;
export const UpdateProviderRoutingPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProviderRoutingPreferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ProviderRoutingPreferencesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProviderRoutingPreferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"preferredProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}},{"kind":"Field","name":{"kind":"Name","value":"useIntelligentRouting"}},{"kind":"Field","name":{"kind":"Name","value":"enableFallback"}},{"kind":"Field","name":{"kind":"Name","value":"staleDataThresholdMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateProviderRoutingPreferencesMutation, UpdateProviderRoutingPreferencesMutationVariables>;
export const InstallMarketDataPackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InstallMarketDataPack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"packId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"installMarketDataPack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"packId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"packId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"jobType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<InstallMarketDataPackMutation, InstallMarketDataPackMutationVariables>;
export const UpdateMarketDataPackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMarketDataPack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"packId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMarketDataPack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"packId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"packId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"jobType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateMarketDataPackMutation, UpdateMarketDataPackMutationVariables>;
export const RemoveMarketDataPackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveMarketDataPack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"packId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeMarketDataPack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"packId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"packId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"jobType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<RemoveMarketDataPackMutation, RemoveMarketDataPackMutationVariables>;
export const RepairMarketDataPackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RepairMarketDataPack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"packId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repairMarketDataPack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"packId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"packId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"jobType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<RepairMarketDataPackMutation, RepairMarketDataPackMutationVariables>;
export const CancelMarketDataPackJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelMarketDataPackJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"jobId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelMarketDataPackJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"jobId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"jobId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"jobType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<CancelMarketDataPackJobMutation, CancelMarketDataPackJobMutationVariables>;
export const StartLocalPackBuildDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartLocalPackBuild"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartLocalPackBuildInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startLocalPackBuild"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"sourceProvider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"currentSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentDate"}},{"kind":"Field","name":{"kind":"Name","value":"currentAssetType"}},{"kind":"Field","name":{"kind":"Name","value":"totalSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"failedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedDates"}},{"kind":"Field","name":{"kind":"Name","value":"totalDates"}},{"kind":"Field","name":{"kind":"Name","value":"rowsWritten"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<StartLocalPackBuildMutation, StartLocalPackBuildMutationVariables>;
export const CancelPackBuildJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelPackBuildJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelPackBuildJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"sourceProvider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"currentSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentDate"}},{"kind":"Field","name":{"kind":"Name","value":"currentAssetType"}},{"kind":"Field","name":{"kind":"Name","value":"totalSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"failedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedDates"}},{"kind":"Field","name":{"kind":"Name","value":"totalDates"}},{"kind":"Field","name":{"kind":"Name","value":"rowsWritten"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<CancelPackBuildJobMutation, CancelPackBuildJobMutationVariables>;
export const CreatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<CreatePortfolioMutation, CreatePortfolioMutationVariables>;
export const UpdatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<UpdatePortfolioMutation, UpdatePortfolioMutationVariables>;
export const DeletePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeletePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deletePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeletePortfolioMutation, DeletePortfolioMutationVariables>;
export const DuplicatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DuplicatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DuplicatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"duplicatePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<DuplicatePortfolioMutation, DuplicatePortfolioMutationVariables>;
export const TriggerFinanceDatabaseSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TriggerFinanceDatabaseSync"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"triggerFinanceDatabaseSync"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}}]}}]}}]}}]} as unknown as DocumentNode<TriggerFinanceDatabaseSyncMutation, TriggerFinanceDatabaseSyncMutationVariables>;
export const UpdateFinanceDatabaseSyncEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateFinanceDatabaseSyncEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFinanceDatabaseSyncEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}}]}}]}}]} as unknown as DocumentNode<UpdateFinanceDatabaseSyncEnabledMutation, UpdateFinanceDatabaseSyncEnabledMutationVariables>;
export const ImportFinanceDatabaseAssetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportFinanceDatabaseAssets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importFinanceDatabaseAssets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"symbols"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"importedCount"}},{"kind":"Field","name":{"kind":"Name","value":"errors"}}]}}]}}]} as unknown as DocumentNode<ImportFinanceDatabaseAssetsMutation, ImportFinanceDatabaseAssetsMutationVariables>;
export const RegisterSyncCredentialDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterSyncCredential"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"credentials"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerSyncCredential"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"credentials"},"value":{"kind":"Variable","name":{"kind":"Name","value":"credentials"}}},{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<RegisterSyncCredentialMutation, RegisterSyncCredentialMutationVariables>;
export const GenerateAggregatorLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateAggregatorLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"redirectUrl"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateAggregatorLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"redirectUrl"},"value":{"kind":"Variable","name":{"kind":"Name","value":"redirectUrl"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"link"}},{"kind":"Field","name":{"kind":"Name","value":"sessionToken"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}}]}}]}}]} as unknown as DocumentNode<GenerateAggregatorLinkMutation, GenerateAggregatorLinkMutationVariables>;
export const CompleteAggregatorAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteAggregatorAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeAggregatorAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"connectionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionToken"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"externalInstitutionId"}},{"kind":"Field","name":{"kind":"Name","value":"externalAccountId"}},{"kind":"Field","name":{"kind":"Name","value":"institutionName"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CompleteAggregatorAuthMutation, CompleteAggregatorAuthMutationVariables>;
export const LinkSyncAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LinkSyncAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accountId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"autoCreate"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"linkSyncAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"connectionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"accountId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accountId"}}},{"kind":"Argument","name":{"kind":"Name","value":"autoCreate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"autoCreate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"externalInstitutionId"}},{"kind":"Field","name":{"kind":"Name","value":"externalAccountId"}},{"kind":"Field","name":{"kind":"Name","value":"institutionName"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<LinkSyncAccountMutation, LinkSyncAccountMutationVariables>;
export const TriggerAccountSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TriggerAccountSync"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accountId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"triggerAccountSync"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"accountId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accountId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"connectionId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"itemsImported"}},{"kind":"Field","name":{"kind":"Name","value":"itemsUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]}}]} as unknown as DocumentNode<TriggerAccountSyncMutation, TriggerAccountSyncMutationVariables>;
export const InitiateWoobAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InitiateWoobAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"institution"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"login"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"region"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"initiateWoobAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"institution"},"value":{"kind":"Variable","name":{"kind":"Name","value":"institution"}}},{"kind":"Argument","name":{"kind":"Name","value":"login"},"value":{"kind":"Variable","name":{"kind":"Name","value":"login"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"region"},"value":{"kind":"Variable","name":{"kind":"Name","value":"region"}}},{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authSessionId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"countdownSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"challengeMessage"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<InitiateWoobAuthMutation, InitiateWoobAuthMutationVariables>;
export const PollWoobAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PollWoobAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"authSessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"otpCode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pollWoobAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"authSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"authSessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"otpCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"otpCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"connections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"externalInstitutionId"}},{"kind":"Field","name":{"kind":"Name","value":"externalAccountId"}},{"kind":"Field","name":{"kind":"Name","value":"institutionName"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<PollWoobAuthMutation, PollWoobAuthMutationVariables>;
export const InitiateTradeRepublicAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InitiateTradeRepublicAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"phoneNumber"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"initiateTradeRepublicAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"phoneNumber"},"value":{"kind":"Variable","name":{"kind":"Name","value":"phoneNumber"}}},{"kind":"Argument","name":{"kind":"Name","value":"pin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin"}}},{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authSessionId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"countdownSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<InitiateTradeRepublicAuthMutation, InitiateTradeRepublicAuthMutationVariables>;
export const PollTradeRepublicAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PollTradeRepublicAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"authSessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pollTradeRepublicAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"authSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"authSessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"connections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"externalInstitutionId"}},{"kind":"Field","name":{"kind":"Name","value":"externalAccountId"}},{"kind":"Field","name":{"kind":"Name","value":"institutionName"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<PollTradeRepublicAuthMutation, PollTradeRepublicAuthMutationVariables>;
export const InitiateEnableBankingAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InitiateEnableBankingAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"aspspName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"aspspCountry"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"redirectUrl"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"initiateEnableBankingAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"aspspName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"aspspName"}}},{"kind":"Argument","name":{"kind":"Name","value":"aspspCountry"},"value":{"kind":"Variable","name":{"kind":"Name","value":"aspspCountry"}}},{"kind":"Argument","name":{"kind":"Name","value":"redirectUrl"},"value":{"kind":"Variable","name":{"kind":"Name","value":"redirectUrl"}}},{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authSessionId"}},{"kind":"Field","name":{"kind":"Name","value":"authUrl"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<InitiateEnableBankingAuthMutation, InitiateEnableBankingAuthMutationVariables>;
export const CompleteEnableBankingAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteEnableBankingAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"state"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeEnableBankingAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}},{"kind":"Argument","name":{"kind":"Name","value":"state"},"value":{"kind":"Variable","name":{"kind":"Name","value":"state"}}},{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"externalInstitutionId"}},{"kind":"Field","name":{"kind":"Name","value":"externalAccountId"}},{"kind":"Field","name":{"kind":"Name","value":"institutionName"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CompleteEnableBankingAuthMutation, CompleteEnableBankingAuthMutationVariables>;
export const UpdateTransactionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTransaction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTransactionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTransaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}},{"kind":"Field","name":{"kind":"Name","value":"feesAmount"}},{"kind":"Field","name":{"kind":"Name","value":"feesCurrency"}}]}}]}}]} as unknown as DocumentNode<UpdateTransactionMutation, UpdateTransactionMutationVariables>;
export const DeleteTransactionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTransaction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTransaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteTransactionMutation, DeleteTransactionMutationVariables>;
export const UpdateUserDisplayCurrencyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserDisplayCurrency"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserDisplayCurrencyInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserDisplayCurrency"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}}]} as unknown as DocumentNode<UpdateUserDisplayCurrencyMutation, UpdateUserDisplayCurrencyMutationVariables>;
export const UpdateUserThemePreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserThemePreferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserThemePreferencesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserThemePreferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"themePreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeBaseColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeAccentColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeFontPreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeHeadingFont"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuAccent"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeStyle"}},{"kind":"Field","name":{"kind":"Name","value":"themeRadius"}},{"kind":"Field","name":{"kind":"Name","value":"themeRTL"}}]}}]}}]} as unknown as DocumentNode<UpdateUserThemePreferencesMutation, UpdateUserThemePreferencesMutationVariables>;
export const UpdateUserTaxJurisdictionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserTaxJurisdiction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserTaxJurisdictionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserTaxJurisdiction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taxJurisdiction"}}]}}]}}]} as unknown as DocumentNode<UpdateUserTaxJurisdictionMutation, UpdateUserTaxJurisdictionMutationVariables>;
export const CreateWalletDeviceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWalletDevice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateWalletDeviceInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createWalletDevice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"deviceType"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CreateWalletDeviceMutation, CreateWalletDeviceMutationVariables>;
export const AddWalletAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddWalletAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddWalletAccountInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addWalletAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"addressOrXpub"}},{"kind":"Field","name":{"kind":"Name","value":"isXpub"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"historyStatus"}},{"kind":"Field","name":{"kind":"Name","value":"balances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"formattedQuantity"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddWalletAccountMutation, AddWalletAccountMutationVariables>;
export const RemoveWalletAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveWalletAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeWalletAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RemoveWalletAccountMutation, RemoveWalletAccountMutationVariables>;
export const TriggerWalletSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TriggerWalletSync"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"triggerWalletSync"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<TriggerWalletSyncMutation, TriggerWalletSyncMutationVariables>;
export const ToggleSpamTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ToggleSpamToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isHidden"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toggleSpamToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"balanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"isHidden"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isHidden"}}}]}]}}]} as unknown as DocumentNode<ToggleSpamTokenMutation, ToggleSpamTokenMutationVariables>;
export const RefreshWalletBalancePriceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshWalletBalancePrice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshWalletBalancePrice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"balanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentPrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange24h"}},{"kind":"Field","name":{"kind":"Name","value":"priceUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"priceSource"}},{"kind":"Field","name":{"kind":"Name","value":"isPriceResolved"}}]}}]}}]} as unknown as DocumentNode<RefreshWalletBalancePriceMutation, RefreshWalletBalancePriceMutationVariables>;
export const ResolveWalletReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResolveWalletReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reviewId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"action"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"customType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resolveWalletReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reviewId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reviewId"}}},{"kind":"Argument","name":{"kind":"Name","value":"action"},"value":{"kind":"Variable","name":{"kind":"Name","value":"action"}}},{"kind":"Argument","name":{"kind":"Name","value":"customType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"customType"}}}]}]}}]} as unknown as DocumentNode<ResolveWalletReviewMutation, ResolveWalletReviewMutationVariables>;
export const ConfigureAlchemyKeyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfigureAlchemyKey"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"configureAlchemyKey"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"apiKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}}}]}]}}]} as unknown as DocumentNode<ConfigureAlchemyKeyMutation, ConfigureAlchemyKeyMutationVariables>;
export const SetWalletBalanceCostBasisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetWalletBalanceCostBasis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"costBasisPerUnit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"currency"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setWalletBalanceCostBasis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"balanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"costBasisPerUnit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"costBasisPerUnit"}}},{"kind":"Argument","name":{"kind":"Name","value":"currency"},"value":{"kind":"Variable","name":{"kind":"Name","value":"currency"}}}]}]}}]} as unknown as DocumentNode<SetWalletBalanceCostBasisMutation, SetWalletBalanceCostBasisMutationVariables>;
export const ResetWalletBalanceCostBasisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetWalletBalanceCostBasis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetWalletBalanceCostBasis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"balanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"balanceId"}}}]}]}}]} as unknown as DocumentNode<ResetWalletBalanceCostBasisMutation, ResetWalletBalanceCostBasisMutationVariables>;
export const AssignWalletDeviceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AssignWalletDevice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"walletAccountId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deviceId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignWalletDevice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"walletAccountId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"walletAccountId"}}},{"kind":"Argument","name":{"kind":"Name","value":"deviceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deviceId"}}}]}]}}]} as unknown as DocumentNode<AssignWalletDeviceMutation, AssignWalletDeviceMutationVariables>;
export const UpdateWalletDeviceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWalletDevice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deviceType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WalletDeviceType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWalletDevice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"deviceType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deviceType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"deviceType"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateWalletDeviceMutation, UpdateWalletDeviceMutationVariables>;
export const RemoveWalletDeviceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveWalletDevice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeWalletDevice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<RemoveWalletDeviceMutation, RemoveWalletDeviceMutationVariables>;
export const AddMultiNetworkWalletDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddMultiNetworkWallet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddMultiNetworkWalletInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addMultiNetworkWallet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"deviceId"}},{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"addressOrXpub"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"historyStatus"}},{"kind":"Field","name":{"kind":"Name","value":"capabilityLevel"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<AddMultiNetworkWalletMutation, AddMultiNetworkWalletMutationVariables>;
export const AddMultiChainWalletDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddMultiChainWallet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddMultiChainWalletInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addMultiChainWallet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"deviceType"}},{"kind":"Field","name":{"kind":"Name","value":"accounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"addressOrXpub"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"capabilityLevel"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<AddMultiChainWalletMutation, AddMultiChainWalletMutationVariables>;
export const AddCustomTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddCustomToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddCustomTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addCustomToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"decimals"}},{"kind":"Field","name":{"kind":"Name","value":"formattedQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"rawBalance"}},{"kind":"Field","name":{"kind":"Name","value":"tokenAddress"}}]}}]}}]} as unknown as DocumentNode<AddCustomTokenMutation, AddCustomTokenMutationVariables>;
export const UpdateBlockchainNetworkConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateBlockchainNetworkConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateBlockchainNetworkConfigInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateBlockchainNetworkConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"rpcUrl"}},{"kind":"Field","name":{"kind":"Name","value":"explorerApiUrl"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateBlockchainNetworkConfigMutation, UpdateBlockchainNetworkConfigMutationVariables>;
export const ResetBlockchainNetworkConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetBlockchainNetworkConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"network"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BlockchainNetwork"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetBlockchainNetworkConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"network"},"value":{"kind":"Variable","name":{"kind":"Name","value":"network"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"rpcUrl"}},{"kind":"Field","name":{"kind":"Name","value":"explorerApiUrl"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<ResetBlockchainNetworkConfigMutation, ResetBlockchainNetworkConfigMutationVariables>;
export const CreateWatchlistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWatchlist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateWatchlistInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createWatchlist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateWatchlistMutation, CreateWatchlistMutationVariables>;
export const AddAssetToWatchlistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAssetToWatchlist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"watchlistID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAssetToWatchlist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"watchlistID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"watchlistID"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WatchlistResult"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WatchlistResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Watchlist"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<AddAssetToWatchlistMutation, AddAssetToWatchlistMutationVariables>;
export const RemoveAssetFromWatchlistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveAssetFromWatchlist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"watchlistID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeAssetFromWatchlist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"watchlistID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"watchlistID"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveAssetFromWatchlistMutation, RemoveAssetFromWatchlistMutationVariables>;
export const GetAccountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAccounts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accounts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"syncProvider"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerName"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUserId"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"syncConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}}]}},{"kind":"Field","name":{"kind":"Name","value":"positionsCount"}},{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetAccountsQuery, GetAccountsQueryVariables>;
export const GetAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"account"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"syncProvider"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerName"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUserId"}},{"kind":"Field","name":{"kind":"Name","value":"coOwnerUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"syncConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}}]}},{"kind":"Field","name":{"kind":"Name","value":"positionsCount"}},{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetAccountQuery, GetAccountQueryVariables>;
export const GetCoOwnerCandidatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCoOwnerCandidates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"coOwnerCandidates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}}]} as unknown as DocumentNode<GetCoOwnerCandidatesQuery, GetCoOwnerCandidatesQueryVariables>;
export const AdminUsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminUsers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AdminUserFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UserOrder"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminUsers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"lastLoginAt"}},{"kind":"Field","name":{"kind":"Name","value":"failedLoginCount"}},{"kind":"Field","name":{"kind":"Name","value":"lockedUntil"}},{"kind":"Field","name":{"kind":"Name","value":"isLocked"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"taxJurisdiction"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"watchlists"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<AdminUsersQuery, AdminUsersQueryVariables>;
export const AdminUserStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminUserStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminUserStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalUsers"}},{"kind":"Field","name":{"kind":"Name","value":"activeUsers"}},{"kind":"Field","name":{"kind":"Name","value":"lockedUsers"}},{"kind":"Field","name":{"kind":"Name","value":"adminUsers"}},{"kind":"Field","name":{"kind":"Name","value":"unverifiedUsers"}}]}}]}}]} as unknown as DocumentNode<AdminUserStatsQuery, AdminUserStatsQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"themePreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeBaseColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeAccentColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeFontPreference"}},{"kind":"Field","name":{"kind":"Name","value":"themeHeadingFont"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuAccent"}},{"kind":"Field","name":{"kind":"Name","value":"themeMenuColor"}},{"kind":"Field","name":{"kind":"Name","value":"themeStyle"}},{"kind":"Field","name":{"kind":"Name","value":"themeRadius"}},{"kind":"Field","name":{"kind":"Name","value":"themeRTL"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const BenchmarkComparisonDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BenchmarkComparison"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"benchmarkAssetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PerformanceTimeRangeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"benchmarkComparison"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}},{"kind":"Argument","name":{"kind":"Name","value":"benchmarkAssetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"benchmarkAssetId"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolioReturn"}},{"kind":"Field","name":{"kind":"Name","value":"benchmarkReturn"}},{"kind":"Field","name":{"kind":"Name","value":"alpha"}},{"kind":"Field","name":{"kind":"Name","value":"beta"}},{"kind":"Field","name":{"kind":"Name","value":"correlation"}},{"kind":"Field","name":{"kind":"Name","value":"trackingError"}},{"kind":"Field","name":{"kind":"Name","value":"informationRatio"}},{"kind":"Field","name":{"kind":"Name","value":"riskAdjustedAlpha"}},{"kind":"Field","name":{"kind":"Name","value":"outperformancePeriods"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}}]}}]}}]}}]} as unknown as DocumentNode<BenchmarkComparisonQuery, BenchmarkComparisonQueryVariables>;
export const GetDashboardCriticalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDashboardCritical"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}},{"kind":"Field","name":{"kind":"Name","value":"diversification"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"positionValuations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"nativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"displayValue"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisNative"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisConverted"}},{"kind":"Field","name":{"kind":"Name","value":"hasDisplayValue"}},{"kind":"Field","name":{"kind":"Name","value":"isExcluded"}},{"kind":"Field","name":{"kind":"Name","value":"exclusionReason"}},{"kind":"Field","name":{"kind":"Name","value":"fxRate"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"accountName"}},{"kind":"Field","name":{"kind":"Name","value":"accountID"}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Stock"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"peRatio"}},{"kind":"Field","name":{"kind":"Name","value":"dividendYield"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Fund"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expenseRatio"}},{"kind":"Field","name":{"kind":"Name","value":"dividendYield"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BankAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accountType"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}},{"kind":"Field","name":{"kind":"Name","value":"balance"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RealEstate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"propertyType"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"zipCode"}},{"kind":"Field","name":{"kind":"Name","value":"squareFeet"}},{"kind":"Field","name":{"kind":"Name","value":"landSurface"}},{"kind":"Field","name":{"kind":"Name","value":"yearBuilt"}},{"kind":"Field","name":{"kind":"Name","value":"bedrooms"}},{"kind":"Field","name":{"kind":"Name","value":"bathrooms"}},{"kind":"Field","name":{"kind":"Name","value":"rooms"}},{"kind":"Field","name":{"kind":"Name","value":"floor"}},{"kind":"Field","name":{"kind":"Name","value":"totalFloors"}},{"kind":"Field","name":{"kind":"Name","value":"garages"}},{"kind":"Field","name":{"kind":"Name","value":"parkingSpaces"}},{"kind":"Field","name":{"kind":"Name","value":"energyLabel"}},{"kind":"Field","name":{"kind":"Name","value":"condition"}},{"kind":"Field","name":{"kind":"Name","value":"agencyFees"}},{"kind":"Field","name":{"kind":"Name","value":"notaryFees"}},{"kind":"Field","name":{"kind":"Name","value":"renovationFees"}},{"kind":"Field","name":{"kind":"Name","value":"furnishingCosts"}},{"kind":"Field","name":{"kind":"Name","value":"rentalType"}},{"kind":"Field","name":{"kind":"Name","value":"rentalPeriod"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"utilityCosts"}},{"kind":"Field","name":{"kind":"Name","value":"yearlyMiscCosts"}},{"kind":"Field","name":{"kind":"Name","value":"hasGarden"}},{"kind":"Field","name":{"kind":"Name","value":"hasBalcony"}},{"kind":"Field","name":{"kind":"Name","value":"hasLift"}},{"kind":"Field","name":{"kind":"Name","value":"hasPool"}},{"kind":"Field","name":{"kind":"Name","value":"hasSauna"}},{"kind":"Field","name":{"kind":"Name","value":"isFurnished"}},{"kind":"Field","name":{"kind":"Name","value":"isNewConstruction"}},{"kind":"Field","name":{"kind":"Name","value":"kitchenQuality"}},{"kind":"Field","name":{"kind":"Name","value":"kitchenCondition"}},{"kind":"Field","name":{"kind":"Name","value":"bathroomQuality"}},{"kind":"Field","name":{"kind":"Name","value":"bathroomCondition"}},{"kind":"Field","name":{"kind":"Name","value":"flooringQuality"}},{"kind":"Field","name":{"kind":"Name","value":"flooringCondition"}},{"kind":"Field","name":{"kind":"Name","value":"windowsQuality"}},{"kind":"Field","name":{"kind":"Name","value":"windowsCondition"}},{"kind":"Field","name":{"kind":"Name","value":"generalQuality"}},{"kind":"Field","name":{"kind":"Name","value":"generalCondition"}},{"kind":"Field","name":{"kind":"Name","value":"linkedLoanId"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipStructure"}},{"kind":"Field","name":{"kind":"Name","value":"addressLabel"}},{"kind":"Field","name":{"kind":"Name","value":"cityCode"}},{"kind":"Field","name":{"kind":"Name","value":"banId"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"hasOutdoor"}},{"kind":"Field","name":{"kind":"Name","value":"isGroundFloor"}},{"kind":"Field","name":{"kind":"Name","value":"valuationMode"}},{"kind":"Field","name":{"kind":"Name","value":"estimationMethod"}},{"kind":"Field","name":{"kind":"Name","value":"manualValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedPricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"basePricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"valuationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"comparablesCount"}},{"kind":"Field","name":{"kind":"Name","value":"searchRadiusMeters"}},{"kind":"Field","name":{"kind":"Name","value":"lastEstimatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"valuationHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}}]}},{"kind":"Field","name":{"kind":"Name","value":"marketRentPerM2"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMonthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedGrossYield"}},{"kind":"Field","name":{"kind":"Name","value":"rentalR2Adjusted"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Loan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loanType"}},{"kind":"Field","name":{"kind":"Name","value":"loanAmount"}},{"kind":"Field","name":{"kind":"Name","value":"remainingBalance"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}},{"kind":"Field","name":{"kind":"Name","value":"durationMonths"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyPayment"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"lender"}},{"kind":"Field","name":{"kind":"Name","value":"loanNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"downPayment"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipMode"}},{"kind":"Field","name":{"kind":"Name","value":"applicationFee"}},{"kind":"Field","name":{"kind":"Name","value":"brokerFee"}},{"kind":"Field","name":{"kind":"Name","value":"insuranceFee"}},{"kind":"Field","name":{"kind":"Name","value":"otherFees"}},{"kind":"Field","name":{"kind":"Name","value":"earlyRepaymentFee"}},{"kind":"Field","name":{"kind":"Name","value":"linkedAssetIDs"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPercentage"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}}]}},{"kind":"Field","name":{"kind":"Name","value":"coOwners"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"companyOwners"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"companyId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"registrationNumber"}},{"kind":"Field","name":{"kind":"Name","value":"legalForm"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"watchlists"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}}]}}]}}]} as unknown as DocumentNode<GetDashboardCriticalQuery, GetDashboardCriticalQueryVariables>;
export const GetDashboardSecondaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDashboardSecondary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"10"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"account"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}}]}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"feesAmount"}},{"kind":"Field","name":{"kind":"Name","value":"feesCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}}]}}]}}]} as unknown as DocumentNode<GetDashboardSecondaryQuery, GetDashboardSecondaryQueryVariables>;
export const GetRecentTransactionsMinimalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRecentTransactionsMinimal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"account"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}}]}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}}]}}]}}]} as unknown as DocumentNode<GetRecentTransactionsMinimalQuery, GetRecentTransactionsMinimalQueryVariables>;
export const GetAssetPerformanceOptimizedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssetPerformanceOptimized"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}}]}}]}}]} as unknown as DocumentNode<GetAssetPerformanceOptimizedQuery, GetAssetPerformanceOptimizedQueryVariables>;
export const ExportPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExportPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<ExportPortfolioQuery, ExportPortfolioQueryVariables>;
export const ExportTransactionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExportTransactions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TransactionFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"feesAmount"}},{"kind":"Field","name":{"kind":"Name","value":"feesCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}}]}}]}}]} as unknown as DocumentNode<ExportTransactionsQuery, ExportTransactionsQueryVariables>;
export const ExportUserPortfoliosDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExportUserPortfolios"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ExportUserPortfoliosQuery, ExportUserPortfoliosQueryVariables>;
export const SearchInstrumentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchInstruments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"InstrumentSearchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchInstruments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"localResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrument"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"isin"}},{"kind":"Field","name":{"kind":"Name","value":"figi"}},{"kind":"Field","name":{"kind":"Name","value":"cusip"}},{"kind":"Field","name":{"kind":"Name","value":"industry"}},{"kind":"Field","name":{"kind":"Name","value":"website"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"family"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}}]}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"matchedAlias"}}]}},{"kind":"Field","name":{"kind":"Name","value":"canSearchOnline"}},{"kind":"Field","name":{"kind":"Name","value":"queryMetadata"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"query"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}},{"kind":"Field","name":{"kind":"Name","value":"localCount"}},{"kind":"Field","name":{"kind":"Name","value":"topScore"}},{"kind":"Field","name":{"kind":"Name","value":"weakResults"}},{"kind":"Field","name":{"kind":"Name","value":"searchOnlineHint"}}]}}]}}]}}]} as unknown as DocumentNode<SearchInstrumentsQuery, SearchInstrumentsQueryVariables>;
export const SearchInstrumentsOnlineDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchInstrumentsOnline"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"InstrumentSearchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchInstrumentsOnline"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onlineResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"marketCapRank"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"platforms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"address"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"isin"}},{"kind":"Field","name":{"kind":"Name","value":"figi"}},{"kind":"Field","name":{"kind":"Name","value":"cusip"}}]}},{"kind":"Field","name":{"kind":"Name","value":"queryMetadata"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"query"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}},{"kind":"Field","name":{"kind":"Name","value":"localCount"}},{"kind":"Field","name":{"kind":"Name","value":"topScore"}},{"kind":"Field","name":{"kind":"Name","value":"weakResults"}},{"kind":"Field","name":{"kind":"Name","value":"searchOnlineHint"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerUsed"}},{"kind":"Field","name":{"kind":"Name","value":"coverageStatus"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<SearchInstrumentsOnlineQuery, SearchInstrumentsOnlineQueryVariables>;
export const ManualInstrumentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ManualInstruments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ManualInstrumentFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manualInstruments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedName"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"baseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"underlyingSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"industryGroup"}},{"kind":"Field","name":{"kind":"Name","value":"industry"}},{"kind":"Field","name":{"kind":"Name","value":"categoryGroup"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"family"}},{"kind":"Field","name":{"kind":"Name","value":"website"}},{"kind":"Field","name":{"kind":"Name","value":"marketCap"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"zipcode"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}}]}}]}}]} as unknown as DocumentNode<ManualInstrumentsQuery, ManualInstrumentsQueryVariables>;
export const LatestHistoricalDataBackfillJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LatestHistoricalDataBackfillJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"latestHistoricalDataBackfillJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"step"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"rowsWritten"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<LatestHistoricalDataBackfillJobQuery, LatestHistoricalDataBackfillJobQueryVariables>;
export const HistoricalDataBackfillJobsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"HistoricalDataBackfillJobs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"HistoricalDataBackfillJobFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"historicalDataBackfillJobs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"instrumentId"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"step"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"rowsWritten"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"requestedFrom"}},{"kind":"Field","name":{"kind":"Name","value":"requestedTo"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<HistoricalDataBackfillJobsQuery, HistoricalDataBackfillJobsQueryVariables>;
export const GetMarketDataCredentialsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketDataCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"lastValidatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataCredentialsQuery, GetMarketDataCredentialsQueryVariables>;
export const GetAvailableProvidersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAvailableProviders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dataType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableProviders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"instrumentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"dataType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dataType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"capability"}},{"kind":"Field","name":{"kind":"Name","value":"requiresApiKey"}},{"kind":"Field","name":{"kind":"Name","value":"hasCredential"}},{"kind":"Field","name":{"kind":"Name","value":"credentialValid"}},{"kind":"Field","name":{"kind":"Name","value":"credentialEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"mappingStatus"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveEnabled"}}]}}]}}]} as unknown as DocumentNode<GetAvailableProvidersQuery, GetAvailableProvidersQueryVariables>;
export const GetSupportedProvidersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSupportedProviders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supportedProviders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"requiresKey"}},{"kind":"Field","name":{"kind":"Name","value":"intervals"}},{"kind":"Field","name":{"kind":"Name","value":"rateLimit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestsPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"requestsPerDay"}},{"kind":"Field","name":{"kind":"Name","value":"burstLimit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"supportsRealtime"}}]}}]}}]} as unknown as DocumentNode<GetSupportedProvidersQuery, GetSupportedProvidersQueryVariables>;
export const GetProviderHealthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetProviderHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"providerHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"healthy"}},{"kind":"Field","name":{"kind":"Name","value":"lastChecked"}}]}}]}}]} as unknown as DocumentNode<GetProviderHealthQuery, GetProviderHealthQueryVariables>;
export const GetProviderRoutingPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetProviderRoutingPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"providerRoutingPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"preferredProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}},{"kind":"Field","name":{"kind":"Name","value":"useIntelligentRouting"}},{"kind":"Field","name":{"kind":"Name","value":"enableFallback"}},{"kind":"Field","name":{"kind":"Name","value":"staleDataThresholdMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetProviderRoutingPreferencesQuery, GetProviderRoutingPreferencesQueryVariables>;
export const GetMarketDataSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketDataCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"lastValidatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"supportedProviders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"requiresKey"}},{"kind":"Field","name":{"kind":"Name","value":"intervals"}},{"kind":"Field","name":{"kind":"Name","value":"rateLimit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestsPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"requestsPerDay"}},{"kind":"Field","name":{"kind":"Name","value":"burstLimit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"supportsRealtime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"healthy"}},{"kind":"Field","name":{"kind":"Name","value":"apiKeyValid"}},{"kind":"Field","name":{"kind":"Name","value":"lastChecked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerRoutingPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"preferredProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}},{"kind":"Field","name":{"kind":"Name","value":"useIntelligentRouting"}},{"kind":"Field","name":{"kind":"Name","value":"enableFallback"}},{"kind":"Field","name":{"kind":"Name","value":"staleDataThresholdMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataSettingsQuery, GetMarketDataSettingsQueryVariables>;
export const GetMarketDataPacksCenterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataPacksCenter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableMarketDataPacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"compressedSizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"assetsCount"}},{"kind":"Field","name":{"kind":"Name","value":"rowsCount"}},{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"assetTypes"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrencies"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"checksum"}},{"kind":"Field","name":{"kind":"Name","value":"signatureUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"recommended"}}]}},{"kind":"Field","name":{"kind":"Name","value":"installedMarketDataPacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"formatVersion"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"parentPackId"}},{"kind":"Field","name":{"kind":"Name","value":"packPriority"}},{"kind":"Field","name":{"kind":"Name","value":"filePath"}},{"kind":"Field","name":{"kind":"Name","value":"checksum"}},{"kind":"Field","name":{"kind":"Name","value":"signatureVerified"}},{"kind":"Field","name":{"kind":"Name","value":"assetsCount"}},{"kind":"Field","name":{"kind":"Name","value":"rowsCount"}},{"kind":"Field","name":{"kind":"Name","value":"installedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"marketDataCoverage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"instrumentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"instrumentId"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"firstDate"}},{"kind":"Field","name":{"kind":"Name","value":"lastDate"}},{"kind":"Field","name":{"kind":"Name","value":"rowCount"}},{"kind":"Field","name":{"kind":"Name","value":"filePaths"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataPacksCenterQuery, GetMarketDataPacksCenterQueryVariables>;
export const GetMarketDataPackJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataPackJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketDataPackJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"jobType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"downloadedBytes"}},{"kind":"Field","name":{"kind":"Name","value":"totalBytes"}},{"kind":"Field","name":{"kind":"Name","value":"importedRows"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataPackJobQuery, GetMarketDataPackJobQueryVariables>;
export const GetPackBuildJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPackBuildJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"packBuildJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"sourceProvider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"currentSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentDate"}},{"kind":"Field","name":{"kind":"Name","value":"currentAssetType"}},{"kind":"Field","name":{"kind":"Name","value":"totalSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"failedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedDates"}},{"kind":"Field","name":{"kind":"Name","value":"totalDates"}},{"kind":"Field","name":{"kind":"Name","value":"rowsWritten"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<GetPackBuildJobQuery, GetPackBuildJobQueryVariables>;
export const GetPackBuildJobsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPackBuildJobs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"packBuildJobs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"packId"}},{"kind":"Field","name":{"kind":"Name","value":"sourceProvider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progressPercent"}},{"kind":"Field","name":{"kind":"Name","value":"currentSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentDate"}},{"kind":"Field","name":{"kind":"Name","value":"currentAssetType"}},{"kind":"Field","name":{"kind":"Name","value":"totalSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"failedSymbols"}},{"kind":"Field","name":{"kind":"Name","value":"completedDates"}},{"kind":"Field","name":{"kind":"Name","value":"totalDates"}},{"kind":"Field","name":{"kind":"Name","value":"rowsWritten"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}}]}}]}}]} as unknown as DocumentNode<GetPackBuildJobsQuery, GetPackBuildJobsQueryVariables>;
export const GetPortfolioRiskMetricsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfolioRiskMetrics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PerformanceTimeRangeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolioRiskMetrics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"sortinoRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}},{"kind":"Field","name":{"kind":"Name","value":"diversification"}}]}}]}}]} as unknown as DocumentNode<GetPortfolioRiskMetricsQuery, GetPortfolioRiskMetricsQueryVariables>;
export const GetPortfoliosWithAnalyticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfoliosWithAnalytics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalNativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalDisplayValue"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"fxState"}},{"kind":"Field","name":{"kind":"Name","value":"excludedPositionCount"}},{"kind":"Field","name":{"kind":"Name","value":"coveredValueRatio"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"positionValuations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"nativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"displayValue"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisNative"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisConverted"}},{"kind":"Field","name":{"kind":"Name","value":"hasDisplayValue"}},{"kind":"Field","name":{"kind":"Name","value":"isExcluded"}},{"kind":"Field","name":{"kind":"Name","value":"exclusionReason"}},{"kind":"Field","name":{"kind":"Name","value":"fxRate"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfoliosWithAnalyticsQuery, GetPortfoliosWithAnalyticsQueryVariables>;
export const GetPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalNativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalDisplayValue"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"fxState"}},{"kind":"Field","name":{"kind":"Name","value":"excludedPositionCount"}},{"kind":"Field","name":{"kind":"Name","value":"coveredValueRatio"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"positionValuations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"nativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"displayValue"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisNative"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisConverted"}},{"kind":"Field","name":{"kind":"Name","value":"hasDisplayValue"}},{"kind":"Field","name":{"kind":"Name","value":"isExcluded"}},{"kind":"Field","name":{"kind":"Name","value":"exclusionReason"}},{"kind":"Field","name":{"kind":"Name","value":"fxRate"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfolioQuery, GetPortfolioQueryVariables>;
export const GetScopedPerformanceHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetScopedPerformanceHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetTypes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"scopedPerformanceHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetTypes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetTypes"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<GetScopedPerformanceHistoryQuery, GetScopedPerformanceHistoryQueryVariables>;
export const EstimateRealEstateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EstimateRealEstate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RealEstateEstimationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"estimateRealEstate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"estimatedValue"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMin"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMax"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedPricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"basePricePerM2"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"comparablesCount"}},{"kind":"Field","name":{"kind":"Name","value":"searchRadiusMeters"}},{"kind":"Field","name":{"kind":"Name","value":"lastEstimatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rentalMarket"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketRentPerM2"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMonthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedGrossYield"}},{"kind":"Field","name":{"kind":"Name","value":"isCommuneLevel"}},{"kind":"Field","name":{"kind":"Name","value":"r2Adjusted"}},{"kind":"Field","name":{"kind":"Name","value":"sourceLabel"}}]}}]}}]}}]} as unknown as DocumentNode<EstimateRealEstateQuery, EstimateRealEstateQueryVariables>;
export const FetchAdemeDpeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FetchADEMEDpe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"banId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"surfaceM2"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"propertyType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fetchADEMEDpe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"banId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"banId"}}},{"kind":"Argument","name":{"kind":"Name","value":"surfaceM2"},"value":{"kind":"Variable","name":{"kind":"Name","value":"surfaceM2"}}},{"kind":"Argument","name":{"kind":"Name","value":"propertyType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"propertyType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"surfaceM2"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosticDate"}},{"kind":"Field","name":{"kind":"Name","value":"sourceDataset"}}]}}]}}]} as unknown as DocumentNode<FetchAdemeDpeQuery, FetchAdemeDpeQueryVariables>;
export const GetCommuneRentalIndicatorsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCommuneRentalIndicators"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cityCode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"propertyType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"roomsCount"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"surfaceM2"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"propertyValue"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCommuneRentalIndicators"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cityCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cityCode"}}},{"kind":"Argument","name":{"kind":"Name","value":"propertyType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"propertyType"}}},{"kind":"Argument","name":{"kind":"Name","value":"roomsCount"},"value":{"kind":"Variable","name":{"kind":"Name","value":"roomsCount"}}},{"kind":"Argument","name":{"kind":"Name","value":"surfaceM2"},"value":{"kind":"Variable","name":{"kind":"Name","value":"surfaceM2"}}},{"kind":"Argument","name":{"kind":"Name","value":"propertyValue"},"value":{"kind":"Variable","name":{"kind":"Name","value":"propertyValue"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketRentPerM2"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedMonthlyRent"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedGrossYield"}},{"kind":"Field","name":{"kind":"Name","value":"isCommuneLevel"}},{"kind":"Field","name":{"kind":"Name","value":"r2Adjusted"}},{"kind":"Field","name":{"kind":"Name","value":"sourceLabel"}}]}}]}}]} as unknown as DocumentNode<GetCommuneRentalIndicatorsQuery, GetCommuneRentalIndicatorsQueryVariables>;
export const GetFinanceDatabaseSyncStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"lastSynced"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"currentRecord"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncStatusQuery, GetFinanceDatabaseSyncStatusQueryVariables>;
export const GetFinanceDatabaseSyncHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncHistoryQuery, GetFinanceDatabaseSyncHistoryQueryVariables>;
export const GetFinanceDatabasePreviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabasePreview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabasePreview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"country"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabasePreviewQuery, GetFinanceDatabasePreviewQueryVariables>;
export const GetSyncConnectionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSyncConnections"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"syncConnections"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"account"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}}]}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"externalInstitutionId"}},{"kind":"Field","name":{"kind":"Name","value":"externalAccountId"}},{"kind":"Field","name":{"kind":"Name","value":"institutionName"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastError"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetSyncConnectionsQuery, GetSyncConnectionsQueryVariables>;
export const GetSyncCredentialsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSyncCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"syncCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetSyncCredentialsQuery, GetSyncCredentialsQueryVariables>;
export const GetEnableBankingInstitutionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetEnableBankingInstitutions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"country"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enableBankingInstitutions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"country"},"value":{"kind":"Variable","name":{"kind":"Name","value":"country"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"logo"}},{"kind":"Field","name":{"kind":"Name","value":"psuTypes"}}]}}]}}]} as unknown as DocumentNode<GetEnableBankingInstitutionsQuery, GetEnableBankingInstitutionsQueryVariables>;
export const GetTaxLotsByPositionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTaxLotsByPosition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"positionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taxLotsByPosition"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"positionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"positionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"transactionId"}},{"kind":"Field","name":{"kind":"Name","value":"acquiredAt"}},{"kind":"Field","name":{"kind":"Name","value":"initialQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"remainingQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisPerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"totalCostBasis"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"holdingPeriodDays"}},{"kind":"Field","name":{"kind":"Name","value":"isLongTerm"}},{"kind":"Field","name":{"kind":"Name","value":"currentPrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"unrealizedGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"unrealizedGainLossPercent"}}]}}]}}]} as unknown as DocumentNode<GetTaxLotsByPositionQuery, GetTaxLotsByPositionQueryVariables>;
export const GetDispositionsByPositionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDispositionsByPosition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"positionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dispositionsByPosition"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"positionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"positionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lotId"}},{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"transactionId"}},{"kind":"Field","name":{"kind":"Name","value":"acquiredAt"}},{"kind":"Field","name":{"kind":"Name","value":"soldAt"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisPerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"sellPricePerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"costBasis"}},{"kind":"Field","name":{"kind":"Name","value":"proceeds"}},{"kind":"Field","name":{"kind":"Name","value":"realizedGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"holdingPeriodDays"}},{"kind":"Field","name":{"kind":"Name","value":"isLongTerm"}},{"kind":"Field","name":{"kind":"Name","value":"isTaxExempt"}}]}}]}}]} as unknown as DocumentNode<GetDispositionsByPositionQuery, GetDispositionsByPositionQueryVariables>;
export const GetTaxHarvestOpportunitiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTaxHarvestOpportunities"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taxHarvestOpportunities"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"harvestableLoss"}},{"kind":"Field","name":{"kind":"Name","value":"eligibleLotsCount"}}]}}]}}]} as unknown as DocumentNode<GetTaxHarvestOpportunitiesQuery, GetTaxHarvestOpportunitiesQueryVariables>;
export const GetRealizedGainsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRealizedGains"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dateFrom"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dateTo"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"realizedGains"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}},{"kind":"Argument","name":{"kind":"Name","value":"dateFrom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dateFrom"}}},{"kind":"Argument","name":{"kind":"Name","value":"dateTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dateTo"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"dateFrom"}},{"kind":"Field","name":{"kind":"Name","value":"dateTo"}},{"kind":"Field","name":{"kind":"Name","value":"totalRealized"}},{"kind":"Field","name":{"kind":"Name","value":"shortTermGains"}},{"kind":"Field","name":{"kind":"Name","value":"longTermGains"}},{"kind":"Field","name":{"kind":"Name","value":"dispositionCount"}},{"kind":"Field","name":{"kind":"Name","value":"transactionCount"}},{"kind":"Field","name":{"kind":"Name","value":"taxWrapper"}},{"kind":"Field","name":{"kind":"Name","value":"taxJurisdiction"}},{"kind":"Field","name":{"kind":"Name","value":"isTaxExempt"}}]}}]}}]} as unknown as DocumentNode<GetRealizedGainsQuery, GetRealizedGainsQueryVariables>;
export const GetTransactionsByAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTransactionsByAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TransactionFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"feesAmount"}},{"kind":"Field","name":{"kind":"Name","value":"feesCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"account"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}}]}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetTransactionsByAccountQuery, GetTransactionsByAccountQueryVariables>;
export const GetAllTransactionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAllTransactions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TransactionFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"accountId"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"feesAmount"}},{"kind":"Field","name":{"kind":"Name","value":"feesCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"account"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}}]}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetAllTransactionsQuery, GetAllTransactionsQueryVariables>;
export const GetWalletDevicesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetWalletDevices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"walletDevices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"deviceType"}},{"kind":"Field","name":{"kind":"Name","value":"accounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"addressOrXpub"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"historyStatus"}},{"kind":"Field","name":{"kind":"Name","value":"capabilityLevel"}},{"kind":"Field","name":{"kind":"Name","value":"balances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"decimals"}},{"kind":"Field","name":{"kind":"Name","value":"formattedQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"rawBalance"}},{"kind":"Field","name":{"kind":"Name","value":"tokenAddress"}},{"kind":"Field","name":{"kind":"Name","value":"isSpam"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisPerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisType"}},{"kind":"Field","name":{"kind":"Name","value":"autoEstimatedBasis"}},{"kind":"Field","name":{"kind":"Name","value":"acquiredAt"}},{"kind":"Field","name":{"kind":"Name","value":"currentPrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange24h"}},{"kind":"Field","name":{"kind":"Name","value":"priceUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"priceSource"}},{"kind":"Field","name":{"kind":"Name","value":"isPriceResolved"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetWalletDevicesQuery, GetWalletDevicesQueryVariables>;
export const GetWalletAccountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetWalletAccounts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"walletAccounts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"portfolioId"}},{"kind":"Field","name":{"kind":"Name","value":"deviceId"}},{"kind":"Field","name":{"kind":"Name","value":"device"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"deviceType"}}]}},{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"addressOrXpub"}},{"kind":"Field","name":{"kind":"Name","value":"isXpub"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAt"}},{"kind":"Field","name":{"kind":"Name","value":"historyStatus"}},{"kind":"Field","name":{"kind":"Name","value":"capabilityLevel"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncError"}},{"kind":"Field","name":{"kind":"Name","value":"balances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"decimals"}},{"kind":"Field","name":{"kind":"Name","value":"formattedQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"rawBalance"}},{"kind":"Field","name":{"kind":"Name","value":"tokenAddress"}},{"kind":"Field","name":{"kind":"Name","value":"isSpam"}},{"kind":"Field","name":{"kind":"Name","value":"isHidden"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisPerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"costBasisType"}},{"kind":"Field","name":{"kind":"Name","value":"autoEstimatedBasis"}},{"kind":"Field","name":{"kind":"Name","value":"acquiredAt"}},{"kind":"Field","name":{"kind":"Name","value":"currentPrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange24h"}},{"kind":"Field","name":{"kind":"Name","value":"priceUpdatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"priceSource"}},{"kind":"Field","name":{"kind":"Name","value":"isPriceResolved"}},{"kind":"Field","name":{"kind":"Name","value":"lastUpdatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetWalletAccountsQuery, GetWalletAccountsQueryVariables>;
export const GetWalletCuUsageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetWalletCUUsage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"walletCUUsage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"billingMonth"}},{"kind":"Field","name":{"kind":"Name","value":"consumedUnits"}},{"kind":"Field","name":{"kind":"Name","value":"maxQuota"}},{"kind":"Field","name":{"kind":"Name","value":"isThrottled"}},{"kind":"Field","name":{"kind":"Name","value":"hasKey"}},{"kind":"Field","name":{"kind":"Name","value":"keySource"}},{"kind":"Field","name":{"kind":"Name","value":"maskedKey"}}]}}]}}]} as unknown as DocumentNode<GetWalletCuUsageQuery, GetWalletCuUsageQueryVariables>;
export const GetPendingWalletReviewsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPendingWalletReviews"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pendingWalletReviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"walletActivityId"}},{"kind":"Field","name":{"kind":"Name","value":"reviewStatus"}},{"kind":"Field","name":{"kind":"Name","value":"suggestedType"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetPendingWalletReviewsQuery, GetPendingWalletReviewsQueryVariables>;
export const GetBlockchainNetworkConfigsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBlockchainNetworkConfigs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"blockchainNetworkConfigs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"network"}},{"kind":"Field","name":{"kind":"Name","value":"rpcUrl"}},{"kind":"Field","name":{"kind":"Name","value":"explorerApiUrl"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetBlockchainNetworkConfigsQuery, GetBlockchainNetworkConfigsQueryVariables>;
export const InvalidationProbeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InvalidationProbe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"watchlists"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<InvalidationProbeQuery, InvalidationProbeQueryVariables>;
export const GetAssetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetOrder"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetAssetsQuery, GetAssetsQueryVariables>;
export const GetAssetTypesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetAssetTypesQuery, GetAssetTypesQueryVariables>;
export const AddAssetToPortfolioHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAssetToPortfolioHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PortfolioAssetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAssetToPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}}]}}]} as unknown as DocumentNode<AddAssetToPortfolioHookMutation, AddAssetToPortfolioHookMutationVariables>;
export const RemoveAssetFromPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveAssetFromPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"accountID"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeAssetFromPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}}},{"kind":"Argument","name":{"kind":"Name","value":"accountID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"accountID"}}}]}]}}]} as unknown as DocumentNode<RemoveAssetFromPortfolioMutation, RemoveAssetFromPortfolioMutationVariables>;
export const UpdateAssetInPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateAssetInPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PortfolioAssetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAssetInPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}}]}}]} as unknown as DocumentNode<UpdateAssetInPortfolioMutation, UpdateAssetInPortfolioMutationVariables>;
export const GetFinanceDatabaseSyncStatusHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncStatusHook"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"lastSynced"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"currentRecord"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncStatusHookQuery, GetFinanceDatabaseSyncStatusHookQueryVariables>;
export const GetFinanceDatabaseSyncHistoryHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncHistoryHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncHistoryHookQuery, GetFinanceDatabaseSyncHistoryHookQueryVariables>;
export const GetFinanceDatabasePreviewHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabasePreviewHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabasePreview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"country"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabasePreviewHookQuery, GetFinanceDatabasePreviewHookQueryVariables>;
export const TriggerFinanceDatabaseSyncHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TriggerFinanceDatabaseSyncHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"triggerFinanceDatabaseSync"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}}]}}]}}]}}]} as unknown as DocumentNode<TriggerFinanceDatabaseSyncHookMutation, TriggerFinanceDatabaseSyncHookMutationVariables>;
export const UpdateFinanceDatabaseSyncEnabledHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateFinanceDatabaseSyncEnabledHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFinanceDatabaseSyncEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}}]}}]}}]} as unknown as DocumentNode<UpdateFinanceDatabaseSyncEnabledHookMutation, UpdateFinanceDatabaseSyncEnabledHookMutationVariables>;
export const ImportFinanceDatabaseAssetsHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportFinanceDatabaseAssetsHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importFinanceDatabaseAssets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"symbols"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"importedCount"}},{"kind":"Field","name":{"kind":"Name","value":"errors"}}]}}]}}]} as unknown as DocumentNode<ImportFinanceDatabaseAssetsHookMutation, ImportFinanceDatabaseAssetsHookMutationVariables>;
export const GetMarketDataBySymbolDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataBySymbol"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"interval"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"candles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"symbol"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"interval"},"value":{"kind":"Variable","name":{"kind":"Name","value":"interval"}}},{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"open"}},{"kind":"Field","name":{"kind":"Name","value":"high"}},{"kind":"Field","name":{"kind":"Name","value":"low"}},{"kind":"Field","name":{"kind":"Name","value":"close"}},{"kind":"Field","name":{"kind":"Name","value":"volume"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realTimePrice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"symbol"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"close"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataBySymbolQuery, GetMarketDataBySymbolQueryVariables>;
export const GetMarketDataByInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataByInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"interval"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"preferredProvider"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"candlesByInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"instrumentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"interval"},"value":{"kind":"Variable","name":{"kind":"Name","value":"interval"}}},{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"preferredProvider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"preferredProvider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sourceProvider"}},{"kind":"Field","name":{"kind":"Name","value":"fallbackUsed"}},{"kind":"Field","name":{"kind":"Name","value":"candles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"open"}},{"kind":"Field","name":{"kind":"Name","value":"high"}},{"kind":"Field","name":{"kind":"Name","value":"low"}},{"kind":"Field","name":{"kind":"Name","value":"close"}},{"kind":"Field","name":{"kind":"Name","value":"volume"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"realTimePriceByInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"instrumentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"preferredProvider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"preferredProvider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sourceProvider"}},{"kind":"Field","name":{"kind":"Name","value":"fallbackUsed"}},{"kind":"Field","name":{"kind":"Name","value":"candle"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"close"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}}]}}]}}]} as unknown as DocumentNode<GetMarketDataByInstrumentQuery, GetMarketDataByInstrumentQueryVariables>;
export const GetMarketDataChartDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataChart"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"interval"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"preferredProvider"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"candlesByInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"instrumentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"instrumentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"interval"},"value":{"kind":"Variable","name":{"kind":"Name","value":"interval"}}},{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"preferredProvider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"preferredProvider"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"candles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"close"}}]}}]}}]}}]} as unknown as DocumentNode<GetMarketDataChartQuery, GetMarketDataChartQueryVariables>;