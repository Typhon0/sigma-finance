/**
 * WalletConnect helper for Sigma Finance
 * Enables pairing with mobile crypto wallets (Trust Wallet Mobile, Phantom Mobile, Rainbow, Ledger Live)
 */

export const DEFAULT_WALLETCONNECT_PROJECT_ID =
	import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64"; // Default demonstration project ID

export interface WalletConnectSessionAccount {
	network: "evm" | "solana" | "bitcoin";
	address: string;
	chainName?: string;
}

export interface WalletConnectConnectionResult {
	walletName: string;
	accounts: WalletConnectSessionAccount[];
}

/**
 * Generates a public QR code image URL for a given payload (e.g. WalletConnect pairing URI)
 */
export function getQRCodeUrl(data: string, size = 260): string {
	return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(data)}`;
}

/**
 * Parses CAIP-10 formatted accounts:
 * e.g. "eip155:1:0x123...", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:...", "bip122:000000000019d6689c085ae165831e93:..."
 */
export function parseCAIP10Account(caipAccount: string): WalletConnectSessionAccount | null {
	const parts = caipAccount.split(":");
	if (parts.length < 3) return null;

	const [namespace, chainId, address] = parts;
	if (namespace === "eip155") {
		return { network: "evm", address, chainName: `EVM (Chain ${chainId})` };
	}
	if (namespace === "solana") {
		return { network: "solana", address, chainName: "Solana" };
	}
	if (namespace === "bip122") {
		return { network: "bitcoin", address, chainName: "Bitcoin" };
	}
	return null;
}
