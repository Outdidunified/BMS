import { Icon } from "@/components/icon";
import type { NavProps } from "@/components/nav";
import { Badge } from "@/ui/badge";

export const frontendNavData: NavProps["data"] = [
	{
		items: [
			{
				title: "Dashboard",
				path: "/dashboard",
				icon: <Icon icon="local:ic-analysis" size="24" />,
			},
			{
				title: "Live Grid",
				path: "/menu_level",
				icon: <Icon icon="mdi:pulse" size="24" />,
			},
				{
				title: "Manage Device",
				path: "/management",
				icon: <Icon icon="mdi:cog" size="24" />,
			},
			{
				title: "Manage Notifications",
				path: "/notifications",
				icon: <Icon icon="mdi:bell-cog-outline" size="24" />,
			},
			
		],
	},
	
	
];