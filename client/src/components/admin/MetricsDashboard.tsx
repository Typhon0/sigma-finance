import {
	Activity,
	AlertTriangle,
	Database,
	Hourglass,
	Pause,
	Play,
	RefreshCw,
	TrendingDown,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---- Response contract (mirror of server/cmd/app.go /admin/metrics) ----

interface MetricsPayload {
	processed_jobs: number;
	failed_jobs: number;
	avg_processing_time: number;
	calculation_queue_size: number;
	refresh_queue_size: number;
	calculation_dropped_jobs: number;
	refresh_dropped_jobs: number;
	is_running: boolean;
}

interface MetricsResponse {
	snapshot_at: string;
	running: boolean;
	metrics: Partial<MetricsPayload> | Record<string, never>;
}

// ---- Config ----

const POLL_INTERVAL_MS = 5_000;
const API_PATH = "/admin/metrics";
// Threshold > 0 = badge fires on any drop observed in the last poll window.
// Hardcoded for v1: localStorage-driven N is overkill until ops actually needs it.
const DROP_THRESHOLD = 0;

// ---- Helpers ----

function formatNumber(value: number | undefined | null): string {
	if (value === undefined || value === null || Number.isNaN(value)) return "—";
	return value.toLocaleString();
}

function formatAvgProcessingTime(ns: number | undefined | null): string {
	if (ns === undefined || ns === null || Number.isNaN(ns) || ns <= 0) return "—";
	if (ns < 1_000) return `${ns.toFixed(0)} ns`;
	if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)} µs`;
	return `${(ns / 1_000_000).toFixed(2)} ms`;
}

function formatSnapshotAt(iso: string | undefined): string {
	if (!iso) return "—";
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString();
	} catch {
		return iso;
	}
}

function formatSecondsAgo(seconds: number | null): string {
	if (seconds === null) return "—";
	if (seconds < 1) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${seconds % 60}s ago`;
}

interface DropDelta {
	calc: number;
	refresh: number;
}

function computeDropDelta(
	previous: MetricsPayload | null,
	current: MetricsPayload | null,
): DropDelta {
	if (!previous || !current) return { calc: 0, refresh: 0 };
	return {
		calc: Math.max(0, current.calculation_dropped_jobs - previous.calculation_dropped_jobs),
		refresh: Math.max(0, current.refresh_dropped_jobs - previous.refresh_dropped_jobs),
	};
}

// ---- Component ----

export function MetricsDashboard() {
	const [response, setResponse] = useState<MetricsResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPaused, setIsPaused] = useState(false);
	const [now, setNow] = useState(() => Date.now());

	// displayedRef  = metrics currently shown to the user
	// prevDisplayedRef = metrics from the previous poll - cleared to compute delta
	const displayedRef = useRef<MetricsPayload | null>(null);
	const prevDisplayedRef = useRef<MetricsPayload | null>(null);

	// After every successful response render, shift the displayed value into
	// prev so further renders can compute the delta against it on the next poll.
	useEffect(() => {
		const incoming = response?.metrics;
		if (incoming && typeof incoming === "object" && "calculation_dropped_jobs" in incoming) {
			const next = incoming as MetricsPayload;
			prevDisplayedRef.current = displayedRef.current;
			displayedRef.current = next;
		}
	}, [response]);

	// One-second tick so the "last fetched" hint stays current without re-fetching.
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1_000);
		return () => clearInterval(id);
	}, []);

	const doFetch = useCallback(async () => {
		try {
			const token = localStorage.getItem("auth_token");
			const resp = await fetch(API_PATH, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (!resp.ok) {
				throw new Error(`HTTP ${resp.status} ${resp.statusText}`.trim());
			}
			const data = (await resp.json()) as MetricsResponse;
			setResponse(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error fetching metrics");
		}
	}, []);

	// Poll loop - cleared on pause, restarted on resume / manual refresh.
	const abortRef = useRef<AbortController | null>(null);
	useEffect(() => {
		abortRef.current?.abort();
		abortRef.current = new AbortController();
		if (isPaused) return;
		doFetch();
		const interval = setInterval(doFetch, POLL_INTERVAL_MS);
		return () => {
			clearInterval(interval);
			abortRef.current?.abort();
		};
	}, [isPaused, doFetch]);

	const metricsPayload = isMetricsPayload(response?.metrics) ? response?.metrics : null;
	const delta = computeDropDelta(prevDisplayedRef.current, metricsPayload);

	const lastFetchedMs = response?.snapshot_at ? Date.parse(response.snapshot_at) : NaN;
	const lastFetchedSec = Number.isFinite(lastFetchedMs)
		? Math.max(0, Math.floor((now - lastFetchedMs) / 1000))
		: null;

	const isLive = !isPaused && !error && response?.running === true && metricsPayload?.is_running;

	const hasDropAlert =
		metricsPayload !== null && (delta.calc > DROP_THRESHOLD || delta.refresh > DROP_THRESHOLD);

	return (
		<div className="flex flex-col gap-6 w-full">
			{/* En-tête de section */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<Activity className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-xl font-semibold tracking-tight text-foreground">
							Métriques du Processeur d'Arrière-Plan
						</h1>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Supervision en temps réel des files de calcul, des jobs et de la charge interne.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge
						variant="outline"
						className={cn(
							"gap-1.5 text-xs font-mono",
							isLive
								? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
								: "border-red-500/30 text-red-600 dark:text-red-400",
						)}
					>
						<span
							className={cn(
								"h-1.5 w-1.5 rounded-full transition-colors",
								isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500",
							)}
						/>
						{isPaused ? "En pause" : isLive ? "En direct" : "Déconnecté"}
					</Badge>
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs gap-1.5 border-border/60"
						onClick={() => setIsPaused((prev) => !prev)}
					>
						{isPaused ? (
							<Play className="h-3.5 w-3.5 text-emerald-500" />
						) : (
							<Pause className="h-3.5 w-3.5" />
						)}
						{isPaused ? "Reprendre" : "Pause"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs gap-1.5 border-border/60"
						onClick={doFetch}
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Actualiser
					</Button>
				</div>
			</div>

			{error && (
				<div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					<span>
						Échec de récupération des métriques : {error}. Les dernières données connues restent affichées.
					</span>
				</div>
			)}

			{response && (
				<div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
					<span>
						Snapshot {formatSnapshotAt(response.snapshot_at)} · {formatSecondsAgo(lastFetchedSec)}
					</span>
					{metricsPayload?.is_running === false && response.running && (
						<span className="flex items-center gap-1 text-amber-500">
							<AlertTriangle className="h-3 w-3" /> processeur suspendu
						</span>
					)}
				</div>
			)}

			{metricsPayload ? (
				<div className="space-y-6">
					{/* Ruban KPI unifié pour les compteurs BackgroundProcessor */}
					<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
						<div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
							<div className="p-4 flex flex-col justify-between">
								<div className="flex items-center justify-between gap-2">
									<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
										<span className="h-1.5 w-1.5 rounded-full bg-primary" />
										Tâches Traitées
									</span>
									<Activity className="h-3.5 w-3.5 text-muted-foreground/60" />
								</div>
								<div className="mt-2">
									<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
										{formatNumber(metricsPayload.processed_jobs)}
									</span>
									<p className="text-[11px] text-muted-foreground mt-0.5">
										Total cumulé depuis démarrage
									</p>
								</div>
							</div>

							<div className="p-4 flex flex-col justify-between">
								<div className="flex items-center justify-between gap-2">
									<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
										<span
											className={cn(
												"h-1.5 w-1.5 rounded-full",
												metricsPayload.failed_jobs > 0 ? "bg-rose-500" : "bg-emerald-500",
											)}
										/>
										Tâches Échouées
									</span>
									<TrendingDown
										className={cn(
											"h-3.5 w-3.5",
											metricsPayload.failed_jobs > 0 ? "text-rose-500" : "text-emerald-500/80",
										)}
									/>
								</div>
								<div className="mt-2">
									<span
										className={cn(
											"text-2xl font-semibold tracking-tight tabular-nums",
											metricsPayload.failed_jobs > 0 ? "text-rose-500" : "text-foreground",
										)}
									>
										{formatNumber(metricsPayload.failed_jobs)}
									</span>
									<p className="text-[11px] text-muted-foreground mt-0.5">
										{metricsPayload.failed_jobs === 0 ? "Aucun échec" : "Erreurs d'exécution"}
									</p>
								</div>
							</div>

							<div className="p-4 flex flex-col justify-between">
								<div className="flex items-center justify-between gap-2">
									<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
										<span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
										Temps Moyen de Traitement
									</span>
									<Hourglass className="h-3.5 w-3.5 text-sky-500/80" />
								</div>
								<div className="mt-2">
									<span className="text-2xl font-semibold tracking-tight text-foreground font-mono">
										{formatAvgProcessingTime(metricsPayload.avg_processing_time)}
									</span>
									<p className="text-[11px] text-muted-foreground mt-0.5">
										Latence par unité de calcul
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Pools de traitement */}
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<PoolCard
							title="File de Calcul (Calculations)"
							queueSize={metricsPayload.calculation_queue_size}
							dropped={metricsPayload.calculation_dropped_jobs}
							droppedDelta={delta.calc}
						/>
						<PoolCard
							title="File de Rafraîchissement (Refresh)"
							queueSize={metricsPayload.refresh_queue_size}
							dropped={metricsPayload.refresh_dropped_jobs}
							droppedDelta={delta.refresh}
						/>
					</div>
				</div>
			) : (
				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs flex flex-col items-center justify-center py-16 text-muted-foreground text-center gap-2 text-sm">
					<Activity className="h-8 w-8 opacity-25" />
					<p className="font-medium">En attente des métriques...</p>
					<p className="text-xs">
						{error ? "Nouvelle tentative au prochain cycle…" : "Interrogation du serveur en cours…"}
					</p>
				</div>
			)}

			{hasDropAlert && !isPaused && (
				<div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-500">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					Avertissement : La capacité du pool de workers a été dépassée. Le processeur a abandonné{" "}
					{delta.calc + delta.refresh} tâche(s) au cours des dernières {POLL_INTERVAL_MS / 1000}s.
				</div>
			)}
		</div>
	);
}

// ---- Subcomponents ----

function isMetricsPayload(value: unknown): value is MetricsPayload {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.processed_jobs === "number" &&
		typeof v.failed_jobs === "number" &&
		typeof v.calculation_queue_size === "number" &&
		typeof v.calculation_dropped_jobs === "number"
	);
}

function PoolCard({
	title,
	queueSize,
	dropped,
	droppedDelta,
}: {
	title: string;
	queueSize: number;
	dropped: number;
	droppedDelta: number;
}) {
	const isAlerting = droppedDelta > DROP_THRESHOLD;

	return (
		<div
			className={cn(
				"rounded-xl border p-5 transition-colors backdrop-blur-xs space-y-4",
				isAlerting ? "border-rose-500/30 bg-rose-500/5" : "border-border/60 bg-card/30",
			)}
		>
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{title}
				</span>
				{isAlerting && (
					<Badge variant="destructive" className="gap-1 text-[10px] px-2 py-0 h-5 font-mono">
						<TrendingDown className="h-3 w-3" />+{droppedDelta} / {POLL_INTERVAL_MS / 1000}s
					</Badge>
				)}
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						<Database className="h-3 w-3" />
						Taille de la file
					</div>
					<div className="font-mono text-2xl font-bold tabular-nums">{formatNumber(queueSize)}</div>
				</div>
				<div className="space-y-1">
					<div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						<TrendingDown className="h-3 w-3" />
						Abandonnés (cumulé)
					</div>
					<div className={cn("font-mono text-2xl font-bold tabular-nums", dropped > 0 && "text-rose-500")}>
						{formatNumber(dropped)}
					</div>
				</div>
			</div>
		</div>
	);
}
