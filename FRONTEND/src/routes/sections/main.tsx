import { LineLoading } from "@/components/loading";
import SimpleLayout from "@/layouts/simple";
import { Suspense, lazy } from "react";
import { Outlet, type RouteObject, Navigate } from "react-router";

const Page403 = lazy(() => import("@/pages/sys/error/Page403"));
const Page404 = lazy(() => import("@/pages/sys/error/Page404"));
const Page500 = lazy(() => import("@/pages/sys/error/Page500"));

export const mainRoutes: RouteObject[] = [
  {
    path: "/",
    element: (
      <SimpleLayout>
        <Suspense fallback={<LineLoading />}>
          <Outlet />
        </Suspense>
      </SimpleLayout>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "500", element: <Page500 /> },
      { path: "404", element: <Page404 /> },
      { path: "403", element: <Page403 /> },
    ],
  },
];