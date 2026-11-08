import { useMutation } from "@apollo/client";
import { createLazyFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	Coins,
	ExternalLink,
	Landmark,
	Loader2,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { COMPLETE_ENABLE_BANKING_AUTH } from "@/graphql/mutations/sync";

export const Route = createLazyFileRoute("/sync/callback")({
	component: SyncCallbackPage,
});

export const EB_PENDING_AUTH_STORAGE_KEY = "sigma_pending_enablebanking_auth";

interface PendingAuthInfo {
	portfolioId: string;
	state: string;
	aspspName?: string;
	aspspCountry?: string;
}

interface DiscoveredConnection {
	id: string;
	institutionName: string;
	syncStatus: string;
	externalAccountId: string;
	accountId?: string | null;
}

function SyncCallbackPage() {
	const navigate = useNavigate();
	const routeSearch = useSearch({ from: "/sync/callback" }) as {
		code?: string;
		state?: string;
		error?: string;
		error_description?: string;
	};
	const { currentPortfolio, portfolios } = usePortfolio();

	const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
	const [activeStep, setActiveStep] = useState<number>(1);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [institutionName, setInstitutionName] = useState<string>("Bank");
	const [discoveredConns, setDiscoveredConns] = useState<DiscoveredConnection[]>([]);
	const executedRef = useRef(false);

	const [completeAuth] = useMutation(COMPLETE_ENABLE_BANKING_AUTH, {
		refetchQueries: [
			"GetAccounts",
			"GetSyncConnections",
			"GetPortfoliosWithAnalytics",
			"GetDashboardCritical",
			"GetPortfolioCards",
		],
		awaitRefetchQueries: true,
	});

	useEffect(() => {
		if (executedRef.current) return;

		// Extract code, state, and error parameters from URL or route search
		const searchParams = new URLSearchParams(window.location.search);
		const errorParam = routeSearch?.error || searchParams.get("error");
		const errorDescParam = routeSearch?.error_description || searchParams.get("error_description");

		if (errorParam || errorDescParam) {
			setStatus("error");
			setErrorMessage(errorDescParam || `Bank connection cancelled or rejected (${errorParam})`);
			return;
		}

		const code = routeSearch?.code || searchParams.get("code");
		const state = routeSearch?.state || searchParams.get("state");

		if (!code || !state) {
			setStatus("error");
			setErrorMessage(
				"Missing authorization code or state in callback URL. Please try initiating connection again.",
			);
			return;
		}

		// Retrieve pending auth info from sessionStorage or localStorage
		let pendingInfo: PendingAuthInfo | null = null;
		try {
			const raw =
				sessionStorage.getItem(EB_PENDING_AUTH_STORAGE_KEY) ||
				localStorage.getItem(EB_PENDING_AUTH_STORAGE_KEY);
			if (raw) {
				pendingInfo = JSON.parse(raw);
				if (pendingInfo?.aspspName) {
					setInstitutionName(pendingInfo.aspspName);
				}
			}
		} catch {
			// Ignore parse error
		}

		// Resolve portfolio ID
		const currentPid =
			typeof currentPortfolio === "string"
				? currentPortfolio
				: (currentPortfolio as { id?: string })?.id;
		const targetPortfolioId = pendingInfo?.portfolioId || currentPid || portfolios?.[0]?.id;

		if (!targetPortfolioId) {
			// Wait for portfolio data to load
			return;
		}

		executedRef.current = true;
		setStatus("processing");
		setActiveStep(1);

		// Step 1: Initiating code exchange
		const timer1 = setTimeout(() => setActiveStep(2), 1200);
		const timer2 = setTimeout(() => setActiveStep(3), 2800);

		completeAuth({
			variables: {
				code,
				state,
				portfolioId: targetPortfolioId,
			},
		})
			.then((res) => {
				clearTimeout(timer1);
				clearTimeout(timer2);
				const conns = res.data?.completeEnableBankingAuth || [];
				setDiscoveredConns(conns);
				setStatus("success");

				// Clean up storage
				try {
					sessionStorage.removeItem(EB_PENDING_AUTH_STORAGE_KEY);
					localStorage.removeItem(EB_PENDING_AUTH_STORAGE_KEY);
				} catch {
					// Ignore
				}

				toast.success(
					`${institutionName} connected successfully! Synced ${conns.length || 1} bank account(s).`,
				);
			})
			.catch((err: unknown) => {
				clearTimeout(timer1);
				clearTimeout(timer2);
				setStatus("error");
				const msg = err instanceof Error ? err.message : "Failed to complete bank authorization";
				setErrorMessage(msg);
				toast.error(`Bank authorization failed: ${msg}`);
			});

		return () => {
			clearTimeout(timer1);
			clearTimeout(timer2);
		};
	}, [completeAuth, currentPortfolio, portfolios, routeSearch, institutionName]);

	const isWhitelistError =
		errorMessage?.toLowerCase().includes("whitelist") ||
		errorMessage?.toLowerCase().includes("returned no accounts") ||
		errorMessage?.toLowerCase().includes("restricted");

	return (
		<div className="flex min-h-[85vh] items-center justify-center p-4">
			<Card className="w-full max-w-lg shadow-xl border-border bg-card">
				<CardHeader className="text-center pb-4">
					<div
						className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
							status === "success"
								? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
								: status === "error"
									? "bg-destructive/15 text-destructive"
									: "bg-primary/10 text-primary"
						}`}
					>
						{status === "success" ? (
							<CheckCircle2 className="h-8 w-8 animate-in zoom-in-75 duration-300" />
						) : status === "error" ? (
							<AlertCircle className="h-8 w-8 animate-in zoom-in-75 duration-300" />
						) : (
							<Landmark className="h-8 w-8 animate-pulse" />
						)}
					</div>

					<CardTitle className="text-2xl font-bold tracking-tight">
						{status === "processing" && `Connecting to ${institutionName}`}
						{status === "success" && `${institutionName} Connected!`}
						{status === "error" && "Bank Connection Failed"}
					</CardTitle>

					<CardDescription className="text-sm">
						{status === "processing" &&
							"Exchanging Open Banking consent tokens and synchronizing account ledger..."}
						{status === "success" &&
							"Your bank accounts and booked transactions have been linked and synchronized."}
						{status === "error" && "Unable to finalize authorization with Enable Banking."}
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-5 pt-2">
					{/* Processing Flow */}
					{status === "processing" && (
						<div className="space-y-4 py-2">
							<div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-xs">
								<div className="flex items-center gap-3">
									{activeStep > 1 ? (
										<CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
									) : (
										<Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
									)}
									<span
										className={
											activeStep === 1 ? "font-semibold text-foreground" : "text-muted-foreground"
										}
									>
										1. Validating bank authorization code & session security
									</span>
								</div>

								<div className="flex items-center gap-3">
									{activeStep > 2 ? (
										<CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
									) : activeStep === 2 ? (
										<Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
									) : (
										<div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
									)}
									<span
										className={
											activeStep === 2 ? "font-semibold text-foreground" : "text-muted-foreground"
										}
									>
										2. Discovering IBAN cash accounts & latest balances
									</span>
								</div>

								<div className="flex items-center gap-3">
									{activeStep === 3 ? (
										<Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
									) : (
										<div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
									)}
									<span
										className={
											activeStep === 3 ? "font-semibold text-foreground" : "text-muted-foreground"
										}
									>
										3. Ingesting booked transactions and updating portfolio
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Success State */}
					{status === "success" && (
						<div className="space-y-4">
							<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
								<div className="flex items-center gap-2 font-semibold text-sm">
									<ShieldCheck className="h-4 w-4 shrink-0" />
									<span>PSD2 Read-Only Consent Active</span>
								</div>
								<p className="text-xs mt-1 text-emerald-600/90 dark:text-emerald-400/90">
									Consent valid for 90 days. Future transactions will synchronize automatically.
								</p>
							</div>

							{discoveredConns.length > 0 && (
								<div className="space-y-2">
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Linked Accounts ({discoveredConns.length})
									</p>
									<div className="divide-y divide-border rounded-lg border bg-muted/20">
										{discoveredConns.map((conn) => (
											<div key={conn.id} className="flex items-center justify-between p-3 text-xs">
												<div className="flex items-center gap-2.5">
													<div className="p-1.5 rounded-md bg-primary/10 text-primary">
														<Coins className="h-4 w-4" />
													</div>
													<div>
														<p className="font-medium text-foreground">
															{conn.institutionName || institutionName}
														</p>
														<p className="text-muted-foreground text-[11px] font-mono">
															{conn.externalAccountId.length > 16
																? `${conn.externalAccountId.substring(0, 8)}...${conn.externalAccountId.substring(conn.externalAccountId.length - 4)}`
																: conn.externalAccountId}
														</p>
													</div>
												</div>
												<Badge
													variant="outline"
													className="text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
												>
													{conn.syncStatus || "SYNCED"}
												</Badge>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Error State */}
					{status === "error" && (
						<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 space-y-3">
							<div className="flex items-start gap-2.5 text-destructive">
								<AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
								<div className="text-xs space-y-1">
									<p className="font-semibold text-sm">Authorization Encountered an Issue</p>
									<p className="text-muted-foreground font-mono">{errorMessage}</p>
								</div>
							</div>

							{isWhitelistError && (
								<div className="pt-3 border-t border-destructive/20 text-xs text-muted-foreground space-y-2">
									<p className="font-semibold text-foreground">
										Enable Banking Restricted Mode Whitelist Notice:
									</p>
									<p>
										In Enable Banking's free personal mode, your bank account must be linked once
										via the developer portal before third-party API sync is allowed:
									</p>
									<ol className="list-decimal pl-4 space-y-1 text-[11px]">
										<li>
											Open the{" "}
											<a
												href="https://enablebanking.com/cp/"
												target="_blank"
												rel="noreferrer"
												className="underline text-primary inline-flex items-center gap-0.5"
											>
												Enable Banking Control Panel <ExternalLink className="h-3 w-3 inline" />
											</a>
										</li>
										<li>
											Click <strong>"Activate by linking accounts"</strong> next to your application
										</li>
										<li>Authenticate with Revolut to whitelist your account</li>
										<li>Come back and retry connecting</li>
									</ol>
								</div>
							)}
						</div>
					)}
				</CardContent>

				<CardFooter className="flex flex-col sm:flex-row gap-2 pt-2">
					{status === "success" && (
						<>
							<Button
								onClick={() => navigate({ to: "/assets/accounts" })}
								className="w-full sm:w-1/2 gap-2"
							>
								View in Accounts
								<ArrowRight className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									navigate({
										to: "/dashboard",
										search: { portfolioId: undefined, view: undefined },
									})
								}
								className="w-full sm:w-1/2"
							>
								Dashboard
							</Button>
						</>
					)}

					{status === "error" && (
						<>
							<Button
								variant="default"
								onClick={() => navigate({ to: "/assets/accounts" })}
								className="w-full sm:w-1/2 gap-2"
							>
								<RefreshCw className="h-4 w-4" />
								Try Again
							</Button>
							<Button
								variant="outline"
								onClick={() => navigate({ to: "/settings/connections" })}
								className="w-full sm:w-1/2"
							>
								Connected Accounts
							</Button>
						</>
					)}
				</CardFooter>
			</Card>
		</div>
	);
}
