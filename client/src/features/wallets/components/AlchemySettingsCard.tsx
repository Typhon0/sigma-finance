import { useQuery } from "@apollo/client";
import { AlertTriangle, CheckCircle, Cpu, Info, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GET_WALLET_CU_USAGE } from "@/graphql/queries/wallets";

export function AlchemySettingsCard() {
	const { data, loading, error } = useQuery(GET_WALLET_CU_USAGE, {
		pollInterval: 30000,
	});

	const usage = data?.walletCUUsage;
	const consumed = usage?.consumedUnits ?? 0;
	const max = usage?.maxQuota ?? 30_000_000;
	const isThrottled = usage?.isThrottled ?? false;
	const pct = max > 0 ? Math.min(100, Math.round((consumed / max) * 100)) : 0;

	const formatCU = (n: number) => {
		if (n >= 1_000_000) {
			return `${(n / 1_000_000).toFixed(1)}M`;
		}
		if (n >= 1_000) {
			return `${(n / 1_000).toFixed(0)}k`;
		}
		return n.toLocaleString();
	};

	let statusColor = "text-green-500";
	let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
	let progressColor = "bg-primary";

	if (pct >= 80 || isThrottled) {
		statusColor = "text-destructive";
		badgeVariant = "destructive";
		progressColor = "bg-destructive";
	} else if (pct >= 60) {
		statusColor = "text-amber-500";
		badgeVariant = "secondary";
		progressColor = "bg-amber-500";
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
				<div>
					<CardTitle className="text-base flex items-center gap-2">
						<Cpu className="h-4 w-4 text-primary" /> Alchemy API & Compute Unit Meter
					</CardTitle>
					<CardDescription>
						Single-key infrastructure covering Ethereum, Base, Arbitrum, Optimism, Polygon, Solana,
						and Bitcoin.
					</CardDescription>
				</div>
				{usage?.billingMonth && (
					<Badge variant="outline" className="font-mono text-xs">
						Billing Cycle: {usage.billingMonth}
					</Badge>
				)}
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="font-medium text-foreground flex items-center gap-1.5">
							<Zap className="h-4 w-4 text-amber-500" /> Monthly Quota Consumption
						</span>
						<span className="font-mono font-semibold text-foreground">
							{formatCU(consumed)} / {formatCU(max)} CUs ({pct}%)
						</span>
					</div>
					<Progress value={pct} className="h-2.5" />
					<div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
						<span>0 CUs</span>
						<span className="text-[11px] text-amber-600/80">
							80% soft-throttle limit ({formatCU(max * 0.8)})
						</span>
						<span>{formatCU(max)} (Free Quota)</span>
					</div>
				</div>

				{isThrottled ? (
					<div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive flex items-start gap-2">
						<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
						<div>
							<p className="font-medium">Quota Conservation Active</p>
							<p className="text-destructive/80 mt-0.5">
								Monthly usage has exceeded 80% (24M CUs). Automatic 12-hour background sync is
								temporarily throttled to guarantee zero subscription costs (€0/month). On-demand
								manual sync remains available.
							</p>
						</div>
					</div>
				) : (
					<div className="bg-muted/40 border rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
						<ShieldCheck className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
						<div>
							<p className="font-medium text-foreground">Healthy Quota Headroom</p>
							<p className="mt-0.5">
								Sigma Finance rate-limits blockchain calls to 25 rps and monitors Alchemy compute
								credits in real-time, preventing unexpected overages.
							</p>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
