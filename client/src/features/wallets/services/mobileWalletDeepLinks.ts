/**
 * Registry of top mobile crypto wallets with Universal Links and Deep Links
 * for direct in-app dApp browser navigation and 1-tap WalletConnect activation.
 */

export interface MobileWallet {
	id: string;
	name: string;
	icon: string;
	chains: string[];
	category: "multichain" | "evm" | "solana" | "bitcoin" | "hardware";
	getDappUrl: (currentUrl: string) => string;
	getWcUrl?: (wcUri: string) => string;
}

export const MOBILE_WALLETS: MobileWallet[] = [
	{
		id: "phantom",
		name: "Phantom",
		icon: "👻",
		chains: ["Solana", "Ethereum", "Polygon", "Bitcoin"],
		category: "multichain",
		getDappUrl: (url: string) =>
			`https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `https://phantom.app/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "trust",
		name: "Trust Wallet",
		icon: "🛡️",
		chains: ["EVM", "Solana", "Bitcoin", "100+ chains"],
		category: "multichain",
		getDappUrl: (url: string) =>
			`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `https://link.trustwallet.com/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "metamask",
		name: "MetaMask",
		icon: "🦊",
		chains: ["EVM (Ethereum, L2s)"],
		category: "evm",
		getDappUrl: (url: string) => {
			const cleanUrl = url.replace(/^https?:\/\//, "");
			return `https://metamask.app.link/dapp/${cleanUrl}`;
		},
		getWcUrl: (wcUri: string) => `https://metamask.app.link/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "okx",
		name: "OKX Wallet",
		icon: "⚫",
		chains: ["EVM", "Solana", "Bitcoin", "Ordinals"],
		category: "multichain",
		getDappUrl: (url: string) =>
			`https://www.okx.com/download?deeplink=${encodeURIComponent("okx://wallet/dapp/details?dappUrl=" + encodeURIComponent(url))}`,
		getWcUrl: (wcUri: string) => `okx://wallet/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "coinbase",
		name: "Coinbase Wallet",
		icon: "🔵",
		chains: ["EVM", "Solana"],
		category: "multichain",
		getDappUrl: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `https://go.cb-w.com/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "solflare",
		name: "Solflare",
		icon: "☀️",
		chains: ["Solana"],
		category: "solana",
		getDappUrl: (url: string) =>
			`https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `https://solflare.com/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "rainbow",
		name: "Rainbow",
		icon: "🌈",
		chains: ["EVM (Ethereum, Optimism, Base, Arbitrum)"],
		category: "evm",
		getDappUrl: (url: string) => `https://rnbwapp.com/dapp?url=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `https://rnbwapp.com/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "zerion",
		name: "Zerion",
		icon: "🟣",
		chains: ["EVM (15+ L1/L2s)"],
		category: "evm",
		getDappUrl: (url: string) => `https://wallet.zerion.io/dapp?url=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `https://wallet.zerion.io/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "bitget",
		name: "Bitget Wallet",
		icon: "💎",
		chains: ["EVM", "Solana", "Bitcoin"],
		category: "multichain",
		getDappUrl: (url: string) => `https://bkcode.vip?action=dapp&url=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `bitkeep://wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "oneinch",
		name: "1inch Wallet",
		icon: "🦄",
		chains: ["EVM"],
		category: "evm",
		getDappUrl: (url: string) => `https://wallet.1inch.io/dapp?url=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `https://wallet.1inch.io/wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "safepal",
		name: "SafePal",
		icon: "🔐",
		chains: ["EVM", "Solana", "Bitcoin"],
		category: "multichain",
		getDappUrl: (url: string) => `safepalwallet://open?url=${encodeURIComponent(url)}`,
		getWcUrl: (wcUri: string) => `safepalwallet://wc?uri=${encodeURIComponent(wcUri)}`,
	},
	{
		id: "backpack",
		name: "Backpack",
		icon: "🎒",
		chains: ["Solana", "Ethereum"],
		category: "solana",
		getDappUrl: (url: string) => `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}`,
	},
	{
		id: "kraken",
		name: "Kraken Wallet",
		icon: "🐙",
		chains: ["EVM", "Solana", "Bitcoin", "Dogecoin"],
		category: "multichain",
		getDappUrl: (url: string) => `krakenwallet://dapp?url=${encodeURIComponent(url)}`,
	},
	{
		id: "ledgerlive",
		name: "Ledger Live",
		icon: "🔒",
		chains: ["EVM", "Bitcoin", "Solana", "Cosmos"],
		category: "hardware",
		getDappUrl: () => "https://www.ledger.com/ledger-live",
		getWcUrl: (wcUri: string) => `https://ledgerlive.app.link/wc?uri=${encodeURIComponent(wcUri)}`,
	},
];

/**
 * Universal WalletConnect fallback URI that invokes the mobile OS native app chooser
 * for any of the 500+ installed crypto wallets supporting the wc: protocol.
 */
export function getUniversalWcDeepLink(wcUri: string): string {
	return `wc:${encodeURIComponent(wcUri)}`;
}

/**
 * Open a specific mobile wallet's dApp browser targeting current URL.
 */
export function openMobileWalletDapp(walletId: string, targetUrl?: string): boolean {
	const wallet = MOBILE_WALLETS.find((w) => w.id === walletId);
	if (!wallet) return false;
	const url = targetUrl || window.location.href;
	window.open(wallet.getDappUrl(url), "_blank", "noopener,noreferrer");
	return true;
}

/**
 * Open a specific mobile wallet with WalletConnect URI.
 */
export function openMobileWalletWc(wallet: MobileWallet, wcUri: string): void {
	if (wallet.getWcUrl) {
		window.location.href = wallet.getWcUrl(wcUri);
	} else {
		window.location.href = getUniversalWcDeepLink(wcUri);
	}
}
