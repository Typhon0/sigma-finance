import { AlertCircle, CheckCircle, RefreshCw, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface RetryConfig {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
	backoffMultiplier: number;
	jitter: boolean;
}

export interface RetryState {
	isRetrying: boolean;
	retryCount: number;
	nextRetryIn: number;
	lastError: Error | null;
	canRetry: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelay: 1000,
	maxDelay: 30000,
	backoffMultiplier: 2,
	jitter: true,
};

export function useRetryMechanism(
	retryFn: () => Promise<void>,
	config: Partial<RetryConfig> = {},
) {
	const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
	const [retryState, setRetryState] = useState<RetryState>({
		isRetrying: false,
		retryCount: 0,
		nextRetryIn: 0,
		lastError: null,
		canRetry: true,
	});

	const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

	const calculateDelay = useCallback(
		(attempt: number): number => {
			let delay =
				fullConfig.baseDelay * fullConfig.backoffMultiplier ** attempt;
			delay = Math.min(delay, fullConfig.maxDelay);

			if (fullConfig.jitter) {
				delay = delay * (0.5 + Math.random() * 0.5);
			}

			return Math.floor(delay);
		},
		[fullConfig],
	);

	const startCountdown = useCallback((delay: number) => {
		let remaining = Math.ceil(delay / 1000);
		setRetryState((prev) => ({ ...prev, nextRetryIn: remaining }));

		countdownIntervalRef.current = setInterval(() => {
			remaining -= 1;
			setRetryState((prev) => ({ ...prev, nextRetryIn: remaining }));

			if (remaining <= 0) {
				if (countdownIntervalRef.current) {
					clearInterval(countdownIntervalRef.current);
					countdownIntervalRef.current = null;
				}
			}
		}, 1000);
	}, []);

	const retry = useCallback(
		async (immediate = false) => {
			if (!retryState.canRetry || retryState.isRetrying) {
				return;
			}

			const newRetryCount = retryState.retryCount + 1;
			const canRetryAgain = newRetryCount < fullConfig.maxRetries;

			setRetryState((prev) => ({
				...prev,
				isRetrying: true,
				retryCount: newRetryCount,
				canRetry: canRetryAgain,
				nextRetryIn: 0,
			}));

			// Clear any existing timers
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
				retryTimeoutRef.current = null;
			}
			if (countdownIntervalRef.current) {
				clearInterval(countdownIntervalRef.current);
				countdownIntervalRef.current = null;
			}

			try {
				if (!immediate && newRetryCount > 1) {
					const delay = calculateDelay(newRetryCount - 1);
					startCountdown(delay);

					await new Promise((resolve) => {
						retryTimeoutRef.current = setTimeout(resolve, delay);
					});
				}

				await retryFn();

				// Success - reset retry state
				setRetryState({
					isRetrying: false,
					retryCount: 0,
					nextRetryIn: 0,
					lastError: null,
					canRetry: true,
				});
			} catch (error) {
				setRetryState((prev) => ({
					...prev,
					isRetrying: false,
					lastError: error as Error,
				}));

				// Auto-retry if we haven't reached max retries
				if (canRetryAgain) {
					const delay = calculateDelay(newRetryCount);
					startCountdown(delay);

					retryTimeoutRef.current = setTimeout(() => {
						retry();
					}, delay);
				}
			}
		},
		[retryState, fullConfig, retryFn, calculateDelay, startCountdown],
	);

	const reset = useCallback(() => {
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current);
			retryTimeoutRef.current = null;
		}
		if (countdownIntervalRef.current) {
			clearInterval(countdownIntervalRef.current);
			countdownIntervalRef.current = null;
		}

		setRetryState({
			isRetrying: false,
			retryCount: 0,
			nextRetryIn: 0,
			lastError: null,
			canRetry: true,
		});
	}, []);

	const manualRetry = useCallback(() => {
		retry(true);
	}, [retry]);

	useEffect(() => {
		return () => {
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
			}
			if (countdownIntervalRef.current) {
				clearInterval(countdownIntervalRef.current);
			}
		};
	}, []);

	return {
		retryState,
		retry: manualRetry,
		reset,
		config: fullConfig,
	};
}

interface RetryButtonProps {
	onRetry: () => void;
	retryState: RetryState;
	variant?: "default" | "outline" | "ghost";
	size?: "sm" | "default" | "lg";
	className?: string;
	showCountdown?: boolean;
}

export function RetryButton({
	onRetry,
	retryState,
	variant = "outline",
	size = "sm",
	className,
	showCountdown = true,
}: RetryButtonProps) {
	const { isRetrying, canRetry, nextRetryIn, retryCount } = retryState;

	const getButtonText = () => {
		if (isRetrying && nextRetryIn > 0) {
			return showCountdown ? `Retry in ${nextRetryIn}s` : "Retrying...";
		}
		if (isRetrying) {
			return "Retrying...";
		}
		if (retryCount === 0) {
			return "Retry";
		}
		return `Retry (${retryCount})`;
	};

	return (
		<Button
			onClick={onRetry}
			disabled={isRetrying || !canRetry}
			variant={variant}
			size={size}
			className={cn("gap-2", className)}
		>
			<RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
			{getButtonText()}
		</Button>
	);
}

interface RetryStatusProps {
	retryState: RetryState;
	config: RetryConfig;
	className?: string;
	showProgress?: boolean;
}

export function RetryStatus({
	retryState,
	config,
	className,
	showProgress = true,
}: RetryStatusProps) {
	const { isRetrying, retryCount, nextRetryIn, lastError, canRetry } =
		retryState;

	const getStatusIcon = () => {
		if (isRetrying) {
			return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
		}
		if (lastError) {
			if (lastError.message.toLowerCase().includes("network")) {
				return <WifiOff className="h-4 w-4 text-orange-500" />;
			}
			return <AlertCircle className="h-4 w-4 text-red-500" />;
		}
		return <CheckCircle className="h-4 w-4 text-green-500" />;
	};

	const getStatusText = () => {
		if (isRetrying && nextRetryIn > 0) {
			return `Retrying in ${nextRetryIn} seconds...`;
		}
		if (isRetrying) {
			return "Retrying now...";
		}
		if (lastError && !canRetry) {
			return `Failed after ${config.maxRetries} attempts`;
		}
		if (lastError) {
			return `Attempt ${retryCount}/${config.maxRetries} failed`;
		}
		return "Connected";
	};

	const getStatusVariant = () => {
		if (isRetrying) return "secondary";
		if (lastError && !canRetry) return "destructive";
		if (lastError) return "outline";
		return "default";
	};

	const progressPercentage =
		showProgress && nextRetryIn > 0
			? ((config.baseDelay / 1000 - nextRetryIn) / (config.baseDelay / 1000)) *
				100
			: 0;

	return (
		<div className={cn("space-y-2", className)}>
			<div className="flex items-center gap-2">
				{getStatusIcon()}
				<Badge variant={getStatusVariant()} className="text-xs">
					{getStatusText()}
				</Badge>
			</div>

			{showProgress && isRetrying && nextRetryIn > 0 && (
				<Progress value={progressPercentage} className="h-1" />
			)}

			{lastError && (
				<p className="text-xs text-muted-foreground">{lastError.message}</p>
			)}
		</div>
	);
}

interface AutoRetryWrapperProps {
	children: React.ReactNode;
	retryFn: () => Promise<void>;
	config?: Partial<RetryConfig>;
	showStatus?: boolean;
	showButton?: boolean;
	className?: string;
}

export function AutoRetryWrapper({
	children,
	retryFn,
	config,
	showStatus = true,
	showButton = true,
	className,
}: AutoRetryWrapperProps) {
	const {
		retryState,
		retry,
		config: fullConfig,
	} = useRetryMechanism(retryFn, config);

	return (
		<div className={cn("space-y-3", className)}>
			{children}

			{(showStatus || showButton) &&
				(retryState.lastError || retryState.isRetrying) && (
					<div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
						{showStatus && (
							<RetryStatus
								retryState={retryState}
								config={fullConfig}
								className="flex-1"
							/>
						)}

						{showButton && (
							<RetryButton onRetry={retry} retryState={retryState} />
						)}
					</div>
				)}
		</div>
	);
}
