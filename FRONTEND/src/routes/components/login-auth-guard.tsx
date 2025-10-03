import { useUserToken } from "@/store/userStore";
import { useCallback, useEffect } from "react";
import { useRouter } from "../hooks";

type Props = {
  children: React.ReactNode;
};
export default function LoginAuthGuard({ children }: Props) {
  const router = useRouter();
  const { accessToken } = useUserToken();

  const check = useCallback(() => {
    if (!accessToken) {
      // Redirect unauthenticated users to login page
      router.replace("/auth/login");
      return;
    }
  }, [router, accessToken]);

  useEffect(() => {
    check();
  }, [check]);

  // Only render children if user is authenticated
  if (!accessToken) {
    return null;
  }

  return <>{children}</>;
}
