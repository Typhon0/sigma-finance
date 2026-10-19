import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Root router error boundary (TanStack Router `errorComponent`).
 *
 * A route-level crash used to fall back to the dev-style raw boundary + an
 * English "Something went wrong!" message (critique #3, P1 crash-loop). This
 * component is self-sufficient: it renders OUTSIDE the app tree (no
 * Apollo/Portfolio/Theme providers), so it must not use them.
 *
 * Approved wording is French, matching the run #3 decision: a hard reload is
 * the reset action, because the crashed provider tree cannot be rebuilt in
 * place. Focus moves to the single button via the mount effect instead of the
 * autoFocus attribute (a11y lint).
 */
export function RouteErrorBoundary({ error }: { error: unknown }) {
	const primaryRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		primaryRef.current?.focus();
	}, []);
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "Unexpected error.";

	return (
		<div
			role="alert"
			className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center"
		>
			<AlertTriangle aria-hidden className="h-10 w-10 text-destructive" />
			<h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
			<p className="max-w-md text-sm text-muted-foreground">
				The page could not be displayed. Your data was not modified. Reload the page to return to
				your portfolio.
			</p>
			<p className="max-w-md text-xs font-mono text-muted-foreground/80">{message}</p>
			<button
				type="button"
				ref={primaryRef}
				onClick={() => window.location.reload()}
				className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
			>
				Reload
			</button>
		</div>
	);
}

export default RouteErrorBoundary;
