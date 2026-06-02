import { useVirtualizer } from "@tanstack/react-virtual";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Copy,
	Download,
	FileText,
	Info,
	Pause,
	Play,
	ScrollText,
	Search,
	Trash2,
	WrapText,
	X,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Hash, HardDrive, Layers, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ---- Types ----

interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	service: string;
}

type LogService = "go" | "yfinance";
type LogLevelFilter = "ALL" | "DEBUG" | "INFO" | "WARN" | "ERROR";

// ---- Config ----

const API_BASE = "/admin/logs";
const MAX_LOG_ENTRIES = 50_000;

// ---- Helpers ----

function getLevelColor(level: string): string {
	switch (level.toUpperCase()) {
		case "ERROR":
		case "FATAL":
		case "PANIC":
			return "text-red-400 font-bold";
		case "WARN":
		case "WARNING":
			return "text-amber-400 font-bold";
		case "DEBUG":
			return "text-blue-400 font-bold";
		case "INFO":
		default:
			return "text-emerald-400 font-bold";
	}
}

function getLevelBg(level: string): string {
	switch (level.toUpperCase()) {
		case "ERROR":
		case "FATAL":
		case "PANIC":
			return "bg-destructive/5 hover:bg-destructive/10 border-l-destructive/50";
		case "WARN":
		case "WARNING":
			return "bg-amber-500/5 hover:bg-amber-500/10 border-l-amber-500/50";
		case "DEBUG":
			return "bg-blue-500/5 hover:bg-blue-500/10 border-l-blue-500/50";
		case "INFO":
		default:
			return "hover:bg-muted/30 border-l-muted-foreground/20";
	}
}

function getLevelIcon(level: string) {
	switch (level.toUpperCase()) {
		case "ERROR":
		case "FATAL":
		case "PANIC":
			return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />;
		case "WARN":
		case "WARNING":
			return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />;
		case "DEBUG":
			return <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />;
		case "INFO":
		default:
			return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />;
	}
}

function formatTimestamp(ts: string): string {
	try {
		const d = new Date(ts);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		const hours = String(d.getHours()).padStart(2, "0");
		const minutes = String(d.getMinutes()).padStart(2, "0");
		const seconds = String(d.getSeconds()).padStart(2, "0");
		const ms = String(d.getMilliseconds()).padStart(3, "0");
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
	} catch {
		return ts;
	}
}

function cleanMessage(message: string, service: string): string {
	let msg = message;
	if (service === "yfinance" || service === "yfinance-service") {
		// Clean up common python log structures
		// Match: "2026-05-28 17:53:44,112 - __main__ - INFO - "
		const regex = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3}\s-\s[^-]+\s-\s[A-Z]+\s-\s/;
		msg = msg.replace(regex, "");
	}
	// Clean up Go standard log prefix: "2026/05/29 20:25:32 "
	const goRegex = /^\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}:\d{2}\s/;
	msg = msg.replace(goRegex, "");

	return msg;
}

// ---- Component ----

function getEntryKey(entry: LogEntry): string {
	return `${entry.timestamp}_${entry.level}_${entry.message}`;
}

export function LogViewer() {
	const [activeService, setActiveService] = useState<LogService>("go");
	const [filterText, setFilterText] = useState("");
	const [levelFilter, setLevelFilter] = useState<LogLevelFilter>("ALL");
	const [isPaused, setIsPaused] = useState(false);
	const [entries, setEntries] = useState<LogEntry[]>([]);
	const [yfEntries, setYfEntries] = useState<LogEntry[]>([]);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [wrapLines, setWrapLines] = useState(true);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
	const [timeFrom, setTimeFrom] = useState<Date | undefined>(undefined);
	const [timeTo, setTimeTo] = useState<Date | undefined>(undefined);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [uptime, setUptime] = useState(0);

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const sessionStartRef = useRef(Date.now());
	const esRef = useRef<EventSource | null>(null);
	const yfPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const isAtTopRef = useRef(true);
	const isPausedRef = useRef(false);

	// Keep ref in sync
	isPausedRef.current = isPaused;

	// Uptime ticker (every second)
	useEffect(() => {
		const id = setInterval(() => setUptime(Math.floor((Date.now() - sessionStartRef.current) / 1000)), 1000);
		return () => clearInterval(id);
	}, []);

	// ---- Derived data ----
	const displayEntries = useMemo(() => {
		const raw = activeService === "go" ? entries : yfEntries;

		let filtered = raw;
		if (filterText) {
			const lower = filterText.toLowerCase();
			filtered = filtered.filter((e) => e.message.toLowerCase().includes(lower));
		}
		if (levelFilter !== "ALL") {
			filtered = filtered.filter((e) => e.level.toUpperCase() === levelFilter);
		}
		if (timeFrom) {
			const fromMs = timeFrom.getTime();
			filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= fromMs);
		}
		if (timeTo) {
			const toMs = timeTo.getTime() + 86_400_000; // end of day
			filtered = filtered.filter((e) => new Date(e.timestamp).getTime() < toMs);
		}

		// Return in reverse chronological order (newest/recent first)
		return [...filtered].reverse();
	}, [entries, yfEntries, filterText, levelFilter, timeFrom, timeTo, activeService]);

	// Memory estimate: average ~300 bytes per log entry (timestamp + level + message + overhead)
	const memoryEstimate = useMemo(() => {
		const source = activeService === "go" ? entries : yfEntries;
		const bytes = source.reduce((sum, e) => sum + e.timestamp.length + e.level.length + e.message.length + 64, 0);
		if (bytes < 1024) return "< 1 KB";
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}, [entries, yfEntries, activeService]);

	const levelCounts = useMemo(() => {
		const source = activeService === "go" ? entries : yfEntries;
		return {
			all: source.length,
			error: source.filter((e) => e.level.toUpperCase() === "ERROR").length,
			warn: source.filter(
				(e) => e.level.toUpperCase() === "WARN" || e.level.toUpperCase() === "WARNING",
			).length,
			info: source.filter((e) => e.level.toUpperCase() === "INFO").length,
			debug: source.filter((e) => e.level.toUpperCase() === "DEBUG").length,
		};
	}, [entries, yfEntries, activeService]);

	// ---- Virtual scrolling ----
	const virtualizer = useVirtualizer({
		count: displayEntries.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: useCallback(
			(index: number) => {
				const entry = displayEntries[index];
				if (!entry) return 22;
				const key = getEntryKey(entry);
				const msg = cleanMessage(entry.message, entry.service);
					if (!expandedKeys.has(key)) return wrapLines ? 28 : 22;
					// Estimate expanded height from message length (mono 12px, ~80 chars/line)
					const lines = Math.max(1, Math.ceil(msg.length / 80));
					return Math.min(500, Math.max(28, 8 + lines * 20));
			},
			[displayEntries, expandedKeys, wrapLines],
		),
		getItemKey: useCallback(
			(index: number) => {
				const entry = displayEntries[index];
				return entry ? getEntryKey(entry) : index;
			},
			[displayEntries],
		),
		overscan: 30,
	});

	// Toggle expanded detail view for a log entry
	const toggleExpand = useCallback((entry: LogEntry) => {
		const key = getEntryKey(entry);
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}, []);

	// Detect if user has scrolled away from top
	const handleScroll = useCallback(() => {
		if (!scrollContainerRef.current) return;
		const el = scrollContainerRef.current;
		isAtTopRef.current = el.scrollTop < 40;
	}, []);

	// Auto-scroll to top when new entries arrive and user is at top
	const scrollToTop = useCallback(() => {
		if (isAtTopRef.current && displayEntries.length > 0) {
			virtualizer.scrollToIndex(0, { align: "start" });
		}
	}, [displayEntries.length, virtualizer]);

	// Scroll to top when new entries arrive (via streaming or polling)
	const prevCountRef = useRef(displayEntries.length);
	useEffect(() => {
		if (displayEntries.length > prevCountRef.current) {
			scrollToTop();
		}
		prevCountRef.current = displayEntries.length;
	}, [displayEntries.length, scrollToTop]);

	// ---- Go SSE connection ----
	// Reset expanded keys when service or filters change
	useEffect(() => {
		setExpandedKeys(new Set());
	}, [activeService, filterText, levelFilter, timeFrom, timeTo]);

	useEffect(() => {
		if (activeService !== "go") return;

		// Fetch initial recent logs
		const fetchInitial = async (): Promise<LogEntry[]> => {
			const params = new URLSearchParams();
			params.set("limit", "200");
			if (filterText) params.set("filter", filterText);
			if (levelFilter !== "ALL") params.set("level", levelFilter);

			const token = localStorage.getItem("auth_token");
			const resp = await fetch(`${API_BASE}/go?${params}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const data = await resp.json();
			return data.logs ?? [];
		};

		fetchInitial()
			.then((initial) => {
				const capped = initial.length > MAX_LOG_ENTRIES ? initial.slice(-MAX_LOG_ENTRIES) : initial;
				setEntries(capped);
				setError(null);
			})
			.catch((err) => {
				setError(`Failed to fetch Go logs: ${err.message}`);
			});

		// SSE connection for live streaming (EventSource doesn't support headers, pass token via query param)
		const params = new URLSearchParams({ stream: "true" });
		if (filterText) params.set("filter", filterText);
		if (levelFilter !== "ALL") params.set("level", levelFilter);
		const token = localStorage.getItem("auth_token");
		if (token) params.set("token", token);

		const es = new EventSource(`${API_BASE}/go?${params}`);
		esRef.current = es;

		es.onopen = () => {
			setConnected(true);
			setError(null);
		};

		es.onmessage = (event) => {
			if (isPausedRef.current) return;
			try {
				const entry: LogEntry = JSON.parse(event.data);
				setEntries((prev) => {
					const next = [...prev, entry];
					if (next.length > MAX_LOG_ENTRIES) {
						setExpandedKeys(new Set());
						return next.slice(-MAX_LOG_ENTRIES);
					}
					return next;
				});
			} catch {
				// Ignore parse errors for keepalive comments
			}
		};

		es.onerror = () => {
			setConnected(false);
			setError("SSE connection lost. Retrying...");
		};

		return () => {
			es.close();
			esRef.current = null;
			setConnected(false);
		};
	}, [activeService, filterText, levelFilter]);

	// ---- yfinance polling ----
	useEffect(() => {
		if (activeService !== "yfinance") return;

		const fetchYFLogs = async () => {
			try {
				const params = new URLSearchParams();
				params.set("limit", "200");
				if (filterText) params.set("filter", filterText);
				if (levelFilter !== "ALL") params.set("level", levelFilter);

				const token = localStorage.getItem("auth_token");
				const resp = await fetch(`${API_BASE}/yfinance?${params}`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				});
				if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
				const data = await resp.json();
				const logs: LogEntry[] = data.logs ?? [];
				setExpandedKeys(new Set());
				setYfEntries(logs.length > MAX_LOG_ENTRIES ? logs.slice(-MAX_LOG_ENTRIES) : logs);
				setError(null);
			} catch (err) {
				setError(
					`Failed to fetch yfinance logs: ${err instanceof Error ? err.message : "Unknown"}`,
				);
			}
		};

		fetchYFLogs();
		if (!isPaused) {
			yfPollRef.current = setInterval(fetchYFLogs, 3000);
		}

		return () => {
			if (yfPollRef.current) {
				clearInterval(yfPollRef.current);
				yfPollRef.current = null;
			}
		};
	}, [activeService, filterText, levelFilter, isPaused]);

	const clearLogs = () => {
		setExpandedKeys(new Set());
		if (activeService === "go") setEntries([]);
		else setYfEntries([]);
	};

	const exportFormattedLogs = () => {
		// Use chronological order (oldest first) for exported files
		const text = [...displayEntries]
			.reverse()
			.map(
				(e) =>
					`[${formatTimestamp(e.timestamp)}] [${e.level}] [${e.service}] ${cleanMessage(e.message, e.service)}`,
			)
			.join("\n");
		const blob = new Blob([text], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${activeService}-formatted-logs-${new Date().toISOString().slice(0, 10)}.txt`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Formatted logs exported successfully");
	};

	const exportRawLogs = () => {
		// Use chronological order (oldest first) for exported files
		const text = [...displayEntries]
			.reverse()
			.map((e) => e.message)
			.join("\n");
		const blob = new Blob([text], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${activeService}-raw-logs-${new Date().toISOString().slice(0, 10)}.txt`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Raw logs exported successfully");
	};

	return (
		<Card className="flex flex-col h-[calc(100vh-8rem)] w-full border-border/60 bg-card">
			<CardHeader className="pb-3 border-b border-border/30">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="space-y-0.5">
						<CardTitle className="text-lg font-semibold">System Logs</CardTitle>
						<CardDescription>
							Real-time server logs and diagnostics for system monitoring
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className={cn(
								"gap-1.5 text-xs",
								connected
									? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
									: "border-red-500/30 text-red-600 dark:text-red-400",
							)}
						>
							<span
								className={cn(
									"h-1.5 w-1.5 rounded-full",
									connected ? "bg-emerald-500" : "bg-red-500",
								)}
							/>
							{connected ? "Connected" : "Disconnected"}
						</Badge>
						<Separator orientation="vertical" className="h-5" />
						<Button
							variant="ghost"
							size="sm"
							className={cn("h-8 text-xs gap-1.5", wrapLines && "bg-secondary text-foreground")}
							onClick={() => setWrapLines(!wrapLines)}
						>
							<WrapText className="h-3.5 w-3.5" />
							Wrap
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 text-xs gap-1.5"
							onClick={() => setIsPaused(!isPaused)}
						>
							{isPaused ? (
								<Play className="h-3.5 w-3.5 text-emerald-500" />
							) : (
								<Pause className="h-3.5 w-3.5" />
							)}
							{isPaused ? "Resume" : "Pause"}
						</Button>
						<Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={clearLogs}>
							<Trash2 className="h-3.5 w-3.5" />
							Clear
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
									<Download className="h-3.5 w-3.5" />
									Export
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={exportFormattedLogs}>
									<FileText className="h-4 w-4 mr-2" />
									Export Formatted
								</DropdownMenuItem>
								<DropdownMenuItem onClick={exportRawLogs}>
									<FileText className="h-4 w-4 mr-2" />
									Export Raw
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => {
										// Use chronological order (oldest first) for copied text
										const text = [...displayEntries]
											.reverse()
											.map(
												(e) =>
													`[${formatTimestamp(e.timestamp)}] [${e.level}] [${e.service}] ${cleanMessage(e.message, e.service)}`,
											)
											.join("\n");
										navigator.clipboard.writeText(text);
										toast.success("All logs copied to clipboard");
									}}
								>
									<Copy className="h-4 w-4 mr-2" />
									Copy All to Clipboard
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardHeader>

			{/* Toolbar: service tabs + level filters + search */}
			<div className="px-6 py-3 border-b border-border/30 bg-muted/20">
				<div className="flex items-center gap-3 flex-wrap">
					<Tabs
						value={activeService}
						onValueChange={(v) => setActiveService(v as LogService)}
						className="w-auto"
					>
						<TabsList>
							<TabsTrigger value="go" className="text-xs px-3">
								Go Server
							</TabsTrigger>
							<TabsTrigger value="yfinance" className="text-xs px-3">
								yfinance
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<Separator orientation="vertical" className="h-6" />

					{/* Level counts */}
					<div className="flex items-center gap-1">
						<Badge
							variant={levelFilter === "ALL" ? "default" : "outline"}
							className="cursor-pointer text-xs py-0 h-6 select-none"
							onClick={() => setLevelFilter("ALL")}
						>
							All {levelCounts.all}
						</Badge>
						<Badge
							variant={levelFilter === "ERROR" ? "destructive" : "outline"}
							className={cn(
								"cursor-pointer text-xs py-0 h-6 select-none",
								levelFilter !== "ERROR" && "text-red-600 dark:text-red-400 border-red-500/30",
							)}
							onClick={() => setLevelFilter(levelFilter === "ERROR" ? "ALL" : "ERROR")}
						>
							Error {levelCounts.error}
						</Badge>
						<Badge
							variant={levelFilter === "WARN" ? "default" : "outline"}
							className={cn(
								"cursor-pointer text-xs py-0 h-6 select-none",
								levelFilter !== "WARN" && "text-amber-600 dark:text-amber-400 border-amber-500/30",
								levelFilter === "WARN" &&
									"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
							)}
							onClick={() => setLevelFilter(levelFilter === "WARN" ? "ALL" : "WARN")}
						>
							Warn {levelCounts.warn}
						</Badge>
						<Badge
							variant={levelFilter === "INFO" ? "default" : "outline"}
							className={cn(
								"cursor-pointer text-xs py-0 h-6 select-none",
								levelFilter !== "INFO" &&
									"text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
								levelFilter === "INFO" &&
									"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
							)}
							onClick={() => setLevelFilter(levelFilter === "INFO" ? "ALL" : "INFO")}
						>
							Info {levelCounts.info}
						</Badge>
						<Badge
							variant={levelFilter === "DEBUG" ? "default" : "outline"}
							className={cn(
								"cursor-pointer text-xs py-0 h-6 select-none",
								levelFilter !== "DEBUG" &&
									"text-blue-600 dark:text-blue-400 border-blue-500/30",
								levelFilter === "DEBUG" &&
									"bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
							)}
							onClick={() => setLevelFilter(levelFilter === "DEBUG" ? "ALL" : "DEBUG")}
						>
							Debug {levelCounts.debug}
						</Badge>
					</div>

					{/* Timestamp range filter */}
					<Separator orientation="vertical" className="h-6" />
					<div className="flex items-center gap-1.5">
						<Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
							<PopoverTrigger asChild>
								<Button variant="outline" className="h-8 min-w-[200px] justify-start text-left font-normal text-xs gap-2">
									<CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
									{timeFrom ? (
										timeTo ? (
											<>
												{format(timeFrom, "yyyy-MM-dd")} – {format(timeTo, "yyyy-MM-dd")}
											</>
										) : (
											format(timeFrom, "yyyy-MM-dd")
										)
									) : (
										<span className="text-muted-foreground">Pick a date range</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="range"
									defaultMonth={timeFrom}
									selected={{ from: timeFrom, to: timeTo }}
									onSelect={(range) => {
										setTimeFrom(range?.from);
										setTimeTo(range?.to);
									}}
									numberOfMonths={2}
								/>
							</PopoverContent>
						</Popover>
						{(timeFrom || timeTo) && (
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
								onClick={() => {
									setTimeFrom(undefined);
									setTimeTo(undefined);
								}}
								title="Clear date filter"
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>

					<div className="flex-1" />

					{/* Search */}
					<div className="relative w-full max-w-[280px]">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							placeholder="Search logs..."
							value={filterText}
							onChange={(e) => setFilterText(e.target.value)}
							className="h-8 pl-8 text-xs"
						/>
					</div>
				</div>
			</div>

		{/* Column Headers */}
		<div className="flex items-center gap-2 px-4 py-1.5 bg-muted/30 border-b border-border/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground select-none shrink-0">
			<div className="w-4 shrink-0" />
			<div className="w-[38px] shrink-0 text-right">#</div>
			<div className="w-[180px] shrink-0">Timestamp</div>
				<div className="w-[65px] shrink-0 text-center">Level</div>
				<div className="w-[80px] shrink-0">Service</div>
				<div className="flex-1">Message</div>
			</div>

			{/* Error state */}
			{error && (
				<div className="px-4 py-2 shrink-0">
					<div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
						<XCircle className="h-3.5 w-3.5 shrink-0" />
						{error}
					</div>
				</div>
			)}

			{/* Log output: virtualized scroll container */}
			<CardContent className="flex-1 p-0 min-h-0 bg-muted/10">
				{displayEntries.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center gap-2">
						<ScrollText className="h-8 w-8 opacity-25" />
						<p className="text-sm font-medium">No log entries</p>
						<p className="text-xs">
							{connected ? "Waiting for incoming log stream..." : "Log stream is disconnected"}
						</p>
					</div>
				) : (
					<div
						ref={scrollContainerRef}
						onScroll={handleScroll}
						className="h-full w-full overflow-auto"
					>
						<div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
							{virtualizer.getVirtualItems().map((virtualRow) => {
								const entry = displayEntries[virtualRow.index];
								const isExpanded = expandedKeys.has(getEntryKey(entry));
								return (
									<div
										key={virtualRow.key}
										data-index={virtualRow.index}
										ref={virtualizer.measureElement}
										className={cn(
											"absolute top-0 left-0 w-full group flex items-start gap-2 px-4 py-0.5 transition-colors border-l-2 font-mono text-[12px] leading-relaxed",
											getLevelBg(entry.level),
										)}
										style={{
											transform: `translateY(${virtualRow.start}px)`,
										}}
									>
						<span className="shrink-0 mt-0.5">{getLevelIcon(entry.level)}</span>
						<span
							className="shrink-0 w-[38px] text-right tabular-nums text-[10px] text-muted-foreground/40 select-none cursor-pointer hover:text-muted-foreground/80 transition-colors"
							onClick={() => {
								navigator.clipboard.writeText(String(virtualRow.index + 1));
								toast.success(`Line ${virtualRow.index + 1} copied`);
							}}
							title={`Line ${virtualRow.index + 1} — click to copy`}
						>
							{virtualRow.index + 1}
						</span>
						<span className="text-muted-foreground shrink-0 w-[180px] tabular-nums select-none">
											{formatTimestamp(entry.timestamp)}
										</span>
										<span
											className={cn(
												"shrink-0 w-[65px] text-center tabular-nums font-semibold text-[11px]",
												getLevelColor(entry.level),
											)}
										>
											{entry.level}
										</span>
										<span className="shrink-0 w-[80px] select-none">
											<span className="px-1.5 py-0.5 rounded text-[10px] bg-muted border border-border/40 text-muted-foreground">
												{entry.service}
											</span>
										</span>
										<div
											className={cn(
												"flex-1 min-w-0 text-foreground selection:bg-primary/20 cursor-pointer",
												isExpanded
													? "whitespace-pre-wrap break-all"
													: wrapLines
														? "whitespace-pre-wrap break-all"
														: "whitespace-nowrap overflow-x-auto scrollbar-none",
											)}
											onClick={() => toggleExpand(entry)}
										>
											{cleanMessage(entry.message, entry.service)}
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center"
											title={isExpanded ? "Collapse" : "Expand"}
											onClick={() => toggleExpand(entry)}
										>
											{isExpanded ? (
												<ChevronUp className="h-3 w-3" />
											) : (
												<ChevronDown className="h-3 w-3" />
											)}
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center"
											title="Copy line"
											onClick={() => {
												const text = `[${formatTimestamp(entry.timestamp)}] [${entry.level}] [${entry.service}] ${cleanMessage(entry.message, entry.service)}`;
												navigator.clipboard.writeText(text);
												toast.success("Copied to clipboard");
											}}
										>
											<Copy className="h-3 w-3" />
										</Button>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Stats footer */}
				<div className="flex items-center gap-4 px-4 py-1.5 border-t border-border/30 bg-muted/20 text-[10px] text-muted-foreground shrink-0 select-none">
					<div className="flex items-center gap-1.5">
						<Layers className="h-3 w-3" />
						<span>
							{displayEntries.length > 0
								? `${virtualizer.getVirtualItems().length} visible`
								: "0"}{" "}
							/ {displayEntries.length} total
						</span>
					</div>
					<div className="flex items-center gap-1.5">
						<HardDrive className="h-3 w-3" />
						<span>{memoryEstimate}</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Clock className="h-3 w-3" />
						<span>
							{uptime < 60
								? `${uptime}s`
								: uptime < 3600
									? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
									: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`}
						</span>
					</div>
					{(timeFrom || timeTo || filterText || levelFilter !== "ALL") && displayEntries.length > 0 && (
						<div className="flex items-center gap-1.5 ml-auto">
							<Hash className="h-3 w-3" />
							<span>filtered</span>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
