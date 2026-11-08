import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnableBankingKeyGenerator } from "../EnableBankingKeyGenerator";

describe("EnableBankingKeyGenerator", () => {
	it("renders generator description and trigger button", () => {
		render(<EnableBankingKeyGenerator />);

		expect(screen.getByText("Enable Banking RSA Key Pair")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Generate Key Pair/i })).toBeInTheDocument();
		expect(screen.getByText(/Laissez Enable Banking générer la clé/i)).toBeInTheDocument();
	});

	it("generates RSA keys and invokes onKeyGenerated callback", async () => {
		const onKeyGenerated = vi.fn();

		// Mock crypto.subtle.generateKey and exportKey
		const mockPrivateKey = { type: "private" };
		const mockPublicKey = { type: "public" };
		const fakeDer = new Uint8Array([1, 2, 3, 4]).buffer;

		const originalCrypto = window.crypto;
		const subtleMock = {
			generateKey: vi.fn().mockResolvedValue({
				privateKey: mockPrivateKey,
				publicKey: mockPublicKey,
			}),
			exportKey: vi.fn().mockResolvedValue(fakeDer),
		};

		Object.defineProperty(window, "crypto", {
			value: { ...originalCrypto, subtle: subtleMock },
			writable: true,
		});

		render(<EnableBankingKeyGenerator onKeyGenerated={onKeyGenerated} />);

		const genBtn = screen.getByRole("button", { name: /Generate Key Pair/i });
		fireEvent.click(genBtn);

		await waitFor(() => {
			expect(screen.getByText("Public Certificate Ready")).toBeInTheDocument();
		});

		expect(subtleMock.generateKey).toHaveBeenCalledWith(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);

		expect(onKeyGenerated).toHaveBeenCalledWith(
			expect.stringContaining("-----BEGIN PRIVATE KEY-----"),
		);
		expect(screen.getByRole("button", { name: /Download \.pem/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Copy/i })).toBeInTheDocument();

		// Restore original crypto
		Object.defineProperty(window, "crypto", {
			value: originalCrypto,
			writable: true,
		});
	});
});
