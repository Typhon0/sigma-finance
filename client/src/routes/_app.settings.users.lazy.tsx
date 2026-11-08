import { createLazyFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { AdminUserManagement } from "@/components/admin/users/AdminUserManagement";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { useAuth } from "@/hooks/use-auth";

function AdminUsersRoute() {
	const { isAdmin, isLoading } = useAuth();

	if (isLoading) {
		return null;
	}

	if (!isAdmin) {
		return (
			<SettingsLayout activeSection="users">
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
						<ShieldAlert className="h-7 w-7" />
					</div>
					<h2 className="text-xl font-bold tracking-tight">Accès Administrateur Requis</h2>
					<p className="mt-1.5 max-w-md text-sm text-muted-foreground">
						Cette section est strictement réservée aux administrateurs de la plateforme Sigma
						Finance.
					</p>
				</div>
			</SettingsLayout>
		);
	}

	return (
		<SettingsLayout activeSection="users" fullWidth={true}>
			<AdminUserManagement />
		</SettingsLayout>
	);
}

export const Route = createLazyFileRoute("/_app/settings/users")({
	component: () => (
		<ProtectedRoute>
			<AdminUsersRoute />
		</ProtectedRoute>
	),
});
