import { useMutation, useQuery } from "@apollo/client";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	DELETE_MARKET_DATA_CREDENTIAL,
	UPDATE_PROVIDER_ROUTING_PREFERENCES,
	UPSERT_MARKET_DATA_CREDENTIAL,
	VALIDATE_PROVIDER_CREDENTIALS,
} from "@/graphql/mutations/market-data";
import { GET_MARKET_DATA_SETTINGS } from "@/graphql/queries/market-data";
import { MarketDataSettings } from "./MarketDataSettings";

// GraphQL response types
interface MarketDataCredential {
	id: string;
	provider: string;
	isEnabled: boolean;
	priority: number;
	lastValidatedAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

interface ProviderRateLimit {
	requestsPerMinute: number;
	requestsPerDay: number;
	burstLimit: number;
}

interface SupportedProvider {
	id: string;
	name: string;
	type: string;
	requiresKey: boolean;
	intervals: string[];
	rateLimit: ProviderRateLimit;
	supportsRealtime: boolean;
}

interface ProviderHealth {
	provider: string;
	assetType: string;
	healthy: boolean;
	apiKeyValid?: boolean | null;
	lastChecked: string;
}

interface PreferredProvider {
	provider: string;
	priority: number;
	enabled: boolean;
}

interface ProviderRoutingPreferences {
	id: string;
	userId: string;
	preferredProviders: PreferredProvider[];
	useIntelligentRouting: boolean;
	enableFallback: boolean;
	staleDataThresholdMinutes: number;
	createdAt: string;
	updatedAt: string;
}

interface MarketDataSettingsData {
	marketDataCredentials: MarketDataCredential[];
	supportedProviders: SupportedProvider[];
	providerHealth: ProviderHealth[];
	providerRoutingPreferences: ProviderRoutingPreferences;
}

// Mutation input types
interface ProviderRoutingPreferencesInput {
	useIntelligentRouting: boolean;
	enableFallback: boolean;
	preferredProviders: PreferredProvider[];
	staleDataThresholdMinutes?: number;
}

interface MarketDataSettingsWrapperProps {
	assetType?: string;
	showHeader?: boolean;
}

export function MarketDataSettingsWrapper(props?: MarketDataSettingsWrapperProps) {
	const showHeader = props?.showHeader ?? true;
	// Fetch all market data settings (no assetType filter = all providers)
	const { data, loading, error, refetch } = useQuery<MarketDataSettingsData>(
		GET_MARKET_DATA_SETTINGS,
		{
			variables: { assetType: null },
			fetchPolicy: "cache-and-network",
		},
	);

	// State for user feedback
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Mutations
	const [upsertCredential, { loading: saving }] = useMutation(UPSERT_MARKET_DATA_CREDENTIAL, {
		onCompleted: () => refetch(),
	});

	const [deleteCredential] = useMutation(DELETE_MARKET_DATA_CREDENTIAL, {
		onCompleted: () => refetch(),
	});

	const [validateCredentials] = useMutation(VALIDATE_PROVIDER_CREDENTIALS);

	const [updateRoutingPreferences] = useMutation(UPDATE_PROVIDER_ROUTING_PREFERENCES, {
		onCompleted: () => refetch(),
	});

	// Transform credentials to match component props
	const credentials =
		data?.marketDataCredentials.map((cred) => ({
			provider: cred.provider,
			configured: true,
			isEnabled: cred.isEnabled,
			priority: cred.priority,
			lastValidated: cred.lastValidatedAt
				? new Date(cred.lastValidatedAt)
				: cred.updatedAt
					? new Date(cred.updatedAt)
					: undefined,
		})) || [];

	// Transform supported providers to match component props
	const supportedProviders =
		data?.supportedProviders.map((provider) => ({
			id: provider.id,
			name: provider.name,
			requiresKey: provider.requiresKey,
			supportsRealtime: provider.supportsRealtime,
			rateLimit: {
				requestsPerMinute: provider.rateLimit.requestsPerMinute,
				requestsPerDay: provider.rateLimit.requestsPerDay,
			},
			intervals: provider.intervals,
		})) || [];

	// Callback handlers
	const handleSaveCredential = async (
		provider: string,
		apiKey: string,
		options?: { isEnabled: boolean; priority: number },
	): Promise<void> => {
		setErrorMessage(null);
		setSaveMessage(null);
		try {
			await upsertCredential({
				variables: {
					provider,
					apiKey,
					isEnabled: options?.isEnabled ?? true,
					priority: options?.priority ?? 100,
				},
			});
			setSaveMessage(`API key for ${provider} saved successfully`);
			// Clear message after 3 seconds
			setTimeout(() => setSaveMessage(null), 3000);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to save API key";
			setErrorMessage(message);
		}
	};

	const handleDeleteCredential = async (provider: string): Promise<void> => {
		setErrorMessage(null);
		try {
			await deleteCredential({
				variables: { provider },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to delete API key";
			setErrorMessage(message);
		}
	};

	const handleValidateCredential = async (provider: string, apiKey: string): Promise<boolean> => {
		setErrorMessage(null);
		try {
			const { data: validateData } = await validateCredentials({
				variables: { provider, apiKey },
			});
			return validateData?.validateProviderCredentials?.valid ?? false;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to validate API key";
			setErrorMessage(message);
			return false;
		}
	};

	const handleUpdatePreferences = async (preferences: {
		useIntelligentRouting: boolean;
		enableFallback: boolean;
		preferredProviders: {
			provider: string;
			priority: number;
			enabled: boolean;
		}[];
	}): Promise<void> => {
		const input: ProviderRoutingPreferencesInput = {
			useIntelligentRouting: preferences.useIntelligentRouting,
			enableFallback: preferences.enableFallback,
			preferredProviders: preferences.preferredProviders,
		};

		await updateRoutingPreferences({
			variables: { input },
		});
	};

	// Loading state
	if (loading && !data) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<Skeleton className="h-8 w-64 mb-2" />
						<Skeleton className="h-4 w-96" />
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>
							<Skeleton className="h-6 w-32" />
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex gap-4">
								<Skeleton className="h-10 flex-1" />
								<Skeleton className="h-10 w-24" />
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Market Data Settings</h1>
						<p className="text-muted-foreground">
							Configure API keys and routing preferences for market data providers
						</p>
					</div>
				</div>

				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>Failed to load market data settings: {error.message}</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<MarketDataSettings
			credentials={credentials}
			supportedProviders={supportedProviders}
			providerHealth={data?.providerHealth}
			onSaveCredential={handleSaveCredential}
			onDeleteCredential={handleDeleteCredential}
			onValidateCredential={handleValidateCredential}
			onUpdatePreferences={handleUpdatePreferences}
			saveMessage={saveMessage}
			errorMessage={errorMessage}
			savingProvider={saving}
			showHeader={showHeader}
		/>
	);
}
