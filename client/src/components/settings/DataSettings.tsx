import { Database, Download, FileText, Shield } from "lucide-react";
import { DataBackupRestore } from "@/components/export/data-backup-restore";
import { ExportQuickActions } from "@/components/export/export-quick-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";

export function DataSettings() {
	const { user } = useAuth();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Data & Privacy</h1>
				<p className="text-muted-foreground">Manage your data exports and backup preferences</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Download className="h-5 w-5" />
						Data Export
					</CardTitle>
					<CardDescription>
						Export your portfolio data, transactions, and reports in various formats.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h4 className="font-medium">Quick Exports</h4>
							<p className="text-sm text-muted-foreground">
								Export common data types with predefined formats
							</p>
						</div>
						<ExportQuickActions variant="outline" showLabel={true} />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Database className="h-5 w-5" />
						Data Backup & Restore
					</CardTitle>
					<CardDescription>
						Create complete backups of your data or restore from previous backups.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<DataBackupRestore userId={user?.id || ""} />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Compliance & Audit
					</CardTitle>
					<CardDescription>
						Export audit trails and compliance reports for regulatory requirements.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<h4 className="font-medium">Audit Trail</h4>
							<p className="text-sm text-muted-foreground">
								Export complete activity logs for compliance and security auditing.
							</p>
							<ExportQuickActions variant="outline" size="sm" showLabel={false} />
						</div>

						<div className="space-y-2">
							<h4 className="font-medium">Tax Reports</h4>
							<p className="text-sm text-muted-foreground">
								Generate tax-ready reports with realized gains, losses, and dividend income.
							</p>
							<ExportQuickActions variant="outline" size="sm" showLabel={false} />
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Data Retention
					</CardTitle>
					<CardDescription>Configure how long your data is retained and archived.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<h4 className="font-medium">Transaction History</h4>
								<p className="text-sm text-muted-foreground">
									Keep transaction records for tax and audit purposes
								</p>
							</div>
							<span className="text-sm font-medium">7 years</span>
						</div>

						<Separator />

						<div className="flex items-center justify-between">
							<div>
								<h4 className="font-medium">Price History</h4>
								<p className="text-sm text-muted-foreground">
									Historical price data for performance calculations
								</p>
							</div>
							<span className="text-sm font-medium">Indefinite</span>
						</div>

						<Separator />

						<div className="flex items-center justify-between">
							<div>
								<h4 className="font-medium">Audit Logs</h4>
								<p className="text-sm text-muted-foreground">
									Activity logs for security and compliance
								</p>
							</div>
							<span className="text-sm font-medium">2 years</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
