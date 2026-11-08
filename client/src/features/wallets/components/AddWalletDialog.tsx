import { useMutation, useQuery } from "@apollo/client";
import {
	AlertCircle,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Copy,
	ExternalLink,
	HardDrive,
	Layers,
	QrCode,
	ShieldCheck,
	Smartphone,
	Sparkles,
	Wallet,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockchainNetwork, WalletDeviceType } from "@/gql/graphql";
import {
	ADD_MULTI_CHAIN_WALLET,
	ADD_MULTI_NETWORK_WALLET,
	ADD_WALLET_ACCOUNT,
	CREATE_WALLET_DEVICE,
} from "@/graphql/mutations/wallets";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import {
	GET_WALLET_ACCOUNTS,
	GET_WALLET_DEVICES,
} from "@/graphql/queries/wallets";
import { useWeb3WalletDetection } from "../hooks/useWeb3WalletDetection";
import {
	DEFAULT_WALLETCONNECT_PROJECT_ID,
	getQRCodeUrl,
} from "../services/walletConnectService";
import {
	MOBILE_WALLETS,
	openMobileWalletDapp,
	openMobileWalletWc,
	getUniversalWcDeepLink,
} from "../services/mobileWalletDeepLinks";

interface AddWalletDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioId?: string;
	onSuccess?: () => void;
}

// Clean Vector Icons for Web3 Chains
export const EthIcon = ({
	className = "h-3.5 w-3.5",
}: {
	className?: string;
}) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 1.5L4.5 13.8 12 18.2l7.5-4.4L12 1.5zM12 19.8l-7.5-4.4L12 22.5l7.5-7.1L12 19.8z" />
	</svg>
);

export const SolanaIcon = ({
	className = "h-3.5 w-3.5",
}: {
	className?: string;
}) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M4 17.5h12.5l3.5-3.5H7.5L4 17.5zM4 6.5h12.5l3.5-3.5H7.5L4 6.5zM7.5 12h12.5L16.5 8.5H4l3.5 3.5z" />
	</svg>
);

export const BtcIcon = ({
	className = "h-3.5 w-3.5",
}: {
	className?: string;
}) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor">
		<path d="M14.5 10.5c.8-.5 1.3-1.3 1.3-2.3 0-1.8-1.4-3.2-3.3-3.2H7V19h6.2c2.1 0 3.8-1.6 3.8-3.7 0-1.6-.9-3-2.5-3.8zM9.5 7.5h2.8c.8 0 1.5.6 1.5 1.4s-.7 1.4-1.5 1.4H9.5V7.5zm3.7 9H9.5V13h3.7c1 0 1.8.8 1.8 1.8s-.8 1.7-1.8 1.7z" />
	</svg>
);

export const toSafeAddressString = (val: any): string => {
	if (!val) return "";
	if (typeof val === "string") return val.trim();
	if (typeof val.address === "string") return val.address.trim();
	if (typeof val.publicKey === "string") return val.publicKey.trim();
	return "";
};

const SUPPORTED_NETWORKS = [
	{
		value: BlockchainNetwork.Ethereum,
		label: "Ethereum",
		iconNode: <EthIcon />,
		badge: "EVM",
	},
	{
		value: BlockchainNetwork.Base,
		label: "Base",
		iconNode: <EthIcon className="h-3.5 w-3.5 text-blue-500" />,
		badge: "L2",
	},
	{
		value: BlockchainNetwork.Arbitrum,
		label: "Arbitrum One",
		iconNode: <EthIcon className="h-3.5 w-3.5 text-cyan-500" />,
		badge: "L2",
	},
	{
		value: BlockchainNetwork.Optimism,
		label: "Optimism",
		iconNode: <EthIcon className="h-3.5 w-3.5 text-red-500" />,
		badge: "L2",
	},
	{
		value: BlockchainNetwork.Polygon,
		label: "Polygon PoS",
		iconNode: <EthIcon className="h-3.5 w-3.5 text-purple-500" />,
		badge: "Sidechain",
	},
	{
		value: BlockchainNetwork.Solana,
		label: "Solana",
		iconNode: <SolanaIcon className="h-3.5 w-3.5 text-purple-400" />,
		badge: "SVM",
	},
	{
		value: BlockchainNetwork.Bitcoin,
		label: "Bitcoin",
		iconNode: <BtcIcon className="h-3.5 w-3.5 text-amber-500" />,
		badge: "UTXO",
	},
];

const EVM_NETWORKS = [
	{ value: BlockchainNetwork.Ethereum, label: "Ethereum", symbol: "ETH" },
	{ value: BlockchainNetwork.Base, label: "Base", symbol: "BASE" },
	{ value: BlockchainNetwork.Arbitrum, label: "Arbitrum", symbol: "ARB" },
	{ value: BlockchainNetwork.Optimism, label: "Optimism", symbol: "OP" },
	{ value: BlockchainNetwork.Polygon, label: "Polygon", symbol: "POL" },
];

export function AddWalletDialog({
	open,
	onOpenChange,
	portfolioId: propPortfolioId,
	onSuccess,
}: AddWalletDialogProps) {
	const {
		currentPortfolio,
		portfolios: contextPortfolios,
		data: portfolioData,
	} = usePortfolio();
	const activePortfolioId = propPortfolioId || currentPortfolio;

	const portfolios = useMemo(() => {
		if (Array.isArray(contextPortfolios) && contextPortfolios.length > 0) {
			return contextPortfolios.filter((p) => p && p.id);
		}
		if (
			Array.isArray(portfolioData?.portfolios) &&
			portfolioData.portfolios.length > 0
		) {
			return portfolioData.portfolios.filter((p: any) => p && p.id);
		}
		if (activePortfolioId) {
			return [{ id: activePortfolioId, name: "Current Portfolio" }];
		}
		return [];
	}, [contextPortfolios, portfolioData, activePortfolioId]);

	// Active tab: 'multichain' is the default hub as approved
	const [activeTab, setActiveTab] = useState<
		"multichain" | "standalone" | "device"
	>("multichain");

	const [selectedPortfolio, setSelectedPortfolio] = useState(
		activePortfolioId || (portfolios.length > 0 ? portfolios[0].id : ""),
	);

	useEffect(() => {
		if (propPortfolioId) {
			setSelectedPortfolio(propPortfolioId);
		} else if (currentPortfolio) {
			setSelectedPortfolio(currentPortfolio);
		} else if (
			portfolios.length > 0 &&
			(!selectedPortfolio || selectedPortfolio === "no-portfolio")
		) {
			setSelectedPortfolio(portfolios[0].id);
		}
	}, [propPortfolioId, currentPortfolio, portfolios, selectedPortfolio]);

	// Web3 Browser Detection
	const {
		evmProviders,
		solanaProviders,
		bitcoinProviders,
		connectEvm,
		connectSolana,
		connectBitcoin,
		connectPhantomAll,
		hasAnyDetected,
	} = useWeb3WalletDetection();

	// Multi-Chain State
	const [multiName, setMultiName] = useState("Phantom Wallet");
	const [multiDeviceType, setMultiDeviceType] = useState<WalletDeviceType>(
		WalletDeviceType.Software,
	);
	const [multiEvmAddress, setMultiEvmAddress] = useState("");
	const [multiSolanaAddress, setMultiSolanaAddress] = useState("");
	const [multiBtcAddress, setMultiBtcAddress] = useState("");
	const [selectedEvmNetworks, setSelectedEvmNetworks] = useState<
		BlockchainNetwork[]
	>([
		BlockchainNetwork.Ethereum,
		BlockchainNetwork.Base,
		BlockchainNetwork.Arbitrum,
		BlockchainNetwork.Optimism,
		BlockchainNetwork.Polygon,
	]);
	const [showWalletConnectModal, setShowWalletConnectModal] = useState(false);
	const [showMobileLinks, setShowMobileLinks] = useState(false);
	const [wcUri, setWcUri] = useState("");
	const [copiedWcUri, setCopiedWcUri] = useState(false);

	// Deduplicate detected web3 extensions across EVM, Solana & Bitcoin
	const unifiedDetectedWallets = useMemo(() => {
		const list: {
			id: string;
			name: string;
			icon?: string;
			chains: string[];
			connect: () => Promise<void>;
		}[] = [];

		const win = typeof window !== "undefined" ? (window as any) : {};
		const hasPhantom = !!(win.phantom?.solana || win.solana?.isPhantom);

		// 1. Phantom All-in-One
		if (hasPhantom) {
			const chains = ["Solana"];
			if (
				win.phantom?.ethereum ||
				evmProviders.some((p) => p.info.name.toLowerCase().includes("phantom"))
			) {
				chains.unshift("EVM");
			}
			if (
				win.phantom?.bitcoin ||
				bitcoinProviders.some((p) => p.id.includes("phantom"))
			) {
				chains.push("Bitcoin");
			}
			list.push({
				id: "phantom-all",
				name: "Phantom",
				chains,
				connect: async () => {
					try {
						const res = await connectPhantomAll();
						if (res.solana) setMultiSolanaAddress(toSafeAddressString(res.solana));
						if (res.evm) setMultiEvmAddress(toSafeAddressString(res.evm));
						if (res.bitcoin) {
							setMultiBtcAddress(toSafeAddressString(res.bitcoin));
						} else {
							const btcProv = bitcoinProviders.find((p) =>
								p.id.includes("phantom"),
							)?.provider;
							if (btcProv) {
								try {
									const btcRes = await connectBitcoin(btcProv);
									if (btcRes?.address) {
										setMultiBtcAddress(toSafeAddressString(btcRes.address));
									}
								} catch {}
							}
						}
						setMultiName("Phantom Multi-Chain");
						toast.success("Phantom connecté avec succès !");
					} catch (err: any) {
						toast.error(err?.message || "Erreur de connexion Phantom");
					}
				},
			});
		}

		// 2. EVM Providers (excluding Phantom if already added)
		evmProviders.forEach((ep) => {
			if (hasPhantom && ep.info.name.toLowerCase().includes("phantom")) return;
			list.push({
				id: ep.info.uuid,
				name: ep.info.name,
				icon: ep.info.icon,
				chains: ["EVM"],
				connect: async () => {
					try {
						const addr = await connectEvm(ep.provider);
						if (addr) {
							setMultiEvmAddress(toSafeAddressString(addr));
							setMultiName(ep.info.name || "EVM Wallet");
							toast.success(`${ep.info.name} connecté !`);
						}
					} catch (err: any) {
						toast.error(err?.message || "Connexion refusée");
					}
				},
			});
		});

		// 3. Solana Providers (excluding Phantom)
		solanaProviders.forEach((sp) => {
			if (sp.id.includes("phantom")) return;
			list.push({
				id: sp.id,
				name: sp.name,
				chains: ["Solana"],
				connect: async () => {
					try {
						const addr = await connectSolana(sp.provider);
						if (addr) {
							setMultiSolanaAddress(toSafeAddressString(addr));
							setMultiName(sp.name);
							toast.success(`${sp.name} connecté !`);
						}
					} catch (err: any) {
						toast.error(err?.message || "Connexion refusée");
					}
				},
			});
		});

		// 4. Bitcoin Providers (excluding Phantom)
		bitcoinProviders.forEach((bp) => {
			if (bp.id.includes("phantom")) return;
			list.push({
				id: bp.id,
				name: bp.name,
				chains: ["Bitcoin"],
				connect: async () => {
					try {
						const res = await connectBitcoin(bp.provider);
						if (res?.address) {
							setMultiBtcAddress(toSafeAddressString(res.address));
							setMultiName(bp.name);
							toast.success(`${bp.name} connecté !`);
						}
					} catch (err: any) {
						toast.error(err?.message || "Connexion refusée");
					}
				},
			});
		});

		return list;
	}, [evmProviders, solanaProviders, bitcoinProviders]);

	// Standalone single address state
	const [network, setNetwork] = useState<BlockchainNetwork>(
		BlockchainNetwork.Ethereum,
	);
	const [address, setAddress] = useState("");
	const [label, setLabel] = useState("");
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>("none");
	const [isCreatingNewDevice, setIsCreatingNewDevice] = useState(false);
	const [newDeviceName, setNewDeviceName] = useState("");
	const [newDeviceType, setNewDeviceType] = useState<WalletDeviceType>(
		WalletDeviceType.Hardware,
	);
	const [multiEvmEnabled, setMultiEvmEnabled] = useState(true);

	// Device container tab state
	const [deviceName, setDeviceName] = useState("");
	const [deviceType, setDeviceType] = useState<WalletDeviceType>(
		WalletDeviceType.Hardware,
	);

	const { data: devicesData } = useQuery(GET_WALLET_DEVICES, {
		skip: !open,
	});

	const [addMultiChainWallet, { loading: addingMultiChain }] = useMutation(
		ADD_MULTI_CHAIN_WALLET,
		{
			refetchQueries: [
				"GetWalletAccounts",
				"GetWalletDevices",
				"GetAccounts",
				"GetPortfolio",
			],
			onCompleted: (res) => {
				const count = res.addMultiChainWallet?.accounts?.length || 0;
				toast.success(
					`Portefeuille ${res.addMultiChainWallet?.name || "multi-chaînes"} connecté avec succès (${count} comptes synchronisés) !`,
				);
				handleClose();
				onSuccess?.();
			},
			onError: (err) => {
				toast.error(`Erreur d'ajout multi-chaînes: ${err.message}`);
			},
		},
	);

	const [addWalletAccount, { loading: addingAccount }] = useMutation(
		ADD_WALLET_ACCOUNT,
		{
			refetchQueries: [
				"GetWalletAccounts",
				"GetWalletDevices",
				"GetAccounts",
				"GetPortfolio",
			],
			onCompleted: () => {
				toast.success(
					"Crypto wallet connected successfully! Syncing token holdings...",
				);
				handleClose();
				onSuccess?.();
			},
			onError: (err) => {
				toast.error(`Failed to connect wallet: ${err.message}`);
			},
		},
	);

	const [addMultiNetworkWallet, { loading: addingMulti }] = useMutation(
		ADD_MULTI_NETWORK_WALLET,
		{
			refetchQueries: [
				"GetWalletAccounts",
				"GetWalletDevices",
				"GetAccounts",
				"GetPortfolio",
			],
			onCompleted: (res) => {
				const count = res.addMultiNetworkWallet?.length || 0;
				toast.success(
					`Connected across ${count} EVM networks! Syncing token holdings...`,
				);
				handleClose();
				onSuccess?.();
			},
			onError: (err) => {
				toast.error(`Failed to connect multi-network wallet: ${err.message}`);
			},
		},
	);

	const [createWalletDevice, { loading: creatingDevice }] = useMutation(
		CREATE_WALLET_DEVICE,
		{
			refetchQueries: [{ query: GET_WALLET_DEVICES }],
			onCompleted: (res) => {
				toast.success(`Created container for ${res.createWalletDevice.name}`);
				setDeviceName("");
			},
			onError: (err) => {
				toast.error(`Failed to create device container: ${err.message}`);
			},
		},
	);

	// Validations
	const evmValidation = useMemo(() => {
		const trimmed = toSafeAddressString(multiEvmAddress);
		if (!trimmed) return { isValid: true, message: "" };
		const isHex = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
		return {
			isValid: isHex,
			message: isHex
				? "Valid EVM address"
				: "Must be a 42-character hex address starting with 0x",
		};
	}, [multiEvmAddress]);

	const solanaValidation = useMemo(() => {
		const trimmed = toSafeAddressString(multiSolanaAddress);
		if (!trimmed) return { isValid: true, message: "" };
		const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
		return {
			isValid: isBase58,
			message: isBase58
				? "Valid Solana address"
				: "Must be a base58 Solana public key (32-44 characters)",
		};
	}, [multiSolanaAddress]);

	const btcValidation = useMemo(() => {
		const trimmed = toSafeAddressString(multiBtcAddress);
		if (!trimmed) return { isValid: true, message: "" };
		const isXpub = /^(xpub|ypub|zpub)[a-zA-HJ-NP-Z0-9]{100,115}$/.test(trimmed);
		const isAddr = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed);
		if (isXpub) {
			return {
				isValid: true,
				message: "Valid Bitcoin extended public key (xpub/ypub/zpub)",
			};
		}
		if (isAddr) {
			return {
				isValid: true,
				message: "Valid Bitcoin address (P2PKH, P2SH, or Bech32)",
			};
		}
		return {
			isValid: false,
			message:
				"Must be a valid Bitcoin address (bc1/1/3) or xpub/zpub descriptor",
		};
	}, [multiBtcAddress]);

	const standaloneValidation = useMemo(() => {
		const trimmed = address.trim();
		if (!trimmed) return { isValid: false, message: "" };

		switch (network) {
			case BlockchainNetwork.Ethereum:
			case BlockchainNetwork.Base:
			case BlockchainNetwork.Arbitrum:
			case BlockchainNetwork.Optimism:
			case BlockchainNetwork.Polygon: {
				const isHex = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
				return {
					isValid: isHex,
					message: isHex
						? "Valid EVM address"
						: "Must be a 42-character hex address starting with 0x",
					isXpub: false,
				};
			}
			case BlockchainNetwork.Solana: {
				const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
				return {
					isValid: isBase58,
					message: isBase58
						? "Valid Solana address"
						: "Must be a base58 Solana public key (32-44 characters)",
					isXpub: false,
				};
			}
			case BlockchainNetwork.Bitcoin: {
				const isXpub = /^(xpub|ypub|zpub)[a-zA-HJ-NP-Z0-9]{100,115}$/.test(
					trimmed,
				);
				const isAddr = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed);
				if (isXpub) {
					return {
						isValid: true,
						message: "Valid Bitcoin extended public key (xpub/ypub/zpub)",
						isXpub: true,
					};
				}
				if (isAddr) {
					return {
						isValid: true,
						message: "Valid Bitcoin address (P2PKH, P2SH, or Bech32)",
						isXpub: false,
					};
				}
				return {
					isValid: false,
					message:
						"Must be a valid Bitcoin address (bc1/1/3) or xpub/zpub descriptor",
					isXpub: false,
				};
			}
			default:
				return {
					isValid: false,
					message: "Unsupported network",
					isXpub: false,
				};
		}
	}, [address, network]);

	const hasAtLeastOneMultiAddress =
		toSafeAddressString(multiEvmAddress) !== "" ||
		toSafeAddressString(multiSolanaAddress) !== "" ||
		toSafeAddressString(multiBtcAddress) !== "";

	const isMultiFormValid =
		hasAtLeastOneMultiAddress &&
		evmValidation.isValid &&
		solanaValidation.isValid &&
		btcValidation.isValid &&
		(multiName || "").trim() !== "";

	const handleClose = () => {
		setAddress("");
		setLabel("");
		setSelectedDeviceId("none");
		setIsCreatingNewDevice(false);
		setNewDeviceName("");
		setShowWalletConnectModal(false);
		onOpenChange(false);
	};

	// Multi-chain form submit
	const handleSubmitMultiChain = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isMultiFormValid) {
			toast.error("Veuillez renseigner un nom et au moins une adresse valide");
			return;
		}
		if (!selectedPortfolio || selectedPortfolio === "no-portfolio") {
			toast.error("Veuillez sélectionner un portefeuille cible");
			return;
		}

		await addMultiChainWallet({
			variables: {
				input: {
					portfolioId: selectedPortfolio,
					name: (multiName || "").trim(),
					deviceType: multiDeviceType,
					evmAddress: toSafeAddressString(multiEvmAddress) || undefined,
					evmNetworks: toSafeAddressString(multiEvmAddress) ? selectedEvmNetworks : undefined,
					solanaAddress: toSafeAddressString(multiSolanaAddress) || undefined,
					bitcoinAddressOrXpub: toSafeAddressString(multiBtcAddress) || undefined,
				},
			},
		});
	};

	// Standalone single address submit
	const handleSubmitStandalone = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!standaloneValidation.isValid) {
			toast.error(
				standaloneValidation.message ||
					"Please enter a valid blockchain address",
			);
			return;
		}

		if (!selectedPortfolio || selectedPortfolio === "no-portfolio") {
			toast.error("Please select a target portfolio");
			return;
		}

		let finalDeviceId: string | undefined;
		if (isCreatingNewDevice) {
			if (!newDeviceName.trim()) {
				toast.error("Veuillez renseigner un nom pour le nouvel appareil");
				return;
			}
			try {
				const devRes = await createWalletDevice({
					variables: {
						input: {
							name: newDeviceName.trim(),
							deviceType: newDeviceType,
						},
					},
				});
				finalDeviceId = devRes.data?.createWalletDevice?.id;
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : "Erreur création appareil";
				toast.error(`Échec création appareil: ${msg}`);
				return;
			}
		} else if (selectedDeviceId && selectedDeviceId !== "none") {
			finalDeviceId = selectedDeviceId;
		}

		const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address.trim());
		if (isEvm && multiEvmEnabled && selectedEvmNetworks.length > 0) {
			await addMultiNetworkWallet({
				variables: {
					input: {
						portfolioId: selectedPortfolio,
						address: address.trim(),
						networks: selectedEvmNetworks,
						label: label.trim() || undefined,
						deviceName: isCreatingNewDevice
							? newDeviceName.trim()
							: finalDeviceId
								? undefined
								: label.trim() || "EVM Multi-Chain",
						deviceType: isCreatingNewDevice
							? newDeviceType
							: WalletDeviceType.Software,
					},
				},
			});
			return;
		}

		await addWalletAccount({
			variables: {
				input: {
					portfolioId: selectedPortfolio,
					network,
					addressOrXpub: address.trim(),
					isXpub: standaloneValidation.isXpub,
					label: label.trim() || undefined,
					deviceId: finalDeviceId,
				},
			},
		});
	};

	const handleCreateDevice = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!deviceName.trim()) {
			toast.error("Please enter a device name");
			return;
		}

		await createWalletDevice({
			variables: {
				input: {
					name: deviceName.trim(),
					deviceType,
				},
			},
		});
	};

	// Open WalletConnect QR Pairing
	const handleTriggerWalletConnect = () => {
		const simulatedPairingUri = `wc:${crypto.randomUUID()}@2?relay-protocol=irn&symKey=${crypto.randomUUID().replace(/-/g, "")}`;
		setWcUri(simulatedPairingUri);
		setShowWalletConnectModal(true);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[700px] max-h-[88vh] overflow-y-auto p-0 gap-0 border border-border/80 shadow-lg">
				{/* Header */}
				<div className="p-6 pb-4 border-b border-border/60 bg-muted/20">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
								<Wallet className="h-5 w-5" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
										Connect Crypto Wallet
									</DialogTitle>
									<span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
										Lecture seule • €0/mois
									</span>
								</div>
								<DialogDescription className="text-xs text-muted-foreground mt-0.5">
									Synchronisation multi-chaînes pour EVM, Solana et Bitcoin.
									Aucune clé privée ni seed phrase requise.
								</DialogDescription>
							</div>
						</div>
					</div>

					{/* Target Portfolio Selector */}
					<div className="mt-4 pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
						<Label
							htmlFor="multi-portfolio"
							className="text-xs font-medium text-muted-foreground shrink-0"
						>
							Target Portfolio :
						</Label>
						<Select
							value={selectedPortfolio}
							onValueChange={setSelectedPortfolio}
						>
							<SelectTrigger
								id="multi-portfolio"
								className="h-8 text-xs sm:w-[260px] bg-background"
							>
								<SelectValue placeholder="Sélectionner le portefeuille cible" />
							</SelectTrigger>
							<SelectContent>
								{portfolios.length > 0 ? (
									portfolios.map((p: { id: string; name: string }) => (
										<SelectItem key={p.id} value={p.id} className="text-xs">
											{p.name}
										</SelectItem>
									))
								) : (
									<SelectItem value="no-portfolio" disabled className="text-xs">
										Aucun portefeuille disponible
									</SelectItem>
								)}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Body Content */}
				<div className="p-6 pt-4">
					<Tabs
						value={activeTab}
						onValueChange={(v) =>
							setActiveTab(v as "multichain" | "standalone" | "device")
						}
						className="w-full space-y-4"
					>
						<TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg border border-border/60">
							<TabsTrigger
								value="multichain"
								className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5"
							>
								<Sparkles className="h-3.5 w-3.5 text-primary" />
								<span>Multi-Chain Device</span>
							</TabsTrigger>
							<TabsTrigger
								value="standalone"
								className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5"
							>
								<Wallet className="h-3.5 w-3.5" />
								<span>Single Address</span>
							</TabsTrigger>
							<TabsTrigger
								value="device"
								className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5"
							>
								<HardDrive className="h-3.5 w-3.5" />
								<span>Registered Devices</span>
							</TabsTrigger>
						</TabsList>

						{/* TAB 1: MULTI-CHAIN HUB (DEFAULT) */}
						<TabsContent
							value="multichain"
							className="space-y-4 pt-1 outline-none"
						>
							{/* Quick Auto-Detection & Web3 Connect */}
							<div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-3 shadow-2xs">
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										{unifiedDetectedWallets.length > 0 ? (
											<span className="relative flex h-2 w-2">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
												<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
											</span>
										) : (
											<Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
										)}
										<span className="text-xs font-semibold text-foreground">
											{unifiedDetectedWallets.length > 0
												? "Extension détectée dans votre navigateur"
												: "Connexion Rapide Web3"}
										</span>
									</div>

									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 text-xs gap-1.5 px-2.5 border-border/80 hover:border-primary/50 text-foreground"
										onClick={handleTriggerWalletConnect}
									>
										<QrCode className="h-3.5 w-3.5 text-primary" />
										<span>Scanner QR Code (WalletConnect)</span>
									</Button>
								</div>

								{unifiedDetectedWallets.length > 0 ? (
									<div className="flex flex-wrap gap-2 pt-0.5">
										{unifiedDetectedWallets.map((wallet) => (
											<Button
												key={wallet.id}
												type="button"
												variant="secondary"
												size="sm"
												className="h-8 text-xs gap-2 bg-primary/10 hover:bg-primary/20 text-foreground border border-primary/25 font-medium px-3 transition-all"
												onClick={wallet.connect}
											>
												<Sparkles className="h-3.5 w-3.5 text-primary" />
												<span>Connecter {wallet.name}</span>
												<span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border/60">
													{wallet.chains.join(" • ")}
												</span>
											</Button>
										))}
									</div>
								) : (
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Connectez instantanément vos adresses en scannant le QR code
										avec votre téléphone ou en saisissant vos adresses publiques
										ci-dessous.
									</p>
								)}

								{/* Discrete Collapsible for Direct Mobile Deep Links */}
								<div className="pt-2 border-t border-border/50">
									<button
										type="button"
										onClick={() => setShowMobileLinks(!showMobileLinks)}
										className="flex items-center justify-between w-full text-left text-xs text-muted-foreground hover:text-foreground py-0.5 transition-colors group"
									>
										<span className="flex items-center gap-1.5">
											<Smartphone className="h-3.5 w-3.5 text-primary" />
											<span className="font-medium">
												Connexion Mobile (Deep Links)
											</span>
											<span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
												14+ wallets supportés
											</span>
										</span>
										<ChevronDown
											className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${
												showMobileLinks ? "rotate-180" : ""
											}`}
										/>
									</button>

									{showMobileLinks && (
										<div className="mt-2.5 pt-2 border-t border-border/40 space-y-2">
											<p className="text-[11px] text-muted-foreground">
												Ouvrez Sigma Finance directement dans le navigateur Web3
												de votre application mobile :
											</p>
											<div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
												{MOBILE_WALLETS.map((mw) => (
													<Button
														key={mw.id}
														type="button"
														variant="outline"
														size="sm"
														className="h-7 text-[11px] justify-start px-2 font-normal hover:border-primary/60 hover:bg-muted/30"
														onClick={() => openMobileWalletDapp(mw.id)}
														title={`Ouvrir dans l'application ${mw.name}`}
													>
														<span className="truncate">{mw.name}</span>
														<ExternalLink className="h-2.5 w-2.5 ml-auto text-muted-foreground opacity-60" />
													</Button>
												))}
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Unified Form */}
							<form
								onSubmit={handleSubmitMultiChain}
								className="space-y-3 pt-1"
							>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
									<div className="sm:col-span-2 space-y-1">
										<Label htmlFor="multi-name" className="text-xs">
											Nom de l'appareil / Wallet
										</Label>
										<Input
											id="multi-name"
											value={multiName}
											onChange={(e) => setMultiName(e.target.value)}
											className="h-8 text-xs"
											placeholder="ex: Phantom Wallet, Trust Wallet, Ledger Nano X"
										/>
									</div>
									<div className="space-y-1">
										<Label
											htmlFor="multi-dev-type"
											className="text-xs font-medium text-foreground"
										>
											Type de garde
										</Label>
										<Select
											value={multiDeviceType}
											onValueChange={(v) =>
												setMultiDeviceType(v as WalletDeviceType)
											}
										>
											<SelectTrigger
												id="multi-dev-type"
												className="h-8 text-xs bg-background"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem
													value={WalletDeviceType.Software}
													className="text-xs"
												>
													Software (Hot Wallet / App)
												</SelectItem>
												<SelectItem
													value={WalletDeviceType.Hardware}
													className="text-xs"
												>
													Hardware (Cold Storage)
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								{/* EVM Section */}
								<div className="rounded-xl border border-border/70 bg-card p-3 space-y-2.5 shadow-2xs">
									<div className="flex items-center justify-between">
										<Label
											htmlFor="multi-evm"
											className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
										>
											<EthIcon className="h-3.5 w-3.5 text-primary" />
											<span>Adresse EVM (0x...)</span>
										</Label>
										{Boolean(toSafeAddressString(multiEvmAddress)) && (
											<span
												className={`text-[10px] flex items-center gap-1 ${evmValidation.isValid ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive"}`}
											>
												{evmValidation.isValid && (
													<CheckCircle2 className="h-3 w-3" />
												)}
												{evmValidation.message}
											</span>
										)}
									</div>
									<Input
										id="multi-evm"
										placeholder="0x... ou coller l'adresse partagée EVM (Ethereum, Base, Polygon...)"
										value={toSafeAddressString(multiEvmAddress)}
										onChange={(e) => setMultiEvmAddress(e.target.value)}
										className="h-8 text-xs font-mono bg-background"
									/>

									{/* EVM Network Selection Chips */}
									<div className="space-y-1.5 pt-1">
										<div className="flex items-center justify-between">
											<span className="text-[11px] text-muted-foreground">
												Réseaux EVM synchronisés en parallèle :
											</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-5 text-[10px] px-1.5 text-primary hover:bg-primary/5"
												onClick={() => {
													if (
														selectedEvmNetworks.length === EVM_NETWORKS.length
													) {
														setSelectedEvmNetworks([
															BlockchainNetwork.Ethereum,
														]);
													} else {
														setSelectedEvmNetworks(
															EVM_NETWORKS.map((n) => n.value),
														);
													}
												}}
											>
												{selectedEvmNetworks.length === EVM_NETWORKS.length
													? "Réinitialiser"
													: "Tout sélectionner"}
											</Button>
										</div>
										<div className="flex flex-wrap gap-1.5">
											{EVM_NETWORKS.map((net) => {
												const isSelected = selectedEvmNetworks.includes(
													net.value,
												);
												return (
													<button
														key={net.value}
														type="button"
														onClick={() => {
															if (isSelected) {
																if (selectedEvmNetworks.length > 1) {
																	setSelectedEvmNetworks(
																		selectedEvmNetworks.filter(
																			(n) => n !== net.value,
																		),
																	);
																}
															} else {
																setSelectedEvmNetworks([
																	...selectedEvmNetworks,
																	net.value,
																]);
															}
														}}
														className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
															isSelected
																? "bg-primary/10 border-primary/40 text-foreground"
																: "bg-background border-border/60 text-muted-foreground hover:bg-muted/40"
														}`}
													>
														<span
															className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary" : "bg-muted-foreground/40"}`}
														/>
														<span>{net.label}</span>
													</button>
												);
											})}
										</div>
									</div>
								</div>

								{/* Solana Section */}
								<div className="rounded-xl border border-border/70 bg-card p-3 space-y-2 shadow-2xs">
									<div className="flex items-center justify-between">
										<Label
											htmlFor="multi-solana"
											className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
										>
											<SolanaIcon className="h-3.5 w-3.5 text-purple-400" />
											<span>Adresse Solana (Optionnel)</span>
										</Label>
										{Boolean(toSafeAddressString(multiSolanaAddress)) && (
											<span
												className={`text-[10px] flex items-center gap-1 ${solanaValidation.isValid ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive"}`}
											>
												{solanaValidation.isValid && (
													<CheckCircle2 className="h-3 w-3" />
												)}
												{solanaValidation.message}
											</span>
										)}
									</div>
									<Input
										id="multi-solana"
										placeholder="Clé publique Solana (base58, ex: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZz...)"
										value={toSafeAddressString(multiSolanaAddress)}
										onChange={(e) => setMultiSolanaAddress(e.target.value)}
										className="h-8 text-xs font-mono bg-background"
									/>
								</div>

								{/* Bitcoin Section */}
								<div className="rounded-xl border border-border/70 bg-card p-3 space-y-2 shadow-2xs">
									<div className="flex items-center justify-between">
										<Label
											htmlFor="multi-btc"
											className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
										>
											<BtcIcon className="h-3.5 w-3.5 text-amber-500" />
											<span>Adresse / xpub Bitcoin (Optionnel)</span>
										</Label>
										{Boolean(toSafeAddressString(multiBtcAddress)) && (
											<span
												className={`text-[10px] flex items-center gap-1 ${btcValidation.isValid ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive"}`}
											>
												{btcValidation.isValid && (
													<CheckCircle2 className="h-3 w-3" />
												)}
												{btcValidation.message}
											</span>
										)}
									</div>
									<Input
										id="multi-btc"
										placeholder="bc1q... (SegWit), bc1p... (Taproot) ou zpub..."
										value={toSafeAddressString(multiBtcAddress)}
										onChange={(e) => setMultiBtcAddress(e.target.value)}
										className="h-8 text-xs font-mono bg-background"
									/>
								</div>

								{/* Security Guarantee */}
								<div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2.5">
									<ShieldCheck className="h-4 w-4 text-primary shrink-0" />
									<span className="leading-relaxed">
										Lecture seule sécurisée. Sigma Finance ne stocke que vos
										adresses publiques pour calculer vos soldes. Aucune clé
										privée ni phrase de récupération n'est demandée.
									</span>
								</div>

								{/* Submit Footer */}
								<div className="flex items-center justify-end gap-2 pt-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleClose}
										className="text-xs h-8"
									>
										Annuler
									</Button>
									<Button
										type="submit"
										size="sm"
										disabled={!isMultiFormValid || addingMultiChain}
										className="gap-1.5 text-xs h-8 font-medium"
									>
										<Sparkles className="h-3.5 w-3.5" />
										{addingMultiChain
											? "Connexion en cours..."
											: "Ajouter le portefeuille multi-chaînes"}
									</Button>
								</div>
							</form>
						</TabsContent>

						{/* TAB 2: STANDALONE SINGLE ADDRESS */}
						<TabsContent value="standalone" className="space-y-4 pt-3">
							<form onSubmit={handleSubmitStandalone} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="portfolio">Target Portfolio</Label>
									<Select
										value={selectedPortfolio}
										onValueChange={setSelectedPortfolio}
									>
										<SelectTrigger id="portfolio">
											<SelectValue placeholder="Select target portfolio" />
										</SelectTrigger>
										<SelectContent>
											{portfolios.length > 0 ? (
												portfolios.map((p: { id: string; name: string }) => (
													<SelectItem key={p.id} value={p.id}>
														{p.name}
													</SelectItem>
												))
											) : (
												<SelectItem value="no-portfolio" disabled>
													No portfolio found
												</SelectItem>
											)}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="network">Blockchain Network</Label>
									<Select
										value={network}
										onValueChange={(v) => setNetwork(v as BlockchainNetwork)}
									>
										<SelectTrigger id="network">
											<SelectValue placeholder="Select network" />
										</SelectTrigger>
										<SelectContent>
											{SUPPORTED_NETWORKS.map((net) => (
												<SelectItem key={net.value} value={net.value}>
													<div className="flex items-center justify-between w-full gap-2">
														<span className="flex items-center gap-1.5">
															{net.iconNode} {net.label}
														</span>
														<span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
															{net.badge}
														</span>
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="address">
										{network === BlockchainNetwork.Bitcoin
											? "Address or Extended Public Key (xpub/zpub)"
											: "Public Address"}
									</Label>
									<Input
										id="address"
										placeholder={
											network === BlockchainNetwork.Bitcoin
												? "bc1q... or zpub..."
												: network === BlockchainNetwork.Solana
													? "9WzDXwBbmkg8ZTbNMqUxvQRAyrZz..."
													: "0x..."
										}
										value={address}
										onChange={(e) => setAddress(e.target.value)}
										className={
											address && !standaloneValidation.isValid
												? "border-destructive focus-visible:ring-destructive font-mono text-sm"
												: "font-mono text-sm"
										}
									/>
									{address && (
										<p
											className={`text-xs flex items-center gap-1 ${standaloneValidation.isValid ? "text-green-500" : "text-destructive"}`}
										>
											{standaloneValidation.isValid && (
												<CheckCircle2 className="h-3 w-3 inline" />
											)}
											{standaloneValidation.message}
										</p>
									)}
								</div>

								{standaloneValidation.isValid &&
									/^0x[a-fA-F0-9]{40}$/.test(address.trim()) && (
										<div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-3">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Checkbox
														id="multi-evm-toggle"
														checked={multiEvmEnabled}
														onCheckedChange={(c) => setMultiEvmEnabled(!!c)}
													/>
													<Label
														htmlFor="multi-evm-toggle"
														className="text-xs font-semibold cursor-pointer"
													>
														Multi-Network EVM Coverage (Recommended)
													</Label>
												</div>
												{multiEvmEnabled && (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-6 text-[11px] px-2"
														onClick={() => {
															if (
																selectedEvmNetworks.length ===
																EVM_NETWORKS.length
															) {
																setSelectedEvmNetworks([network]);
															} else {
																setSelectedEvmNetworks(
																	EVM_NETWORKS.map((n) => n.value),
																);
															}
														}}
													>
														{selectedEvmNetworks.length === EVM_NETWORKS.length
															? "Deselect All"
															: "Select All"}
													</Button>
												)}
											</div>

											{multiEvmEnabled && (
												<div className="space-y-2 pt-1">
													<p className="text-[11px] text-muted-foreground">
														One address tracks your holdings across all selected
														EVM chains in parallel.
													</p>
													<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
														{EVM_NETWORKS.map((net) => {
															const isSelected = selectedEvmNetworks.includes(
																net.value,
															);
															return (
																<div
																	key={net.value}
																	onClick={() => {
																		if (isSelected) {
																			if (selectedEvmNetworks.length > 1) {
																				setSelectedEvmNetworks(
																					selectedEvmNetworks.filter(
																						(n) => n !== net.value,
																					),
																				);
																			}
																		} else {
																			setSelectedEvmNetworks([
																				...selectedEvmNetworks,
																				net.value,
																			]);
																		}
																	}}
																	className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
																		isSelected
																			? "bg-primary/10 border-primary/40 font-medium"
																			: "bg-background border-border/60 text-muted-foreground"
																	}`}
																>
																	<Checkbox
																		checked={isSelected}
																		onCheckedChange={() => {}}
																		className="pointer-events-none"
																	/>
																	<span>{net.label}</span>
																</div>
															);
														})}
													</div>
												</div>
											)}
										</div>
									)}

								<div className="space-y-2">
									<Label htmlFor="label">Custom Label (Optional)</Label>
									<Input
										id="label"
										placeholder="e.g. Ledger Cold Storage, DeFi Hot Wallet"
										value={label}
										onChange={(e) => setLabel(e.target.value)}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="device-selector">
										Appareil / Conteneur Hardware (Optionnel)
									</Label>
									<Select
										value={isCreatingNewDevice ? "new" : selectedDeviceId}
										onValueChange={(val) => {
											if (val === "new") {
												setIsCreatingNewDevice(true);
											} else {
												setIsCreatingNewDevice(false);
												setSelectedDeviceId(val);
											}
										}}
									>
										<SelectTrigger id="device-selector">
											<SelectValue placeholder="Aucun (Hot Wallet indépendant)" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">
												<span className="flex items-center gap-1.5">
													Aucun (Hot Wallet / Software)
												</span>
											</SelectItem>
											{devicesData?.walletDevices?.map(
												(dev: {
													id: string;
													name: string;
													deviceType: string;
												}) => (
													<SelectItem key={dev.id} value={dev.id}>
														<div className="flex items-center justify-between w-full gap-2">
															<span className="flex items-center gap-1.5">
																{dev.deviceType === "HARDWARE" ? (
																	<HardDrive className="h-3.5 w-3.5 text-primary" />
																) : (
																	<Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
																)}
																{dev.name}
															</span>
															<span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
																{dev.deviceType}
															</span>
														</div>
													</SelectItem>
												),
											)}
											<SelectItem value="new">
												<span className="text-primary font-medium flex items-center gap-1.5">
													+ Nouveau Hardware Device...
												</span>
											</SelectItem>
										</SelectContent>
									</Select>

									{isCreatingNewDevice && (
										<div className="p-3 bg-muted/40 rounded-lg border border-border/70 space-y-3 mt-2">
											<div className="space-y-1">
												<Label htmlFor="new-dev-name" className="text-xs">
													Nom de l'appareil (ex: Cypherock, Ledger Nano X)
												</Label>
												<Input
													id="new-dev-name"
													placeholder="ex: Cypherock, Ledger Nano X"
													value={newDeviceName}
													onChange={(e) => setNewDeviceName(e.target.value)}
													className="text-sm h-8"
													autoFocus
												/>
											</div>
											<div className="space-y-1">
												<Label htmlFor="new-dev-type" className="text-xs">
													Type d'appareil
												</Label>
												<Select
													value={newDeviceType}
													onValueChange={(v) =>
														setNewDeviceType(v as WalletDeviceType)
													}
												>
													<SelectTrigger
														id="new-dev-type"
														className="h-8 text-xs"
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value={WalletDeviceType.Hardware}>
															Hardware Wallet (Cold Storage)
														</SelectItem>
														<SelectItem value={WalletDeviceType.Software}>
															Software App (Phantom, Rabby)
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
									)}
								</div>

								<DialogFooter className="pt-2">
									<Button type="button" variant="outline" onClick={handleClose}>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={!standaloneValidation.isValid || addingAccount}
									>
										{addingAccount ? "Connecting..." : "Add Wallet"}
									</Button>
								</DialogFooter>
							</form>
						</TabsContent>

						{/* TAB 3: DEVICE CONTAINERS MANAGEMENT */}
						<TabsContent value="device" className="space-y-4 pt-3">
							<form onSubmit={handleCreateDevice} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="deviceName">
										Device / Hardware Container Name
									</Label>
									<Input
										id="deviceName"
										placeholder="e.g. Ledger Nano X, Trezor Model T, Phantom Multi-Chain"
										value={deviceName}
										onChange={(e) => setDeviceName(e.target.value)}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="deviceType">Container Type</Label>
									<Select
										value={deviceType}
										onValueChange={(v) => setDeviceType(v as WalletDeviceType)}
									>
										<SelectTrigger id="deviceType">
											<SelectValue placeholder="Select type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={WalletDeviceType.Hardware}>
												Hardware Wallet (Ledger, Trezor, Keystone)
											</SelectItem>
											<SelectItem value={WalletDeviceType.Software}>
												Software App (Phantom, MetaMask, Rabby)
											</SelectItem>
											<SelectItem value={WalletDeviceType.Standalone}>
												Standalone Key Set
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="border rounded-md p-3 space-y-2">
									<h4 className="text-xs font-medium text-foreground">
										Registered Devices
									</h4>
									{devicesData?.walletDevices?.length ? (
										<ul className="space-y-1.5 text-xs text-muted-foreground">
											{devicesData.walletDevices.map(
												(d: {
													id: string;
													name: string;
													deviceType: string;
													accounts: unknown[];
												}) => (
													<li
														key={d.id}
														className="flex items-center justify-between bg-muted/40 px-2 py-1.5 rounded"
													>
														<span className="font-medium text-foreground">
															{d.name}
														</span>
														<span className="text-[11px] bg-background px-1.5 py-0.5 rounded border">
															{d.deviceType} • {d.accounts?.length || 0}{" "}
															addresses
														</span>
													</li>
												),
											)}
										</ul>
									) : (
										<p className="text-xs text-muted-foreground italic">
											No multi-chain devices configured yet.
										</p>
									)}
								</div>

								<DialogFooter className="pt-2">
									<Button
										type="button"
										variant="outline"
										onClick={handleClose}
										className="h-8 text-xs"
									>
										Close
									</Button>
									<Button
										type="submit"
										disabled={!deviceName.trim() || creatingDevice}
										className="h-8 text-xs font-medium"
									>
										{creatingDevice ? "Creating..." : "Create Device Container"}
									</Button>
								</DialogFooter>
							</form>
						</TabsContent>
					</Tabs>
				</div>
			</DialogContent>

			{/* Sub-Modal: WalletConnect QR Code */}
			<Dialog
				open={showWalletConnectModal}
				onOpenChange={setShowWalletConnectModal}
			>
				<DialogContent className="sm:max-w-[420px] text-center p-6 border border-border/80 shadow-xl">
					<DialogHeader>
						<div className="flex items-center justify-center gap-2 mb-1">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
								<Smartphone className="h-4 w-4" />
							</div>
							<DialogTitle className="text-base font-semibold">
								Scanner avec votre Wallet Mobile
							</DialogTitle>
						</div>
						<DialogDescription className="text-xs text-muted-foreground">
							Ouvrez Trust Wallet, Phantom, Rainbow ou MetaMask sur votre
							smartphone et scannez ce QR Code.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl border border-border/60 my-2">
						<img
							src={getQRCodeUrl(wcUri || "https://walletconnect.com")}
							alt="WalletConnect QR Code"
							className="w-44 h-44 rounded-lg bg-white p-2 border shadow-xs"
						/>
						<p className="text-[11px] text-muted-foreground mt-2.5">
							Scannez avec votre smartphone ou ouvrez directement votre wallet
							ci-dessous
						</p>
					</div>

					<div className="space-y-3">
						<div className="flex items-center gap-2 justify-center">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 text-xs gap-1.5"
								onClick={() => {
									if (wcUri) {
										navigator.clipboard.writeText(wcUri);
										setCopiedWcUri(true);
										toast.success(
											"URI WalletConnect copié dans le presse-papiers",
										);
										setTimeout(() => setCopiedWcUri(false), 2000);
									}
								}}
							>
								{copiedWcUri ? (
									<Check className="h-3.5 w-3.5 text-emerald-500" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
								<span>Copier l'URI</span>
							</Button>

							<Button
								type="button"
								variant="secondary"
								size="sm"
								className="h-8 text-xs gap-1.5"
								onClick={() => {
									if (wcUri) {
										window.location.href = getUniversalWcDeepLink(wcUri);
									}
								}}
							>
								<Smartphone className="h-3.5 w-3.5 text-primary" />
								<span>App par défaut (Universel)</span>
							</Button>
						</div>

						{/* 1-Tap Mobile Wallet Buttons */}
						<div className="text-left pt-1">
							<Label className="text-[11px] text-muted-foreground mb-1.5 block font-medium">
								Ouvrir directement dans votre application installée :
							</Label>
							<div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
								{MOBILE_WALLETS.filter((w) => w.getWcUrl).map((mw) => (
									<Button
										key={mw.id}
										type="button"
										variant="outline"
										size="sm"
										className="h-7 text-[11px] justify-start px-2 font-normal hover:border-primary"
										onClick={() => openMobileWalletWc(mw, wcUri)}
										title={`Ouvrir avec ${mw.name}`}
									>
										<span className="truncate">{mw.name}</span>
									</Button>
								))}
							</div>
						</div>
					</div>

					<DialogFooter className="pt-2 sm:justify-center">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setShowWalletConnectModal(false)}
							className="text-xs h-8"
						>
							Fermer
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Dialog>
	);
}
