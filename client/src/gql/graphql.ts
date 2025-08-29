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
  Time: { input: any; output: any; }
};

export type Asset = {
  assetType: AssetType;
  currentValue?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
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

export type AssetType = {
  __typename?: 'AssetType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
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
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type CreateCryptoInput = {
  assetTypeID: Scalars['ID']['input'];
  blockchainNetwork?: InputMaybe<Scalars['String']['input']>;
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  quantity: Scalars['Float']['input'];
  walletAddress?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePortfolioInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  userID: Scalars['ID']['input'];
};

export type CreateStockInput = {
  assetTypeID: Scalars['ID']['input'];
  currentValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  purchaseDate?: InputMaybe<Scalars['Time']['input']>;
  purchasePrice?: InputMaybe<Scalars['Float']['input']>;
  quantity: Scalars['Float']['input'];
  ticker: Scalars['String']['input'];
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
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
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  quantity: Scalars['Float']['output'];
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  walletAddress?: Maybe<Scalars['String']['output']>;
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

export type Mutation = {
  __typename?: 'Mutation';
  addAssetToPortfolio: PortfolioAsset;
  addAssetToWatchlist: Watchlist;
  confirmPasswordReset: PasswordResetResponse;
  createCryptoAsset: Crypto;
  createPortfolio: Portfolio;
  createStockAsset: Stock;
  createUser: User;
  createWatchlist: Watchlist;
  deletePortfolio: Scalars['ID']['output'];
  deleteUser: Scalars['ID']['output'];
  deleteWatchlist: Scalars['ID']['output'];
  duplicatePortfolio: Portfolio;
  exportPortfolio: ExportResult;
  login: AuthResponse;
  logout: LogoutResponse;
  refreshToken: AuthResponse;
  register: AuthResponse;
  removeAssetFromPortfolio: Scalars['ID']['output'];
  removeAssetFromWatchlist: Watchlist;
  reorderPortfolios: Array<Portfolio>;
  resendVerification: EmailVerificationResponse;
  resetPassword: PasswordResetResponse;
  tagAsset: Asset;
  tagPortfolio: Portfolio;
  untagAsset: Asset;
  untagPortfolio: Portfolio;
  updateAssetInPortfolio: PortfolioAsset;
  updatePortfolio: Portfolio;
  updateUser: User;
  verifyEmail: EmailVerificationResponse;
};


export type MutationAddAssetToPortfolioArgs = {
  input: PortfolioAssetInput;
};


export type MutationAddAssetToWatchlistArgs = {
  assetID: Scalars['ID']['input'];
  watchlistID: Scalars['ID']['input'];
};


export type MutationConfirmPasswordResetArgs = {
  input: PasswordResetConfirmInput;
};


export type MutationCreateCryptoAssetArgs = {
  input: CreateCryptoInput;
};


export type MutationCreatePortfolioArgs = {
  input: CreatePortfolioInput;
};


export type MutationCreateStockAssetArgs = {
  input: CreateStockInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationCreateWatchlistArgs = {
  input: CreateWatchlistInput;
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


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationLogoutArgs = {
  input: LogoutInput;
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


export type MutationTagAssetArgs = {
  assetID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationTagPortfolioArgs = {
  portfolioID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationUntagAssetArgs = {
  assetID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationUntagPortfolioArgs = {
  portfolioID: Scalars['ID']['input'];
  tagID: Scalars['ID']['input'];
};


export type MutationUpdateAssetInPortfolioArgs = {
  input: PortfolioAssetInput;
};


export type MutationUpdatePortfolioArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePortfolioInput;
};


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};


export type MutationVerifyEmailArgs = {
  input: EmailVerificationInput;
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

export type PerformancePoint = {
  __typename?: 'PerformancePoint';
  date: Scalars['Time']['output'];
  value: Scalars['Float']['output'];
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
  performanceHistory: Array<PerformancePoint>;
  riskMetrics: RiskMetrics;
  totalCost: Scalars['Float']['output'];
  totalGainLoss: Scalars['Float']['output'];
  totalGainLossPercent: Scalars['Float']['output'];
  totalValue: Scalars['Float']['output'];
};

export type PortfolioAsset = {
  __typename?: 'PortfolioAsset';
  asset: Asset;
  averagePurchasePrice?: Maybe<Scalars['Float']['output']>;
  currentValue?: Maybe<Scalars['Float']['output']>;
  ownershipPct?: Maybe<Scalars['Float']['output']>;
  quantity: Scalars['Float']['output'];
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

export type Query = {
  __typename?: 'Query';
  GetPortfoliosWithAnalytics: Array<Portfolio>;
  asset?: Maybe<Asset>;
  assetTypes: Array<AssetType>;
  assets: Array<Asset>;
  me?: Maybe<AuthUser>;
  portfolio?: Maybe<Portfolio>;
  portfolios: Array<Portfolio>;
  tag?: Maybe<Tag>;
  tags: Array<Tag>;
  transaction?: Maybe<Transaction>;
  transactions: Array<Transaction>;
  user?: Maybe<User>;
  users: Array<User>;
  watchlist?: Maybe<Watchlist>;
  watchlists: Array<Watchlist>;
};


export type QueryGetPortfoliosWithAnalyticsArgs = {
  userID: Scalars['ID']['input'];
};


export type QueryAssetArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAssetsArgs = {
  filter?: InputMaybe<AssetFilter>;
  orderBy?: InputMaybe<AssetOrder>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryPortfolioArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPortfoliosArgs = {
  filter?: InputMaybe<PortfolioFilter>;
  orderBy?: InputMaybe<PortfolioOrder>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryTagArgs = {
  id: Scalars['ID']['input'];
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


export type QueryWatchlistArgs = {
  id: Scalars['ID']['input'];
};


export type QueryWatchlistsArgs = {
  filter?: InputMaybe<WatchlistFilter>;
  pagination?: InputMaybe<PaginationInput>;
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
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  positions: Array<Position>;
  purchaseDate?: Maybe<Scalars['Time']['output']>;
  purchasePrice?: Maybe<Scalars['Float']['output']>;
  quantity: Scalars['Float']['output'];
  symbol?: Maybe<Scalars['String']['output']>;
  tags: Array<Tag>;
  ticker: Scalars['String']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  portfolioUpdates: PortfolioUpdatePayload;
  transactionUpdates: TransactionUpdatePayload;
};


export type SubscriptionPortfolioUpdatesArgs = {
  userID: Scalars['ID']['input'];
};


export type SubscriptionTransactionUpdatesArgs = {
  userID: Scalars['ID']['input'];
};

export type Tag = {
  __typename?: 'Tag';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Transaction = {
  __typename?: 'Transaction';
  asset: Asset;
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  portfolio: Portfolio;
  pricePerUnit: Scalars['Float']['output'];
  quantity: Scalars['Float']['output'];
  transactionDate: Scalars['Time']['output'];
  transactionType: TransactionType;
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
  PricePerUnit = 'PRICE_PER_UNIT',
  Quantity = 'QUANTITY',
  TransactionDate = 'TRANSACTION_DATE'
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

export type UpdatePortfolioInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateUserInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['Time']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  portfolios: Array<Portfolio>;
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

export type RegisterMutationVariables = Exact<{
  input: RegisterInput;
}>;


export type RegisterMutation = { __typename?: 'Mutation', register: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

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


export type RefreshTokenMutation = { __typename?: 'Mutation', refreshToken: { __typename?: 'AuthResponse', success: boolean, data?: { __typename?: 'AuthData', token: string, refreshToken: string, expiresAt: any, user: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean } } | null, errors?: Array<{ __typename?: 'AuthError', code: string, message: string, field?: string | null }> | null } };

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

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'AuthUser', id: string, email: string, name: string, emailVerified: boolean } | null };

export type GetDashboardCriticalQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetDashboardCriticalQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number } | null }>, watchlists: Array<{ __typename?: 'Watchlist', id: string, name: string }> };

export type GetDashboardSecondaryQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetDashboardSecondaryQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, notes?: string | null, quantity: number, pricePerUnit: number, transactionDate: any }> };

export type GetPortfolioCardsQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetPortfolioCardsQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalGainLossPercent: number } | null }> };

export type GetRecentTransactionsMinimalQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetRecentTransactionsMinimalQuery = { __typename?: 'Query', transactions: Array<{ __typename?: 'Transaction', id: string, notes?: string | null, quantity: number, pricePerUnit: number }> };

export type GetAssetPerformanceOptimizedQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAssetPerformanceOptimizedQuery = { __typename?: 'Query', assets: Array<{ __typename?: 'Crypto', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null } | { __typename?: 'Stock', id: string, name: string, currentValue?: number | null, purchasePrice?: number | null }> };

export type GetPortfoliosWithAnalyticsQueryVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type GetPortfoliosWithAnalyticsQuery = { __typename?: 'Query', portfolios: Array<{ __typename?: 'Portfolio', id: string, name: string, description?: string | null, createdAt: any, updatedAt: any, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'Crypto', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Stock', name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } }>, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number }>, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility: number, sharpeRatio: number, maxDrawdown: number } } | null }> };

export type GetPortfolioQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetPortfolioQuery = { __typename?: 'Query', portfolio?: { __typename?: 'Portfolio', id: string, name: string, description?: string | null, createdAt: any, updatedAt: any, sortOrder: number, user: { __typename?: 'User', id: string }, assets: Array<{ __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', name: string } } }>, analytics?: { __typename?: 'PortfolioAnalytics', totalValue: number, totalCost: number, totalGainLoss: number, totalGainLossPercent: number, assetAllocation: Array<{ __typename?: 'AssetAllocation', assetType: string, value: number, percentage: number }>, performanceHistory: Array<{ __typename?: 'PerformancePoint', date: any, value: number }>, riskMetrics: { __typename?: 'RiskMetrics', volatility: number, sharpeRatio: number, maxDrawdown: number } } | null, tags: Array<{ __typename?: 'Tag', id: string, name: string }> } | null };

export type PortfolioUpdateSubscriptionSubscriptionVariables = Exact<{
  userID: Scalars['ID']['input'];
}>;


export type PortfolioUpdateSubscriptionSubscription = { __typename?: 'Subscription', portfolioUpdates: { __typename?: 'PortfolioUpdatePayload', type: string, portfolio: { __typename?: 'Portfolio', id: string, name: string } } };

export type GetAssetsQueryVariables = Exact<{
  filter?: InputMaybe<AssetFilter>;
  pagination?: InputMaybe<PaginationInput>;
  orderBy?: InputMaybe<AssetOrder>;
}>;


export type GetAssetsQuery = { __typename?: 'Query', assets: Array<{ __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } }> };

export type GetAssetTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAssetTypesQuery = { __typename?: 'Query', assetTypes: Array<{ __typename?: 'AssetType', id: string, name: string }> };

export type AddAssetToPortfolioMutationVariables = Exact<{
  input: PortfolioAssetInput;
}>;


export type AddAssetToPortfolioMutation = { __typename?: 'Mutation', addAssetToPortfolio: { __typename?: 'PortfolioAsset', quantity: number, averagePurchasePrice?: number | null, ownershipPct?: number | null, asset: { __typename?: 'Crypto', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } | { __typename?: 'Stock', id: string, name: string, symbol?: string | null, currentValue?: number | null, assetType: { __typename?: 'AssetType', id: string, name: string } } } };

export type RemoveAssetFromPortfolioMutationVariables = Exact<{
  portfolioID: Scalars['ID']['input'];
  assetID: Scalars['ID']['input'];
}>;


export type RemoveAssetFromPortfolioMutation = { __typename?: 'Mutation', removeAssetFromPortfolio: string };

export type PortfolioFieldsFragment = { __typename?: 'Portfolio', id: string, name: string, description?: string | null, createdAt: any, updatedAt: any } & { ' $fragmentName'?: 'PortfolioFieldsFragment' };

export const PortfolioFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PortfolioFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Portfolio"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<PortfolioFieldsFragment, unknown>;
export const RegisterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Register"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"register"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterMutation, RegisterMutationVariables>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LogoutInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const ResetPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PasswordResetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const ConfirmPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PasswordResetConfirmInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ConfirmPasswordResetMutation, ConfirmPasswordResetMutationVariables>;
export const VerifyEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EmailVerificationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<VerifyEmailMutation, VerifyEmailMutationVariables>;
export const ResendVerificationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendVerification"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResendVerificationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resendVerification"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<ResendVerificationMutation, ResendVerificationMutationVariables>;
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RefreshTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"data"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]}}]} as unknown as DocumentNode<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const CreatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<CreatePortfolioMutation, CreatePortfolioMutationVariables>;
export const UpdatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<UpdatePortfolioMutation, UpdatePortfolioMutationVariables>;
export const DeletePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeletePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deletePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeletePortfolioMutation, DeletePortfolioMutationVariables>;
export const DuplicatePortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DuplicatePortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DuplicatePortfolioInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"duplicatePortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<DuplicatePortfolioMutation, DuplicatePortfolioMutationVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const GetDashboardCriticalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDashboardCritical"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"watchlists"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetDashboardCriticalQuery, GetDashboardCriticalQueryVariables>;
export const GetDashboardSecondaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDashboardSecondary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"10"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"pricePerUnit"}},{"kind":"Field","name":{"kind":"Name","value":"transactionDate"}}]}}]}}]} as unknown as DocumentNode<GetDashboardSecondaryQuery, GetDashboardSecondaryQueryVariables>;
export const GetPortfolioCardsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfolioCards"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfolioCardsQuery, GetPortfolioCardsQueryVariables>;
export const GetRecentTransactionsMinimalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRecentTransactionsMinimal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"pricePerUnit"}}]}}]}}]} as unknown as DocumentNode<GetRecentTransactionsMinimalQuery, GetRecentTransactionsMinimalQueryVariables>;
export const GetAssetPerformanceOptimizedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssetPerformanceOptimized"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}}]}}]}}]} as unknown as DocumentNode<GetAssetPerformanceOptimizedQuery, GetAssetPerformanceOptimizedQueryVariables>;
export const GetPortfoliosWithAnalyticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfoliosWithAnalytics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolios"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfoliosWithAnalyticsQuery, GetPortfoliosWithAnalyticsQueryVariables>;
export const GetPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"assets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}},{"kind":"Field","name":{"kind":"Name","value":"analytics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalValue"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLoss"}},{"kind":"Field","name":{"kind":"Name","value":"totalGainLossPercent"}},{"kind":"Field","name":{"kind":"Name","value":"assetAllocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetType"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"performanceHistory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskMetrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"volatility"}},{"kind":"Field","name":{"kind":"Name","value":"sharpeRatio"}},{"kind":"Field","name":{"kind":"Name","value":"maxDrawdown"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetPortfolioQuery, GetPortfolioQueryVariables>;
export const PortfolioUpdateSubscriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"PortfolioUpdateSubscription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"portfolioUpdates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"portfolio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<PortfolioUpdateSubscriptionSubscription, PortfolioUpdateSubscriptionSubscriptionVariables>;
export const GetAssetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AssetOrder"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"pagination"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pagination"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetAssetsQuery, GetAssetsQueryVariables>;
export const GetAssetTypesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAssetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetAssetTypesQuery, GetAssetTypesQueryVariables>;
export const AddAssetToPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAssetToPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PortfolioAssetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAssetToPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"asset"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"currentValue"}},{"kind":"Field","name":{"kind":"Name","value":"assetType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"averagePurchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"ownershipPct"}}]}}]}}]} as unknown as DocumentNode<AddAssetToPortfolioMutation, AddAssetToPortfolioMutationVariables>;
export const RemoveAssetFromPortfolioDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveAssetFromPortfolio"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeAssetFromPortfolio"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"portfolioID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"portfolioID"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetID"}}}]}]}}]} as unknown as DocumentNode<RemoveAssetFromPortfolioMutation, RemoveAssetFromPortfolioMutationVariables>;