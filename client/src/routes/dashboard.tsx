import { createFileRoute } from "@tanstack/react-router";
import DashboardHomePage from "@/pages/dashboard-home";

export const Route = createFileRoute("/dashboard")({
	component: DashboardHomePage,
});
