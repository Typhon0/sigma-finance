import { ApolloProvider } from "@apollo/client";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { PortfolioProvider } from "@/components/PortfolioProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { AuthProvider } from "@/lib/auth-context";
import { THEME_STORAGE_KEY } from "@/lib/theme/shadcn-theme";
import { DesignSystemProvider } from "@/providers/design-system-provider";

export const Route = createRootRoute({
	component: () => (
		<ApolloProvider client={apolloClient}>
			<DesignSystemProvider>
				<ThemeProvider defaultTheme="system" storageKey={THEME_STORAGE_KEY}>
					<AuthProvider>
						<PortfolioProvider>
							<Outlet />
						</PortfolioProvider>
						<TanStackRouterDevtools />
					</AuthProvider>
				</ThemeProvider>
			</DesignSystemProvider>
		</ApolloProvider>
	),
});
