import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ApolloProvider } from "@apollo/client";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { apolloClient } from "@/lib/apollo/apollo-client";

export const Route = createRootRoute({
	component: () => (
		<ApolloProvider client={apolloClient}>
			<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
				<AuthProvider>
					<Outlet />
					<TanStackRouterDevtools />
				</AuthProvider>
			</ThemeProvider>
		</ApolloProvider>
	),
});
