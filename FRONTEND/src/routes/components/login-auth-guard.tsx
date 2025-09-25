import { useUserToken } from "@/store/userStore";
import { useCallback, useEffect } from "react";
import { useRouter } from "../hooks";

// Auth guard that currently allows dashboard to be accessed without login
// If user is unauthenticated and tries to access protected pages (non-dashboard),
// you can enhance this to check pathname and redirect accordingly.

type Props = {
  children: React.ReactNode;
};
export default function LoginAuthGuard({ children }: Props) {
  const router = useRouter();
  const { accessToken } = useUserToken();

  const check = useCallback(() => {
    if (!accessToken) {
      // Do not redirect unauthenticated users to login by default
      // This keeps dashboard accessible as landing page
      return;
    }
  }, [router, accessToken]);

  useEffect(() => {
    check();
  }, [check]);

  return <>{children}</>;
}
