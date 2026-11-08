import { useEffect, useState } from "react";

export interface EIP6963ProviderInfo {
	uuid: string;
	name: string;
	icon: string;
	rdns: string;
}

export interface EIP6963ProviderDetail {
	info: EIP6963ProviderInfo;
	provider: any;
}

export interface DetectedWallet {
	id: string;
	name: string;
	icon?: string;
	type: "evm" | "solana" | "bitcoin" | "multichain";
	provider: any;
}

export function useWeb3WalletDetection() {
	const [evmProviders, setEvmProviders] = useState<EIP6963ProviderDetail[]>([]);
	const [solanaProviders, setSolanaProviders] = useState<{ id: string; name: string; icon?: string; provider: any }[]>([]);
	const [bitcoinProviders, setBitcoinProviders] = useState<{ id: string; name: string; icon?: string; provider: any }[]>([]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		// 1. EIP-6963 discovery for modern EVM wallets
		const detected = new Map<string, EIP6963ProviderDetail>();

		const handleAnnounce = (event: any) => {
			if (!event.detail || !event.detail.info) return;
			const { info, provider } = event.detail;
			detected.set(info.uuid, { info, provider });
			setEvmProviders(Array.from(detected.values()));
		};

		window.addEventListener("eip6963:announceProvider" as any, handleAnnounce);
		window.dispatchEvent(new Event("eip6963:requestProvider"));

		// Legacy fallback if no EIP-6963 provider is announced within 200ms
		const timeoutId = setTimeout(() => {
			if (detected.size === 0 && (window as any).ethereum) {
				const eth = (window as any).ethereum;
				let name = "Injected Web3 Wallet";
				if (eth.isRabby) name = "Rabby Wallet";
				else if (eth.isMetaMask) name = "MetaMask";
				else if (eth.isTrust) name = "Trust Wallet";
				else if (eth.isCoinbaseWallet) name = "Coinbase Wallet";
				else if (eth.isOKExWallet || eth.isOkxWallet) name = "OKX Wallet";
				else if (eth.isBitKeep || eth.isBitget) name = "Bitget Wallet";
				else if (eth.isBraveWallet) name = "Brave Wallet";
				else if (eth.isOneInch) name = "1inch Wallet";
				else if (eth.isPhantom) name = "Phantom EVM";

				detected.set("injected-ethereum", {
					info: {
						uuid: "injected-ethereum",
						name,
						icon: "",
						rdns: "io.injected",
					},
					provider: eth,
				});
				setEvmProviders(Array.from(detected.values()));
			}
		}, 300);

		// 2. Solana Wallet Detection (Phantom, Solflare, Backpack, OKX, Trust, Coinbase, Magic Eden, Glow, Brave)
		const solWallets: { id: string; name: string; icon?: string; provider: any }[] = [];
		const win = window as any;
		if (win.phantom?.solana?.isPhantom) {
			solWallets.push({ id: "phantom-solana", name: "Phantom", provider: win.phantom.solana });
		} else if (win.solana?.isPhantom) {
			solWallets.push({ id: "phantom-solana", name: "Phantom", provider: win.solana });
		}

		if (win.solflare?.isSolflare) {
			solWallets.push({ id: "solflare", name: "Solflare", provider: win.solflare });
		}
		if (win.backpack?.isBackpack) {
			solWallets.push({ id: "backpack", name: "Backpack", provider: win.backpack });
		}
		if (win.okxwallet?.solana) {
			solWallets.push({ id: "okx-solana", name: "OKX Wallet (Solana)", provider: win.okxwallet.solana });
		}
		if (win.trustwallet?.solana) {
			solWallets.push({ id: "trust-solana", name: "Trust Wallet (Solana)", provider: win.trustwallet.solana });
		}
		if (win.coinbaseSolana) {
			solWallets.push({ id: "coinbase-solana", name: "Coinbase (Solana)", provider: win.coinbaseSolana });
		}
		if (win.magicEden?.solana) {
			solWallets.push({ id: "magiceden-solana", name: "Magic Eden (Solana)", provider: win.magicEden.solana });
		}
		if (win.glowSolana || win.glow?.solana) {
			solWallets.push({ id: "glow-solana", name: "Glow", provider: win.glowSolana || win.glow?.solana });
		}
		if (win.braveSolana) {
			solWallets.push({ id: "brave-solana", name: "Brave (Solana)", provider: win.braveSolana });
		}
		setSolanaProviders(solWallets);

		// 3. Bitcoin Wallet Detection (UniSat, Xverse, OKX, Phantom, Leather, Magic Eden, Bitget, Wizz)
		const btcWallets: { id: string; name: string; icon?: string; provider: any }[] = [];
		if (win.unisat) {
			btcWallets.push({ id: "unisat", name: "UniSat", provider: win.unisat });
		}
		if (win.XverseProviders?.BitcoinProvider || win.BitcoinProvider) {
			btcWallets.push({
				id: "xverse",
				name: "Xverse",
				provider: win.XverseProviders?.BitcoinProvider || win.BitcoinProvider,
			});
		}
		if (win.okxwallet?.bitcoin) {
			btcWallets.push({ id: "okx-bitcoin", name: "OKX Wallet (Bitcoin)", provider: win.okxwallet.bitcoin });
		}
		if (win.phantom?.bitcoin) {
			btcWallets.push({ id: "phantom-bitcoin", name: "Phantom (Bitcoin)", provider: win.phantom.bitcoin });
		}
		if (win.LeatherProvider || win.HiroWalletProvider) {
			btcWallets.push({
				id: "leather",
				name: "Leather / Hiro",
				provider: win.LeatherProvider || win.HiroWalletProvider,
			});
		}
		if (win.magicEden?.bitcoin) {
			btcWallets.push({ id: "magiceden-bitcoin", name: "Magic Eden (Bitcoin)", provider: win.magicEden.bitcoin });
		}
		if (win.bitkeep?.bitcoin || win.bitget?.bitcoin) {
			btcWallets.push({
				id: "bitget-bitcoin",
				name: "Bitget (Bitcoin)",
				provider: win.bitkeep?.bitcoin || win.bitget?.bitcoin,
			});
		}
		if (win.wizz) {
			btcWallets.push({ id: "wizz", name: "Wizz Wallet", provider: win.wizz });
		}
		setBitcoinProviders(btcWallets);

		return () => {
			window.removeEventListener("eip6963:announceProvider" as any, handleAnnounce);
			clearTimeout(timeoutId);
		};
	}, []);

	// Helper to safely extract address string from various provider return formats
	const parseAddressString = (item: any): string => {
		if (!item) return "";
		if (typeof item === "string") return item;
		if (typeof item.address === "string") return item.address;
		if (typeof item.publicKey === "string") return item.publicKey;
		return "";
	};

	// Connection helper for EVM
	const connectEvm = async (provider: any): Promise<string | null> => {
		try {
			const accounts = await provider.request({ method: "eth_requestAccounts" });
			if (Array.isArray(accounts) && accounts.length > 0) {
				const addr = parseAddressString(accounts[0]);
				return addr || null;
			}
			return null;
		} catch (err) {
			console.warn("[Web3Detection] EVM connect error:", err);
			throw err;
		}
	};

	// Connection helper for Solana
	const connectSolana = async (provider: any): Promise<string | null> => {
		try {
			const resp = await provider.connect();
			if (resp?.publicKey) {
				return resp.publicKey.toString();
			}
			if (provider.publicKey) {
				return provider.publicKey.toString();
			}
			return null;
		} catch (err) {
			console.warn("[Web3Detection] Solana connect error:", err);
			throw err;
		}
	};

	// Connection helper for Bitcoin
	const connectBitcoin = async (provider: any): Promise<{ segwit?: string; taproot?: string; address: string } | null> => {
		try {
			if (typeof provider.requestAccounts === "function") {
				const accounts = await provider.requestAccounts();
				if (Array.isArray(accounts) && accounts.length > 0) {
					const addr = parseAddressString(accounts[0]);
					if (addr) return { address: addr };
				}
			}
			if (typeof provider.connect === "function") {
				const res = await provider.connect();
				const directAddr = parseAddressString(res);
				if (directAddr) return { address: directAddr };
				if (Array.isArray(res?.accounts) && res.accounts.length > 0) {
					const addr = parseAddressString(res.accounts[0]);
					if (addr) return { address: addr };
				}
			}
			if (typeof provider.request === "function") {
				try {
					const res = await provider.request("getAccounts", {
						purposes: ["payment", "ordinals"],
					});
					if (res?.result && Array.isArray(res.result)) {
						let segwit: string | undefined;
						let taproot: string | undefined;
						for (const item of res.result) {
							const parsed = parseAddressString(item);
							if (item.purpose === "payment") segwit = parsed;
							if (item.purpose === "ordinals") taproot = parsed;
						}
						const finalAddr = segwit || taproot || parseAddressString(res.result[0]);
						if (finalAddr) {
							return {
								segwit,
								taproot,
								address: finalAddr,
							};
						}
					}
				} catch {
					// Fallback for Leather or Hiro getAddresses
					const res = await provider.request("getAddresses");
					if (res?.result?.addresses && Array.isArray(res.result.addresses)) {
						const addr = parseAddressString(res.result.addresses[0]);
						if (addr) return { address: addr };
					}
				}
			}
			if (typeof provider.getAccounts === "function") {
				const accounts = await provider.getAccounts();
				if (Array.isArray(accounts) && accounts.length > 0) {
					const addr = parseAddressString(accounts[0]);
					if (addr) return { address: addr };
				}
			}
			return null;
		} catch (err) {
			console.warn("[Web3Detection] Bitcoin connect error:", err);
			throw err;
		}
	};

	// All-in-one helper for Phantom (EVM + Solana + Bitcoin)
	const connectPhantomAll = async (): Promise<{ evm?: string; solana?: string; bitcoin?: string }> => {
		const result: { evm?: string; solana?: string; bitcoin?: string } = {};
		const win = window as any;
		if (win.phantom?.solana) {
			try {
				const solResp = await win.phantom.solana.connect();
				result.solana = solResp?.publicKey ? solResp.publicKey.toString() : win.phantom.solana.publicKey?.toString();
			} catch (e) {
				console.warn("[Phantom] Solana connect canceled/failed", e);
			}
		}
		if (win.phantom?.ethereum) {
			try {
				const ethAccounts = await win.phantom.ethereum.request({ method: "eth_requestAccounts" });
				if (Array.isArray(ethAccounts) && ethAccounts.length > 0) {
					result.evm = parseAddressString(ethAccounts[0]);
				}
			} catch (e) {
				console.warn("[Phantom] EVM connect canceled/failed", e);
			}
		}
		if (win.phantom?.bitcoin) {
			try {
				const btcRes = await connectBitcoin(win.phantom.bitcoin);
				if (btcRes?.address) {
					result.bitcoin = btcRes.address;
				}
			} catch (e) {
				console.warn("[Phantom] Bitcoin connect canceled/failed", e);
			}
		}
		return result;
	};

	return {
		evmProviders,
		solanaProviders,
		bitcoinProviders,
		connectEvm,
		connectSolana,
		connectBitcoin,
		connectPhantomAll,
		hasAnyDetected:
			evmProviders.length > 0 || solanaProviders.length > 0 || bitcoinProviders.length > 0,
	};
}
