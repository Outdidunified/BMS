import { Suspense, lazy } from "react";
import { Outlet } from "react-router";
import type { RouteObject } from "react-router";

const LoginPage = lazy(() => import("@/pages/sys/login"));
const TestLoginPage = lazy(() => import("@/pages/sys/login/test-login"));
const authCustom: RouteObject[] = [
	{
		path: "login",
		element: (
			<Suspense fallback={<div>Loading...</div>}>
				<LoginPage />
			</Suspense>
		),
	},
];

export const authRoutes: RouteObject[] = [
	{
		path: "auth",
		element: <Outlet />,
		children: [...authCustom],
	},
];
