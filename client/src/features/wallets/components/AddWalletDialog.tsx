import { useMutation, useQuery } from "@apollo/client";
import { CheckCircle2, Cpu, HardDrive, Layers, ShieldCheck, Wallet } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
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
import { usePortfolio } from "@/components/PortfolioProvider";
import {
	ADD_MULTI_NETWORK_WALLET,
	ADD_WALLET_ACCOUNT,
	CREATE_WALLET_DEVICE,
} from "@/graphql/mutations/wallets";
import {
	GET_WALLET_ACCOUNTS,
	GET_WALLET_DEVICES,
} from "@/graphql/queries/wallets";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { BlockchainNetwork, WalletDeviceType } from "@/gql/graphql";

interface AddWalletDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioId?: string;
	onSuccess?: () => void;
}

const SUPPORTED_NETWORKS = [
	{ value: BlockchainNetwork.Ethereum, label: "Ethereum", icon: "💎", badge: "EVM" },
	{ value: BlockchainNetwork.Base, label: "Base", icon: "🔵", badge: "EVM L2" },
	{ value: BlockchainNetwork.Arbitrum, label: "Arbitrum One", icon: "🔷", badge: "EVM L2" },
	{ value: BlockchainNetwork.Optimism, label: "Optimism", icon: "🔴", badge: "EVM L2" },
	{ value: BlockchainNetwork.Polygon, label: "Polygon PoS", icon: "🟣", badge: "EVM Sidechain" },
	{ value: BlockchainNetwork.Solana, label: "Solana", icon: "🟣", badge: "SVM" },
	{ value: BlockchainNetwork.Bitcoin, label: "Bitcoin", icon: "₿", badge: "UTXO" },
];

const EVM_NETWORKS = [
	{ value: BlockchainNetwork.Ethereum, label: "Ethereum", icon: "💎", badge: "EVM" },
	{ value: BlockchainNetwork.Base, label: "Base", icon: "🔵", badge: "EVM L2" },
	{ value: BlockchainNetwork.Arbitrum, label: "Arbitrum One", icon: "🔷", badge: "EVM L2" },
	{ value: BlockchainNetwork.Optimism, label: "Optimism", icon: "🔴", badge: "EVM L2" },
	{ value: BlockchainNetwork.Polygon, label: "Polygon PoS", icon: "🟣", badge: "Sidechain" },
];

export function AddWalletDialog({
	open,
	onOpenChange,
	portfolioId: propPortfolioId,
	onSuccess,
}: AddWalletDialogProps) {
	const { currentPortfolio, portfolios: contextPortfolios, data: portfolioData } = usePortfolio();
	const activePortfolioId = propPortfolioId || currentPortfolio;

	const portfolios = useMemo(() => {
		if (Array.isArray(contextPortfolios) && contextPortfolios.length > 0) {
			return contextPortfolios;
		}
		if (Array.isArray(portfolioData?.portfolios) && portfolioData.portfolios.length > 0) {
			return portfolioData.portfolios;
		}
		if (activePortfolioId) {
			return [{ id: activePortfolioId, name: "Current Portfolio" }];
		}
		return [];
	}, [contextPortfolios, portfolioData, activePortfolioId]);

	const [activeTab, setActiveTab] = useState<"standalone" | "device">("standalone");
	const [network, setNetwork] = useState<BlockchainNetwork>(BlockchainNetwork.Ethereum);
	const [address, setAddress] = useState("");
	const [label, setLabel] = useState("");
	const [selectedPortfolio, setSelectedPortfolio] = useState(
		activePortfolioId || (portfolios.length > 0 ? portfolios[0].id : ""),
	);

	useEffect(() => {
		if (propPortfolioId) {
			setSelectedPortfolio(propPortfolioId);
		} else if (currentPortfolio) {
			setSelectedPortfolio(currentPortfolio);
		} else if (portfolios.length > 0 && !selectedPortfolio) {
			setSelectedPortfolio(portfolios[0].id);
		}
	}, [propPortfolioId, currentPortfolio, portfolios, selectedPortfolio]);

	// Multi-chain device state
	const [deviceName, setDeviceName] = useState("");
	const [deviceType, setDeviceType] = useState<WalletDeviceType>(WalletDeviceType.Hardware);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>("none");
	const [isCreatingNewDevice, setIsCreatingNewDevice] = useState(false);
	const [newDeviceName, setNewDeviceName] = useState("");
	const [newDeviceType, setNewDeviceType] = useState<WalletDeviceType>(WalletDeviceType.Hardware);

	// Multi-EVM state
	const [multiEvmEnabled, setMultiEvmEnabled] = useState(true);
	const [selectedEvmNetworks, setSelectedEvmNetworks] = useState<BlockchainNetwork[]>([
		BlockchainNetwork.Ethereum,
		BlockchainNetwork.Base,
		BlockchainNetwork.Arbitrum,
		BlockchainNetwork.Optimism,
		BlockchainNetwork.Polygon,
	]);

	const { data: devicesData } = useQuery(GET_WALLET_DEVICES, {
		skip: !open,
	});

	const [addWalletAccount, { loading: addingAccount }] = useMutation(ADD_WALLET_ACCOUNT, {
		refetchQueries: [
			"GetWalletAccounts",
			"GetWalletDevices",
			"GetAccounts",
			"GetPortfolio",
		],
		onCompleted: () => {
			toast.success("Crypto wallet connected successfully! Syncing token holdings...");
			handleClose();
			onSuccess?.();
		},
		onError: (err) => {
			toast.error(`Failed to connect wallet: ${err.message}`);
		},
	});

	const [addMultiNetworkWallet, { loading: addingMulti }] = useMutation(ADD_MULTI_NETWORK_WALLET, {
		refetchQueries: [
			"GetWalletAccounts",
			"GetWalletDevices",
			"GetAccounts",
			"GetPortfolio",
		],
		onCompleted: (res) => {
			const count = res.addMultiNetworkWallet?.length || 0;
			toast.success(`Connected across ${count} EVM networks! Syncing token holdings...`);
			handleClose();
			onSuccess?.();
		},
		onError: (err) => {
			toast.error(`Failed to connect multi-network wallet: ${err.message}`);
		},
	});

	const [createWalletDevice, { loading: creatingDevice }] = useMutation(CREATE_WALLET_DEVICE, {
		refetchQueries: [{ query: GET_WALLET_DEVICES }],
		onCompleted: (res) => {
			toast.success(`Created container for ${res.createWalletDevice.name}`);
			setDeviceName("");
		},
		onError: (err) => {
			toast.error(`Failed to create device container: ${err.message}`);
		},
	});

	const validation = useMemo(() => {
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
					message: isHex ? "Valid EVM address" : "Must be a 42-character hex address starting with 0x",
					isXpub: false,
				};
			}
			case BlockchainNetwork.Solana: {
				const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
				return {
					isValid: isBase58,
					message: isBase58 ? "Valid Solana address" : "Must be a base58 Solana public key (32-44 characters)",
					isXpub: false,
				};
			}
			case BlockchainNetwork.Bitcoin: {
				const isXpub = /^(xpub|ypub|zpub)[a-zA-HJ-NP-Z0-9]{100,115}$/.test(trimmed);
				const isAddr = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed);
				if (isXpub) {
					return { isValid: true, message: "Valid Bitcoin extended public key (xpub/ypub/zpub)", isXpub: true };
				}
				if (isAddr) {
					return { isValid: true, message: "Valid Bitcoin address (P2PKH, P2SH, or Bech32)", isXpub: false };
				}
				return {
					isValid: false,
					message: "Must be a valid Bitcoin address (bc1/1/3) or xpub/zpub descriptor",
					isXpub: false,
				};
			}
			default:
				return { isValid: false, message: "Unsupported network", isXpub: false };
		}
	}, [address, network]);

	const handleClose = () => {
		setAddress("");
		setLabel("");
		setSelectedDeviceId("none");
		setIsCreatingNewDevice(false);
		setNewDeviceName("");
		onOpenChange(false);
	};

	const handleSubmitStandalone = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validation.isValid) {
			toast.error(validation.message || "Please enter a valid blockchain address");
			return;
		}

		if (!selectedPortfolio) {
			toast.error("Please select a target portfolio");
			return;
		}

		let finalDeviceId: string | undefined = undefined;
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
						deviceName: isCreatingNewDevice ? newDeviceName.trim() : (finalDeviceId ? undefined : (label.trim() || "EVM Multi-Chain")),
						deviceType: isCreatingNewDevice ? newDeviceType : WalletDeviceType.Software,
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
					isXpub: validation.isXpub,
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[560px]">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<Wallet className="h-5 w-5 text-primary" />
						<DialogTitle>Connect Crypto Wallet</DialogTitle>
					</div>
					<DialogDescription>
						Import public addresses or xpubs with €0/month zero-cost live sync across EVM, Solana, and Bitcoin.
					</DialogDescription>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "standalone" | "device")} className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="standalone" className="flex items-center gap-1.5">
							<Wallet className="h-4 w-4" />
							<span>Single Address</span>
						</TabsTrigger>
						<TabsTrigger value="device" className="flex items-center gap-1.5">
							<HardDrive className="h-4 w-4" />
							<span>Multi-Chain Device</span>
						</TabsTrigger>
					</TabsList>

					<TabsContent value="standalone" className="space-y-4 pt-3">
						<form onSubmit={handleSubmitStandalone} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="portfolio">Target Portfolio</Label>
								<Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
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
											<SelectItem value="" disabled>
												No portfolio found
											</SelectItem>
										)}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="network">Blockchain Network</Label>
								<Select value={network} onValueChange={(v) => setNetwork(v as BlockchainNetwork)}>
									<SelectTrigger id="network">
										<SelectValue placeholder="Select network" />
									</SelectTrigger>
									<SelectContent>
										{SUPPORTED_NETWORKS.map((net) => (
											<SelectItem key={net.value} value={net.value}>
												<div className="flex items-center justify-between w-full gap-2">
													<span>
														{net.icon} {net.label}
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
									{network === BlockchainNetwork.Bitcoin ? "Address or Extended Public Key (xpub/zpub)" : "Public Address"}
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
										address && !validation.isValid
											? "border-destructive focus-visible:ring-destructive font-mono text-sm"
											: "font-mono text-sm"
									}
								/>
								{address && (
									<p className={`text-xs flex items-center gap-1 ${validation.isValid ? "text-green-500" : "text-destructive"}`}>
										{validation.isValid && <CheckCircle2 className="h-3 w-3 inline" />}
										{validation.message}
									</p>
								)}
							</div>

							{validation.isValid && /^0x[a-fA-F0-9]{40}$/.test(address.trim()) && (
								<div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-3">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Checkbox
												id="multi-evm-toggle"
												checked={multiEvmEnabled}
												onCheckedChange={(c) => setMultiEvmEnabled(!!c)}
											/>
											<Label htmlFor="multi-evm-toggle" className="text-xs font-semibold cursor-pointer">
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
													if (selectedEvmNetworks.length === EVM_NETWORKS.length) {
														setSelectedEvmNetworks([network]);
													} else {
														setSelectedEvmNetworks(EVM_NETWORKS.map((n) => n.value));
													}
												}}
											>
												{selectedEvmNetworks.length === EVM_NETWORKS.length ? "Deselect All" : "Select All"}
											</Button>
										)}
									</div>

									{multiEvmEnabled && (
										<div className="space-y-2 pt-1">
											<p className="text-[11px] text-muted-foreground">
												One address tracks your holdings across all selected EVM chains in parallel.
											</p>
											<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
												{EVM_NETWORKS.map((net) => {
													const isSelected = selectedEvmNetworks.includes(net.value);
													return (
														<div
															key={net.value}
															onClick={() => {
																if (isSelected) {
																	if (selectedEvmNetworks.length > 1) {
																		setSelectedEvmNetworks(selectedEvmNetworks.filter((n) => n !== net.value));
																	}
																} else {
																	setSelectedEvmNetworks([...selectedEvmNetworks, net.value]);
																}
															}}
															className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
																isSelected ? "bg-primary/10 border-primary/40 font-medium" : "bg-background border-border/60 text-muted-foreground"
															}`}
														>
															<Checkbox
																checked={isSelected}
																onCheckedChange={() => {}}
																className="pointer-events-none"
															/>
															<span>{net.icon} {net.label}</span>
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
								<Label htmlFor="device-selector">Appareil / Conteneur Hardware (Optionnel)</Label>
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
												🌐 Aucun (Hot Wallet / Software)
											</span>
										</SelectItem>
										{devicesData?.walletDevices?.map((dev: { id: string; name: string; deviceType: string }) => (
											<SelectItem key={dev.id} value={dev.id}>
												<div className="flex items-center justify-between w-full gap-2">
													<span>
														{dev.deviceType === "HARDWARE" ? "🛡️ " : "📱 "}
														{dev.name}
													</span>
													<span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
														{dev.deviceType}
													</span>
												</div>
											</SelectItem>
										))}
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
											<Label htmlFor="new-dev-name" className="text-xs">Nom de l'appareil (ex: Cypherock, Ledger Nano X)</Label>
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
											<Label htmlFor="new-dev-type" className="text-xs">Type d'appareil</Label>
											<Select value={newDeviceType} onValueChange={(v) => setNewDeviceType(v as WalletDeviceType)}>
												<SelectTrigger id="new-dev-type" className="h-8 text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={WalletDeviceType.Hardware}>🛡️ Hardware Wallet (Cold Storage)</SelectItem>
													<SelectItem value={WalletDeviceType.Software}>📱 Software App (Phantom, Rabby)</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
								)}
							</div>

							<div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
								<ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
								<span>
									Read-only public synchronization. Sigma Finance never requests private keys or seed phrases.
								</span>
							</div>

							<DialogFooter className="pt-2">
								<Button type="button" variant="outline" onClick={handleClose}>
									Cancel
								</Button>
								<Button type="submit" disabled={!validation.isValid || addingAccount}>
									{addingAccount ? "Connecting..." : "Add Wallet"}
								</Button>
							</DialogFooter>
						</form>
					</TabsContent>

					<TabsContent value="device" className="space-y-4 pt-3">
						<form onSubmit={handleCreateDevice} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="deviceName">Device / Hardware Container Name</Label>
								<Input
									id="deviceName"
									placeholder="e.g. Ledger Nano X, Trezor Model T, Phantom Multi-Chain"
									value={deviceName}
									onChange={(e) => setDeviceName(e.target.value)}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="deviceType">Container Type</Label>
								<Select value={deviceType} onValueChange={(v) => setDeviceType(v as WalletDeviceType)}>
									<SelectTrigger id="deviceType">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={WalletDeviceType.Hardware}>Hardware Wallet (Ledger, Trezor, Keystone)</SelectItem>
										<SelectItem value={WalletDeviceType.Software}>Software App (Phantom, MetaMask, Rabby)</SelectItem>
										<SelectItem value={WalletDeviceType.Standalone}>Standalone Key Set</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="border rounded-md p-3 space-y-2">
								<h4 className="text-xs font-medium text-foreground">Registered Devices</h4>
								{devicesData?.walletDevices?.length ? (
									<ul className="space-y-1.5 text-xs text-muted-foreground">
										{devicesData.walletDevices.map((d: { id: string; name: string; deviceType: string; accounts: unknown[] }) => (
											<li key={d.id} className="flex items-center justify-between bg-muted/40 px-2 py-1.5 rounded">
												<span className="font-medium text-foreground">{d.name}</span>
												<span className="text-[11px] bg-background px-1.5 py-0.5 rounded border">
													{d.deviceType} • {d.accounts?.length || 0} addresses
												</span>
											</li>
										))}
									</ul>
								) : (
									<p className="text-xs text-muted-foreground italic">No multi-chain devices configured yet.</p>
								)}
							</div>

							<DialogFooter className="pt-2">
								<Button type="button" variant="outline" onClick={handleClose}>
									Close
								</Button>
								<Button type="submit" disabled={!deviceName.trim() || creatingDevice}>
									{creatingDevice ? "Creating..." : "Create Device Container"}
								</Button>
							</DialogFooter>
						</form>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
