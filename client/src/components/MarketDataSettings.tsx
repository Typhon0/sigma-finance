import { Activity, CheckCircle, Globe, Key, Plug, XCircle, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProviderConfig {
	id: string;
	name: string;
	requiresKey: boolean;
	supportsRealtime: boolean;
	rateLimit: {
		requestsPerMinute: number;
		requestsPerDay: number;
	};
	intervals: string[];
}

interface CredentialStatus {
	provider: string;
	configured: boolean;
	isEnabled: boolean;
	priority: number;
	lastValidated?: Date;
}

interface MarketDataSettingsProps {
	credentials: CredentialStatus[];
	supportedProviders: ProviderConfig[];
	providerHealth?: ProviderHealthStatus[];
	onSaveCredential: (
		provider: string,
		apiKey: string,
		options?: { isEnabled: boolean; priority: number },
	) => Promise<void>;
	onDeleteCredential: (provider: string) => Promise<void>;
	onValidateCredential: (provider: string, apiKey: string) => Promise<boolean>;
	onUpdatePreferences: (preferences: RoutingPreferences) => Promise<void>;
	saveMessage?: string | null;
	errorMessage?: string | null;
	savingProvider?: boolean;
	showHeader?: boolean;
}

interface ProviderHealthStatus {
	provider: string;
	assetType: string;
	healthy: boolean;
	apiKeyValid?: boolean | null;
	lastChecked: string;
}

interface RoutingPreferences {
	useIntelligentRouting: boolean;
	enableFallback: boolean;
	preferredProviders: {
		provider: string;
		priority: number;
		enabled: boolean;
	}[];
}

export function MarketDataSettings({
	credentials,
	supportedProviders,
	providerHealth,
	onSaveCredential,
	onDeleteCredential,
	onValidateCredential,
	onUpdatePreferences,
	saveMessage,
	errorMessage,
	savingProvider: savingProviderGlobal,
	showHeader = true,
}: MarketDataSettingsProps) {
	const [activeTab, setActiveTab] = useState("credentials");
	const [savingProvider, setSavingProvider] = useState<string | null>(null);
	const [validatingProvider, setValidatingProvider] = useState<string | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
	const [validationResults, setValidationResults] = useState<Record<string, boolean | null>>({});
	const [preferences, setPreferences] = useState<RoutingPreferences>({
		useIntelligentRouting: true,
		enableFallback: true,
		preferredProviders: supportedProviders.map((p) => ({
			provider: p.id,
			priority: 1,
			enabled: true,
		})),
	});
	const [credentialOptions, setCredentialOptions] = useState<
		Record<string, { isEnabled: boolean; priority: number }>
	>({});

	useEffect(() => {
		setCredentialOptions((prev) => {
			const next = { ...prev };
			for (const credential of credentials) {
				next[credential.provider] = {
					isEnabled: credential.isEnabled,
					priority: credential.priority,
				};
			}
			return next;
		});
	}, [credentials]);

	const handleSave = async (provider: string) => {
		const apiKey = apiKeys[provider];
		const status = getCredentialStatus(provider);
		if (!apiKey && !status?.configured) return;

		setSavingProvider(provider);
		try {
			const currentOptions =
				credentialOptions[provider] ?? ({ isEnabled: true, priority: 100 } as const);
			await onSaveCredential(provider, apiKey ?? "", {
				isEnabled: currentOptions.isEnabled,
				priority: currentOptions.priority,
			});
			setValidationResults((prev) => ({ ...prev, [provider]: null }));
			// Clear the input after successful save
			setApiKeys((prev) => {
				const next = { ...prev };
				delete next[provider];
				return next;
			});
		} catch (_err) {
			// Error is handled by the parent via errorMessage prop
		} finally {
			setSavingProvider(null);
		}
	};

	const handleValidate = async (provider: string) => {
		const apiKey = apiKeys[provider];
		if (!apiKey) return;

		setValidatingProvider(provider);
		try {
			const isValid = await onValidateCredential(provider, apiKey);
			setValidationResults((prev) => ({ ...prev, [provider]: isValid }));
		} finally {
			setValidatingProvider(null);
		}
	};

	const handleDelete = async (provider: string) => {
		await onDeleteCredential(provider);
		setApiKeys((prev) => {
			const next = { ...prev };
			delete next[provider];
			return next;
		});
		setDeleteConfirm(null);
	};

	const getCredentialStatus = (providerId: string) => {
		return credentials.find((c) => c.provider === providerId);
	};

	return (
		<div className="space-y-6">
			{showHeader && (
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Market Data Settings</h1>
						<p className="text-muted-foreground">
							Configure API keys and routing preferences for market data providers
						</p>
					</div>
				</div>
			)}

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="credentials">
						<Key className="mr-2 h-4 w-4" />
						API Keys
					</TabsTrigger>
					<TabsTrigger value="routing">
						<Globe className="mr-2 h-4 w-4" />
						Routing
					</TabsTrigger>
					<TabsTrigger value="health">
						<Activity className="mr-2 h-4 w-4" />
						Status
					</TabsTrigger>
				</TabsList>

				<TabsContent value="credentials" className="space-y-4">
					{/* Global feedback alerts */}
					{saveMessage && (
						<Alert className="border-green-500 bg-green-50">
							<CheckCircle className="h-4 w-4 text-green-600" />
							<AlertTitle className="text-green-800">Success</AlertTitle>
							<AlertDescription className="text-green-700">{saveMessage}</AlertDescription>
						</Alert>
					)}
					{errorMessage && (
						<Alert variant="destructive">
							<XCircle className="h-4 w-4" />
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					)}

					{supportedProviders
						.filter((p) => p.requiresKey)
						.map((provider, index) => {
							const status = getCredentialStatus(provider.id);
							const isConfigured = status?.configured;
							const result = validationResults[provider.id];
							const currentOptions =
								credentialOptions[provider.id] ??
								({ isEnabled: true, priority: index + 1 } as const);

							return (
								<Card key={provider.id}>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div>
												<CardTitle>{provider.name}</CardTitle>
												<CardDescription>
													{provider.rateLimit.requestsPerMinute} req/min
													{" | "}
													{provider.rateLimit.requestsPerDay} req/day
												</CardDescription>
											</div>
											{isConfigured ? (
												<Badge variant="default" className="bg-green-500">
													<CheckCircle className="mr-1 h-3 w-3" />
													Configured
												</Badge>
											) : (
												<Badge variant="secondary">
													<XCircle className="mr-1 h-3 w-3" />
													Not Set
												</Badge>
											)}
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex gap-2">
											<div className="flex-1">
												<Label htmlFor={`api-key-${provider.id}`}>API Key</Label>
												<Input
													id={`api-key-${provider.id}`}
													type="password"
													placeholder={
														isConfigured
															? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
															: "Enter API key"
													}
													value={apiKeys[provider.id] || ""}
													onChange={(e) =>
														setApiKeys((prev) => ({
															...prev,
															[provider.id]: e.target.value,
														}))
													}
												/>
											</div>
											<div className="w-28">
												<Label htmlFor={`priority-${provider.id}`}>Priority</Label>
												<Input
													id={`priority-${provider.id}`}
													type="number"
													min={1}
													value={currentOptions.priority}
													onChange={(e) => {
														const nextPriority = Number.parseInt(e.target.value, 10);
														setCredentialOptions((prev) => ({
															...prev,
															[provider.id]: {
																isEnabled: currentOptions.isEnabled,
																priority: Number.isNaN(nextPriority)
																	? 1
																	: Math.max(1, nextPriority),
															},
														}));
													}}
												/>
											</div>
											<div className="flex items-end pb-2">
												<Switch
													checked={currentOptions.isEnabled}
													onCheckedChange={(checked) =>
														setCredentialOptions((prev) => ({
															...prev,
															[provider.id]: {
																isEnabled: checked,
																priority: currentOptions.priority,
															},
														}))
													}
												/>
											</div>
										</div>

										{result !== undefined && (
											<Alert
												variant={result ? "default" : "destructive"}
												className={result ? "border-green-500 bg-green-50" : "border-red-50"}
											>
												<AlertDescription>
													{result ? "API key is valid" : "API key validation failed"}
												</AlertDescription>
											</Alert>
										)}

										<div className="flex gap-2">
											<Button
												onClick={() => handleSave(provider.id)}
												disabled={
													(!isConfigured && !apiKeys[provider.id]) ||
													savingProvider === provider.id ||
													savingProviderGlobal
												}
											>
												{savingProvider === provider.id || savingProviderGlobal
													? "Saving..."
													: "Save"}
											</Button>
											<Button
												variant="outline"
												onClick={() => handleValidate(provider.id)}
												disabled={!apiKeys[provider.id] || validatingProvider === provider.id}
											>
												{validatingProvider === provider.id ? "Validating..." : "Validate"}
											</Button>
											{isConfigured && (
												<Button
													variant="destructive"
													onClick={() =>
														deleteConfirm === provider.id
															? handleDelete(provider.id)
															: setDeleteConfirm(provider.id)
													}
												>
													{deleteConfirm === provider.id ? "Confirm Delete" : "Delete"}
												</Button>
											)}
										</div>
									</CardContent>
								</Card>
							);
						})}
				</TabsContent>

				<TabsContent value="routing" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Intelligent Routing</CardTitle>
							<CardDescription>
								Configure how market data requests are routed between providers
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<Label>Enable Intelligent Routing</Label>
									<p className="text-sm text-muted-foreground">
										Automatically select the best provider based on asset type
									</p>
								</div>
								<Switch
									checked={preferences.useIntelligentRouting}
									onCheckedChange={(checked) =>
										setPreferences((prev) => ({
											...prev,
											useIntelligentRouting: checked,
										}))
									}
								/>
							</div>

							<div className="flex items-center justify-between">
								<div>
									<Label>Enable Fallback</Label>
									<p className="text-sm text-muted-foreground">
										Automatically switch to backup provider on failure
									</p>
								</div>
								<Switch
									checked={preferences.enableFallback}
									onCheckedChange={(checked) =>
										setPreferences((prev) => ({
											...prev,
											enableFallback: checked,
										}))
									}
								/>
							</div>

							<div className="pt-4">
								<Label className="mb-4 block">Provider Priority</Label>
								<div className="space-y-2">
									{supportedProviders.map((provider, index) => (
										<div key={provider.id} className="flex items-center gap-4">
											<span className="w-8 text-muted-foreground">{index + 1}.</span>
											<span className="flex-1">{provider.name}</span>
											<Switch
												checked={
													preferences.preferredProviders.find((p) => p.provider === provider.id)
														?.enabled ?? false
												}
												onCheckedChange={(checked) =>
													setPreferences((prev) => ({
														...prev,
														preferredProviders: prev.preferredProviders.map((p) =>
															p.provider === provider.id ? { ...p, enabled: checked } : p,
														),
													}))
												}
											/>
										</div>
									))}
								</div>
							</div>

							<Button onClick={() => onUpdatePreferences(preferences)}>Save Preferences</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="health" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Provider Status</CardTitle>
							<CardDescription>Health and API key validation status per asset type</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{supportedProviders.map((provider) => {
									const status = getCredentialStatus(provider.id);
									// Collect all health entries for this provider (one per asset type)
									const healthEntries =
										providerHealth?.filter((h) => h.provider === provider.id) ?? [];

									return (
										<div key={provider.id} className="border-b pb-4 last:border-0">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<p className="font-medium">{provider.name}</p>
													{provider.requiresKey ? (
														status?.configured ? (
															<Badge variant="outline" className="text-xs">
																Key Saved
															</Badge>
														) : (
															<Badge variant="secondary" className="text-xs">
																No Key
															</Badge>
														)
													) : provider.id === "YFINANCE" ? (
														<Badge className="bg-blue-500 flex items-center gap-1 text-xs">
															<Plug className="h-3 w-3" />
															Sidecar
														</Badge>
													) : (
														<Badge className="bg-teal-600 text-xs">Free</Badge>
													)}
													{provider.supportsRealtime && (
														<Badge className="bg-amber-500 flex items-center gap-1 text-xs">
															<Zap className="h-3 w-3" />
															Real-time
														</Badge>
													)}
												</div>
												<p className="text-sm text-muted-foreground">{provider.id}</p>
											</div>
											{/* Per-asset-type health rows */}
											{healthEntries.length > 0 ? (
												<div className="mt-2 space-y-1.5">
													{healthEntries.map((entry) => {
														const apiKeyValid = entry.apiKeyValid;
														return (
															<div
																key={`${entry.provider}-${entry.assetType}`}
																className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5"
															>
																<span className="text-sm text-muted-foreground">
																	{entry.assetType}
																</span>
																<div className="flex items-center gap-1.5">
																	<Badge
																		variant={entry.healthy ? "default" : "secondary"}
																		className={entry.healthy ? "bg-green-500" : "bg-gray-400"}
																	>
																		{entry.healthy ? "Healthy" : "Unhealthy"}
																	</Badge>
																	{provider.requiresKey && apiKeyValid === true && (
																		<Badge className="bg-green-500 text-xs">Key Valid</Badge>
																	)}
																	{provider.requiresKey && apiKeyValid === false && (
																		<Badge variant="destructive" className="text-xs">
																			Key Invalid
																		</Badge>
																	)}
																</div>
															</div>
														);
													})}
												</div>
											) : (
												<div className="mt-2 flex items-center gap-2">
													<Badge variant="secondary" className="bg-gray-400">
														Unhealthy
													</Badge>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
