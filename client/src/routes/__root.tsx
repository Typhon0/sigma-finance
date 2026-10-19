import { ApolloProvider } from "@apollo/client";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { PortfolioProvider } from "@/components/PortfolioProvider";
import { RouteErrorBoundary } from "@/components/router-error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { AuthProvider } from "@/lib/auth-context";
import { THEME_STORAGE_KEY } from "@/lib/theme/shadcn-theme";
import { DesignSystemProvider } from "@/providers/design-system-provider";

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
							<Outlet />
							<Toaster />
						</PortfolioProvider>
						<TanStackRouterDevtools />
					</AuthProvider>
				</ThemeProvider>
			</DesignSystemProvider>
		</ApolloProvider>
	),
});
