"use client";

import { CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export type SyncStatus = "idle" | "syncing" | "error" | "complete";

interface SyncProgressProps {
  assetType: string;
  progress: number; // 0-100
  status: SyncStatus;
  currentRecord?: string;
  errorMessage?: string;
}

const statusConfig: Record<
  SyncStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }
> = {
  idle: { label: "Idle", variant: "secondary", icon: CheckCircle },
  syncing: { label: "Syncing", variant: "default", icon: RefreshCw },
  error: { label: "Error", variant: "destructive", icon: XCircle },
  complete: { label: "Complete", variant: "outline", icon: CheckCircle },
};

export function SyncProgress({
  assetType,
  progress,
  status,
  currentRecord,
  errorMessage,
}: SyncProgressProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{assetType}</span>
          <Badge variant={config.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      {status === "syncing" && currentRecord && (
        <p className="text-xs text-muted-foreground truncate">
          Processing: {currentRecord}
        </p>
      )}
      {status === "error" && errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
