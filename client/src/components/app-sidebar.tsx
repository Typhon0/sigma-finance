"use client"

import * as React from "react"
import {
  AudioWaveform,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  ChartColumn,
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Bell,
  FileText
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
    },
    {
      title: "Portfolios",
      url: "/portfolios",
      icon: Wallet,
      items: [
        {
          title: "All Portfolios",
          url: "/portfolios",
        },
        {
          title: "Create Portfolio",
          url: "/portfolios/create",
        },
        {
          title: "Portfolio Analytics",
          url: "/portfolios/analytics",
        },
      ],
    },
    {
      title: "Assets",
      url: "#",
      icon: ChartColumn,
      items: [
        {
          title: "Stocks",
          url: "#",
        },
        {
          title: "Crypto",
          url: "#",
        },
        {
          title: "Real Estate",
          url: "#",
        },
        {
          title: "Other Assets",
          url: "#",
        },
      ],
    },
    {
      title: "Transactions",
      url: "#",
      icon: TrendingUp,
      items: [
        {
          title: "All Transactions",
          url: "#",
        },
        {
          title: "Add Transaction",
          url: "#",
        },
      ],
    },
    {
      title: "Alerts",
      url: "#",
      icon: Bell,
      items: [
        {
          title: "Active Alerts",
          url: "#",
        },
        {
          title: "Create Alert",
          url: "#",
        },
      ],
    },
    {
      title: "Reports",
      url: "#",
      icon: FileText,
      items: [
        {
          title: "Performance",
          url: "#",
        },
        {
          title: "Tax Reports",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "Profile",
          url: "#",
        },
        {
          title: "Preferences",
          url: "#",
        },
        {
          title: "Security",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <h1 className="scroll-m-20 text-2xl font-extrabold tracking-tight lg:text-5xl ">
          ΣFinance
        </h1>
        <h1 className="group-data-[state=open]/collapsible:hidden">ΣF</h1>
        {/* <TeamSwitcher teams={data.teams} /> */}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
