import { useMutation, useQuery } from "@apollo/client";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
	if (status === "COMPLETE") return "default";
	if (status === "ERROR") return "destructive";
	if (status === "RUNNING" || status === "QUEUED") return "secondary";
	return "outline";
}

export function HistoricalDataJobsSettings() {
	const { data, loading, error, refetch } = useQuery(HISTORICAL_DATA_BACKFILL_JOBS, {
		variables: { pagination: { limit: 100, offset: 0 } },
		pollInterval: 4000,
	});
	const [retryMutation, { loading: retrying }] = useMutation(RETRY_HISTORICAL_DATA_BACKFILL_JOB);

	const jobs = useMemo(
		() => data?.historicalDataBackfillJobs ?? [],
		[data?.historicalDataBackfillJobs],
	);

	const retryJob = async (id: string) => {
		try {
			await retryMutation({ variables: { id } });
			toast.success("Backfill retry queued");
			await refetch();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to retry backfill");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">Historical Data Jobs</h1>
					<p className="text-muted-foreground mt-1">
						Monitor yfinance backfill and performance calculation jobs.
					</p>
				</div>
				<Button variant="outline" onClick={() => refetch()} disabled={loading}>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Backfill Queue</CardTitle>
					<CardDescription>Latest jobs across users and portfolios</CardDescription>
				</CardHeader>
				<CardContent>
					{error ? <p className="text-sm text-destructive">{error.message}</p> : null}
					{loading && jobs.length === 0 ? (
						<p className="text-sm text-muted-foreground">Loading jobs...</p>
					) : null}
					{!loading && jobs.length === 0 ? (
						<p className="text-sm text-muted-foreground">No backfill jobs yet.</p>
					) : null}
					{jobs.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Status</TableHead>
									<TableHead>Step</TableHead>
									<TableHead>Progress</TableHead>
									<TableHead>Portfolio</TableHead>
									<TableHead>Asset</TableHead>
									<TableHead>Rows</TableHead>
									<TableHead>Error</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-right">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{jobs.map((job) => (
									<TableRow key={job.id}>
										<TableCell>
											<Badge variant={statusVariant(job.status)}>{job.status}</Badge>
										</TableCell>
										<TableCell>{job.step}</TableCell>
										<TableCell>{job.progress}%</TableCell>
										<TableCell className="font-mono text-xs">{job.portfolioId}</TableCell>
										<TableCell className="font-mono text-xs">{job.assetId}</TableCell>
										<TableCell>{job.rowsWritten}</TableCell>
										<TableCell
											className="max-w-[320px] truncate text-xs text-muted-foreground"
											title={job.errorMessage || ""}
										>
											{job.errorMessage || "-"}
										</TableCell>
										<TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
										<TableCell className="text-right">
											<Button
												size="sm"
												variant="outline"
												disabled={retrying || job.status === "RUNNING" || job.status === "QUEUED"}
												onClick={() => retryJob(job.id)}
											>
												Retry
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
