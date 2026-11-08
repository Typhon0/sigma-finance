"use client";

import { ChevronsUpDown } from "lucide-react";

import { AccountSwitcherMenu } from "@/components/layout/AccountSwitcherMenu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

export function NavUser() {
	const { isMobile } = useSidebar();
	const { user } = useAuth();

	if (!user) {
		return null;
	}

	// Generate initials from user name
	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((part) => part.charAt(0))
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<AccountSwitcherMenu
					side={isMobile ? "bottom" : "right"}
					align="end"
					sideOffset={4}
				>
					<SidebarMenuButton
						size="lg"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<Avatar className="h-8 w-8 rounded-lg">
							<AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">{user.name}</span>
							<span className="truncate text-xs">{user.email}</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4" />
					</SidebarMenuButton>
				</AccountSwitcherMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
