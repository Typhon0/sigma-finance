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
		<Card className="border-border/60 bg-card">
			<CardHeader className="pb-3 border-b border-border/30">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="space-y-0.5">
						<CardTitle className="text-lg font-semibold">Background Processor Metrics</CardTitle>
						<CardDescription>
							Live snapshot of <code className="font-mono text-[10px]">/admin/metrics</code> —
							refreshed every {POLL_INTERVAL_MS / 1000}s
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className={cn(
								"gap-1.5 text-xs",
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
							{isPaused ? "Paused" : isLive ? "Live" : "Disconnected"}
						</Badge>
						<Separator orientation="vertical" className="h-5" />
						<Button
							variant="ghost"
							size="sm"
							className="h-8 text-xs gap-1.5"
							onClick={() => setIsPaused((prev) => !prev)}
						>
							{isPaused ? (
								<Play className="h-3.5 w-3.5 text-emerald-500" />
							) : (
								<Pause className="h-3.5 w-3.5" />
							)}
							{isPaused ? "Resume" : "Pause"}
						</Button>
						<Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={doFetch}>
							<RefreshCw className="h-3.5 w-3.5" />
							Refresh
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4 pt-4">
				{error && (
					<div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
						<span>
							Metric poll failed: {error}. Showing last known data; the next poll will retry.
						</span>
					</div>
				)}

				{response && (
					<div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
						<span>
							Snapshot {formatSnapshotAt(response.snapshot_at)} · {formatSecondsAgo(lastFetchedSec)}
						</span>
						{metricsPayload?.is_running === false && response.running && (
							<span className="flex items-center gap-1 text-amber-500">
								<AlertTriangle className="h-3 w-3" /> processor paused
							</span>
						)}
					</div>
				)}

				{metricsPayload ? (
					<>
						{/* BackgroundProcessor-wide counters */}
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-md border border-border/30 bg-card/40 p-4">
							<WideMetric
								icon={<Activity className="h-3.5 w-3.5 text-muted-foreground" />}
								label="Processed (cumulative)"
								value={formatNumber(metricsPayload.processed_jobs)}
							/>
							<WideMetric
								icon={<TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />}
								label="Failed (cumulative)"
								value={formatNumber(metricsPayload.failed_jobs)}
								emphasize={metricsPayload.failed_jobs > 0}
								emphasizeClass="text-red-500"
							/>
							<WideMetric
								icon={<Hourglass className="h-3.5 w-3.5 text-muted-foreground" />}
								label="Avg processing time"
								value={formatAvgProcessingTime(metricsPayload.avg_processing_time)}
							/>
						</div>

						{/* Per-pool cards */}
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<PoolCard
								title="Calculation Pool"
								queueSize={metricsPayload.calculation_queue_size}
								dropped={metricsPayload.calculation_dropped_jobs}
								droppedDelta={delta.calc}
							/>
							<PoolCard
								title="Refresh Pool"
								queueSize={metricsPayload.refresh_queue_size}
								dropped={metricsPayload.refresh_dropped_jobs}
								droppedDelta={delta.refresh}
							/>
						</div>
					</>
				) : (
					<div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center gap-2 text-sm">
						<Activity className="h-8 w-8 opacity-25" />
						<p className="font-medium">No metrics yet</p>
						<p className="text-xs">
							{error ? "Retrying on next tick…" : "Waiting for first poll…"}
						</p>
					</div>
				)}

				{hasDropAlert && !isPaused && (
					<div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-500">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
						Worker-pool queue depth exceeded capacity. The BackgroundProcessor dropped{" "}
						{delta.calc + delta.refresh} job(s) in the last {POLL_INTERVAL_MS / 1000}s window —
						check DB pool size, calc worker count, or recent portfolio count spikes.
					</div>
				)}
			</CardContent>
		</Card>
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

function WideMetric({
	icon,
	label,
	value,
	emphasize = false,
	emphasizeClass,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	emphasize?: boolean;
	emphasizeClass?: string;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				{icon}
				{label}
			</div>
			<div className={cn("font-mono text-2xl font-bold", emphasize && emphasizeClass)}>{value}</div>
		</div>
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
				"space-y-3 rounded-md border p-4 transition-colors",
				isAlerting ? "border-red-500/30 bg-red-500/5" : "border-border/30 bg-card/30",
			)}
		>
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{title}
				</span>
				{isAlerting && (
					<Badge variant="destructive" className="gap-1 text-[10px] px-2 py-0 h-5 font-mono">
						<TrendingDown className="h-3 w-3" />+{droppedDelta} in last {POLL_INTERVAL_MS / 1000}s
					</Badge>
				)}
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-1.5">
					<div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						<Database className="h-3 w-3" />
						Queue size
					</div>
					<div className="font-mono text-2xl font-bold">{formatNumber(queueSize)}</div>
				</div>
				<div className="space-y-1.5">
					<div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						<TrendingDown className="h-3 w-3" />
						Dropped (cumulative)
					</div>
					<div className={cn("font-mono text-2xl font-bold", dropped > 0 && "text-red-500")}>
						{formatNumber(dropped)}
					</div>
				</div>
			</div>
		</div>
	);
}
