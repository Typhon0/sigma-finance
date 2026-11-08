import { Check, Copy, Download, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface EnableBankingKeyGeneratorProps {
	onKeyGenerated?: (privateKeyPem: string) => void;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

function formatPEM(b64: string, label: string): string {
	const lines: string[] = [];
	for (let i = 0; i < b64.length; i += 64) {
		lines.push(b64.slice(i, i + 64));
	}
	return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export function EnableBankingKeyGenerator({ onKeyGenerated }: EnableBankingKeyGeneratorProps) {
	const [isGenerating, setIsGenerating] = useState(false);
	const [generated, setGenerated] = useState(false);
	const [copied, setCopied] = useState(false);
	const [publicKeyPem, setPublicKeyPem] = useState<string | null>(null);

	const handleGenerate = async () => {
		try {
			setIsGenerating(true);

			if (!window.crypto || !window.crypto.subtle) {
				toast.error(
					"Génération locale indisponible en HTTP non sécurisé. Laissez Enable Banking générer la clé directement sur leur portail (recommandé) !",
					{ duration: 6000 },
				);
				return;
			}

			// Generate 2048-bit RSA key pair via WebCrypto
			const keyPair = await window.crypto.subtle.generateKey(
				{
					name: "RSASSA-PKCS1-v1_5",
					modulusLength: 2048,
					publicExponent: new Uint8Array([1, 0, 1]),
					hash: "SHA-256",
				},
				true,
				["sign", "verify"],
			);

			// Export private key to PKCS#8 DER
			const privDer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
			const privPem = formatPEM(arrayBufferToBase64(privDer), "PRIVATE KEY");

			// Export public key to SPKI DER
			const pubDer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
			const pubPem = formatPEM(arrayBufferToBase64(pubDer), "CERTIFICATE");

			setPublicKeyPem(pubPem);
			setGenerated(true);
			onKeyGenerated?.(privPem);

			toast.success("RSA key pair generated successfully! Private key is populated below.");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to generate key pair";
			toast.error(`Key generation failed: ${msg}`);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleDownloadCert = () => {
		if (!publicKeyPem) return;
		const blob = new Blob([publicKeyPem], { type: "application/x-pem-file" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "enablebanking-certificate.pem";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success("Certificate downloaded! Upload this file to Enable Banking Control Panel.");
	};

	const handleCopyPublic = async () => {
		if (!publicKeyPem) return;
		try {
			await navigator.clipboard.writeText(publicKeyPem);
			setCopied(true);
			toast.success("Public certificate copied to clipboard!");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy certificate");
		}
	};

	return (
		<div className="rounded-lg border bg-muted/40 p-4 space-y-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<KeyRound className="h-4 w-4 text-primary" />
					<h4 className="text-sm font-semibold">Enable Banking RSA Key Pair</h4>
				</div>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick={handleGenerate}
					disabled={isGenerating}
					className="gap-2 text-xs"
				>
					{isGenerating ? (
						<>
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							Generating...
						</>
					) : (
						<>
							<ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
							{generated ? "Regenerate Keys" : "Generate Key Pair"}
						</>
					)}
				</Button>
			</div>
			<p className="text-xs text-muted-foreground leading-relaxed">
				<strong>Option recommandée :</strong> Laissez Enable Banking générer la clé sur son portail
				(option <em>&quot;Generate in the browser&quot;</em> cochée par défaut). Vous téléchargerez
				directement le fichier de clé privée lors de la création de l&apos;application. Ce bouton
				ci-contre est une alternative si vous préférez générer la paire de clés ici et importer le
				certificat sur Enable Banking.
			</p>

			{generated && publicKeyPem && (
				<div className="pt-2 border-t space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
							<ShieldCheck className="h-3.5 w-3.5" />
							Public Certificate Ready
						</span>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleCopyPublic}
								className="h-7 px-2 text-xs gap-1"
							>
								{copied ? (
									<Check className="h-3 w-3 text-emerald-500" />
								) : (
									<Copy className="h-3 w-3" />
								)}
								{copied ? "Copied" : "Copy"}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleDownloadCert}
								className="h-7 px-2.5 text-xs gap-1.5 bg-background"
							>
								<Download className="h-3 w-3 text-primary" />
								Download .pem
							</Button>
						</div>
					</div>
					<p className="text-[11px] text-muted-foreground">
						1. Upload this downloaded certificate when registering your Application in the{" "}
						<a
							href="https://enablebanking.com/cp/"
							target="_blank"
							rel="noreferrer"
							className="underline text-primary"
						>
							Enable Banking Control Panel
						</a>
						.<br />
						2. Paste the resulting <strong>Application ID</strong> into the field below.
					</p>
				</div>
			)}
		</div>
	);
}
