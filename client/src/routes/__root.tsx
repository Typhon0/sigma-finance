import { ApolloProvider } from "@apollo/client";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { PortfolioProvider } from "@/components/PortfolioProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { AuthProvider } from "@/lib/auth-context";

export const Route = createRootRoute({
	component: () => (
		<ApolloProvider client={apolloClient}>
			<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
				<AuthProvider>
					<PortfolioProvider>
						<Outlet />
					</PortfolioProvider>
					<TanStackRouterDevtools />
				</AuthProvider>
			</ThemeProvider>
		</ApolloProvider>
	),
});
