import { CheckCircle2, Lock, MailWarning, ShieldCheck, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminUserStatsData } from "@/hooks/use-admin-users";

interface AdminUserStatsCardsProps {
	stats: AdminUserStatsData | null;
	loading: boolean;
	currentFilter?: "all" | "admin" | "locked" | "unverified";
	onFilterClick?: (filterType: "all" | "admin" | "locked" | "unverified") => void;
}

export function AdminUserStatsCards({
	stats,
	loading,
	currentFilter,
	onFilterClick,
}: AdminUserStatsCardsProps) {
	if (loading && !stats) {
		return (
			<div className="rounded-xl border border-border/60 bg-card/30 p-4">
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{Array.from({ length: 5 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
						<div key={i} className="space-y-2 py-1">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-7 w-12" />
						</div>
					))}
				</div>
			</div>
		);
	}

	const items = [
		{
			id: "all" as const,
			label: "Total Utilisateurs",
			value: stats?.totalUsers ?? 0,
			icon: Users,
			dotColor: "bg-muted-foreground/60",
		},
		{
			id: "all" as const,
			label: "Utilisateurs Actifs",
			value: stats?.activeUsers ?? 0,
			icon: CheckCircle2,
			dotColor: "bg-emerald-500",
		},
		{
			id: "admin" as const,
			label: "Administrateurs",
			value: stats?.adminUsers ?? 0,
			icon: ShieldCheck,
			dotColor: "bg-primary",
		},
		{
			id: "locked" as const,
			label: "Comptes Verrouillés",
			value: stats?.lockedUsers ?? 0,
			icon: Lock,
			dotColor: "bg-rose-500",
		},
		{
			id: "unverified" as const,
			label: "Emails Non Vérifiés",
			value: stats?.unverifiedUsers ?? 0,
			icon: MailWarning,
			dotColor: "bg-amber-500",
		},
	];

	return (
		<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs">
			<div className="grid grid-cols-2 divide-y sm:divide-y-0 sm:grid-cols-3 lg:grid-cols-5 sm:divide-x divide-border/40">
				{items.map((item, idx) => {
					const Icon = item.icon;
					const isActive =
						currentFilter &&
						(currentFilter === item.id || (currentFilter === "all" && idx === 0));

					return (
						<button
							type="button"
							key={`${item.id}-${item.label}`}
							onClick={() => onFilterClick?.(item.id)}
							className={`group flex flex-col justify-between p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
								isActive
									? "bg-muted/40"
									: "hover:bg-muted/20"
							} ${idx === 0 ? "rounded-tl-xl sm:rounded-l-xl" : ""} ${
								idx === items.length - 1 ? "rounded-br-xl sm:rounded-r-xl" : ""
							}`}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground group-hover:text-foreground/90 transition-colors">
									<span className={`h-1.5 w-1.5 rounded-full ${item.dotColor}`} />
									{item.label}
								</span>
								<Icon className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
							</div>

							<div className="mt-3 flex items-baseline gap-2">
								<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
									{item.value}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
