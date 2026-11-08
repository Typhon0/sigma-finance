import { Database, Download, FileText, Shield } from "lucide-react";
import { DataBackupRestore } from "@/components/export/data-backup-restore";
import { ExportQuickActions } from "@/components/export/export-quick-actions";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

export function DataSettings() {
	const { user } = useAuth();

	return (
		<div className="space-y-6">
			{/* En-tête */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<Database className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-xl font-semibold tracking-tight text-foreground">
						Données & Sauvegardes
					</h1>
				</div>
				<p className="text-xs text-muted-foreground">
					Exportez vos données de portefeuille, créez des sauvegardes complètes et consultez les durées de rétention.
				</p>
			</div>

			{/* Exportations Rapides */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<div className="flex items-center gap-2">
							<Download className="h-4 w-4 text-muted-foreground" />
							<h2 className="text-sm font-semibold text-foreground">Exportation des Données</h2>
						</div>
						<p className="text-xs text-muted-foreground mt-0.5">
							Téléchargez vos transactions, valorisations et historiques au format CSV ou JSON.
						</p>
					</div>
					<ExportQuickActions variant="outline" showLabel={true} />
				</div>
			</div>

			{/* Sauvegarde & Restauration */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div>
					<div className="flex items-center gap-2">
						<Database className="h-4 w-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold text-foreground">Sauvegarde & Restauration</h2>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Créez une archive complète de votre compte ou restaurez un instantané antérieur.
					</p>
				</div>

				<div className="pt-1">
					<DataBackupRestore userId={user?.id || ""} />
				</div>
			</div>

			{/* Conformité & Rapports Fiscaux */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div>
					<div className="flex items-center gap-2">
						<Shield className="h-4 w-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold text-foreground">Rapports & Audit</h2>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Documents fiscaux certifiés et journaux d'activité pour vos déclarations.
					</p>
				</div>

				<div className="rounded-lg border border-border/40 bg-card/20 divide-y divide-border/30 px-3.5 py-1 text-xs">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2">
						<div>
							<h3 className="font-medium text-foreground">Journal d'Audit & Activité</h3>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Historique exhaustif de toutes les modifications de positions et transactions.
							</p>
						</div>
						<ExportQuickActions variant="outline" size="sm" showLabel={false} />
					</div>

					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2">
						<div>
							<h3 className="font-medium text-foreground">Rapport Fiscal des Plus-Values (PFU / PMP)</h3>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Synthèse fiscale prête à l'emploi avec calcul des gains/pertes réalisés et dividendes.
							</p>
						</div>
						<ExportQuickActions variant="outline" size="sm" showLabel={false} />
					</div>
				</div>
			</div>

			{/* Rétention des Données */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-6 space-y-4">
				<div>
					<div className="flex items-center gap-2">
						<FileText className="h-4 w-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold text-foreground">Règles de Rétention & Conservation</h2>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Durées de conservation des enregistrements financiers et journaux de connexion.
					</p>
				</div>

				<div className="rounded-lg border border-border/40 bg-card/20 divide-y divide-border/30 px-3.5 py-1 text-xs">
					<div className="flex items-center justify-between py-2.5">
						<div>
							<p className="font-medium text-foreground">Historique des Transactions</p>
							<p className="text-[11px] text-muted-foreground">Conservation légale pour obligations comptables</p>
						</div>
						<span className="font-mono text-muted-foreground rounded border border-border/50 bg-muted/20 px-2 py-0.5 text-[11px]">
							7 ans
						</span>
					</div>

					<div className="flex items-center justify-between py-2.5">
						<div>
							<p className="font-medium text-foreground">Cotations & Historique de Marché</p>
							<p className="text-[11px] text-muted-foreground">Séries temporelles pour courbes de performance</p>
						</div>
						<span className="font-mono text-muted-foreground rounded border border-border/50 bg-muted/20 px-2 py-0.5 text-[11px]">
							Illimitée
						</span>
					</div>

					<div className="flex items-center justify-between py-2.5">
						<div>
							<p className="font-medium text-foreground">Journaux d'Audit & Sécurité</p>
							<p className="text-[11px] text-muted-foreground">Traçabilité des connexions et sessions actives</p>
						</div>
						<span className="font-mono text-muted-foreground rounded border border-border/50 bg-muted/20 px-2 py-0.5 text-[11px]">
							2 ans
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
