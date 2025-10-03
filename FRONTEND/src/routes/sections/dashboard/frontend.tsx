import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { Component } from "./utils";

export function getFrontendDashboardRoutes(): RouteObject[] {
	const frontendDashboardRoutes: RouteObject[] = [
		// { path: "workbench", element: Component("/pages/dashboard/workbench") },
		{ path: "dashboard", element: Component("/pages/dashboard/Dashboard") },
		{ path: "devices", element: Component("/pages/devices") },
		{ path: "notifications", element: Component("/pages/notifications") },
		{ path: "analytics", element: Component("/pages/analytics") },
		{ path: "history", element: Component("/pages/history") },
		{ path: "history/:deviceId", element: Component("/pages/history/[deviceId]") },
		{ path: "manage-roles", element: Component("/pages/management/manage-roles") },
		{ path: "manage-users", element: Component("/pages/management/manage-users") },
		{ path: "profile", element: Component("/pages/management/profile") },

		{
			path: "management",
			children: [
				{ index: true, element: <Navigate to="profile" replace /> },

				// profile index
				{ path: "profile", element: Component("/pages/management/profile") },
			],
		},
		{
			path: "menu_level",
			children: [
				{ index: true, element: <Navigate to="1a" replace /> },
				{ path: "1a", element: Component("/pages/menu-level/menu-level-1a") },
				{
					path: "1b",
					children: [
						{ index: true, element: <Navigate to="2a" replace /> },
						{ path: "2a", element: Component("/pages/menu-level/menu-level-1b/menu-level-2a") },
						{
							path: "2b",
							children: [
								{ index: true, element: <Navigate to="3a" replace /> },
								{ path: "3a", element: Component("/pages/menu-level/menu-level-1b/menu-level-2b/menu-level-3a") },
								{ path: "3b", element: Component("/pages/menu-level/menu-level-1b/menu-level-2b/menu-level-3b") },
							],
						},
					],
				},
			],
		},
		{
			path: "link",
			children: [
				{ index: true, element: <Navigate to="iframe" replace /> },
				{ path: "iframe", element: Component("/pages/sys/others/link/iframe", { src: "https://ant.design/index-cn" }) },
				{
					path: "external-link",
					element: Component("/pages/sys/others/link/external-link", { src: "https://ant.design/index-cn" }),
				},
			],
		},
		{
			path: "permission",
			children: [
				{ index: true, element: Component("/pages/sys/others/permission") },
				{ path: "page-test", element: Component("/pages/sys/others/permission/page-test") },
			],
		},
		{ path: "calendar", element: Component("/pages/sys/others/calendar") },
		{ path: "kanban", element: Component("/pages/sys/others/kanban") },
		{ path: "blank", element: Component("/pages/sys/others/blank") },
	];
	return frontendDashboardRoutes;
}