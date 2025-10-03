import { Icon } from "@/components/icon";
import type { NavProps } from "@/components/nav";
import { Badge } from "@/ui/badge";

const getRoleId = (): number | null => {
	try {
		const authUser = sessionStorage.getItem("authUser");
		if (authUser) {
			const user = JSON.parse(authUser);
			return user.role_id || null;
		}
		return null;
	} catch (error) {
		console.error("Error getting role_id:", error);
		return null;
	}
};

export const getFrontendNavData = (): NavProps["data"] => {
	const roleId = getRoleId();
	const isAdmin = roleId === 1;

	const baseItems = [
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
			title: "Manage History",
			path: "/history",
			icon: <Icon icon="mdi:history" size="24" />,
		},
		{
			title: "Manage Notifications",
			path: "/notifications",
			icon: <Icon icon="mdi:bell-cog-outline" size="24" />,
		},
	];

	const adminItems = [
		{
			title: "Manage Users",
			path: "/manage-users",
			icon: <Icon icon="mdi:account-cog" size="24" />,
		},
		{
			title: "Manage Roles",
			path: "/manage-roles",
			icon: <Icon icon="mdi:shield-account" size="24" />,
		},
		{
			title: "Manage Station Master",
			path: "/manage-station-master",
			icon: <Icon icon="mdi:office-building" size="24" />,
		},
	];

	const profileItem = {
		title: "Profile",
		path: "/profile",
		icon: <Icon icon="mdi:account" size="24" />,
	};

	const items = [...baseItems];
	if (isAdmin) {
		items.push(...adminItems);
	}
	items.push(profileItem);

	return [
		{
			items,
		},
	];
};

export const frontendNavData = getFrontendNavData();