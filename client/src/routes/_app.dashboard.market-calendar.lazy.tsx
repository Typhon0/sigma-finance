import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MarketCalendar } from "@/components/MarketCalendar";

export const Route = createLazyFileRoute("/_app/dashboard/market-calendar")({
	component: () => (
		<ProtectedRoute>
			<MarketCalendar onFilterStock={() => {}} />
		</ProtectedRoute>
	),
});
