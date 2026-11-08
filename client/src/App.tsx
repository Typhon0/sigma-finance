import { createRouter, RouterProvider } from "@tanstack/react-router";
import "./app.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Shell-level loading state. Route chunks are code-split, so without this a
// slow network shows a blank content area after a navigation.
function RoutePending() {
	return (
		<div
			className="flex h-full min-h-[40vh] w-full items-center justify-center"
			role="status"
			aria-live="polite"
		>
			<div className="flex flex-col items-center gap-3">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
				<span className="text-xs text-muted-foreground">Loading…</span>
			</div>
		</div>
	);
}

// Create a new router instance. `intent` preloading fetches a route's code
// when the pointer or focus lands on a link, so most navigations render from
// cache instead of waiting on a chunk request.
const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	defaultPreloadDelay: 50,
	defaultPendingMs: 150,
	defaultPendingMinMs: 300,
	defaultPendingComponent: RoutePending,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	return <RouterProvider router={router} />;
}

export default App;
