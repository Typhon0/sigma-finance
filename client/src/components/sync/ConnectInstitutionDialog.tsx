import {
	ApolloClient,
	ApolloLink,
	getApolloContext,
	InMemoryCache,
	useApolloClient,
	useMutation,
	useQuery,
} from "@apollo/client";
import {
	AlertCircle,
	ArrowRight,
	Building2,
	Check,
	CheckCircle2,
	ExternalLink,
	Eye,
	EyeOff,
	Key,
	Landmark,
	Loader2,
	Lock,
	Search,
	ShieldCheck,
	Smartphone,
	Wallet,
} from "lucide-react";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	type DiscoveredWoobConnection,
	WoobAccountSelector,
} from "./WoobAccountSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddWalletDialog } from "@/features/wallets";
import { CREATE_ACCOUNT } from "@/graphql/mutations/accounts";
import {
	COMPLETE_AGGREGATOR_AUTH,
	COMPLETE_ENABLE_BANKING_AUTH,
	GENERATE_AGGREGATOR_LINK,
	INITIATE_ENABLE_BANKING_AUTH,
	INITIATE_TRADE_REPUBLIC_AUTH,
	INITIATE_WOOB_AUTH,
	LINK_SYNC_ACCOUNT,
	POLL_TRADE_REPUBLIC_AUTH,
	POLL_WOOB_AUTH,
	REGISTER_SYNC_CREDENTIAL,
} from "@/graphql/mutations/sync";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { GET_ENABLE_BANKING_INSTITUTIONS, GET_SYNC_CONNECTIONS } from "@/graphql/queries/sync";
import { invalidateDashboardData, invalidatePortfolioQueries } from "@/hooks/use-asset-management";
import { cn } from "@/lib/utils";

export interface ConnectInstitutionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioId: string;
	onSuccess?: (connectionId?: string) => void;
}

export const TR_SESSION_STORAGE_KEY = "sigma_pending_traderepublic_auth";

export interface PendingTradeRepublicSession {
	authSessionId: string;
	countdownSeconds: number;
	expiresAt: number;
	startedAt: number;
	phoneNumber: string;
	portfolioId?: string;
}

interface AccountItem {
	id: string;
	name: string;
	type: string;
	institution?: string | null;
}

const WOOB_BANKS = [
	{ id: "boursobank", name: "BoursoBank", subtitle: "Courant, Livrets, PEA, CTO, Crédits, Assurance-Vie", popular: true },
	{ id: "fortuneo", name: "Fortuneo", subtitle: "PEA, CTO, Courant, Livrets, Assurance-Vie", popular: true },
	{ id: "bnp", name: "BNP Paribas", subtitle: "Courant, Livrets, Prêts, Titres", popular: true },
	{ id: "creditagricole", name: "Crédit Agricole", subtitle: "Comptes, Livrets, Prêts, PEA", hasRegion: true, popular: true },
	{ id: "caissedepargne", name: "Caisse d'Épargne", subtitle: "Comptes, Livrets, Crédit Immo", hasRegion: true, popular: true },
	{ id: "societegenerale", name: "Société Générale", subtitle: "Comptes, Livrets, Prêts, PEA", popular: true },
	{ id: "creditmutuel", name: "Crédit Mutuel", subtitle: "Comptes, Livrets, Prêts, Titres", popular: true },
	{ id: "cic", name: "CIC", subtitle: "Comptes, Livrets, Crédits, Bourse", popular: true },
	{ id: "labanquepostale", name: "La Banque Postale", subtitle: "CCP, Livrets, Prêts, Titres", popular: true },
	{ id: "lcl", name: "LCL", subtitle: "Comptes, Épargne, Prêts, Titres", popular: false },
	{ id: "banquepopulaire", name: "Banque Populaire", subtitle: "Comptes, Livrets, Prêts", hasRegion: true, popular: false },
	{ id: "hellobank", name: "Hello bank!", subtitle: "Courant, Livrets, Bourse", popular: false },
	{ id: "bforbank", name: "BforBank", subtitle: "Comptes, Livrets, Titres", popular: false },
	{ id: "boursedirect", name: "Bourse Direct", subtitle: "PEA, PEA-PME, CTO", popular: false },
	{ id: "amundi", name: "Amundi", subtitle: "Épargne Salariale, PEE, PERCO", popular: false },
	{ id: "linxea", name: "Linxea", subtitle: "Assurance-Vie, PER, SCPI", popular: false },
	{ id: "yomoni", name: "Yomoni", subtitle: "Assurance-Vie, PEA, PER", popular: false },
	{ id: "revolut", name: "Revolut", subtitle: "Comptes multi-devises, Épargne", popular: false },
	{ id: "n26", name: "N26", subtitle: "Comptes courants & Espaces", popular: false },
	{ id: "custom", name: "Autre établissement", subtitle: "Saisie manuelle d'un module Woob", popular: false },
];

export function ConnectInstitutionDialog({
	open,
	onOpenChange,
	portfolioId,
	onSuccess,
}: ConnectInstitutionDialogProps) {
	// Safe Apollo context handling when rendered in tests without ApolloProvider
	const apolloContext = useContext(getApolloContext());
	const fallbackClient = useMemo(() => {
		if (apolloContext?.client) return undefined;
		return new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
	}, [apolloContext?.client]);
	const apolloClient = apolloContext?.client || fallbackClient;

	const [activeProviderTab, setActiveProviderTab] = useState<
		"traderepublic" | "enablebanking" | "woob" | "snaptrade" | "kraken" | "gocardless" | "wallets"
	>("traderepublic");
	const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);

	// Woob (French Banks Direct Sync Engine) State
	const [woobInstitution, setWoobInstitution] = useState<string>("boursobank");
	const [woobCustomModule, setWoobCustomModule] = useState("");
	const [woobBankSearch, setWoobBankSearch] = useState("");
	const [woobLogin, setWoobLogin] = useState("");
	const [woobPassword, setWoobPassword] = useState("");
	const [woobRegion, setWoobRegion] = useState("grand_est");
	const [showWoobPassword, setShowWoobPassword] = useState(false);
	const [woobOtpCode, setWoobOtpCode] = useState("");
	const [woobAuthSession, setWoobAuthSession] = useState<{
		authSessionId: string;
		countdownSeconds: number;
		status: string;
		challengeMessage?: string | null;
	} | null>(null);
	const [woobCountdown, setWoobCountdown] = useState<number>(0);
	const [woobErrorMessage, setWoobErrorMessage] = useState<string | null>(null);
	const [discoveredWoobConnections, setDiscoveredWoobConnections] = useState<DiscoveredWoobConnection[] | null>(null);
	const [isImportingSelected, setIsImportingSelected] = useState(false);

	const filteredWoobBanks = useMemo(() => {
		if (!woobBankSearch.trim()) return WOOB_BANKS;
		const query = woobBankSearch.toLowerCase().trim();
		return WOOB_BANKS.filter(
			(b) =>
				b.name.toLowerCase().includes(query) ||
				b.id.toLowerCase().includes(query) ||
				b.subtitle.toLowerCase().includes(query),
		);
	}, [woobBankSearch]);

	// Enable Banking State
	const [ebCountry, setEbCountry] = useState("FR");
	const [ebSearch, setEbSearch] = useState("");
	const [selectedEbAspsp, setSelectedEbAspsp] = useState<{
		name: string;
		title: string;
		country: string;
		logo?: string | null;
	} | null>(null);

	const handleConnectionComplete = useCallback(
		async (connId?: string) => {
			if (apolloClient) {
				try {
					invalidatePortfolioQueries(apolloClient.cache);
					invalidateDashboardData(apolloClient.cache);
					await apolloClient.refetchQueries({
						include: [
							GET_ACCOUNTS,
							"GetAccounts",
							"GetPortfoliosWithAnalytics",
							"GetDashboardCritical",
						],
					});
				} catch (err) {
					console.error("[ConnectInstitutionDialog] Cache refetch error:", err);
				}
			}
			onSuccess?.(connId);
			onOpenChange(false);
		},
		[apolloClient, onSuccess, onOpenChange],
	);

	// Trade Republic Form & Polling State
	const [trPhoneNumber, setTrPhoneNumber] = useState("");
	const [trPin, setTrPin] = useState("");
	const [showTrPin, setShowTrPin] = useState(false);
	const [trAuthSession, setTrAuthSession] = useState<{
		authSessionId: string;
		countdownSeconds: number;
	} | null>(null);
	const [trCountdown, setTrCountdown] = useState<number>(0);
	const [trErrorMessage, setTrErrorMessage] = useState<string | null>(null);

	// Kraken Form State
	const [krakenApiKey, setKrakenApiKey] = useState("");
	const [krakenApiSecret, setKrakenApiSecret] = useState("");
	const [showSecret, setShowSecret] = useState(false);

	// Account Mapping State
	const [mappingMode, setMappingMode] = useState<"auto" | "existing">("auto");
	const [selectedAccountId, setSelectedAccountId] = useState<string>("");

	// Pending Aggregator Session State
	const [pendingSession, setPendingSession] = useState<{
		provider: string;
		sessionToken: string;
		link: string;
	} | null>(null);

	// Restore pending aggregator authorization state on mount/open
	useEffect(() => {
		try {
			const saved = sessionStorage.getItem("sigma_pending_aggregator_auth");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed.sessionToken && (!parsed.portfolioId || parsed.portfolioId === portfolioId)) {
					setPendingSession(parsed);
				}
			}
		} catch {
			// Ignore sessionStorage errors
		}
	}, [open, portfolioId]);

	// Restore pending Trade Republic authorization state on mount/open
	useEffect(() => {
		try {
			const saved = sessionStorage.getItem(TR_SESSION_STORAGE_KEY);
			if (saved) {
				const parsed: PendingTradeRepublicSession = JSON.parse(saved);
				const remaining = Math.max(0, Math.floor((parsed.expiresAt - Date.now()) / 1000));
				if (remaining > 0 && (!parsed.portfolioId || parsed.portfolioId === portfolioId)) {
					setTrAuthSession({
						authSessionId: parsed.authSessionId,
						countdownSeconds: remaining,
					});
					setTrCountdown(remaining);
					setTrPhoneNumber(parsed.phoneNumber || "");
					setActiveProviderTab("traderepublic");
				} else {
					sessionStorage.removeItem(TR_SESSION_STORAGE_KEY);
				}
			}
		} catch {
			// Ignore sessionStorage errors
		}
	}, [open, portfolioId]);

	// Queries & Mutations
	const { data: accountsData } = useQuery<{ accounts: AccountItem[] }>(GET_ACCOUNTS, {
		client: fallbackClient,
		variables: { portfolioId },
		skip: !open || !portfolioId || !apolloContext?.client,
	});

	const { data: syncConnsData } = useQuery<{
		syncConnections: Array<{ id: string; provider: string; accountId?: string | null }>;
	}>(GET_SYNC_CONNECTIONS, {
		client: fallbackClient,
		variables: { portfolioId },
		skip: !open || !portfolioId || !apolloContext?.client,
	});

	const [registerCredential, { loading: registeringKraken }] = useMutation(
		REGISTER_SYNC_CREDENTIAL,
		{
			client: fallbackClient,
		},
	);
	const [generateLink, { loading: generatingLink }] = useMutation(GENERATE_AGGREGATOR_LINK, {
		client: fallbackClient,
	});
	const [completeAggregatorAuth, { loading: completingAuth }] = useMutation(
		COMPLETE_AGGREGATOR_AUTH,
		{
			client: fallbackClient,
			refetchQueries: [
				{ query: GET_ACCOUNTS, variables: { portfolioId } },
				{ query: GET_SYNC_CONNECTIONS, variables: { portfolioId } },
			],
		},
	);
	const [linkAccount, { loading: linkingAccount }] = useMutation(LINK_SYNC_ACCOUNT, {
		client: fallbackClient,
		refetchQueries: [{ query: GET_ACCOUNTS, variables: { portfolioId } }],
	});
	const [createAccount, { loading: creatingAccount }] = useMutation(CREATE_ACCOUNT, {
		client: fallbackClient,
		refetchQueries: [{ query: GET_ACCOUNTS, variables: { portfolioId } }],
	});
	const [initiateTradeRepublicAuth, { loading: initiatingTr }] = useMutation(
		INITIATE_TRADE_REPUBLIC_AUTH,
		{ client: fallbackClient, errorPolicy: "all" },
	);
	const [pollTradeRepublicAuth] = useMutation(POLL_TRADE_REPUBLIC_AUTH, {
		client: fallbackClient,
		errorPolicy: "all",
	});
	const [initiateWoobAuth, { loading: initiatingWoob }] = useMutation(INITIATE_WOOB_AUTH, {
		client: fallbackClient,
		errorPolicy: "all",
	});
	const [pollWoobAuth] = useMutation(POLL_WOOB_AUTH, {
		client: fallbackClient,
		errorPolicy: "all",
	});

	const {
		data: ebData,
		loading: loadingEbAspsps,
		error: ebAspspsError,
		refetch: refetchEbAspsps,
	} = useQuery<{
		enableBankingInstitutions: Array<{
			name: string;
			title: string;
			country: string;
			logo?: string | null;
			psuTypes?: string[] | null;
		}>;
	}>(GET_ENABLE_BANKING_INSTITUTIONS, {
		client: fallbackClient,
		variables: { country: ebCountry },
		skip: !open || activeProviderTab !== "enablebanking",
		fetchPolicy: "network-only",
	});

	const [initiateEnableBankingAuth, { loading: initiatingEb }] = useMutation(
		INITIATE_ENABLE_BANKING_AUTH,
		{ client: fallbackClient },
	);

	const handleConnectEnableBanking = async () => {
		if (!selectedEbAspsp) {
			toast.error("Please select a bank to connect.");
			return;
		}
		try {
			const redirectUrl = `${window.location.origin}/sync/callback`;
			const res = await initiateEnableBankingAuth({
				variables: {
					aspspName: selectedEbAspsp.name,
					aspspCountry: selectedEbAspsp.country,
					redirectUrl,
					portfolioId,
				},
			});

			if (res.errors && res.errors.length > 0) {
				toast.error(res.errors[0].message);
				return;
			}

			const authSession = res.data?.initiateEnableBankingAuth;
			if (!authSession?.authUrl) {
				toast.error("Failed to generate bank authorization link.");
				return;
			}

			try {
				const pendingData = JSON.stringify({
					portfolioId,
					state: authSession.state,
					aspspName: selectedEbAspsp.title || selectedEbAspsp.name,
					aspspCountry: selectedEbAspsp.country,
					startedAt: Date.now(),
				});
				sessionStorage.setItem("sigma_pending_enablebanking_auth", pendingData);
				localStorage.setItem("sigma_pending_enablebanking_auth", pendingData);
			} catch {
				// Ignore
			}

			window.location.href = authSession.authUrl;
		} catch (err: unknown) {
			const apolloErr = err as {
				graphQLErrors?: Array<{ message: string }>;
				networkError?: { message: string };
				message?: string;
			};
			const msg =
				apolloErr?.graphQLErrors?.[0]?.message ||
				apolloErr?.networkError?.message ||
				(err instanceof Error ? err.message : "Failed to initiate bank authorization");
			toast.error(msg);
		}
	};

	// Trade Republic countdown timer
	useEffect(() => {
		if (!trAuthSession || trCountdown <= 0) return;
		const timer = setInterval(() => {
			setTrCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [trAuthSession, trCountdown]);

	// Trade Republic polling interval (every 2s while waiting)
	useEffect(() => {
		if (!trAuthSession) return;

		const pollInterval = setInterval(async () => {
			try {
				const res = await pollTradeRepublicAuth({
					variables: { authSessionId: trAuthSession.authSessionId },
				});
				const pollRes = res.data?.pollTradeRepublicAuth;
				if (!pollRes) return;

				if (pollRes.status === "COMPLETED") {
					clearInterval(pollInterval);
					setTrAuthSession(null);
					try {
						sessionStorage.removeItem(TR_SESSION_STORAGE_KEY);
					} catch {
						// Ignore
					}
					toast.dismiss("tr-pending-auth-banner");
					toast.success("Trade Republic account linked and synchronized successfully!");
					const conns = pollRes.connections;
					const connId = conns && conns.length > 0 ? conns[0].id : trAuthSession.authSessionId;
					handleConnectionComplete(connId);
				} else if (pollRes.status === "EXPIRED") {
					clearInterval(pollInterval);
					setTrAuthSession(null);
					try {
						sessionStorage.removeItem(TR_SESSION_STORAGE_KEY);
					} catch {
						// Ignore
					}
					toast.dismiss("tr-pending-auth-banner");
					toast.error(
						pollRes.errorMessage || "Trade Republic login confirmation expired. Please try again.",
					);
				} else if (pollRes.status === "REJECTED") {
					clearInterval(pollInterval);
					setTrAuthSession(null);
					try {
						sessionStorage.removeItem(TR_SESSION_STORAGE_KEY);
					} catch {
						// Ignore
					}
					toast.dismiss("tr-pending-auth-banner");
					toast.error(
						pollRes.errorMessage || "Login request was rejected in your Trade Republic mobile app.",
					);
				}
			} catch (err: unknown) {
				console.error("[TradeRepublic] Poll error:", err);
			}
		}, 2000);

		return () => clearInterval(pollInterval);
	}, [trAuthSession, pollTradeRepublicAuth, onSuccess, onOpenChange]);

	// Woob countdown timer
	useEffect(() => {
		if (!woobAuthSession || woobCountdown <= 0) return;
		const timer = setInterval(() => {
			setWoobCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
		}, 1000);
		return () => clearInterval(timer);
	}, [woobAuthSession, woobCountdown]);

	// Woob polling interval
	useEffect(() => {
		if (!woobAuthSession) return;
		if (woobAuthSession.status === "WAITING_FOR_CODE" && !woobOtpCode) return;

		const pollInterval = setInterval(async () => {
			try {
				const res = await pollWoobAuth({
					variables: {
						authSessionId: woobAuthSession.authSessionId,
						otpCode: woobOtpCode || undefined,
					},
				});
				const pollRes = res.data?.pollWoobAuth;
				if (!pollRes) return;

				if (pollRes.status === "COMPLETED") {
					clearInterval(pollInterval);
					setWoobAuthSession(null);
					const conns = pollRes.connections;
					if (conns && conns.length > 0) {
						const mapped: DiscoveredWoobConnection[] = conns.map((c) => ({
							id: c.id,
							externalAccountId: c.externalAccountId,
							institutionName: c.institutionName,
							accountName: c.account?.name || `${c.institutionName} (${c.externalAccountId})`,
							accountType: c.account?.type || "BANK",
							balance: c.account?.balance !== undefined ? Number(c.account.balance) / 100 : undefined,
							currency: c.account?.currency || "EUR",
							accountNumber: c.account?.accountNumber || c.externalAccountId,
						}));
						setDiscoveredWoobConnections(mapped);
						toast.success(`${mapped.length} produit(s) détecté(s) chez ${mapped[0].institutionName} !`);
					} else {
						toast.success("Banque synchronisée avec succès via Woob !");
						handleConnectionComplete(woobAuthSession.authSessionId);
					}
				} else if (pollRes.status === "EXPIRED") {
					clearInterval(pollInterval);
					setWoobAuthSession(null);
					toast.error("Délai d'authentification dépassé. Veuillez réessayer.");
				} else if (pollRes.status === "REJECTED") {
					clearInterval(pollInterval);
					setWoobAuthSession(null);
					toast.error(pollRes.errorMessage || "Authentification rejetée.");
				}
			} catch (err: unknown) {
				console.error("[Woob] Poll error:", err);
			}
		}, 2000);

		return () => clearInterval(pollInterval);
	}, [woobAuthSession, woobOtpCode, pollWoobAuth, handleConnectionComplete]);

	// Handle Woob Direct Connection
	const handleConnectWoob = async (e: React.FormEvent) => {
		e.preventDefault();
		const effectiveInstitution =
			woobInstitution === "custom" ? woobCustomModule.trim().toLowerCase() : woobInstitution;

		if (!effectiveInstitution) {
			toast.error("Veuillez renseigner le nom du module Woob");
			return;
		}

		if (!woobLogin.trim() || !woobPassword.trim()) {
			toast.error("Veuillez renseigner votre identifiant et mot de passe");
			return;
		}

		const toastId = toast.loading("Connexion bancaire via Woob en cours...");
		setWoobErrorMessage(null);
		try {
			const res = await initiateWoobAuth({
				variables: {
					institution: effectiveInstitution,
					login: woobLogin.trim(),
					password: woobPassword.trim(),
					region:
						woobInstitution === "caissedepargne" ||
						woobInstitution === "creditagricole" ||
						woobInstitution === "banquepopulaire"
							? woobRegion
							: undefined,
					portfolioId,
				},
			});
			if (res.errors && res.errors.length > 0) {
				const errMsg = res.errors.map((e) => e.message).join(", ");
				throw new Error(errMsg);
			}

			const session = res.data?.initiateWoobAuth;
			if (!session) {
				throw new Error("Aucune session d'authentification retournée par le serveur.");
			}

			if (session.status === "COMPLETED") {
				try {
					const pollRes = await pollWoobAuth({
						variables: { authSessionId: session.authSessionId },
					});
					const conns = pollRes.data?.pollWoobAuth?.connections;
					if (conns && conns.length > 0) {
						const mapped: DiscoveredWoobConnection[] = conns.map((c) => ({
							id: c.id,
							externalAccountId: c.externalAccountId,
							institutionName: c.institutionName,
							accountName: c.account?.name || `${c.institutionName} (${c.externalAccountId})`,
							accountType: c.account?.type || "BANK",
							balance: c.account?.balance !== undefined ? Number(c.account.balance) / 100 : undefined,
							currency: c.account?.currency || "EUR",
							accountNumber: c.account?.accountNumber || c.externalAccountId,
						}));
						setDiscoveredWoobConnections(mapped);
						toast.success(`${mapped.length} produit(s) détecté(s) chez ${mapped[0].institutionName} !`, {
							id: toastId,
						});
						return;
					}
				} catch (pollErr) {
					console.warn("[Woob] Immediate poll error:", pollErr);
				}

				toast.success("Connexion réussie !", { id: toastId });
				handleConnectionComplete(session.authSessionId);
				return;
			}

			setWoobAuthSession(session);
			setWoobCountdown(session.countdownSeconds || 120);
			toast.info(
				session.challengeMessage || "Veuillez valider la notification sur votre application mobile",
				{ id: toastId },
			);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Erreur lors de l'authentification Woob";
			setWoobErrorMessage(msg);
			toast.error(msg, { id: toastId });
		}
	};

	const handleConfirmWoobAccounts = async (selectedIds: string[]) => {
		setIsImportingSelected(true);
		try {
			for (const id of selectedIds) {
				try {
					await linkAccount({
						variables: {
							connectionId: id,
							autoCreate: true,
						},
					});
				} catch (err) {
					console.warn("[Woob] Link account error for", id, err);
				}
			}
			toast.success(`${selectedIds.length} compte(s) synchronisé(s) dans votre portefeuille !`);
			await handleConnectionComplete(selectedIds[0]);
		} finally {
			setIsImportingSelected(false);
			setDiscoveredWoobConnections(null);
		}
	};

	const accounts = accountsData?.accounts ?? [];
	const aspsps = ebData?.enableBankingInstitutions ?? [];
	const filteredAspsps = useMemo(() => {
		if (!ebSearch.trim()) return aspsps;
		const q = ebSearch.toLowerCase();
		return aspsps.filter(
			(a) => a.title.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
		);
	}, [aspsps, ebSearch]);
	const isBusy =
		registeringKraken ||
		generatingLink ||
		linkingAccount ||
		creatingAccount ||
		completingAuth ||
		initiatingTr ||
		initiatingEb;

	const resetForm = () => {
		setTrPhoneNumber("");
		setTrPin("");
		setShowTrPin(false);
		if (!trAuthSession) {
			setTrCountdown(0);
		}
		setKrakenApiKey("");
		setKrakenApiSecret("");
		setShowSecret(false);
		setMappingMode("auto");
		setSelectedAccountId("");
		setSelectedEbAspsp(null);
		setEbSearch("");
		setPendingSession(null);
	};

	const handleCancelTradeRepublic = () => {
		setTrAuthSession(null);
		setTrCountdown(0);
		try {
			sessionStorage.removeItem(TR_SESSION_STORAGE_KEY);
		} catch {
			// Ignore
		}
		toast.dismiss("tr-pending-auth-banner");
	};

	const handleCompleteAuth = async (tokenOverride?: string) => {
		const token = tokenOverride || pendingSession?.sessionToken;
		if (!token) return;

		const toastId = toast.loading("Finalizing account discovery and synchronization...");
		try {
			const res = await completeAggregatorAuth({
				variables: {
					connectionId: portfolioId,
					sessionToken: token,
				},
			});

			try {
				sessionStorage.removeItem("sigma_pending_aggregator_auth");
			} catch {
				// Ignore
			}

			setPendingSession(null);
			toast.success("Account connected and synchronized successfully!", { id: toastId });
			const conns = res.data?.completeAggregatorAuth;
			const connId = conns && conns.length > 0 ? conns[0].id : token;
			handleConnectionComplete(connId);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to complete aggregator connection";
			toast.error(msg, { id: toastId });
		}
	};

	// 0. Handle Trade Republic Direct Connection
	const handleConnectTradeRepublic = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedPhone = trPhoneNumber.trim();
		const trimmedPin = trPin.trim();

		if (!trimmedPhone || !trimmedPin) {
			toast.error("Please enter both your phone number and PIN");
			return;
		}

		const toastId = toast.loading("Initiating Trade Republic login...");
		setTrErrorMessage(null);
		try {
			const res = await initiateTradeRepublicAuth({
				variables: {
					phoneNumber: trimmedPhone,
					pin: trimmedPin,
					portfolioId,
				},
			});

			// Discard PIN immediately from memory
			setTrPin("");

			if (res.errors && res.errors.length > 0) {
				throw new Error(res.errors[0].message);
			}

			const session = res.data?.initiateTradeRepublicAuth;
			if (!session?.authSessionId) {
				throw new Error("Failed to initialize authentication session");
			}

			const countdown = session.countdownSeconds || 90;
			setTrAuthSession({
				authSessionId: session.authSessionId,
				countdownSeconds: countdown,
			});
			setTrCountdown(countdown);
			setTrErrorMessage(null);
			try {
				sessionStorage.setItem(
					TR_SESSION_STORAGE_KEY,
					JSON.stringify({
						authSessionId: session.authSessionId,
						countdownSeconds: countdown,
						phoneNumber: trimmedPhone,
						portfolioId,
						startedAt: Date.now(),
						expiresAt: Date.now() + countdown * 1000,
					}),
				);
			} catch {
				// Ignore
			}
			toast.success("Login request sent! Please approve in your Trade Republic mobile app.", {
				id: toastId,
			});
		} catch (err: unknown) {
			setTrPin("");
			const apolloErr = err as {
				graphQLErrors?: Array<{ message: string }>;
				networkError?: { message: string };
				message?: string;
			};
			const msg =
				apolloErr?.graphQLErrors?.[0]?.message ||
				apolloErr?.networkError?.message ||
				(err instanceof Error ? err.message : "Failed to initiate Trade Republic login");
			setTrErrorMessage(msg);
			toast.error(msg, { id: toastId });
		}
	};

	// 1. Handle Kraken Direct Connection
	const handleConnectKraken = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!krakenApiKey.trim() || !krakenApiSecret.trim()) {
			toast.error("Please enter both Kraken API Key and API Secret");
			return;
		}

		if (mappingMode === "existing" && accounts.length > 0 && !selectedAccountId) {
			toast.error("Please select an existing account to link");
			return;
		}

		const toastId = toast.loading("Registering Kraken credentials...");

		try {
			// Register credential in backend
			const credRes = await registerCredential({
				variables: {
					provider: "KRAKEN",
					credentials: {
						apiKey: krakenApiKey.trim(),
						apiSecret: krakenApiSecret.trim(),
					},
					portfolioId,
				},
			});

			if (!credRes.data?.registerSyncCredential?.id) {
				throw new Error("Failed to register Kraken credentials");
			}

			// When mappingMode is existing, link the discovered connection to the selected account
			if (mappingMode === "existing" && selectedAccountId) {
				const krakenConn = syncConnsData?.syncConnections.find(
					(c) => c.provider === "KRAKEN" && (!c.accountId || c.accountId === selectedAccountId),
				);
				if (krakenConn) {
					await linkAccount({
						variables: {
							connectionId: krakenConn.id,
							accountId: selectedAccountId,
							autoCreate: false,
						},
					});
				}
			}

			toast.success("Kraken connected successfully!", { id: toastId });
			resetForm();
			handleConnectionComplete(credRes.data.registerSyncCredential.id);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to connect Kraken";
			toast.error(msg, { id: toastId });
		}
	};

	// 2. Handle SnapTrade (Trade Republic, IBKR, etc.)
	const handleConnectSnapTrade = async () => {
		if (mappingMode === "existing" && accounts.length > 0 && !selectedAccountId) {
			toast.error("Please select an existing account to link");
			return;
		}

		const redirectUrl = `${window.location.origin}/dashboard`;
		const toastId = toast.loading("Initializing Trade Republic & Brokerage connection...");

		try {
			const res = await generateLink({
				variables: {
					provider: "SNAPTRADE",
					redirectUrl,
				},
			});

			const authSession = res.data?.generateAggregatorLink;
			if (!authSession?.link) {
				throw new Error("No authorization link received from broker aggregator");
			}

			// If linking to existing account, link any matching connection if available
			if (mappingMode === "existing" && selectedAccountId) {
				const snapConn = syncConnsData?.syncConnections.find(
					(c) => c.provider === "SNAPTRADE" && !c.accountId,
				);
				if (snapConn) {
					await linkAccount({
						variables: {
							connectionId: snapConn.id,
							accountId: selectedAccountId,
							autoCreate: false,
						},
					});
				}
			}

			toast.success("Redirecting to institution authentication portal...", { id: toastId });

			const sessionData = {
				provider: "SNAPTRADE",
				sessionToken: authSession.sessionToken,
				link: authSession.link,
				portfolioId,
			};
			setPendingSession(sessionData);
			try {
				sessionStorage.setItem("sigma_pending_aggregator_auth", JSON.stringify(sessionData));
			} catch {
				// Ignore
			}

			// Open portal in new window or redirect
			const popup = window.open(
				authSession.link,
				"snaptrade_auth",
				"width=720,height=800,scrollbars=yes,resizable=yes",
			);
			if (popup) {
				const checkPopup = setInterval(() => {
					if (popup.closed) {
						clearInterval(checkPopup);
						handleCompleteAuth(authSession.sessionToken);
					}
				}, 1000);
			} else {
				// Popup blocked, open in same tab
				window.location.href = authSession.link;
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to generate connection link";
			toast.error(msg, { id: toastId });
		}
	};

	// 3. Handle GoCardless (European Banks Open Banking)
	const handleConnectGoCardless = async () => {
		if (mappingMode === "existing" && accounts.length > 0 && !selectedAccountId) {
			toast.error("Please select an existing account to link");
			return;
		}

		const redirectUrl = `${window.location.origin}/dashboard`;
		const toastId = toast.loading("Initializing European Open Banking session...");

		try {
			const res = await generateLink({
				variables: {
					provider: "GOCARDLESS",
					redirectUrl,
				},
			});

			const authSession = res.data?.generateAggregatorLink;
			if (!authSession?.link) {
				throw new Error("No authorization link received from Open Banking provider");
			}

			// If linking to existing account, link any matching connection if available
			if (mappingMode === "existing" && selectedAccountId) {
				const gcConn = syncConnsData?.syncConnections.find(
					(c) => c.provider === "GOCARDLESS" && !c.accountId,
				);
				if (gcConn) {
					await linkAccount({
						variables: {
							connectionId: gcConn.id,
							accountId: selectedAccountId,
							autoCreate: false,
						},
					});
				}
			}

			toast.success("Redirecting to Bank authorization gateway...", { id: toastId });

			const sessionData = {
				provider: "GOCARDLESS",
				sessionToken: authSession.sessionToken,
				link: authSession.link,
				portfolioId,
			};
			setPendingSession(sessionData);
			try {
				sessionStorage.setItem("sigma_pending_aggregator_auth", JSON.stringify(sessionData));
			} catch {
				// Ignore
			}

			const popup = window.open(
				authSession.link,
				"gocardless_auth",
				"width=720,height=800,scrollbars=yes,resizable=yes",
			);
			if (popup) {
				const checkPopup = setInterval(() => {
					if (popup.closed) {
						clearInterval(checkPopup);
						handleCompleteAuth(authSession.sessionToken);
					}
				}, 1000);
			} else {
				window.location.href = authSession.link;
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to generate bank connection link";
			toast.error(msg, { id: toastId });
		}
	};

	const isWaitingForAuth = Boolean(trAuthSession || pendingSession || isBusy);

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(val) => {
					if (!val) {
						if (!trAuthSession) resetForm();
						else {
							toast.info("Trade Republic approval pending in mobile app", {
								id: "tr-pending-auth-banner",
								duration: (trCountdown || 90) * 1000,
								action: {
									label: "Resume",
									onClick: () => onOpenChange(true),
								},
							});
						}
					}
					onOpenChange(val);
				}}
			>
				<DialogContent
					className="max-w-xl sm:!max-w-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-6"
					style={{ maxWidth: "42rem", width: "100%" }}
					onPointerDownOutside={(e) => {
						if (isWaitingForAuth) {
							e.preventDefault();
						}
					}}
					onInteractOutside={(e) => {
						if (isWaitingForAuth) {
							e.preventDefault();
						}
					}}
					onEscapeKeyDown={(e) => {
						if (isWaitingForAuth) {
							e.preventDefault();
						}
					}}
				>
					<DialogHeader>
						<div className="flex items-center gap-2">
							<Building2 className="h-5 w-5 text-primary" />
							<DialogTitle>Connect External Institution</DialogTitle>
						</div>
						<DialogDescription>
							Link your financial institution to automatically synchronize balances, positions, and
							trades into this portfolio.
						</DialogDescription>
					</DialogHeader>

					{pendingSession ? (
						<div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
							<div className="rounded-full bg-primary/10 p-4">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
							</div>
							<div className="space-y-1">
								<h3 className="font-semibold text-lg">Waiting for authorization...</h3>
								<p className="text-sm text-muted-foreground max-w-sm">
									Please complete the authentication process in the institution's portal. Once
									approved, click below to discover accounts and initiate synchronization.
								</p>
							</div>
							<div className="flex flex-col gap-2 w-full max-w-xs pt-2">
								<Button
									type="button"
									onClick={() => handleCompleteAuth()}
									disabled={completingAuth}
									className="w-full gap-2"
								>
									{completingAuth ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Connecting Accounts...
										</>
									) : (
										<>
											<CheckCircle2 className="h-4 w-4" />
											Complete Connection
										</>
									)}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setPendingSession(null);
										try {
											sessionStorage.removeItem("sigma_pending_aggregator_auth");
										} catch {
											// Ignore
										}
									}}
									disabled={completingAuth}
									className="w-full"
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<Tabs
							value={activeProviderTab}
							onValueChange={(val) => setActiveProviderTab(val as typeof activeProviderTab)}
							className="mt-3 space-y-4"
						>
							<div className="space-y-1.5">
								<Label className="text-xs font-medium text-muted-foreground">
									Select Institution
								</Label>
								<TabsList
									className="!grid !w-full grid-cols-2 sm:grid-cols-3 gap-2 !h-auto !bg-transparent !p-0"
									style={{
										display: "grid",
										width: "100%",
										height: "auto",
										background: "transparent",
									}}
								>
									{/* Provider 1: Trade Republic */}
									<TabsTrigger
										value="traderepublic"
										onClick={() => setActiveProviderTab("traderepublic")}
										className={cn(
											"group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer h-auto",
											"border-border/70 bg-card/60 hover:bg-muted/50 hover:border-border",
											"data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:ring-1 data-[state=active]:ring-primary/40",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 w-full",
										)}
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0 transition-colors group-hover:bg-primary/15">
											<Smartphone className="h-4.5 w-4.5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span className="font-semibold text-xs text-foreground truncate">
													Trade Republic
												</span>
												<span className="text-[10px] font-medium text-primary/80 shrink-0">
													Direct
												</span>
											</div>
											<p className="text-[10.5px] text-muted-foreground truncate">
												Neobroker · PEA, CTO, Cash
											</p>
										</div>
									</TabsTrigger>

									{/* Provider 2: Enable Banking */}
									<TabsTrigger
										value="enablebanking"
										onClick={() => setActiveProviderTab("enablebanking")}
										className={cn(
											"group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer h-auto",
											"border-border/70 bg-card/60 hover:bg-muted/50 hover:border-border",
											"data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-500/5 data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/40",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 w-full",
										)}
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500 shrink-0 transition-colors group-hover:bg-emerald-500/15">
											<Landmark className="h-4.5 w-4.5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span className="font-semibold text-xs text-foreground truncate">
													Enable Banking
												</span>
												<span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
													PSD2
												</span>
											</div>
											<p className="text-[10.5px] text-muted-foreground truncate">
												2,700+ Integrated Institutions
											</p>
										</div>
									</TabsTrigger>

									{/* Provider: Woob Direct French Banking */}
									<TabsTrigger
										value="woob"
										onClick={() => setActiveProviderTab("woob")}
										className={cn(
											"group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer h-auto",
											"border-border/70 bg-card/60 hover:bg-muted/50 hover:border-border",
											"data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/5 data-[state=active]:ring-1 data-[state=active]:ring-blue-500/40",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 w-full",
										)}
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-500 shrink-0 transition-colors group-hover:bg-blue-500/15">
											<Building2 className="h-4.5 w-4.5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span className="font-semibold text-xs text-foreground truncate">
													Banques FR (Woob)
												</span>
												<span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
													Direct
												</span>
											</div>
											<p className="text-[10.5px] text-muted-foreground truncate">
												BoursoBank, Fortuneo, CA, BNP...
											</p>
										</div>
									</TabsTrigger>

									{/* Provider 3: SnapTrade */}
									<TabsTrigger
										value="snaptrade"
										onClick={() => setActiveProviderTab("snaptrade")}
										className={cn(
											"group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer h-auto",
											"border-border/70 bg-card/60 hover:bg-muted/50 hover:border-border",
											"data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:ring-1 data-[state=active]:ring-primary/40",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 w-full",
										)}
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground shrink-0 transition-colors group-hover:bg-muted/80">
											<Building2 className="h-4.5 w-4.5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span className="font-semibold text-xs text-foreground truncate">
													SnapTrade (IBKR, etc.)
												</span>
												<span className="text-[10px] font-medium text-muted-foreground shrink-0">
													Brokers
												</span>
											</div>
											<p className="text-[10.5px] text-muted-foreground truncate">
												IBKR, Degiro, Robinhood
											</p>
										</div>
									</TabsTrigger>

									{/* Provider 4: Kraken */}
									<TabsTrigger
										value="kraken"
										onClick={() => setActiveProviderTab("kraken")}
										className={cn(
											"group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer h-auto",
											"border-border/70 bg-card/60 hover:bg-muted/50 hover:border-border",
											"data-[state=active]:border-amber-500 data-[state=active]:bg-amber-500/5 data-[state=active]:ring-1 data-[state=active]:ring-amber-500/40",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 w-full",
										)}
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 shrink-0 transition-colors group-hover:bg-amber-500/15">
											<Wallet className="h-4.5 w-4.5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span className="font-semibold text-xs text-foreground truncate">
													Kraken
												</span>
												<span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
													Crypto
												</span>
											</div>
											<p className="text-[10.5px] text-muted-foreground truncate">
												Spot Balances & Trades
											</p>
										</div>
									</TabsTrigger>

									{/* Provider 5: European Banks (GoCardless) */}
									<TabsTrigger
										value="gocardless"
										onClick={() => setActiveProviderTab("gocardless")}
										className={cn(
											"group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer h-auto",
											"border-border/70 bg-card/60 hover:bg-muted/50 hover:border-border",
											"data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:ring-1 data-[state=active]:ring-primary/40",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 w-full",
										)}
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0 transition-colors group-hover:bg-muted/80">
											<Landmark className="h-4.5 w-4.5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span className="font-semibold text-xs text-foreground truncate">
													European Banks
												</span>
												<span className="text-[10px] font-medium text-muted-foreground shrink-0">
													Gateway
												</span>
											</div>
											<p className="text-[10.5px] text-muted-foreground truncate">
												GoCardless Open Banking
											</p>
										</div>
									</TabsTrigger>

									{/* Provider 6: Crypto Wallets */}
									<TabsTrigger
										value="wallets"
										onClick={() => setActiveProviderTab("wallets")}
										className={cn(
											"group relative flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer h-auto",
											"border-border/70 bg-card/60 hover:bg-muted/50 hover:border-border",
											"data-[state=active]:border-violet-500 data-[state=active]:bg-violet-500/5 data-[state=active]:ring-1 data-[state=active]:ring-violet-500/40",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 w-full",
										)}
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-md bg-violet-500/10 text-violet-500 shrink-0 transition-colors group-hover:bg-violet-500/15">
											<Wallet className="h-4.5 w-4.5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span className="font-semibold text-xs text-foreground truncate">
													Crypto Wallets
												</span>
												<span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 shrink-0">
													On-Chain
												</span>
											</div>
											<p className="text-[10.5px] text-muted-foreground truncate">
												EVM, Solana, Bitcoin
											</p>
										</div>
									</TabsTrigger>
								</TabsList>
							</div>

							{/* ENABLE BANKING (European Banks) TAB */}
							<TabsContent
								value="enablebanking"
								className="space-y-4 pt-3 border-t border-border/40 mt-3"
							>
								<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs sm:text-sm space-y-2">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 font-medium text-foreground">
											<Landmark className="h-4 w-4 text-emerald-500" />
											<span>European Bank Aggregation (Enable Banking)</span>
										</div>
										<Badge
											variant="outline"
											className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
										>
											PSD2 Open Banking · €0/mo Personal
										</Badge>
									</div>
									<p className="text-muted-foreground leading-relaxed text-xs">
										Connect accounts from 2,700+ European financial institutions with read-only PSD2
										consent. Free for personal self-hosted use via Enable Banking Restricted
										Production.
									</p>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
									<div className="space-y-1 sm:col-span-1">
										<Label className="text-xs font-medium">Country</Label>
										<Select
											value={ebCountry}
											onValueChange={(val) => {
												setEbCountry(val);
												setSelectedEbAspsp(null);
											}}
										>
											<SelectTrigger className="h-9 text-xs">
												<SelectValue placeholder="Select Country" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="FR">France (FR)</SelectItem>
												<SelectItem value="LU">Luxembourg (LU)</SelectItem>
												<SelectItem value="DE">Germany (DE)</SelectItem>
												<SelectItem value="BE">Belgium (BE)</SelectItem>
												<SelectItem value="NL">Netherlands (NL)</SelectItem>
												<SelectItem value="ES">Spain (ES)</SelectItem>
												<SelectItem value="IT">Italy (IT)</SelectItem>
												<SelectItem value="PT">Portugal (PT)</SelectItem>
												<SelectItem value="AT">Austria (AT)</SelectItem>
												<SelectItem value="IE">Ireland (IE)</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-1 sm:col-span-2">
										<Label className="text-xs font-medium">Search Bank</Label>
										<Input
											placeholder="e.g. BNP Paribas, Spuerkeess, Crédit Agricole..."
											value={ebSearch}
											onChange={(e) => setEbSearch(e.target.value)}
											className="h-9 text-xs"
										/>
									</div>
								</div>

								{/* ASPSP List */}
								<div className="space-y-1.5">
									<Label className="text-xs font-medium flex items-center justify-between">
										<span>Select Institution</span>
										<span className="text-[11px] text-muted-foreground">
											{loadingEbAspsps
												? "Loading banks..."
												: `${filteredAspsps.length} bank(s) found`}
										</span>
									</Label>

									<div className="rounded-md border max-h-52 overflow-y-auto divide-y bg-background text-xs">
										{loadingEbAspsps ? (
											<div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
												<Loader2 className="h-5 w-5 animate-spin text-primary" />
												<span>Loading available banks...</span>
											</div>
										) : ebAspspsError ? (
											<div className="py-6 text-center px-4 space-y-2">
												<div className="flex items-center justify-center gap-1.5 text-amber-500 font-medium">
													<AlertCircle className="h-4 w-4 shrink-0" />
													<span>Identifiants non configurés ou indisponibles</span>
												</div>
												<p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
													{ebAspspsError.message.includes("not configured")
														? "Vos identifiants Enable Banking ne sont pas encore configurés ou la session a expiré."
														: ebAspspsError.message}
												</p>
												<div className="flex items-center justify-center gap-2 pt-1">
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-7 text-xs"
														onClick={() => {
															onOpenChange(false);
															window.location.href = "/settings/api-keys";
														}}
													>
														Configurer dans Paramètres
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-7 text-xs"
														onClick={() => void refetchEbAspsps()}
													>
														Réessayer
													</Button>
												</div>
											</div>
										) : filteredAspsps.length === 0 ? (
											<div className="py-6 text-center text-muted-foreground px-4">
												No banks found matching your search.
											</div>
										) : (
											filteredAspsps.map((aspsp) => {
												const isSelected = selectedEbAspsp?.name === aspsp.name;
												return (
													<button
														key={aspsp.name}
														type="button"
														onClick={() => setSelectedEbAspsp(aspsp)}
														className={cn(
															"w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50",
															isSelected && "bg-primary/10 border-l-2 border-primary",
														)}
													>
														<div className="flex items-center gap-2.5 truncate">
															{aspsp.logo ? (
																<img
																	src={aspsp.logo}
																	alt={aspsp.title}
																	className="h-5 w-5 rounded object-contain shrink-0 bg-white p-0.5"
																	onError={(e) => {
																		(e.target as HTMLElement).style.display = "none";
																	}}
																/>
															) : (
																<Landmark className="h-4 w-4 text-muted-foreground shrink-0" />
															)}
															<span className="font-medium truncate">
																{aspsp.title || aspsp.name}
															</span>
														</div>
														{isSelected && (
															<CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
														)}
													</button>
												);
											})
										)}
									</div>
								</div>

								{selectedEbAspsp && (
									<div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between text-xs">
										<div className="flex items-center gap-2 truncate">
											<Landmark className="h-4 w-4 text-primary shrink-0" />
											<span className="font-semibold truncate">
												Ready to connect: {selectedEbAspsp.title || selectedEbAspsp.name}
											</span>
										</div>
										<Badge variant="outline" className="text-[10px] shrink-0">
											{selectedEbAspsp.country}
										</Badge>
									</div>
								)}

								<div className="rounded-md border bg-muted/30 p-2.5 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
									<div>
										<strong className="text-foreground">Required Redirect URL:</strong>{" "}
										<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground select-all">
											{`${typeof window !== "undefined" ? window.location.origin : "https://sigmafinance.typhon0.com"}/sync/callback`}
										</code>
									</div>
									<div>
										<strong>Restricted Mode Notice:</strong> In Enable Banking's free personal mode,
										ensure this bank account is whitelisted via{" "}
										<a
											href="https://enablebanking.com/cp/"
											target="_blank"
											rel="noreferrer"
											className="underline text-primary"
										>
											Enable Banking Control Panel
										</a>{" "}
										(<em>"Activate by linking accounts"</em>). Un-whitelisted accounts will return
										empty.
									</div>
								</div>

								<DialogFooter className="pt-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => onOpenChange(false)}
										disabled={isBusy}
									>
										Cancel
									</Button>
									<Button
										type="button"
										onClick={handleConnectEnableBanking}
										disabled={isBusy || !selectedEbAspsp}
										className="gap-2"
									>
										{initiatingEb ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />
												Opening Bank Gateway...
											</>
										) : (
											<>
												Connect{" "}
												{selectedEbAspsp?.title ? selectedEbAspsp.title.split(" ")[0] : "Bank"}
												<ExternalLink className="h-4 w-4" />
											</>
										)}
									</Button>
								</DialogFooter>
							</TabsContent>

							{/* 0. TRADE REPUBLIC TAB */}
							<TabsContent
								value="traderepublic"
								className="space-y-4 pt-3 border-t border-border/40 mt-3"
							>
								{trAuthSession ? (
									<div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
										<div className="relative">
											<div className="rounded-full bg-primary/10 p-5">
												<Smartphone className="h-10 w-10 text-primary animate-pulse" />
											</div>
											<div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1 shadow">
												<Loader2 className="h-5 w-5 animate-spin text-primary" />
											</div>
										</div>
										<div className="space-y-1.5 max-w-sm">
											<h3 className="font-semibold text-lg">Approve login on your phone</h3>
											<p className="text-sm text-muted-foreground">
												Please open your Trade Republic app on your mobile device and approve the
												login request.
											</p>
											{trCountdown > 0 && (
												<Badge variant="outline" className="mt-2 text-xs font-mono">
													Request expires in {trCountdown}s
												</Badge>
											)}
										</div>
										<div className="pt-2 flex items-center justify-center">
											<Button type="button" variant="outline" onClick={handleCancelTradeRepublic}>
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<>
										<div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs sm:text-sm space-y-1">
											<div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
												<ShieldCheck className="h-4 w-4" />
												<span>Direct Read-Only Integration (Unofficial)</span>
											</div>
											<p className="text-muted-foreground leading-relaxed">
												Synchronize your Trade Republic portfolio, CTO, PEA, cash balances, and
												transactions automatically. Your PIN is used exclusively for one-time mobile
												authorization and is <strong>never stored</strong>.
											</p>
										</div>

										{trErrorMessage && (
											<div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-xs sm:text-sm space-y-1.5">
												<div className="flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
													<Smartphone className="h-4 w-4" />
													<span>Mobile App Update Required</span>
												</div>
												<p className="text-muted-foreground leading-relaxed">{trErrorMessage}</p>
											</div>
										)}

										<form onSubmit={handleConnectTradeRepublic} className="space-y-4">
											<div className="space-y-2">
												<Label htmlFor="tr-phone">Phone Number *</Label>
												<div className="relative">
													<Input
														id="tr-phone"
														placeholder="e.g. +33612345678 or +491512345678"
														value={trPhoneNumber}
														onChange={(e) => setTrPhoneNumber(e.target.value)}
														required
														autoFocus
													/>
													<Smartphone className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
												</div>
												<p className="text-xs text-muted-foreground">
													Enter your international phone number registered with Trade Republic.
												</p>
											</div>

											<div className="space-y-2">
												<Label htmlFor="tr-pin">4-Digit App PIN *</Label>
												<div className="relative">
													<Input
														id="tr-pin"
														type={showTrPin ? "text" : "password"}
														placeholder="••••"
														maxLength={4}
														value={trPin}
														onChange={(e) => setTrPin(e.target.value)}
														required
													/>
													<button
														type="button"
														onClick={() => setShowTrPin((v) => !v)}
														className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
														aria-label={showTrPin ? "Hide PIN" : "Show PIN"}
													>
														{showTrPin ? (
															<EyeOff className="h-4 w-4" />
														) : (
															<Eye className="h-4 w-4" />
														)}
													</button>
												</div>
											</div>

											<DialogFooter className="pt-2">
												<Button
													type="button"
													variant="outline"
													onClick={() => onOpenChange(false)}
													disabled={isBusy}
												>
													Cancel
												</Button>
												<Button type="submit" disabled={isBusy || !trPhoneNumber || !trPin}>
													{initiatingTr ? (
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Initiating...
														</>
													) : (
														<>
															Connect Trade Republic
															<ArrowRight className="ml-2 h-4 w-4" />
														</>
													)}
												</Button>
											</DialogFooter>
										</form>
									</>
								)}
							</TabsContent>

							{/* WOOB TAB (Universal Direct Sync: BoursoBank, Fortuneo, BNP, CA, Amundi, etc.) */}
							<TabsContent value="woob" className="space-y-4 pt-3 border-t border-border/40 mt-3">
								{discoveredWoobConnections ? (
									<WoobAccountSelector
										connections={discoveredWoobConnections}
										institutionName={
											WOOB_BANKS.find((b) => b.id === woobInstitution)?.name ||
											(woobInstitution === "custom" ? woobCustomModule : woobInstitution)
										}
										onConfirm={handleConfirmWoobAccounts}
										onCancel={() => setDiscoveredWoobConnections(null)}
										isSubmitting={isImportingSelected}
									/>
								) : woobAuthSession ? (
									<div className="space-y-4 py-4 text-center">
										<div className="flex justify-center">
											<div className="relative">
												<div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
													<Smartphone className="h-8 w-8 animate-pulse" />
												</div>
												<div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border">
													<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
												</div>
											</div>
										</div>
										<div className="space-y-1.5 max-w-sm mx-auto">
											<h3 className="font-semibold text-base">
												Validation sur votre application mobile
											</h3>
											<p className="text-xs text-muted-foreground">
												{woobAuthSession.challengeMessage ||
													"Veuillez ouvrir votre application bancaire et valider la notification de connexion."}
											</p>
											{woobCountdown > 0 && (
												<Badge variant="outline" className="mt-2 text-xs font-mono">
													Expire dans {woobCountdown}s
												</Badge>
											)}
										</div>

										{woobAuthSession.status === "WAITING_FOR_CODE" && (
											<div className="max-w-xs mx-auto space-y-2 pt-2">
												<Label htmlFor="woob-otp" className="text-xs">
													Code de sécurité (SMS / OTP)
												</Label>
												<Input
													id="woob-otp"
													type="text"
													value={woobOtpCode}
													onChange={(e) => setWoobOtpCode(e.target.value)}
													placeholder="Ex: 123456"
													className="text-center font-mono text-sm tracking-wider"
												/>
											</div>
										)}

										<div className="pt-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => setWoobAuthSession(null)}
												className="text-xs"
											>
												Annuler
											</Button>
										</div>
									</div>
								) : (
									<form onSubmit={handleConnectWoob} className="space-y-4">
										<div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs space-y-1">
											<div className="flex items-center gap-1.5 font-medium text-foreground">
												<ShieldCheck className="h-4 w-4 text-blue-500" />
												<span>Synchronisation Universelle & Patrimoine Complet (Woob Engine)</span>
											</div>
											<p className="text-muted-foreground leading-relaxed">
												Synchronisez l'intégralité de vos comptes et produits : comptes courants, livrets d'épargne,
												PEA & CTO (avec valorisation et positions), assurances-vie (fonds euros et unités de compte),
												et crédits immobiliers (déduits de votre patrimoine net). Identifiants chiffrés localement en AES-256-GCM.
											</p>
										</div>

										{/* Search Bar for Banks */}
										<div className="space-y-1.5">
											<div className="flex items-center justify-between">
												<Label className="text-xs font-medium">Choisissez votre établissement</Label>
												<span className="text-[10px] text-muted-foreground">
													{filteredWoobBanks.length} disponible(s)
												</span>
											</div>
											<div className="relative">
												<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
												<Input
													type="text"
													value={woobBankSearch}
													onChange={(e) => setWoobBankSearch(e.target.value)}
													placeholder="Rechercher une banque (BoursoBank, Fortuneo, BNP, Amundi, Linxea...)"
													className="pl-8 text-xs bg-background h-8"
												/>
											</div>
										</div>

										{/* Bank Grid Selector */}
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
											{filteredWoobBanks.map((bank) => {
												const isSelected = woobInstitution === bank.id;
												return (
													<button
														key={bank.id}
														type="button"
														onClick={() => {
															setWoobInstitution(bank.id);
															if (!bank.hasRegion) {
																setWoobRegion("");
															}
														}}
														className={cn(
															"flex flex-col items-start p-2 rounded-lg border text-left transition-all",
															isSelected
																? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500 text-foreground"
																: "border-border/60 hover:border-border hover:bg-muted/40 text-muted-foreground",
														)}
													>
														<div className="flex items-center justify-between w-full">
															<span className="font-medium text-xs text-foreground truncate">
																{bank.name}
															</span>
															{isSelected && (
																<Check className="h-3.5 w-3.5 text-blue-500 shrink-0 ml-1" />
															)}
														</div>
														<span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
															{bank.subtitle}
														</span>
													</button>
												);
											})}
										</div>

										{/* Regional selector for mutualist banks */}
										{(woobInstitution === "caissedepargne" ||
											woobInstitution === "creditagricole" ||
											woobInstitution === "banquepopulaire") && (
											<div className="space-y-1.5 pt-1">
												<Label className="text-xs">Caisse régionale</Label>
												<Select value={woobRegion} onValueChange={setWoobRegion}>
													<SelectTrigger className="text-xs bg-background">
														<SelectValue placeholder="Sélectionnez une caisse régionale" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="grand_est">Grand Est Europe (Alsace, Lorraine, Champagne-Ardenne)</SelectItem>
														<SelectItem value="idf">Île-de-France</SelectItem>
														<SelectItem value="rhone_alpes">Rhône Alpes</SelectItem>
														<SelectItem value="aquitaine">Aquitaine Poitou-Charentes</SelectItem>
														<SelectItem value="nord">Hauts de France / Nord Europe</SelectItem>
														<SelectItem value="paca">Provence-Alpes-Côte d'Azur / CEPAC</SelectItem>
														<SelectItem value="cote_azur">Côte d'Azur</SelectItem>
														<SelectItem value="bourgogne">Bourgogne Franche-Comté</SelectItem>
														<SelectItem value="bretagne">Bretagne Pays de Loire</SelectItem>
														<SelectItem value="languedoc">Languedoc-Roussillon</SelectItem>
														<SelectItem value="loire_centre">Loire-Centre</SelectItem>
														<SelectItem value="loire_drome">Loire Drôme Ardèche</SelectItem>
														<SelectItem value="midi_pyrenees">Midi-Pyrénées</SelectItem>
														<SelectItem value="normandie">Normandie</SelectItem>
														<SelectItem value="auvergne">Auvergne et Limousin</SelectItem>
														<SelectItem value="autre">Autre caisse régionale</SelectItem>
													</SelectContent>
												</Select>
											</div>
										)}

										{/* Custom Woob module input */}
										{woobInstitution === "custom" && (
											<div className="space-y-1.5 pt-1">
												<Label htmlFor="woob-custom-module" className="text-xs">
													Identifiant du module Woob (ex: bforbank, hellobank, ing, n26)
												</Label>
												<Input
													id="woob-custom-module"
													type="text"
													value={woobCustomModule}
													onChange={(e) => setWoobCustomModule(e.target.value)}
													placeholder="Ex: bforbank"
													className="text-xs bg-background"
													required
												/>
											</div>
										)}

										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
											<div className="space-y-1.5">
												<Label htmlFor="woob-login" className="text-xs">
													Identifiant client *
												</Label>
												<Input
													id="woob-login"
													type="text"
													value={woobLogin}
													onChange={(e) => setWoobLogin(e.target.value)}
													placeholder="Ex: 12345678"
													className="text-xs bg-background"
													required
												/>
											</div>

											<div className="space-y-1.5">
												<Label htmlFor="woob-pwd" className="text-xs">
													Mot de passe / Code d'accès *
												</Label>
												<div className="relative">
													<Input
														id="woob-pwd"
														type={showWoobPassword ? "text" : "password"}
														value={woobPassword}
														onChange={(e) => setWoobPassword(e.target.value)}
														placeholder="••••••••"
														className="text-xs bg-background pr-10"
														required
													/>
													<button
														type="button"
														onClick={() => setShowWoobPassword(!showWoobPassword)}
														className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
													>
														{showWoobPassword ? (
															<EyeOff className="h-4 w-4" />
														) : (
															<Eye className="h-4 w-4" />
														)}
													</button>
												</div>
											</div>
										</div>

										{woobErrorMessage && (
											<p className="text-xs text-destructive">{woobErrorMessage}</p>
										)}

										<DialogFooter className="pt-2">
											<Button
												type="submit"
												size="sm"
												disabled={initiatingWoob}
												className="text-xs w-full sm:w-auto"
											>
												{initiatingWoob ? (
													<>
														<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
														Connexion et détection...
													</>
												) : (
													<>
														Connecter et Détecter les Produits
														<ArrowRight className="ml-2 h-3.5 w-3.5" />
													</>
												)}
											</Button>
										</DialogFooter>
									</form>
								)}
							</TabsContent>

							{/* 1. KRAKEN TAB */}
							<TabsContent value="kraken" className="space-y-4 pt-3 border-t border-border/40 mt-3">
								<div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm space-y-1">
									<div className="flex items-center gap-2 font-medium text-foreground">
										<ShieldCheck className="h-4 w-4 text-emerald-500" />
										<span>Direct Read-Only Exchange Integration</span>
									</div>
									<p className="text-muted-foreground leading-relaxed">
										Generate an API key in your account security settings. Only enable
										<strong className="text-foreground"> "Query Funds"</strong> and
										<strong className="text-foreground"> "Query Closed Orders & Trades"</strong>.
										Never enable withdrawal or trading permissions.
									</p>
								</div>

								<form onSubmit={handleConnectKraken} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="kraken-key">API Key *</Label>
										<div className="relative">
											<Input
												id="kraken-key"
												placeholder="e.g. abcd1234efgh5678..."
												value={krakenApiKey}
												onChange={(e) => setKrakenApiKey(e.target.value)}
												required
												autoFocus
											/>
											<Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
										</div>
									</div>

									<div className="space-y-2">
										<Label htmlFor="kraken-secret">Private Key (Secret) *</Label>
										<div className="relative">
											<Input
												id="kraken-secret"
												type={showSecret ? "text" : "password"}
												placeholder="Enter API Private Key"
												value={krakenApiSecret}
												onChange={(e) => setKrakenApiSecret(e.target.value)}
												required
											/>
											<button
												type="button"
												onClick={() => setShowSecret((v) => !v)}
												className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
												aria-label={showSecret ? "Hide secret" : "Show secret"}
											>
												{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
											</button>
										</div>
									</div>

									{/* Account Mapping Option */}
									<div className="space-y-3 pt-2 border-t">
										<Label className="text-sm font-medium">Account Mapping</Label>
										<RadioGroup
											value={mappingMode}
											onValueChange={(v) => setMappingMode(v as typeof mappingMode)}
											className="gap-2"
										>
											<div className="flex items-center space-x-2">
												<RadioGroupItem value="auto" id="kraken-map-auto" />
												<Label
													htmlFor="kraken-map-auto"
													className="cursor-pointer text-xs sm:text-sm"
												>
													Auto-create a dedicated exchange account in this portfolio
												</Label>
											</div>
											{accounts.length > 0 && (
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="existing" id="kraken-map-existing" />
													<Label
														htmlFor="kraken-map-existing"
														className="cursor-pointer text-xs sm:text-sm"
													>
														Link to an existing account
													</Label>
												</div>
											)}
										</RadioGroup>

										{mappingMode === "existing" && accounts.length > 0 && (
											<div className="pt-1">
												<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
													<SelectTrigger>
														<SelectValue placeholder="Select existing account" />
													</SelectTrigger>
													<SelectContent>
														{accounts.map((acc) => (
															<SelectItem key={acc.id} value={acc.id}>
																{acc.name} ({acc.type})
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										)}
									</div>

									<DialogFooter className="pt-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => onOpenChange(false)}
											disabled={isBusy}
										>
											Cancel
										</Button>
										<Button type="submit" disabled={isBusy || !krakenApiKey || !krakenApiSecret}>
											{registeringKraken || creatingAccount ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Connecting...
												</>
											) : (
												<>
													Connect Account
													<ArrowRight className="ml-2 h-4 w-4" />
												</>
											)}
										</Button>
									</DialogFooter>
								</form>
							</TabsContent>

							{/* 2. SNAPTRADE TAB (Trade Republic, IBKR, etc.) */}
							<TabsContent
								value="snaptrade"
								className="space-y-4 pt-3 border-t border-border/40 mt-3"
							>
								<div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm space-y-2">
									<div className="flex items-center gap-2 font-medium text-foreground">
										<Building2 className="h-4 w-4 text-primary" />
										<span>Retail Brokerages & Stock Accounts</span>
									</div>
									<p className="text-muted-foreground leading-relaxed">
										Connect Interactive Brokers, Robinhood, Degiro, Charles Schwab, and 100+ stock
										brokerages securely via SnapTrade Open Brokerage API.
									</p>
									<div className="flex flex-wrap gap-1.5 pt-1">
										<Badge variant="secondary">Interactive Brokers</Badge>
										<Badge variant="secondary">Degiro</Badge>
										<Badge variant="secondary">Robinhood</Badge>
									</div>
								</div>

								<div className="space-y-3 pt-2 border-t">
									<Label className="text-sm font-medium">Account Mapping</Label>
									<RadioGroup
										value={mappingMode}
										onValueChange={(v) => setMappingMode(v as typeof mappingMode)}
										className="gap-2"
									>
										<div className="flex items-center space-x-2">
											<RadioGroupItem value="auto" id="snap-map-auto" />
											<Label htmlFor="snap-map-auto" className="cursor-pointer text-xs sm:text-sm">
												Auto-create accounts discovered from the brokerage connection
											</Label>
										</div>
										{accounts.length > 0 && (
											<div className="flex items-center space-x-2">
												<RadioGroupItem value="existing" id="snap-map-existing" />
												<Label
													htmlFor="snap-map-existing"
													className="cursor-pointer text-xs sm:text-sm"
												>
													Link to existing account in portfolio
												</Label>
											</div>
										)}
									</RadioGroup>

									{mappingMode === "existing" && accounts.length > 0 && (
										<div className="pt-1">
											<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
												<SelectTrigger>
													<SelectValue placeholder="Select existing account" />
												</SelectTrigger>
												<SelectContent>
													{accounts.map((acc) => (
														<SelectItem key={acc.id} value={acc.id}>
															{acc.name} ({acc.type})
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									)}
								</div>

								<DialogFooter className="pt-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => onOpenChange(false)}
										disabled={isBusy}
									>
										Cancel
									</Button>
									<Button type="button" onClick={handleConnectSnapTrade} disabled={isBusy}>
										{generatingLink ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Generating Portal...
											</>
										) : (
											<>
												Connect via SnapTrade
												<ExternalLink className="ml-2 h-4 w-4" />
											</>
										)}
									</Button>
								</DialogFooter>
							</TabsContent>

							{/* 3. GOCARDLESS TAB (European Banks) */}
							<TabsContent
								value="gocardless"
								className="space-y-4 pt-3 border-t border-border/40 mt-3"
							>
								<div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm space-y-2">
									<div className="flex items-center gap-2 font-medium text-foreground">
										<Landmark className="h-4 w-4 text-emerald-500" />
										<span>Open Banking (PSD2)</span>
									</div>
									<p className="text-muted-foreground leading-relaxed">
										Connect over 2,500+ financial institutions in 31 countries via GoCardless
										(formerly Nordigen) PSD2 Open Banking. Sync checking, savings, and deposit
										accounts with read-only bank consent.
									</p>
									<div className="flex flex-wrap gap-1.5 pt-1">
										<Badge variant="secondary">BNP Paribas</Badge>
										<Badge variant="secondary">Crédit Agricole</Badge>
										<Badge variant="secondary">Revolut</Badge>
										<Badge variant="secondary">N26</Badge>
										<Badge variant="secondary">Fortuneo</Badge>
										<Badge variant="secondary">Boursorama</Badge>
									</div>
								</div>

								<div className="space-y-3 pt-2 border-t">
									<Label className="text-sm font-medium">Account Mapping</Label>
									<RadioGroup
										value={mappingMode}
										onValueChange={(v) => setMappingMode(v as typeof mappingMode)}
										className="gap-2"
									>
										<div className="flex items-center space-x-2">
											<RadioGroupItem value="auto" id="gc-map-auto" />
											<Label htmlFor="gc-map-auto" className="cursor-pointer text-xs sm:text-sm">
												Auto-create bank accounts discovered during authentication
											</Label>
										</div>
										{accounts.length > 0 && (
											<div className="flex items-center space-x-2">
												<RadioGroupItem value="existing" id="gc-map-existing" />
												<Label
													htmlFor="gc-map-existing"
													className="cursor-pointer text-xs sm:text-sm"
												>
													Link to existing account in portfolio
												</Label>
											</div>
										)}
									</RadioGroup>

									{mappingMode === "existing" && accounts.length > 0 && (
										<div className="pt-1">
											<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
												<SelectTrigger>
													<SelectValue placeholder="Select existing account" />
												</SelectTrigger>
												<SelectContent>
													{accounts.map((acc) => (
														<SelectItem key={acc.id} value={acc.id}>
															{acc.name} ({acc.type})
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									)}
								</div>

								<DialogFooter className="pt-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => onOpenChange(false)}
										disabled={isBusy}
									>
										Cancel
									</Button>
									<Button type="button" onClick={handleConnectGoCardless} disabled={isBusy}>
										{generatingLink ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Opening Gateway...
											</>
										) : (
											<>
												Connect via Open Banking
												<ExternalLink className="ml-2 h-4 w-4" />
											</>
										)}
									</Button>
								</DialogFooter>
							</TabsContent>

							{/* 4. ON-CHAIN WALLETS TAB */}
							<TabsContent
								value="wallets"
								className="space-y-4 pt-3 border-t border-border/40 mt-3"
							>
								<div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3.5 text-xs sm:text-sm space-y-2">
									<div className="flex items-center gap-2 font-medium text-foreground">
										<ShieldCheck className="h-4 w-4 text-violet-500" />
										<span>Public Address & Device Synchronization</span>
									</div>
									<p className="text-muted-foreground leading-relaxed">
										Track public wallet addresses, extended public keys (xpub/zpub), or hardware
										containers without private keys. Sync balances, smart swaps, and transactions
										automatically.
									</p>
								</div>

								<div className="space-y-2">
									<Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
										Supported Blockchains & Networks (7)
									</Label>
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
										<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-xs">
											<span className="font-mono text-base">💎</span>
											<div>
												<p className="font-medium">Ethereum</p>
												<p className="text-[10px] text-muted-foreground">EVM Mainnet</p>
											</div>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-xs">
											<span className="font-mono text-base">🔵</span>
											<div>
												<p className="font-medium">Base</p>
												<p className="text-[10px] text-muted-foreground">Coinbase L2</p>
											</div>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-xs">
											<span className="font-mono text-base">🔷</span>
											<div>
												<p className="font-medium">Arbitrum</p>
												<p className="text-[10px] text-muted-foreground">Arbitrum One L2</p>
											</div>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-xs">
											<span className="font-mono text-base">🔴</span>
											<div>
												<p className="font-medium">Optimism</p>
												<p className="text-[10px] text-muted-foreground">OP Mainnet L2</p>
											</div>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-xs">
											<span className="font-mono text-base">🟣</span>
											<div>
												<p className="font-medium">Polygon PoS</p>
												<p className="text-[10px] text-muted-foreground">Sidechain</p>
											</div>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-xs">
											<span className="font-mono text-base">🟣</span>
											<div>
												<p className="font-medium">Solana</p>
												<p className="text-[10px] text-muted-foreground">SVM & SPL</p>
											</div>
										</div>
										<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-xs col-span-2 sm:col-span-1">
											<span className="font-mono text-base">₿</span>
											<div>
												<p className="font-medium">Bitcoin</p>
												<p className="text-[10px] text-muted-foreground">Native & xpub/zpub</p>
											</div>
										</div>
									</div>
								</div>

								<div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs space-y-1.5 text-muted-foreground">
									<p className="flex items-center gap-1.5 font-medium text-foreground">
										<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
										Zero-cost single-key Alchemy API architecture (30M CU free tier)
									</p>
									<p className="flex items-center gap-1.5 font-medium text-foreground">
										<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
										Automated smart swap & staged DeFi transaction detector
									</p>
									<p className="flex items-center gap-1.5 font-medium text-foreground">
										<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
										Trust Wallet verified token lists & spam NFT shielding
									</p>
								</div>

								<DialogFooter className="pt-2">
									<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
										Cancel
									</Button>
									<Button
										type="button"
										className="bg-violet-600 hover:bg-violet-700 text-white"
										onClick={() => {
											onOpenChange(false);
											setShowAddWalletDialog(true);
										}}
									>
										<Wallet className="mr-2 h-4 w-4" />
										Connect On-Chain Wallet
									</Button>
								</DialogFooter>
							</TabsContent>
						</Tabs>
					)}
				</DialogContent>
			</Dialog>

			{showAddWalletDialog && (
				<AddWalletDialog
					open={showAddWalletDialog}
					onOpenChange={setShowAddWalletDialog}
					portfolioId={portfolioId}
					onSuccess={() => {
						handleConnectionComplete();
					}}
				/>
			)}
		</>
	);
}
