"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useCallback } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";

interface NavItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	isActive?: boolean;
	items?: NavItem[];
}

function parseUrlWithSearch(url: string): {
	pathname: string;
	search?: Record<string, string>;
} {
	const urlObj = new URL(url, "http://localhost");
	const search: Record<string, string> = {};
	urlObj.searchParams.forEach((value, key) => {
		search[key] = value;
	});
	return {
		pathname: urlObj.pathname,
		search: Object.keys(search).length > 0 ? search : undefined,
	};
}

export function NavMain({ items }: { items: NavItem[] }) {
	const navigate = useNavigate();

	const handleClick = useCallback(
		(url: string) => {
			const { pathname, search } = parseUrlWithSearch(url);
			navigate({ to: pathname, search });
		},
		[navigate],
	);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Navigation</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					// If item has no sub-items, render as direct link
					if (!item.items || item.items.length === 0) {
						const { pathname, search } = parseUrlWithSearch(item.url);
						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
									<Link to={pathname} search={search}>
										{item.icon && <item.icon />}
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					}

					// If item has sub-items, render as collapsible
					return (
						<Collapsible
							key={item.title}
							asChild
							defaultOpen={item.isActive}
							className="group/collapsible"
						>
							<SidebarMenuItem>
								<CollapsibleTrigger asChild>
									<SidebarMenuButton tooltip={item.title}>
										{item.icon && <item.icon />}
										<span>{item.title}</span>
										<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
									</SidebarMenuButton>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<SidebarMenuSub>
										{item.items?.map((subItem) => (
											<SidebarMenuSubItem key={subItem.title}>
												<SidebarMenuSubButton asChild onClick={() => handleClick(subItem.url)}>
													<span className="flex cursor-pointer items-center">
														{subItem.icon && <subItem.icon />}
														<span>{subItem.title}</span>
													</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</CollapsibleContent>
							</SidebarMenuItem>
						</Collapsible>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
