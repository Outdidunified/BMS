import { Icon } from "@/components/icon";
import Logo from "@/components/logo";
import { NavMini, NavVertical } from "@/components/nav";
import type { NavProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { useRouter } from "@/routes/hooks";
import { useSettingActions, useSettings } from "@/store/settingStore";
import { useUserActions } from "@/store/userStore";
import { ThemeLayout } from "@/types/enum";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import { cn } from "@/utils";
import { useTranslation } from "react-i18next";
import Swal from "sweetalert2";

type Props = {
	data: NavProps["data"];
	className?: string;
};

export function NavVerticalLayout({ data, className }: Props) {
	const settings = useSettings();
	const { themeLayout } = settings;
	const { setSettings } = useSettingActions();
	const { clearUserInfoAndToken } = useUserActions();
	const { replace } = useRouter();
	const { t } = useTranslation();

	const navWidth = themeLayout === ThemeLayout.Vertical ? "var(--layout-nav-width)" : "var(--layout-nav-width-mini)";
	const isMiniLayout = themeLayout === ThemeLayout.Mini;

	const handleToggle = () => {
		setSettings({
			...settings,
			themeLayout: isMiniLayout ? ThemeLayout.Vertical : ThemeLayout.Mini,
		});
	};

	const handleLogout = async () => {
		const result = await Swal.fire({
			title: t("sys.login.logoutConfirmTitle", { defaultValue: "Are you sure you want to log out?" }),
			text: t("sys.login.logoutConfirmText", { defaultValue: "You will need to log in again to continue." }),
			icon: "warning",
			showCancelButton: true,
			confirmButtonText: t("common.yes", { defaultValue: "Yes" }),
			cancelButtonText: t("common.no", { defaultValue: "No" }),
			confirmButtonColor: "#ef4444",
			focusCancel: true,
		});

		if (result.isConfirmed) {
			try {
				clearUserInfoAndToken();
				sessionStorage.removeItem("authToken");
				sessionStorage.removeItem("authUser");
				sessionStorage.removeItem("authResponse");
				await Swal.fire({
					title: t("sys.login.logoutSuccessTitle", { defaultValue: "Logged out" }),
					text: t("sys.login.logoutSuccessText", { defaultValue: "You have been signed out successfully." }),
					icon: "success",
					confirmButtonText: t("common.ok", { defaultValue: "OK" }),
					confirmButtonColor: "#ef4444",
				});
			} catch (error) {
				console.error("Logout failed", error);
			} finally {
				replace("/auth/login");
			}
		}
	};

	return (
		<nav
			data-slot="slash-layout-nav"
			className={cn("fixed inset-y-0 left-0 flex-col h-full bg-background border-r border-dashed z-nav transition-[width] duration-300 ease-in-out", className)}
			style={{
				width: navWidth,
			}}
		>
			<div
				className={cn("relative flex items-center py-4 px-2 h-[var(--layout-header-height)] ", {
					"justify-center": isMiniLayout,
				})}
			>
				<div className="flex items-center justify-center">
					<Logo />
					<span
						className="text-xl font-bold transition-all duration-300 ease-in-out"
						style={{
							opacity: isMiniLayout ? 0 : 1,
							maxWidth: isMiniLayout ? 0 : "auto",
							whiteSpace: "nowrap",
							marginLeft: isMiniLayout ? 0 : "8px",
						}}
					>
						{GLOBAL_CONFIG.appName}
					</span>
				</div>

				<Button variant="outline" size="icon" onClick={handleToggle} className="h-7 w-7 absolute right-0 translate-x-1/2">
					{isMiniLayout ? <Icon icon="lucide:arrow-right-to-line" size={12} /> : <Icon icon="lucide:arrow-left-to-line" size={12} />}
				</Button>
			</div>

			<ScrollArea className={cn("h-[calc(100vh-var(--layout-header-height))] px-2 bg-background")}>
				<div className="flex h-full flex-col">
					<div className="flex-1 overflow-y-auto">
						{isMiniLayout ? <NavMini data={data} /> : <NavVertical data={data} />}
					</div>
					<div className="mt-6 border-t border-border pt-4">
						<div
							role="button"
							tabIndex={0}
							onClick={handleLogout}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									handleLogout();
								}
							}}
							className={cn(
								"flex w-full items-center gap-2 font-semibold text-destructive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
								{
									"justify-center": isMiniLayout,
								},
							)}
							aria-label={t("sys.login.logout")}
						>
							<Icon icon="lucide:log-out" className="h-4 w-4" />
							<span className={cn({ "sr-only": isMiniLayout })}>{t("sys.login.logout")}</span>
						</div>
					</div>
				</div>
			</ScrollArea>
		</nav>
	);
}
