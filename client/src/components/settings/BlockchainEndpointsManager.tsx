import { useMutation, useQuery } from "@apollo/client";
import { CheckCircle2, Edit, Globe, RefreshCw, RotateCcw, Server } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { BlockchainNetwork } from "@/gql/graphql";
import {
	RESET_BLOCKCHAIN_NETWORK_CONFIG,
	UPDATE_BLOCKCHAIN_NETWORK_CONFIG,
} from "@/graphql/mutations/wallets";
import { GET_BLOCKCHAIN_NETWORK_CONFIGS } from "@/graphql/queries/wallets";

export function BlockchainEndpointsManager() {
	const { data, loading, refetch } = useQuery(GET_BLOCKCHAIN_NETWORK_CONFIGS, {
		fetchPolicy: "cache-and-network",
	});

	const [editingConfig, setEditingConfig] = useState<{
		network: BlockchainNetwork;
		rpcUrl: string;
		explorerApiUrl: string;
	} | null>(null);

	const [updateConfig, { loading: updating }] = useMutation(UPDATE_BLOCKCHAIN_NETWORK_CONFIG, {
		onCompleted: () => {
			toast.success("Endpoint mis à jour avec succès");
			setEditingConfig(null);
			refetch();
		},
		onError: (err) => {
			toast.error(`Erreur: ${err.message}`);
		},
	});

	const [resetConfig, { loading: resetting }] = useMutation(RESET_BLOCKCHAIN_NETWORK_CONFIG, {
		onCompleted: () => {
			toast.success("Endpoint réinitialisé aux valeurs par défaut");
			setEditingConfig(null);
			refetch();
		},
		onError: (err) => {
			toast.error(`Erreur: ${err.message}`);
		},
	});

	const configs = data?.blockchainNetworkConfigs || [];

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingConfig) return;
		if (!editingConfig.rpcUrl.trim()) {
			toast.error("L'URL RPC est obligatoire");
			return;
		}

		await updateConfig({
			variables: {
				input: {
					network: editingConfig.network,
					rpcUrl: editingConfig.rpcUrl.trim(),
					explorerApiUrl: editingConfig.explorerApiUrl.trim() || undefined,
				},
			},
		});
	};

	const handleReset = async () => {
		if (!editingConfig) return;
		await resetConfig({
			variables: {
				network: editingConfig.network,
			},
		});
	};

	return (
		<div className="space-y-4">
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40">
					<div>
						<h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
							<Server className="h-4 w-4 text-primary" />
							Blockchain RPC & Explorer Endpoints
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							Configurez des nœuds RPC privés ou des endpoints Esplora/Blockscout personnalisés pour
							un suivi 100% autonome et privé.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						className="h-8 gap-1.5 text-xs border-border/60 bg-card/30"
					>
						<RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
						Actualiser
					</Button>
				</div>

				{loading && configs.length === 0 ? (
					<p className="text-xs text-muted-foreground py-8 text-center">
						Chargement des endpoints...
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow className="border-b border-border/40 bg-muted/20 hover:bg-muted/20">
								<TableHead className="w-[140px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Réseau
								</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									RPC Endpoint URL
								</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Explorer API
								</TableHead>
								<TableHead className="w-[130px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Source
								</TableHead>
								<TableHead className="w-[80px] text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Action
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{configs.map((c) => (
								<TableRow key={c.network} className="text-xs font-mono">
									<TableCell className="font-semibold font-sans">{c.network}</TableCell>
									<TableCell
										className="truncate max-w-[260px] text-muted-foreground"
										title={c.rpcUrl}
									>
										{c.rpcUrl}
									</TableCell>
									<TableCell
										className="truncate max-w-[180px] text-muted-foreground"
										title={c.explorerApiUrl || "N/A"}
									>
										{c.explorerApiUrl || "—"}
									</TableCell>
									<TableCell className="font-sans">
										{c.source === "DATABASE" ? (
											<Badge
												variant="outline"
												className="text-[10px] font-mono gap-1 border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
											>
												<span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
												Database
											</Badge>
										) : c.source === "CONFIGURED_ENV" || c.source === "ENV" ? (
											<Badge
												variant="outline"
												className="text-[10px] font-mono gap-1 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
											>
												<span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
												Configured Env
											</Badge>
										) : (
											<Badge
												variant="outline"
												className="text-[10px] font-mono gap-1 border-border/60 bg-muted/20 text-muted-foreground"
											>
												<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
												Default Public
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-right font-sans">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2 text-xs gap-1"
											onClick={() =>
												setEditingConfig({
													network: c.network as BlockchainNetwork,
													rpcUrl: c.rpcUrl,
													explorerApiUrl: c.explorerApiUrl || "",
												})
											}
										>
											<Edit className="h-3 w-3" />
											Modifier
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>

			{/* Modal d'édition de l'endpoint */}
			{editingConfig && (
				<Dialog open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
					<DialogContent className="sm:max-w-[500px]">
						<form onSubmit={handleSave}>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<Globe className="h-5 w-5 text-primary" />
									Modifier Endpoint {editingConfig.network}
								</DialogTitle>
								<DialogDescription>
									Spécifiez une URL JSON-RPC personnalisée (par exemple votre propre nœud local,
									Infura, Ankr ou PublicNode).
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<Label htmlFor="rpc-url">RPC Endpoint URL</Label>
									<Input
										id="rpc-url"
										value={editingConfig.rpcUrl}
										onChange={(e) => setEditingConfig({ ...editingConfig, rpcUrl: e.target.value })}
										placeholder="https://..."
										className="font-mono text-xs"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="explorer-url">Explorer API URL (Optionnel)</Label>
									<Input
										id="explorer-url"
										value={editingConfig.explorerApiUrl}
										onChange={(e) =>
											setEditingConfig({ ...editingConfig, explorerApiUrl: e.target.value })
										}
										placeholder="https://..."
										className="font-mono text-xs"
									/>
									<p className="text-[11px] text-muted-foreground">
										Utilisé pour la découverte de transactions ou l'exploration on-chain.
									</p>
								</div>
							</div>

							<DialogFooter className="flex items-center justify-between sm:justify-between w-full">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleReset}
									disabled={resetting}
									className="gap-1 text-muted-foreground hover:text-foreground"
								>
									<RotateCcw className="h-3.5 w-3.5" />
									Reset Default
								</Button>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setEditingConfig(null)}
									>
										Annuler
									</Button>
									<Button type="submit" size="sm" disabled={updating} className="gap-1.5">
										<CheckCircle2 className="h-3.5 w-3.5" />
										Enregistrer
									</Button>
								</div>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
