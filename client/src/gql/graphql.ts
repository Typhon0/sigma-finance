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
  /** Custom scalar for JSON data */
  JSON: { input: any; output: any; }
  Time: { input: any; output: any; }
};

export type AddInstrumentHoldingInput = {
  averagePurchasePrice: Scalars['Float']['input'];
  instrumentID: Scalars['ID']['input'];
  portfolioID: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
  unitPriceCurrency?: InputMaybe<Scalars['String']['input']>;
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

/** Alert action configuration */
export type AlertAction = {
  __typename?: 'AlertAction';
  config: Scalars['JSON']['output'];
  type: AlertActionType;
};

/** Input for alert actions */
export type AlertActionInput = {
  config: Scalars['JSON']['input'];
  type: AlertActionType;
};

/** Alert action type enumeration */
export enum AlertActionType {
  Email = 'EMAIL',
  Log = 'LOG',
  Slack = 'SLACK',
  Webhook = 'WEBHOOK'
}

/** Alert condition enumeration */
export enum AlertCondition {
  AvgGreaterThan = 'AVG_GREATER_THAN',
  AvgLessThan = 'AVG_LESS_THAN',
  EqualTo = 'EQUAL_TO',
  GreaterThan = 'GREATER_THAN',
  LessThan = 'LESS_THAN',
  MaxGreaterThan = 'MAX_GREATER_THAN',
  MinLessThan = 'MIN_LESS_THAN'
}

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

/** Alert notification */
export type AlertNotification = {
  __typename?: 'AlertNotification';
  alertId: Scalars['ID']['output'];
  alertName: Scalars['String']['output'];
  currentValue: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  metricName: Scalars['String']['output'];
  severity: AlertSeverity;
  threshold: Scalars['Float']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export enum AlertNotificationMethod {
  Email = 'EMAIL',
  InApp = 'IN_APP',
  Push = 'PUSH',
  Sms = 'SMS'
}

/** Alert rule configuration */
export type AlertRule = {
  __typename?: 'AlertRule';
  actions: Array<AlertAction>;
  condition: AlertCondition;
  createdAt: Scalars['DateTime']['output'];
  duration: Scalars['Int']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  labels: Scalars['JSON']['output'];
  lastFired?: Maybe<Scalars['DateTime']['output']>;
  metricName: Scalars['String']['output'];
  name: Scalars['String']['output'];
  threshold: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

/** Input for creating/updating alert rules */
export type AlertRuleInput = {
  actions: Array<AlertActionInput>;
  condition: AlertCondition;
  duration: Scalars['Int']['input'];
  enabled: Scalars['Boolean']['input'];
  labels?: InputMaybe<Scalars['JSON']['input']>;
  metricName: Scalars['String']['input'];
  name: Scalars['String']['input'];
  threshold: Scalars['Float']['input'];
};

/** Alert severity enumeration */
export enum AlertSeverity {
  Critical = 'CRITICAL',
  High = 'HIGH',
  Low = 'LOW',
  Medium = 'MEDIUM'
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

export enum ConditionType {
  Above = 'ABOVE',
  Below = 'BELOW',
  DecreaseBy = 'DECREASE_BY',
  Equals = 'EQUALS',
  IncreaseBy = 'INCREASE_BY'
}

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
  loanAmount: Scalars['Float']['input'];
  loanNumber?: InputMaybe<Scalars['String']['input']>;
  loanType: Scalars['String']['input'];
  monthlyPayment: Scalars['Float']['input'];
  name: Scalars['String']['input'];
  otherFees?: InputMaybe<Scalars['Float']['input']>;
  ownershipMode?: InputMaybe<Scalars['String']['input']>;
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  remainingBalance: Scalars['Float']['input'];
  startDate: Scalars['String']['input'];
  status: Scalars['String']['input'];
};

export type CreatePortfolioInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  userID: Scalars['ID']['input'];
};

export type CreateRealEstateInput = {
  address: Scalars['String']['input'];
  assetTypeID: Scalars['ID']['input'];
  bathrooms?: InputMaybe<Scalars['Float']['input']>;
  bedrooms?: InputMaybe<Scalars['Int']['input']>;
  city: Scalars['String']['input'];
  country: Scalars['String']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  propertyType: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  squareFeet?: InputMaybe<Scalars['Int']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  yearBuilt?: InputMaybe<Scalars['Int']['input']>;
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

/** Input for recording dashboard events */
export type DashboardEventInput = {
  data: Scalars['JSON']['input'];
  sessionId?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
};

/** Dashboard performance metrics */
export type DashboardPerformanceMetrics = {
  __typename?: 'DashboardPerformanceMetrics';
  dashboardStateTransitions?: Maybe<MetricSummary>;
  dataLoadTimes?: Maybe<MetricSummary>;
  errorRates?: Maybe<MetricSummary>;
  marketDataUpdates?: Maybe<MetricSummary>;
  userInteractions?: Maybe<MetricSummary>;
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

/** Feature usage statistics */
export type FeatureUsage = {
  __typename?: 'FeatureUsage';
  avgDuration: Scalars['Float']['output'];
  feature: Scalars['String']['output'];
  uniqueUsers: Scalars['Int']['output'];
  usageCount: Scalars['Int']['output'];
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
  exchange?: Maybe<Scalars['String']['output']>;
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

export type ImportFinanceDatabaseAssetsPayload = {
  __typename?: 'ImportFinanceDatabaseAssetsPayload';
  errors: Array<Scalars['String']['output']>;
  importedCount: Scalars['Int']['output'];
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
  exchange: Scalars['String']['output'];
  exchangeCode?: Maybe<Scalars['String']['output']>;
  family?: Maybe<Scalars['String']['output']>;
  figi?: Maybe<Scalars['String']['output']>;
  firstSeenAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  industry?: Maybe<Scalars['String']['output']>;
  industryGroup?: Maybe<Scalars['String']['output']>;
  isin?: Maybe<Scalars['String']['output']>;
  lastUsedAt?: Maybe<Scalars['Time']['output']>;
  lastVerifiedAt?: Maybe<Scalars['Time']['output']>;
  marketCap?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  normalizedName: Scalars['String']['output'];
  normalizedSymbol: Scalars['String']['output'];
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
  interestRate: Scalars['Float']['output'];
  lender: Scalars['String']['output'];
  loanAmount: Scalars['Float']['output'];
  loanNumber?: Maybe<Scalars['String']['output']>;
  loanType: Scalars['String']['output'];
  monthlyPayment: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  otherFees?: Maybe<Scalars['Float']['output']>;
  ownershipMode?: Maybe<Scalars['String']['output']>;
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  remainingBalance: Scalars['Float']['output'];
  sector?: Maybe<Scalars['String']['output']>;
  startDate: Scalars['String']['output'];
  status: Scalars['String']['output'];
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
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

export type MarketDataCredential = {
  __typename?: 'MarketDataCredential';
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  provider: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
};

export type MethodParameter = {
  __typename?: 'MethodParameter';
  key: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/** Individual metric data */
export type Metric = {
  __typename?: 'Metric';
  aggregations: Scalars['JSON']['output'];
  labels: Scalars['JSON']['output'];
  lastUpdated: Scalars['DateTime']['output'];
  name: Scalars['String']['output'];
  type: MetricType;
  value: Scalars['Float']['output'];
};

/** Aggregated metric summary */
export type MetricSummary = {
  __typename?: 'MetricSummary';
  average: Scalars['Float']['output'];
  breakdown: Scalars['JSON']['output'];
  lastDay: Scalars['Float']['output'];
  lastHour: Scalars['Float']['output'];
  max: Scalars['Float']['output'];
  min: Scalars['Float']['output'];
  p50: Scalars['Float']['output'];
  p95: Scalars['Float']['output'];
  p99: Scalars['Float']['output'];
  total: Scalars['Float']['output'];
};

/** Metric type enumeration */
export enum MetricType {
  Counter = 'COUNTER',
  Gauge = 'GAUGE',
  Histogram = 'HISTOGRAM',
  Timing = 'TIMING'
}

export type Mutation = {
  __typename?: 'Mutation';
  acknowledgeAlert: Scalars['Boolean']['output'];
  addAssetToPortfolio: PortfolioAsset;
  addAssetToWatchlist: Watchlist;
  addInstrumentToPortfolio: PortfolioAsset;
  archiveManualInstrument: Instrument;
  confirmPasswordReset: PasswordResetResponse;
  createAlert: Alert;
  /** Create an alert rule */
  createAlertRule: AlertRule;
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
  createWatchAsset: Watch;
  createWatchlist: Watchlist;
  deactivateBatchAlerts: BatchDeactivateResult;
  deleteAlert: Scalars['Boolean']['output'];
  /** Delete an alert rule */
  deleteAlertRule: Scalars['Boolean']['output'];
  deleteMarketDataCredential: Scalars['ID']['output'];
  deletePortfolio: Scalars['ID']['output'];
  deleteUser: Scalars['ID']['output'];
  deleteWatchlist: Scalars['ID']['output'];
  duplicatePortfolio: Portfolio;
  exportPortfolio: ExportResult;
  importFinanceDatabaseAssets: ImportFinanceDatabaseAssetsPayload;
  login: AuthResponse;
  logout: LogoutResponse;
  persistDiscoveredInstrument: Instrument;
  /** Record a dashboard monitoring event */
  recordDashboardEvent: Scalars['Boolean']['output'];
  refreshAssetPrices: RefreshAssetPricesResult;
  refreshSingleAssetPrice: AssetPricePoint;
  refreshToken: AuthResponse;
  register: AuthResponse;
  removeAssetFromPortfolio: Scalars['ID']['output'];
  removeAssetFromWatchlist: Watchlist;
  reorderPortfolios: Array<Portfolio>;
  resendVerification: EmailVerificationResponse;
  resetPassword: PasswordResetResponse;
  restoreManualInstrument: Instrument;
  tagAsset: Asset;
  tagPortfolio: Portfolio;
  triggerFinanceDatabaseSync: TriggerFinanceDatabaseSyncPayload;
  untagAsset: Asset;
  untagPortfolio: Portfolio;
  updateAlert: Alert;
  /** Update an alert rule */
  updateAlertRule: AlertRule;
  updateAssetInPortfolio: PortfolioAsset;
  updateFinanceDatabaseSyncEnabled: FinanceDatabaseSyncItem;
  updateManualInstrument: Instrument;
  updatePerformanceSnapshots: Scalars['Boolean']['output'];
  updatePortfolio: Portfolio;
  updateProviderRoutingPreferences: ProviderRoutingPreferences;
  updateUser: User;
  updateUserDisplayCurrency: User;
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


export type MutationAddInstrumentToPortfolioArgs = {
  input: AddInstrumentHoldingInput;
};


export type MutationArchiveManualInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationConfirmPasswordResetArgs = {
  input: PasswordResetConfirmInput;
};


export type MutationCreateAlertArgs = {
  input: CreateAlertInput;
};


export type MutationCreateAlertRuleArgs = {
  input: AlertRuleInput;
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


export type MutationCreateWatchAssetArgs = {
  input: CreateWatchInput;
};


export type MutationCreateWatchlistArgs = {
  input: CreateWatchlistInput;
};


export type MutationDeactivateBatchAlertsArgs = {
  input: BatchDeactivateInput;
};


export type MutationDeleteAlertArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAlertRuleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMarketDataCredentialArgs = {
  provider: Scalars['String']['input'];
};


export type MutationDeletePortfolioArgs = {
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


export type MutationImportFinanceDatabaseAssetsArgs = {
  assetType: AssetSyncType;
  symbols: Array<Scalars['String']['input']>;
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


export type MutationRecordDashboardEventArgs = {
  input: DashboardEventInput;
};


export type MutationRefreshAssetPricesArgs = {
  assetId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationRefreshSingleAssetPriceArgs = {
  assetId: Scalars['ID']['input'];
};


export type MutationRefreshTokenArgs = {
  input: RefreshTokenInput;
};


export type MutationRegisterArgs = {
  input: RegisterInput;
};


export type MutationRemoveAssetFromPortfolioArgs = {
  assetID: Scalars['ID']['input'];
  portfolioID: Scalars['ID']['input'];
};


export type MutationRemoveAssetFromWatchlistArgs = {
  assetID: Scalars['ID']['input'];
  watchlistID: Scalars['ID']['input'];
};


export type MutationReorderPortfoliosArgs = {
  input: ReorderPortfoliosInput;
};


export type MutationResendVerificationArgs = {
  input: ResendVerificationInput;
};


export type MutationResetPasswordArgs = {
  input: PasswordResetInput;
};


export type MutationRestoreManualInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationTagAssetArgs = {
  assetID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationTagPortfolioArgs = {
  portfolioID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationTriggerFinanceDatabaseSyncArgs = {
  assetType: AssetSyncType;
};


export type MutationUntagAssetArgs = {
  assetID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationUntagPortfolioArgs = {
  portfolioID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationUpdateAlertArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAlertInput;
};


export type MutationUpdateAlertRuleArgs = {
  id: Scalars['ID']['input'];
  input: AlertRuleInput;
};


export type MutationUpdateAssetInPortfolioArgs = {
  input: PortfolioAssetInput;
};


export type MutationUpdateFinanceDatabaseSyncEnabledArgs = {
  assetType: AssetSyncType;
  enabled: Scalars['Boolean']['input'];
};


export type MutationUpdateManualInstrumentArgs = {
  id: Scalars['ID']['input'];
  input: UpdateManualInstrumentInput;
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


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};


export type MutationUpdateUserDisplayCurrencyArgs = {
  input: UpdateUserDisplayCurrencyInput;
};


export type MutationUpsertMarketDataCredentialArgs = {
  apiKey: Scalars['String']['input'];
  provider: Scalars['String']['input'];
};


export type MutationValidateProviderCredentialsArgs = {
  apiKey: Scalars['String']['input'];
  provider: Scalars['String']['input'];
};


export type MutationVerifyEmailArgs = {
  input: EmailVerificationInput;
};

/** User navigation pattern */
export type NavigationPattern = {
  __typename?: 'NavigationPattern';
  avgDuration: Scalars['Float']['output'];
  conversion: Scalars['Float']['output'];
  count: Scalars['Int']['output'];
  pattern: Scalars['String']['output'];
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
  figi?: Maybe<Scalars['String']['output']>;
  isin?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  providerExternalId?: Maybe<Scalars['String']['output']>;
  providerSource: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
};

export type OnlineInstrumentSearchPayload = {
  __typename?: 'OnlineInstrumentSearchPayload';
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

export type Portfolio = {
  __typename?: 'Portfolio';
  analytics?: Maybe<PortfolioAnalytics>;
  assets: Array<PortfolioAsset>;
  createdAt: Scalars['Time']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  tags: Array<Tag>;
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
  asset: Asset;
  averagePurchasePrice?: Maybe<Scalars['Float']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  instrumentID?: Maybe<Scalars['ID']['output']>;
  ownershipPct?: Maybe<Scalars['Float']['output']>;
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

export type PortfolioUpdatePayload = {
  __typename?: 'PortfolioUpdatePayload';
  portfolio: Portfolio;
  type: Scalars['String']['output'];
};

export type Position = {
  __typename?: 'Position';
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
  displayCurrency: Scalars['String']['output'];
  displayValue: Scalars['Float']['output'];
  fxAsOf?: Maybe<Scalars['Time']['output']>;
  fxGranularity?: Maybe<Scalars['String']['output']>;
  fxRate: Scalars['Float']['output'];
  fxSource?: Maybe<Scalars['String']['output']>;
  isStale: Scalars['Boolean']['output'];
  nativeValue: Scalars['Float']['output'];
  positionId: Scalars['ID']['output'];
  quoteCurrency: Scalars['String']['output'];
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
  benchmarkComparison: BenchmarkComparison;
  candles: Array<Candle>;
  comparePortfolios: Array<PerformanceMetrics>;
  exportPortfolioData: ExportData;
  financeDatabasePreview: Array<FinanceDatabasePreviewItem>;
  financeDatabaseSyncHistory: Array<FinanceDatabaseSyncHistoryEntry>;
  financeDatabaseSyncStatus: FinanceDatabaseSyncStatusPayload;
  generatePerformanceReport: PerformanceReport;
  instrument?: Maybe<Instrument>;
  latestPerformanceSnapshot?: Maybe<PerformanceSnapshot>;
  manualInstruments: ManualInstrumentPayload;
  marketDataCredentials: Array<MarketDataCredential>;
  me?: Maybe<AuthUser>;
  /** Get specific metric data */
  metric?: Maybe<Metric>;
  /** Get all available metrics */
  metrics: Array<Metric>;
  /** Get dashboard performance metrics */
  performanceMetrics: DashboardPerformanceMetrics;
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
  searchInstruments: InstrumentSearchPayload;
  searchInstrumentsOnline: OnlineInstrumentSearchPayload;
  supportedProviders: Array<ProviderInfo>;
  /** Get current system health status */
  systemHealth: SystemHealth;
  tag?: Maybe<Tag>;
  tags: Array<Tag>;
  technicalIndicator: TechnicalIndicatorResponse;
  topPerformingAssets: Array<PositionPerformance>;
  transaction?: Maybe<Transaction>;
  transactions: Array<Transaction>;
  user?: Maybe<User>;
  /** Get user engagement analytics */
  userEngagementMetrics: UserEngagementMetrics;
  users: Array<User>;
  watchlist?: Maybe<Watchlist>;
  watchlists: Array<Watchlist>;
  worstPerformingAssets: Array<PositionPerformance>;
};


export type QueryGetPortfoliosWithAnalyticsArgs = {
  userID: Scalars['ID']['input'];
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


export type QueryComparePortfoliosArgs = {
  portfolioIds: Array<Scalars['ID']['input']>;
  timeRange: PerformanceTimeRangeInput;
};


export type QueryExportPortfolioDataArgs = {
  input: ExportDataInput;
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


export type QueryInstrumentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryLatestPerformanceSnapshotArgs = {
  portfolioId: Scalars['ID']['input'];
};


export type QueryManualInstrumentsArgs = {
  filter?: InputMaybe<ManualInstrumentFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryMetricArgs = {
  name: Scalars['String']['input'];
};


export type QueryPerformanceMetricsArgs = {
  timeRange?: InputMaybe<Scalars['String']['input']>;
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


export type QuerySearchInstrumentsArgs = {
  input: InstrumentSearchInput;
};


export type QuerySearchInstrumentsOnlineArgs = {
  input: InstrumentSearchInput;
};


export type QuerySupportedProvidersArgs = {
  assetType?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTagArgs = {
  id: Scalars['ID']['input'];
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


export type QueryUserEngagementMetricsArgs = {
  timeRange?: InputMaybe<Scalars['String']['input']>;
};


export type QueryUsersArgs = {
  filter?: InputMaybe<UserFilter>;
  orderBy?: InputMaybe<UserOrder>;
  pagination?: InputMaybe<PaginationInput>;
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
  assetType: AssetType;
  bathrooms?: Maybe<Scalars['Float']['output']>;
  bedrooms?: Maybe<Scalars['Int']['output']>;
  city: Scalars['String']['output'];
  country: Scalars['String']['output'];
  currentValue?: Maybe<Scalars['Float']['output']>;
  dayChange?: Maybe<Scalars['Float']['output']>;
  dayChangePercent?: Maybe<Scalars['Float']['output']>;
  exchange?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  propertyType: Scalars['String']['output'];
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  squareFeet?: Maybe<Scalars['Int']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  yearBuilt?: Maybe<Scalars['Int']['output']>;
  zipCode?: Maybe<Scalars['String']['output']>;
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
  diversification: Scalars['Float']['output'];
  maxDrawdown: Scalars['Float']['output'];
  sharpeRatio: Scalars['Float']['output'];
  volatility: Scalars['Float']['output'];
};

export enum SortDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type Stock = Asset & {
  __typename?: 'Stock';
  assetType: AssetType;
  buyingPrice?: Maybe<Scalars['Float']['output']>;
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
  ticker: Scalars['String']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  alertTriggered: AlertTriggerEvent;
  /** Subscribe to real-time performance metrics */
  performanceMetricsUpdated: DashboardPerformanceMetrics;
  portfolioPerformanceUpdates: PerformanceMetrics;
  portfolioUpdates: PortfolioUpdatePayload;
  priceUpdates: ChartDataPoint;
  /** Subscribe to system health changes */
  systemHealthUpdated: SystemHealth;
  transactionUpdates: TransactionUpdatePayload;
};


export type SubscriptionAlertTriggeredArgs = {
  userId: Scalars['ID']['input'];
};


export type SubscriptionPortfolioPerformanceUpdatesArgs = {
  portfolioId: Scalars['ID']['input'];
};


export type SubscriptionPortfolioUpdatesArgs = {
  userID: Scalars['ID']['input'];
};


export type SubscriptionPriceUpdatesArgs = {
  assetIds: Array<Scalars['ID']['input']>;
};


export type SubscriptionTransactionUpdatesArgs = {
  userID: Scalars['ID']['input'];
};

export enum SyncStatus {
  Complete = 'COMPLETE',
  Error = 'ERROR',
  Idle = 'IDLE',
  Syncing = 'SYNCING'
}

/** System health status */
export type SystemHealth = {
  __typename?: 'SystemHealth';
  alertsCount: Scalars['Int']['output'];
  details?: Maybe<Scalars['JSON']['output']>;
  metricsCount: Scalars['Int']['output'];
  recentErrors: Scalars['Float']['output'];
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export type Tag = {
  __typename?: 'Tag';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

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

export type Transaction = {
  __typename?: 'Transaction';
  asset: Asset;
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
  Buy = 'BUY',
  Sell = 'SELL'
}

export type TransactionUpdatePayload = {
  __typename?: 'TransactionUpdatePayload';
  transaction: Transaction;
  type: Scalars['String']['output'];
};

export type TriggerFinanceDatabaseSyncPayload = {
  __typename?: 'TriggerFinanceDatabaseSyncPayload';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  syncStatus: FinanceDatabaseSyncItem;
};

export type UpdateAlertInput = {
  alertType?: InputMaybe<AlertType>;
  conditionType?: InputMaybe<ConditionType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  notificationMethods?: InputMaybe<Array<AlertNotificationMethod>>;
  thresholdPercentage?: InputMaybe<Scalars['Float']['input']>;
  thresholdValue?: InputMaybe<Scalars['Float']['input']>;
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
};

export type UpdateUserDisplayCurrencyInput = {
  displayCurrency: Scalars['String']['input'];
};

export type UpdateUserInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['Time']['output'];
  displayCurrency: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  portfolios: Array<Portfolio>;
  updatedAt: Scalars['Time']['output'];
  username: Scalars['String']['output'];
  watchlists: Array<Watchlist>;
};

/** User engagement analytics */
export type UserEngagementMetrics = {
  __typename?: 'UserEngagementMetrics';
  activeUsers: Scalars['Int']['output'];
  avgSessionDuration: Scalars['Float']['output'];
  deviceBreakdown: Scalars['JSON']['output'];
  errorsByComponent: Scalars['JSON']['output'];
  navigationPatterns: Array<NavigationPattern>;
  topFeatures: Array<FeatureUsage>;
  totalUsers: Scalars['Int']['output'];
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


export type CreateRealEstateAssetMutation = { __typename?: 'Mutation', createRealEstateAsset: { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, propertyType: string, address: string, city: string, state?: string | null, country: string, zipCode?: string | null, squareFeet?: number | null, yearBuilt?: number | null, bedrooms?: number | null, bathrooms?: number | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

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


export type CreateLoanAssetMutation = { __typename?: 'Mutation', createLoanAsset: { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, purchaseDate?: any | null, description?: string | null, loanType: string, loanAmount: number, remainingBalance: number, interestRate: number, durationMonths: number, monthlyPayment: number, startDate: string, endDate?: string | null, lender: string, loanNumber?: string | null, currency: string, downPayment?: number | null, status: string, ownershipMode?: string | null, applicationFee?: number | null, brokerFee?: number | null, insuranceFee?: number | null, otherFees?: number | null, earlyRepaymentFee?: number | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } };

export type AddAssetToPortfolioMutationVariables = Exact<{
  input: PortfolioAssetInput;
}>;


export type AddAssetToPortfolioMutation = { __typename?: 'Mutation', addAssetToPortfolio: { __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } } };

export type RegisterMutationVariables = Exact<{
  input: RegisterInput;
}>;


export type RegisterMutation = { __typename?: 'Mutation', register: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean, displayCurrency: string } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean, displayCurrency: string } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

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


export type RefreshTokenMutation = { __typename?: 'Mutation', refreshToken: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean, displayCurrency: string } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type PersistDiscoveredInstrumentMutationVariables = Exact<{
  input: PersistDiscoveredInstrumentInput;
}>;


export type PersistDiscoveredInstrumentMutation = { __typename?: 'Mutation', persistDiscoveredInstrument: { __typename?: 'Instrument', id: string, symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, assetType: InstrumentAssetType, providerSource: string, providerExternalId?: string | null, isin?: string | null, figi?: string | null, cusip?: string | null, firstSeenAt: any, lastVerifiedAt?: any | null, lastUsedAt?: any | null, createdAt: any, updatedAt: any } };

export type AddInstrumentToPortfolioMutationVariables = Exact<{
  input: AddInstrumentHoldingInput;
}>;


export type AddInstrumentToPortfolioMutation = { __typename?: 'Mutation', addInstrumentToPortfolio: { __typename?: 'PortfolioAsset', instrumentID?: string | null, quantity: number, averagePurchasePrice?: number | null, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null } };

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

export type UpsertMarketDataCredentialMutationVariables = Exact<{
  provider: Scalars['String']['input'];
  apiKey: Scalars['String']['input'];
}>;


export type UpsertMarketDataCredentialMutation = { __typename?: 'Mutation', upsertMarketDataCredential: { __typename?: 'MarketDataCredential', id: string, provider: string, createdAt: any, updatedAt: any } };

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

export type CreatePortfolioMutationVariables = Exact<{
  input: CreatePortfolioInput;
}>;


export type CreatePortfolioMutation = { __typename?: 'Mutation', createPortfolio: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, sortOrder: number } };

export type UpdatePortfolioMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePortfolioInput;
}>;


export type UpdatePortfolioMutation = { __typename?: 'Mutation', updatePortfolio: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, sortOrder: number } };

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

export type UpdateUserDisplayCurrencyMutationVariables = Exact<{
  input: UpdateUserDisplayCurrencyInput;
}>;


export type UpdateUserDisplayCurrencyMutation = { __typename?: 'Mutation', updateUserDisplayCurrency: { __typename?: 'User', id: string, displayCurrency: string } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean, displayCurrency: string } | null };

export type GetDashboardCriticalQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetDashboardCriticalQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number, count: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility: number, sharpeRatio: number, maxDrawdown: number, diversification: number }, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }> } | null, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, currentValue?: number | null, dayChange?: number | null, dayChangePercent?: number | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, purchasePrice?: number | null, sector?: string | null, exchange?: string | null, dayChange?: number | null, dayChangePercent?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } }> }>, watchlists: Array<{ __typename?: 'Watchlist', id: string, name: string }> };

export type GetDashboardSecondaryQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetDashboardSecondaryQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, notes?: string | null, quantity: number, unitPriceAmount?: number | null, unitPriceCurrency: string, executedAt: any, feesAmount: number, feesCurrency: string, transactionType: TransactionType }> };

export type GetPortfolioCardsQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetPortfolioCardsQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number } | null }> };

export type GetRecentTransactionsMinimalQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetRecentTransactionsMinimalQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, notes?: string | null, quantity: number, unitPriceAmount?: number | null, unitPriceCurrency: string, executedAt: any, transactionType: TransactionType }> };

export type GetAssetPerformanceOptimizedQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAssetPerformanceOptimizedQuery = { __typename?: 'Query', assets: Array<{ __typename?: 'BankAccount', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Crypto', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Fund', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'LifeInsurance', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Loan', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'RealEstate', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Stock', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Watch', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null }> };

export type SearchInstrumentsQueryVariables = Exact<{
  input: InstrumentSearchInput;
}>;


export type SearchInstrumentsQuery = { __typename?: 'Query', searchInstruments: { __typename?: 'InstrumentSearchPayload', canSearchOnline: boolean, localResults: Array<{ __typename?: 'InstrumentSearchResult', score: number, matchedAlias?: string | null, instrument: { __typename?: 'Instrument', id: string, symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, assetType: InstrumentAssetType, providerSource: string, providerExternalId?: string | null } }>, queryMetadata: { __typename?: 'InstrumentQueryMetadata', query: string, limit: number, offset: number, localCount: number, topScore: number, weakResults: boolean, searchOnlineHint: boolean } } };

export type SearchInstrumentsOnlineQueryVariables = Exact<{
  input: InstrumentSearchInput;
}>;


export type SearchInstrumentsOnlineQuery = { __typename?: 'Query', searchInstrumentsOnline: { __typename?: 'OnlineInstrumentSearchPayload', providerUsed: string, onlineResults: Array<{ __typename?: 'OnlineInstrumentResult', symbol: string, name: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, assetType: InstrumentAssetType, providerSource: string, providerExternalId?: string | null, isin?: string | null, figi?: string | null, cusip?: string | null }>, queryMetadata: { __typename?: 'InstrumentQueryMetadata', query: string, limit: number, offset: number, localCount: number, topScore: number, weakResults: boolean, searchOnlineHint: boolean } } };

export type ManualInstrumentsQueryVariables = Exact<{
  filter?: InputMaybe<ManualInstrumentFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
}>;


export type ManualInstrumentsQuery = { __typename?: 'Query', manualInstruments: { __typename?: 'ManualInstrumentPayload', hasMore: boolean, limit: number, offset: number, items: Array<{ __typename?: 'Instrument', id: string, symbol: string, normalizedSymbol: string, name: string, normalizedName: string, exchange: string, exchangeCode?: string | null, country?: string | null, currency?: string | null, baseCurrency?: string | null, quoteCurrency?: string | null, underlyingSymbol?: string | null, assetType: InstrumentAssetType, status: string, providerSource: string, providerExternalId?: string | null, firstSeenAt: any, lastVerifiedAt?: any | null, lastUsedAt?: any | null, createdAt: any, updatedAt: any, syncState?: { __typename?: 'InstrumentSyncState', instrumentID: string, syncStatus: string, stale: boolean, verificationConfidence: number, lastSyncAttempt?: any | null, lastSyncSuccess?: any | null, lastSyncSource?: string | null, syncErrorMessage?: string | null, createdAt: any, updatedAt: any } | null }> } };

export type GetMarketDataCredentialsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMarketDataCredentialsQuery = { __typename?: 'Query', marketDataCredentials: Array<{ __typename?: 'MarketDataCredential', id: string, provider: string, createdAt: any, updatedAt: any }> };

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


export type GetMarketDataSettingsQuery = { __typename?: 'Query', marketDataCredentials: Array<{ __typename?: 'MarketDataCredential', id: string, provider: string, createdAt: any, updatedAt: any }>, supportedProviders: Array<{ __typename?: 'ProviderInfo', id: string, name: string, type: string, requiresKey: boolean, intervals: Array<string>, supportsRealtime: boolean, rateLimit: { __typename?: 'RateLimit', requestsPerMinute: number, requestsPerDay: number, burstLimit: number } }>, providerHealth: Array<{ __typename?: 'ProviderHealth', provider: string, assetType: string, healthy: boolean, apiKeyValid?: boolean | null, lastChecked: any }>, providerRoutingPreferences: { __typename?: 'ProviderRoutingPreferences', id: string, userId: string, useIntelligentRouting: boolean, enableFallback: boolean, staleDataThresholdMinutes: number, createdAt: any, updatedAt: any, preferredProviders: Array<{ __typename?: 'ProviderPreference', provider: string, priority: number, enabled: boolean }> } };

export type GetPortfoliosWithAnalyticsQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetPortfoliosWithAnalyticsQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, description?: string | null, createdAt: any, updatedAt: any, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'BankAccount', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Crypto', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Fund', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'LifeInsurance', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Loan', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'RealEstate', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Stock', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Watch', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } }>, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, totalNativeValue?: number | null, totalDisplayValue?: number | null, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale?: boolean | null, fxState?: string | null, excludedPositionCount?: number | null, coveredValueRatio?: number | null, displayCurrency?: string | null, quoteCurrency?: string | null, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number }>, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility: number, sharpeRatio: number, maxDrawdown: number }, positionValuations?: Array<{ __typename?: 'PositionValuation', positionId: string, assetId: string, nativeValue: number, displayValue: number, fxRate: number, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale: boolean, quoteCurrency: string, displayCurrency: string }> | null } | null }> };

export type GetPortfolioQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPortfolioQuery = { __typename?: 'Query', portfolio?: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, createdAt: any, updatedAt: any, sortOrder: number, user: { __typename?: 'User', id: string }, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'BankAccount', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Fund', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'LifeInsurance', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Loan', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'RealEstate', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Watch', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } }>, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, totalNativeValue?: number | null, totalDisplayValue?: number | null, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale?: boolean | null, fxState?: string | null, excludedPositionCount?: number | null, coveredValueRatio?: number | null, displayCurrency?: string | null, quoteCurrency?: string | null, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number }>, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility: number, sharpeRatio: number, maxDrawdown: number }, positionValuations?: Array<{ __typename?: 'PositionValuation', positionId: string, assetId: string, nativeValue: number, displayValue: number, fxRate: number, fxAsOf?: any | null, fxSource?: string | null, fxGranularity?: string | null, isStale: boolean, quoteCurrency: string, displayCurrency: string }> | null } | null, tags: Array<{ __typename?: 'Tag', id: string, name: string }> } | null };

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

export type PortfolioUpdateSubscriptionSubscriptionVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type PortfolioUpdateSubscriptionSubscription = { __typename?: 'Subscription', portfolioUpdates: { __typename?: 'PortfolioUpdatePayload', type: string, portfolio: { __typename?: 'Portfolio', id: string, name: string } } };

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
}>;


export type RemoveAssetFromPortfolioMutation = { __typename?: 'Mutation', removeAssetFromPortfolio: string };

export type GetPerformanceMetricsQueryVariables = Exact<{
  timeRange?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetPerformanceMetricsQuery = { __typename?: 'Query', performanceMetrics: { __typename?: 'DashboardPerformanceMetrics', dashboardStateTransitions?: { __typename?: 'MetricSummary', total: number, average: number, min: number, max: number, p50: number, p95: number, p99: number, lastHour: number, lastDay: number, breakdown: any } | null, dataLoadTimes?: { __typename?: 'MetricSummary', total: number, average: number, min: number, max: number, p50: number, p95: number, p99: number, lastHour: number, lastDay: number, breakdown: any } | null, userInteractions?: { __typename?: 'MetricSummary', total: number, average: number, lastHour: number, lastDay: number, breakdown: any } | null, errorRates?: { __typename?: 'MetricSummary', total: number, average: number, lastHour: number, lastDay: number, breakdown: any } | null, marketDataUpdates?: { __typename?: 'MetricSummary', total: number, average: number, lastHour: number, lastDay: number, breakdown: any } | null } };

export type GetSystemHealthQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSystemHealthQuery = { __typename?: 'Query', systemHealth: { __typename?: 'SystemHealth', status: string, timestamp: any, metricsCount: number, alertsCount: number, recentErrors: number, details?: any | null } };

export type GetUserEngagementMetricsQueryVariables = Exact<{
  timeRange?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetUserEngagementMetricsQuery = { __typename?: 'Query', userEngagementMetrics: { __typename?: 'UserEngagementMetrics', totalUsers: number, activeUsers: number, avgSessionDuration: number, deviceBreakdown: any, errorsByComponent: any, topFeatures: Array<{ __typename?: 'FeatureUsage', feature: string, usageCount: number, uniqueUsers: number, avgDuration: number }>, navigationPatterns: Array<{ __typename?: 'NavigationPattern', pattern: string, count: number, avgDuration: number, conversion: number }> } };

export type RecordDashboardEventMutationVariables = Exact<{
  input: DashboardEventInput;
}>;


export type RecordDashboardEventMutation = { __typename?: 'Mutation', recordDashboardEvent: boolean };

export type PerformanceMetricsUpdatedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type PerformanceMetricsUpdatedSubscription = { __typename?: 'Subscription', performanceMetricsUpdated: { __typename?: 'DashboardPerformanceMetrics', dashboardStateTransitions?: { __typename?: 'MetricSummary', total: number, average: number, p95: number, lastHour: number } | null, dataLoadTimes?: { __typename?: 'MetricSummary', average: number, p95: number, lastHour: number } | null, errorRates?: { __typename?: 'MetricSummary', total: number, lastHour: number } | null } };

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

export type GetMarketDataQueryVariables = Exact<{
  symbol: Scalars['String']['input'];
  assetType: Scalars['String']['input'];
  interval: Scalars['String']['input'];
  from: Scalars['Time']['input'];
  to: Scalars['Time']['input'];
}>;


export type GetMarketDataQuery = { __typename?: 'Query', candles: Array<{ __typename?: 'Candle', timestamp: any, open: number, high: number, low: number, close: number, volume?: number | null }>, realTimePrice?: { __typename?: 'Candle', close: number, timestamp: any } | null };

export const PortfolioFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PortfolioFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Portfolio"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<PortfolioFieldsFragment, unknown>;
export const CreateStockAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateStockAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateStockInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createStockAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"ticker"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateStockAssetMutation, CreateStockAssetMutationVariables>;
export const CreateBankAccountAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBankAccountAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateBankAccountInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBankAccountAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"accountType"}},{"kind":"Field","name":{"kind":"Name","value":"institution"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}},{"kind":"Field","name":{"kind":"Name","value":"balance"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateBankAccountAssetMutation, CreateBankAccountAssetMutationVariables>;
export const CreateCryptoAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateCryptoAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateCryptoInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCryptoAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"walletAddress"}},{"kind":"Field","name":{"kind":"Name","value":"blockchainNetwork"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateCryptoAssetMutation, CreateCryptoAssetMutationVariables>;
export const CreateRealEstateAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRealEstateAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRealEstateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRealEstateAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"propertyType"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"zipCode"}},{"kind":"Field","name":{"kind":"Name","value":"squareFeet"}},{"kind":"Field","name":{"kind":"Name","value":"yearBuilt"}},{"kind":"Field","name":{"kind":"Name","value":"bedrooms"}},{"kind":"Field","name":{"kind":"Name","value":"bathrooms"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateRealEstateAssetMutation, CreateRealEstateAssetMutationVariables>;
export const CreateLifeInsuranceAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateLifeInsuranceAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateLifeInsuranceInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createLifeInsuranceAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"policyNumber"}},{"kind":"Field","name":{"kind":"Name","value":"insurer"}},{"kind":"Field","name":{"kind":"Name","value":"policyType"}},{"kind":"Field","name":{"kind":"Name","value":"coverageAmount"}},{"kind":"Field","name":{"kind":"Name","value":"premiumAmount"}},{"kind":"Field","name":{"kind":"Name","value":"premiumFrequency"}},{"kind":"Field","name":{"kind":"Name","value":"beneficiaries"}},{"kind":"Field","name":{"kind":"Name","value":"maturityDate"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateLifeInsuranceAssetMutation, CreateLifeInsuranceAssetMutationVariables>;
export const CreateWatchAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWatchAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateWatchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createWatchAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"brand"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"serialNumber"}},{"kind":"Field","name":{"kind":"Name","value":"referenceNumber"}},{"kind":"Field","name":{"kind":"Name","value":"condition"}},{"kind":"Field","name":{"kind":"Name","value":"yearMade"}},{"kind":"Field","name":{"kind":"Name","value":"material"}},{"kind":"Field","name":{"kind":"Name","value":"movement"}},{"kind":"Field","name":{"kind":"Name","value":"caseSize"}},{"kind":"Field","name":{"kind":"Name","value":"waterResistance"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateWatchAssetMutation, CreateWatchAssetMutationVariables>;
export const CreateLoanAssetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateLoanAsset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateLoanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createLoanAsset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"purchaseDate"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"loanType"}},{"kind":"Field","name":{"kind":"Name","value":"loanAmount"}},{"kind":"Field","name":{"kind":"Name","value":"remainingBalance"}},{"kind":"Field","name":{"kind":"Name","value":"interestRate"}},{"kind":"Field","name":{"kind":"Name","value":"durationMonths"}},{"kind":"Field","name":{"kind":"Name","value":"monthlyPayment"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"lender"}},{"kind":"Field","name":{"kind":"Name","value":"loanNumber"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"downPayment"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipMode"}},{"kind":"Field","name":{"kind":"Name","value":"applicationFee"}},{"kind":"Field","name":{"kind":"Name","value":"brokerFee"}},{"kind":"Field","name":{"kind":"Name","value":"insuranceFee"}},{"kind":"Field","name":{"kind":"Name","value":"otherFees"}},{"kind":"Field","name":{"kind":"Name","value":"earlyRepaymentFee"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<CreateLoanAssetMutation, CreateLoanAssetMutationVariables>;
export const AddAssetToPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAssetToPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PortfolioAssetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAssetToPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}}]}}]}}]} as unknown as DocumentNode<AddAssetToPortfolioMutation, AddAssetToPortfolioMutationVariables>;
export const RegisterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Register"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"register"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterMutation, RegisterMutationVariables>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogoutInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const ResetPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PasswordResetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const ConfirmPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PasswordResetConfirmInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ConfirmPasswordResetMutation, ConfirmPasswordResetMutationVariables>;
export const VerifyEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EmailVerificationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<VerifyEmailMutation, VerifyEmailMutationVariables>;
export const ResendVerificationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendVerification"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResendVerificationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resendVerification"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ResendVerificationMutation, ResendVerificationMutationVariables>;
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RefreshTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const PersistDiscoveredInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PersistDiscoveredInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PersistDiscoveredInstrumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"persistDiscoveredInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"isin"}},{"kind":"Field","name":{"kind":"Name","value":"figi"}},{"kind":"Field","name":{"kind":"Name","value":"cusip"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<PersistDiscoveredInstrumentMutation, PersistDiscoveredInstrumentMutationVariables>;
export const AddInstrumentToPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddInstrumentToPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddInstrumentHoldingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addInstrumentToPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}}]}}]}}]} as unknown as DocumentNode<AddInstrumentToPortfolioMutation, AddInstrumentToPortfolioMutationVariables>;
export const UpdateManualInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateManualInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateManualInstrumentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateManualInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedName"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"baseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"underlyingSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateManualInstrumentMutation, UpdateManualInstrumentMutationVariables>;
export const ArchiveManualInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchiveManualInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiveManualInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<ArchiveManualInstrumentMutation, ArchiveManualInstrumentMutationVariables>;
export const RestoreManualInstrumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestoreManualInstrument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restoreManualInstrument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<RestoreManualInstrumentMutation, RestoreManualInstrumentMutationVariables>;
export const UpsertMarketDataCredentialDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpsertMarketDataCredential"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upsertMarketDataCredential"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"apiKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpsertMarketDataCredentialMutation, UpsertMarketDataCredentialMutationVariables>;
export const DeleteMarketDataCredentialDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMarketDataCredential"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMarketDataCredential"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}]}]}}]} as unknown as DocumentNode<DeleteMarketDataCredentialMutation, DeleteMarketDataCredentialMutationVariables>;
export const ValidateProviderCredentialsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ValidateProviderCredentials"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"validateProviderCredentials"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}},{"kind":"Argument","name":{"kind":"Name","value":"apiKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"apiKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<ValidateProviderCredentialsMutation, ValidateProviderCredentialsMutationVariables>;
export const UpdateProviderRoutingPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProviderRoutingPreferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ProviderRoutingPreferencesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProviderRoutingPreferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"preferredProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}},{"kind":"Field","name":{"kind":"Name","value":"useIntelligentRouting"}},{"kind":"Field","name":{"kind":"Name","value":"enableFallback"}},{"kind":"Field","name":{"kind":"Name","value":"staleDataThresholdMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateProviderRoutingPreferencesMutation, UpdateProviderRoutingPreferencesMutationVariables>;
export const CreatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<CreatePortfolioMutation, CreatePortfolioMutationVariables>;
export const UpdatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<UpdatePortfolioMutation, UpdatePortfolioMutationVariables>;
export const DeletePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeletePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deletePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeletePortfolioMutation, DeletePortfolioMutationVariables>;
export const DuplicatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DuplicatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DuplicatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"duplicatePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<DuplicatePortfolioMutation, DuplicatePortfolioMutationVariables>;
export const TriggerFinanceDatabaseSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TriggerFinanceDatabaseSync"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"triggerFinanceDatabaseSync"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}}]}}]}}]}}]} as unknown as DocumentNode<TriggerFinanceDatabaseSyncMutation, TriggerFinanceDatabaseSyncMutationVariables>;
export const UpdateFinanceDatabaseSyncEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateFinanceDatabaseSyncEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFinanceDatabaseSyncEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}}]}}]}}]} as unknown as DocumentNode<UpdateFinanceDatabaseSyncEnabledMutation, UpdateFinanceDatabaseSyncEnabledMutationVariables>;
export const ImportFinanceDatabaseAssetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportFinanceDatabaseAssets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importFinanceDatabaseAssets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"symbols"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"importedCount"}},{"kind":"Field","name":{"kind":"Name","value":"errors"}}]}}]}}]} as unknown as DocumentNode<ImportFinanceDatabaseAssetsMutation, ImportFinanceDatabaseAssetsMutationVariables>;
export const UpdateUserDisplayCurrencyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserDisplayCurrency"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserDisplayCurrencyInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserDisplayCurrency"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}}]} as unknown as DocumentNode<UpdateUserDisplayCurrencyMutation, UpdateUserDisplayCurrencyMutationVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const GetDashboardCriticalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDashboardCritical"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}},{"kind":"Field","name":{"kind":"Name","value":"diversification"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChange"}},{"kind":"Field","name":{"kind":"Name","value":"dayChangePercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"watchlists"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetDashboardCriticalQuery, GetDashboardCriticalQueryVariables>;
export const GetDashboardSecondaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDashboardSecondary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"10"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"feesAmount"}},{"kind":"Field","name":{"kind":"Name","value":"feesCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}}]}}]}}]} as unknown as DocumentNode<GetDashboardSecondaryQuery, GetDashboardSecondaryQueryVariables>;
export const GetPortfolioCardsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfolioCards"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfolioCardsQuery, GetPortfolioCardsQueryVariables>;
export const GetRecentTransactionsMinimalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRecentTransactionsMinimal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceAmount"}},{"kind":"Field","name":{"kind":"Name","value":"unitPriceCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"executedAt"}},{"kind":"Field","name":{"kind":"Name","value":"transactionType"}}]}}]}}]} as unknown as DocumentNode<GetRecentTransactionsMinimalQuery, GetRecentTransactionsMinimalQueryVariables>;
export const GetAssetPerformanceOptimizedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssetPerformanceOptimized"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}}]}}]}}]} as unknown as DocumentNode<GetAssetPerformanceOptimizedQuery, GetAssetPerformanceOptimizedQueryVariables>;
export const SearchInstrumentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchInstruments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"InstrumentSearchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchInstruments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"localResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrument"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"matchedAlias"}}]}},{"kind":"Field","name":{"kind":"Name","value":"canSearchOnline"}},{"kind":"Field","name":{"kind":"Name","value":"queryMetadata"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"query"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}},{"kind":"Field","name":{"kind":"Name","value":"localCount"}},{"kind":"Field","name":{"kind":"Name","value":"topScore"}},{"kind":"Field","name":{"kind":"Name","value":"weakResults"}},{"kind":"Field","name":{"kind":"Name","value":"searchOnlineHint"}}]}}]}}]}}]} as unknown as DocumentNode<SearchInstrumentsQuery, SearchInstrumentsQueryVariables>;
export const SearchInstrumentsOnlineDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchInstrumentsOnline"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"InstrumentSearchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchInstrumentsOnline"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onlineResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"isin"}},{"kind":"Field","name":{"kind":"Name","value":"figi"}},{"kind":"Field","name":{"kind":"Name","value":"cusip"}}]}},{"kind":"Field","name":{"kind":"Name","value":"queryMetadata"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"query"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}},{"kind":"Field","name":{"kind":"Name","value":"localCount"}},{"kind":"Field","name":{"kind":"Name","value":"topScore"}},{"kind":"Field","name":{"kind":"Name","value":"weakResults"}},{"kind":"Field","name":{"kind":"Name","value":"searchOnlineHint"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerUsed"}}]}}]}}]} as unknown as DocumentNode<SearchInstrumentsOnlineQuery, SearchInstrumentsOnlineQueryVariables>;
export const ManualInstrumentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ManualInstruments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ManualInstrumentFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manualInstruments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"normalizedName"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"exchangeCode"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"baseCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"underlyingSymbol"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"providerSource"}},{"kind":"Field","name":{"kind":"Name","value":"providerExternalId"}},{"kind":"Field","name":{"kind":"Name","value":"firstSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastVerifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"syncState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instrumentID"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"stale"}},{"kind":"Field","name":{"kind":"Name","value":"verificationConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncAttempt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncSource"}},{"kind":"Field","name":{"kind":"Name","value":"syncErrorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}}]}}]}}]} as unknown as DocumentNode<ManualInstrumentsQuery, ManualInstrumentsQueryVariables>;
export const GetMarketDataCredentialsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketDataCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataCredentialsQuery, GetMarketDataCredentialsQueryVariables>;
export const GetSupportedProvidersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSupportedProviders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supportedProviders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"requiresKey"}},{"kind":"Field","name":{"kind":"Name","value":"intervals"}},{"kind":"Field","name":{"kind":"Name","value":"rateLimit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestsPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"requestsPerDay"}},{"kind":"Field","name":{"kind":"Name","value":"burstLimit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"supportsRealtime"}}]}}]}}]} as unknown as DocumentNode<GetSupportedProvidersQuery, GetSupportedProvidersQueryVariables>;
export const GetProviderHealthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetProviderHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"providerHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"healthy"}},{"kind":"Field","name":{"kind":"Name","value":"lastChecked"}}]}}]}}]} as unknown as DocumentNode<GetProviderHealthQuery, GetProviderHealthQueryVariables>;
export const GetProviderRoutingPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetProviderRoutingPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"providerRoutingPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"preferredProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}},{"kind":"Field","name":{"kind":"Name","value":"useIntelligentRouting"}},{"kind":"Field","name":{"kind":"Name","value":"enableFallback"}},{"kind":"Field","name":{"kind":"Name","value":"staleDataThresholdMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetProviderRoutingPreferencesQuery, GetProviderRoutingPreferencesQueryVariables>;
export const GetMarketDataSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketDataSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketDataCredentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"supportedProviders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"requiresKey"}},{"kind":"Field","name":{"kind":"Name","value":"intervals"}},{"kind":"Field","name":{"kind":"Name","value":"rateLimit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestsPerMinute"}},{"kind":"Field","name":{"kind":"Name","value":"requestsPerDay"}},{"kind":"Field","name":{"kind":"Name","value":"burstLimit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"supportsRealtime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"healthy"}},{"kind":"Field","name":{"kind":"Name","value":"apiKeyValid"}},{"kind":"Field","name":{"kind":"Name","value":"lastChecked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"providerRoutingPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"preferredProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}},{"kind":"Field","name":{"kind":"Name","value":"useIntelligentRouting"}},{"kind":"Field","name":{"kind":"Name","value":"enableFallback"}},{"kind":"Field","name":{"kind":"Name","value":"staleDataThresholdMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataSettingsQuery, GetMarketDataSettingsQueryVariables>;
export const GetPortfoliosWithAnalyticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfoliosWithAnalytics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalNativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalDisplayValue"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"fxState"}},{"kind":"Field","name":{"kind":"Name","value":"excludedPositionCount"}},{"kind":"Field","name":{"kind":"Name","value":"coveredValueRatio"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"positionValuations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"nativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"displayValue"}},{"kind":"Field","name":{"kind":"Name","value":"fxRate"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfoliosWithAnalyticsQuery, GetPortfoliosWithAnalyticsQueryVariables>;
export const GetPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalNativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalDisplayValue"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"fxState"}},{"kind":"Field","name":{"kind":"Name","value":"excludedPositionCount"}},{"kind":"Field","name":{"kind":"Name","value":"coveredValueRatio"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"positionValuations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"positionId"}},{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"nativeValue"}},{"kind":"Field","name":{"kind":"Name","value":"displayValue"}},{"kind":"Field","name":{"kind":"Name","value":"fxRate"}},{"kind":"Field","name":{"kind":"Name","value":"fxAsOf"}},{"kind":"Field","name":{"kind":"Name","value":"fxSource"}},{"kind":"Field","name":{"kind":"Name","value":"fxGranularity"}},{"kind":"Field","name":{"kind":"Name","value":"isStale"}},{"kind":"Field","name":{"kind":"Name","value":"quoteCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"displayCurrency"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfolioQuery, GetPortfolioQueryVariables>;
export const GetFinanceDatabaseSyncStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"lastSynced"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"currentRecord"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncStatusQuery, GetFinanceDatabaseSyncStatusQueryVariables>;
export const GetFinanceDatabaseSyncHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncHistoryQuery, GetFinanceDatabaseSyncHistoryQueryVariables>;
export const GetFinanceDatabasePreviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabasePreview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabasePreview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"country"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabasePreviewQuery, GetFinanceDatabasePreviewQueryVariables>;
export const PortfolioUpdateSubscriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"PortfolioUpdateSubscription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolioUpdates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<PortfolioUpdateSubscriptionSubscription, PortfolioUpdateSubscriptionSubscriptionVariables>;
export const GetAssetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetOrder"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetAssetsQuery, GetAssetsQueryVariables>;
export const GetAssetTypesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetAssetTypesQuery, GetAssetTypesQueryVariables>;
export const AddAssetToPortfolioHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAssetToPortfolioHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PortfolioAssetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAssetToPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}}]}}]} as unknown as DocumentNode<AddAssetToPortfolioHookMutation, AddAssetToPortfolioHookMutationVariables>;
export const RemoveAssetFromPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveAssetFromPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeAssetFromPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}}}]}]}}]} as unknown as DocumentNode<RemoveAssetFromPortfolioMutation, RemoveAssetFromPortfolioMutationVariables>;
export const GetPerformanceMetricsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPerformanceMetrics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"performanceMetrics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dashboardStateTransitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}},{"kind":"Field","name":{"kind":"Name","value":"p50"}},{"kind":"Field","name":{"kind":"Name","value":"p95"}},{"kind":"Field","name":{"kind":"Name","value":"p99"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}},{"kind":"Field","name":{"kind":"Name","value":"lastDay"}},{"kind":"Field","name":{"kind":"Name","value":"breakdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"dataLoadTimes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}},{"kind":"Field","name":{"kind":"Name","value":"p50"}},{"kind":"Field","name":{"kind":"Name","value":"p95"}},{"kind":"Field","name":{"kind":"Name","value":"p99"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}},{"kind":"Field","name":{"kind":"Name","value":"lastDay"}},{"kind":"Field","name":{"kind":"Name","value":"breakdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userInteractions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}},{"kind":"Field","name":{"kind":"Name","value":"lastDay"}},{"kind":"Field","name":{"kind":"Name","value":"breakdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errorRates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}},{"kind":"Field","name":{"kind":"Name","value":"lastDay"}},{"kind":"Field","name":{"kind":"Name","value":"breakdown"}}]}},{"kind":"Field","name":{"kind":"Name","value":"marketDataUpdates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}},{"kind":"Field","name":{"kind":"Name","value":"lastDay"}},{"kind":"Field","name":{"kind":"Name","value":"breakdown"}}]}}]}}]}}]} as unknown as DocumentNode<GetPerformanceMetricsQuery, GetPerformanceMetricsQueryVariables>;
export const GetSystemHealthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSystemHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"systemHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"metricsCount"}},{"kind":"Field","name":{"kind":"Name","value":"alertsCount"}},{"kind":"Field","name":{"kind":"Name","value":"recentErrors"}},{"kind":"Field","name":{"kind":"Name","value":"details"}}]}}]}}]} as unknown as DocumentNode<GetSystemHealthQuery, GetSystemHealthQueryVariables>;
export const GetUserEngagementMetricsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserEngagementMetrics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userEngagementMetrics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalUsers"}},{"kind":"Field","name":{"kind":"Name","value":"activeUsers"}},{"kind":"Field","name":{"kind":"Name","value":"avgSessionDuration"}},{"kind":"Field","name":{"kind":"Name","value":"topFeatures"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feature"}},{"kind":"Field","name":{"kind":"Name","value":"usageCount"}},{"kind":"Field","name":{"kind":"Name","value":"uniqueUsers"}},{"kind":"Field","name":{"kind":"Name","value":"avgDuration"}}]}},{"kind":"Field","name":{"kind":"Name","value":"navigationPatterns"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pattern"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"avgDuration"}},{"kind":"Field","name":{"kind":"Name","value":"conversion"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deviceBreakdown"}},{"kind":"Field","name":{"kind":"Name","value":"errorsByComponent"}}]}}]}}]} as unknown as DocumentNode<GetUserEngagementMetricsQuery, GetUserEngagementMetricsQueryVariables>;
export const RecordDashboardEventDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordDashboardEvent"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DashboardEventInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordDashboardEvent"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<RecordDashboardEventMutation, RecordDashboardEventMutationVariables>;
export const PerformanceMetricsUpdatedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"PerformanceMetricsUpdated"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"performanceMetricsUpdated"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dashboardStateTransitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"p95"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}}]}},{"kind":"Field","name":{"kind":"Name","value":"dataLoadTimes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"p95"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errorRates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"lastHour"}}]}}]}}]}}]} as unknown as DocumentNode<PerformanceMetricsUpdatedSubscription, PerformanceMetricsUpdatedSubscriptionVariables>;
export const GetFinanceDatabaseSyncStatusHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncStatusHook"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"lastSynced"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"currentRecord"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncStatusHookQuery, GetFinanceDatabaseSyncStatusHookQueryVariables>;
export const GetFinanceDatabaseSyncHistoryHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabaseSyncHistoryHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabaseSyncHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"recordCount"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabaseSyncHistoryHookQuery, GetFinanceDatabaseSyncHistoryHookQueryVariables>;
export const GetFinanceDatabasePreviewHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFinanceDatabasePreviewHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"financeDatabasePreview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"exchange"}},{"kind":"Field","name":{"kind":"Name","value":"sector"}},{"kind":"Field","name":{"kind":"Name","value":"country"}}]}}]}}]} as unknown as DocumentNode<GetFinanceDatabasePreviewHookQuery, GetFinanceDatabasePreviewHookQueryVariables>;
export const TriggerFinanceDatabaseSyncHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TriggerFinanceDatabaseSyncHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"triggerFinanceDatabaseSync"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"syncStatus"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}}]}}]}}]}}]} as unknown as DocumentNode<TriggerFinanceDatabaseSyncHookMutation, TriggerFinanceDatabaseSyncHookMutationVariables>;
export const UpdateFinanceDatabaseSyncEnabledHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateFinanceDatabaseSyncEnabledHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFinanceDatabaseSyncEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"isEnabled"}}]}}]}}]} as unknown as DocumentNode<UpdateFinanceDatabaseSyncEnabledHookMutation, UpdateFinanceDatabaseSyncEnabledHookMutationVariables>;
export const ImportFinanceDatabaseAssetsHookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ImportFinanceDatabaseAssetsHook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetSyncType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importFinanceDatabaseAssets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"symbols"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbols"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"importedCount"}},{"kind":"Field","name":{"kind":"Name","value":"errors"}}]}}]}}]} as unknown as DocumentNode<ImportFinanceDatabaseAssetsHookMutation, ImportFinanceDatabaseAssetsHookMutationVariables>;
export const GetMarketDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMarketData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"interval"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Time"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"candles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"symbol"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}},{"kind":"Argument","name":{"kind":"Name","value":"interval"},"value":{"kind":"Variable","name":{"kind":"Name","value":"interval"}}},{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"open"}},{"kind":"Field","name":{"kind":"Name","value":"high"}},{"kind":"Field","name":{"kind":"Name","value":"low"}},{"kind":"Field","name":{"kind":"Name","value":"close"}},{"kind":"Field","name":{"kind":"Name","value":"volume"}}]}},{"kind":"Field","name":{"kind":"Name","value":"realTimePrice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"symbol"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"close"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}}]}}]} as unknown as DocumentNode<GetMarketDataQuery, GetMarketDataQueryVariables>;