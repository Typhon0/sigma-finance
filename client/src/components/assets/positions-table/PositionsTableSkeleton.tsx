import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface PositionsTableSkeletonProps {
	hasTrendColumn?: boolean;
}

export function PositionsTableSkeleton({ hasTrendColumn = false }: PositionsTableSkeletonProps) {
	return (
		<div className="border border-border/60 rounded-lg overflow-hidden bg-card/80 flex flex-col h-full animate-pulse">
			<div className="flex flex-col justify-between gap-2.5 border-b border-border/40 bg-muted/5 px-3 py-2.5 sm:px-4 sm:py-2.5 lg:flex-row lg:items-center">
				<div className="flex w-full items-center gap-2 lg:w-auto">
					<Skeleton className="h-8 w-full lg:w-64 rounded-md" />
					<Skeleton className="h-8 w-8 rounded-md" />
					<Skeleton className="h-8 w-8 rounded-md" />
					<Skeleton className="h-8 w-24 rounded-md" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-7 w-20 rounded-md" />
					<Skeleton className="h-7 w-20 rounded-md" />
				</div>
			</div>

			<div className="overflow-x-auto min-h-[400px]">
				<Table>
					<TableHeader className="bg-muted/10">
						<TableRow className="border-border/50">
							<TableHead className="w-[20px] p-0 h-8" />
							<TableHead className="w-[140px] sm:w-[210px] h-8">
								<Skeleton className="h-3.5 w-20" />
							</TableHead>
							<TableHead className="text-right w-[90px] h-8">
								<Skeleton className="h-3.5 w-12 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[105px] h-8">
								<Skeleton className="h-3.5 w-16 ml-auto" />
							</TableHead>
							{hasTrendColumn && (
								<TableHead className="text-right w-[90px] hidden lg:table-cell h-8">
									<Skeleton className="h-3.5 w-14 ml-auto" />
								</TableHead>
							)}
							<TableHead className="text-right w-[75px] hidden sm:table-cell h-8">
								<Skeleton className="h-3.5 w-10 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[110px] hidden sm:table-cell h-8">
								<Skeleton className="h-3.5 w-14 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[105px] h-8">
								<Skeleton className="h-3.5 w-14 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[115px] h-8">
								<Skeleton className="h-3.5 w-16 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[80px] hidden md:table-cell h-8">
								<Skeleton className="h-3.5 w-10 ml-auto" />
							</TableHead>
							<TableHead className="w-[36px] h-8 p-0" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 6 }).map((_, i) => (
							<TableRow key={`pos-skel-${i}`} className="border-border/40">
								<TableCell className="py-1.5 pl-2.5 sm:pl-3 w-[20px]">
									<Skeleton className="h-5 w-1 rounded-full" />
								</TableCell>
								<TableCell className="py-1.5 px-2 w-[140px] sm:w-[210px]">
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<Skeleton className="h-3.5 w-14" />
											<Skeleton className="h-3 w-12 rounded-full" />
										</div>
										<Skeleton className="h-2.5 w-24" />
									</div>
								</TableCell>
								<TableCell className="py-1.5 px-2 text-right">
									<Skeleton className="h-3.5 w-14 ml-auto" />
								</TableCell>
								<TableCell className="py-1.5 px-2 text-right">
									<Skeleton className="h-3.5 w-16 ml-auto" />
									<Skeleton className="h-2.5 w-10 ml-auto mt-0.5" />
								</TableCell>
								{hasTrendColumn && (
									<TableCell className="py-1.5 px-2 text-right hidden lg:table-cell">
										<Skeleton className="h-4 w-16 ml-auto rounded" />
									</TableCell>
								)}
								<TableCell className="py-1.5 px-2 text-right hidden sm:table-cell">
									<Skeleton className="h-3.5 w-12 ml-auto" />
								</TableCell>
								<TableCell className="py-1.5 px-2 text-right hidden sm:table-cell">
									<Skeleton className="h-3.5 w-14 ml-auto" />
									<Skeleton className="h-2.5 w-12 ml-auto mt-0.5" />
								</TableCell>
								<TableCell className="py-1.5 px-2 text-right">
									<Skeleton className="h-3.5 w-16 ml-auto" />
								</TableCell>
								<TableCell className="py-1.5 px-2 text-right">
									<div className="flex flex-col items-end gap-0.5">
										<Skeleton className="h-3.5 w-16 ml-auto" />
										<Skeleton className="h-2.5 w-10 ml-auto" />
									</div>
								</TableCell>
								<TableCell className="py-1.5 px-2 text-right hidden md:table-cell">
									<Skeleton className="h-3.5 w-8 ml-auto" />
									<Skeleton className="h-1 w-10 ml-auto mt-0.5 rounded-full" />
								</TableCell>
								<TableCell className="py-1.5 pr-2.5 pl-1 w-[36px]">
									<Skeleton className="h-6 w-6 rounded-md ml-auto" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between border-t border-border/40 bg-muted/5 px-3 py-2 sm:px-4 sm:py-2">
				<Skeleton className="h-3.5 w-36" />
				<Skeleton className="h-3.5 w-40" />
			</div>
		</div>
	);
}

