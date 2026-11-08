import { useMutation, useQuery } from "@apollo/client";
import { AlertCircle, CheckCircle2, Clock, Layers, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { RETRY_HISTORICAL_DATA_BACKFILL_JOB } from "@/graphql/mutations/instruments";
import { HISTORICAL_DATA_BACKFILL_JOBS } from "@/graphql/queries/instruments";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
	const normalized = status.toUpperCase();
	if (normalized === "COMPLETE") {
		return (
			<Badge
				variant="outline"
				className="gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]"
			>
				<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
				Terminé
			</Badge>
		);
	}
	if (normalized === "ERROR") {
		return (
			<Badge
				variant="outline"
				className="gap-1.5 border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[11px]"
			>
				<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
				Erreur
			</Badge>
		);
	}
	if (normalized === "RUNNING" || normalized === "QUEUED") {
		return (
			<Badge
				variant="outline"
				className="gap-1.5 border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[11px]"
			>
				<span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
				{normalized === "RUNNING" ? "En cours" : "En file"}
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="font-mono text-[11px]">
			{status}
		</Badge>
	);
}

export function HistoricalDataJobsSettings() {
	const [activePolling, setActivePolling] = useState(false);
	const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
		HISTORICAL_DATA_BACKFILL_JOBS,
		{
			variables: { pagination: { limit: 100, offset: 0 } },
			notifyOnNetworkStatusChange: true,
		},
	);
	const [retryMutation, { loading: retrying }] = useMutation(RETRY_HISTORICAL_DATA_BACKFILL_JOB);

	const jobs = useMemo(
		() => data?.historicalDataBackfillJobs ?? [],
		[data?.historicalDataBackfillJobs],
	);

	const stats = useMemo(() => {
		const total = jobs.length;
		const completed = jobs.filter((j) => j.status?.toUpperCase() === "COMPLETE").length;
		const inProgress = jobs.filter(
			(j) => j.status?.toUpperCase() === "RUNNING" || j.status?.toUpperCase() === "QUEUED",
		).length;
		const errors = jobs.filter((j) => j.status?.toUpperCase() === "ERROR").length;
		return { total, completed, inProgress, errors };
	}, [jobs]);

	// Adaptive Polling: 2s while jobs are running/queued, stopped (0s) when idle
	useEffect(() => {
		if (stats.inProgress > 0) {
			startPolling(2000);
			setActivePolling(true);
		} else {
			stopPolling();
			setActivePolling(false);
		}
		return () => {
			stopPolling();
		};
	}, [stats.inProgress, startPolling, stopPolling]);

	const retryJob = async (id: string) => {
		try {
			startPolling(2000);
			setActivePolling(true);
			await retryMutation({ variables: { id } });
			toast.success("Reprise du travail de backfill planifiée");
			await refetch();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Échec de la relance du travail");
		}
	};

	return (
		<div className="flex flex-col gap-6 w-full">
			{/* En-tête de section */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<Clock className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-xl font-semibold tracking-tight text-foreground">
							Tâches d'Historique de Données
						</h1>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Supervisez les opérations de rattrapage yfinance et les calculs de performance en arrière-plan.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{activePolling && (
						<Badge
							variant="outline"
							className="text-[10px] font-mono gap-1 border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 py-1"
						>
							<span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
							Flux direct (2s)
						</Badge>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={loading}
						className="h-8 gap-1.5 text-xs border-border/60 bg-card/30"
					>
						<RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
						Actualiser
					</Button>
				</div>
			</div>

			{/* Ruban KPI unifié */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
					{/* Total */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span className="h-1.5 w-1.5 rounded-full bg-primary" />
								Total Tâches
							</span>
							<Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
						</div>
						<div className="mt-2">
							<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
								{stats.total}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Enregistrements récents
							</p>
						</div>
					</div>

					{/* En cours */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
								En Cours / File
							</span>
							<Clock className="h-3.5 w-3.5 text-sky-500/80" />
						</div>
						<div className="mt-2">
							<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
								{stats.inProgress}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Traitements actifs
							</p>
						</div>
					</div>

					{/* Terminées */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								Succès
							</span>
							<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
						</div>
						<div className="mt-2">
							<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
								{stats.completed}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Backfills achevés
							</p>
						</div>
					</div>

					{/* Erreurs */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span
									className={cn(
										"h-1.5 w-1.5 rounded-full",
										stats.errors === 0 ? "bg-emerald-500" : "bg-rose-500",
									)}
								/>
								Erreurs
							</span>
							{stats.errors === 0 ? (
								<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
							) : (
								<AlertCircle className="h-3.5 w-3.5 text-rose-500/80" />
							)}
						</div>
						<div className="mt-2">
							<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
								{stats.errors}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{stats.errors === 0 ? "Aucune anomalie" : "Nécessite une relance"}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Tableau unifié */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				{error ? (
					<div className="p-4 text-xs text-rose-500 bg-rose-500/5 border-b border-border/40">
						{error.message}
					</div>
				) : null}

				<Table>
					<TableHeader>
						<TableRow className="border-b border-border/40 bg-muted/20 hover:bg-muted/20">
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Statut
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Étape
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Progression
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Portefeuille
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Actif
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Lignes
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Erreur
							</TableHead>
							<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Date de Création
							</TableHead>
							<TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Action
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="divide-y divide-border/20">
						{loading && jobs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
									Chargement des tâches de données...
								</TableCell>
							</TableRow>
						) : null}
						{!loading && jobs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
									Aucune tâche de rattrapage enregistrée.
								</TableCell>
							</TableRow>
						) : null}
						{jobs.map((job) => (
							<TableRow key={job.id} className="hover:bg-muted/30 transition-colors">
								<TableCell>
									<StatusBadge status={job.status} />
								</TableCell>
								<TableCell className="text-xs font-medium">{job.step}</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<span className="font-mono text-xs tabular-nums text-foreground">
											{job.progress}%
										</span>
									</div>
								</TableCell>
								<TableCell className="font-mono text-[11px] text-muted-foreground">
									{job.portfolioId?.slice(0, 8)}...
								</TableCell>
								<TableCell className="font-mono text-[11px] text-muted-foreground">
									{job.assetId ? `${job.assetId.slice(0, 8)}...` : "—"}
								</TableCell>
								<TableCell className="font-mono text-xs tabular-nums">
									{job.rowsWritten?.toLocaleString() ?? 0}
								</TableCell>
								<TableCell
									className="max-w-[240px] truncate text-xs text-muted-foreground"
									title={job.errorMessage || ""}
								>
									{job.errorMessage || "—"}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground whitespace-nowrap">
									{new Date(job.createdAt).toLocaleString()}
								</TableCell>
								<TableCell className="text-right">
									<Button
										size="sm"
										variant="outline"
										disabled={retrying || job.status === "RUNNING" || job.status === "QUEUED"}
										onClick={() => retryJob(job.id)}
										className="h-7 text-xs px-2.5 border-border/60 hover:bg-muted/40"
									>
										Relancer
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
