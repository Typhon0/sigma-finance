import { ApolloProvider } from "@apollo/client";
import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { PortfolioProvider } from "@/components/PortfolioProvider";
import { RouteErrorBoundary } from "@/components/router-error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { AuthProvider } from "@/lib/auth-context";
import { THEME_STORAGE_KEY } from "@/lib/theme/shadcn-theme";
import { DesignSystemProvider } from "@/providers/design-system-provider";

function OAuthRedirectHandler() {
	const navigate = useNavigate();
	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const code = params.get("code");
		const state = params.get("state");
		if (code && state && !window.location.pathname.startsWith("/sync/callback")) {
			navigate({
				to: "/sync/callback",
				search: {
					code,
					state,
					error: undefined,
					error_description: undefined,
				},
			});
		}
	}, [navigate]);
	return null;
}

// Devtools are a development-only dependency. Importing them eagerly put the
// whole devtools panel in the production entry chunk; the conditional lazy
// import lets Rollup drop it entirely when `DEV` is false.
const RouterDevtools = import.meta.env.DEV
	? lazy(() =>
			import("@tanstack/router-devtools").then((mod) => ({
				default: mod.TanStackRouterDevtools,
			})),
		)
	: null;

export const Route = createRootRoute({
	// Route-level crashes (e.g. the provider max-update-depth loop seen in
	// critique #3) render this boundary instead of the raw dev overlay.
	errorComponent: RouteErrorBoundary,
	component: () => (
		<ApolloProvider client={apolloClient}>
			<DesignSystemProvider>
				<ThemeProvider defaultTheme="system" storageKey={THEME_STORAGE_KEY}>
					<AuthProvider>
						<PortfolioProvider>
							<OAuthRedirectHandler />
							<Outlet />
							<Toaster />
						</PortfolioProvider>
						{RouterDevtools ? (
							<Suspense fallback={null}>
								<RouterDevtools />
							</Suspense>
						) : null}
					</AuthProvider>
				</ThemeProvider>
			</DesignSystemProvider>
		</ApolloProvider>
	),
});
