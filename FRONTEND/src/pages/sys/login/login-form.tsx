import { GLOBAL_CONFIG } from "@/global-config";
import { Button } from "@/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { cn } from "@/utils";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LoginStateEnum, useLoginStateContext } from "./providers/login-provider";
import { useUserActions } from "@/store/userStore";

interface LoginFormValues {
	email: string;
	password: string;
}

const LOGIN_ENDPOINT = "http://192.168.0.12:8070/auth/login";

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"form">) {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const { setUserInfo, setUserToken } = useUserActions();

	const { loginState } = useLoginStateContext();

	const form = useForm<LoginFormValues>({
		defaultValues: {
			email: "",
			password: "",
		},
		mode: "onBlur",
	});

	if (loginState !== LoginStateEnum.LOGIN) return null;

	const mutation = useMutation({
		mutationFn: async (values: LoginFormValues) => {
			const response = await fetch(LOGIN_ENDPOINT, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(values),
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || "Failed to login");
			}

			return result;
		},
	});

	const handleFinish = async (values: LoginFormValues) => {
		setLoading(true);
		try {
			const result = await mutation.mutateAsync(values);
			// Success case - store in session storage and navigate to dashboard
			sessionStorage.setItem("authToken", result.data?.token ?? "");
			sessionStorage.setItem("authUser", JSON.stringify(result.data?.user ?? {}));
			sessionStorage.setItem("authResponse", JSON.stringify(result));
			
			// Update Zustand store to trigger reactive navigation
			if (result.data?.user) {
				setUserInfo(result.data.user);
			}
			if (result.data?.token) {
				setUserToken({ 
					accessToken: result.data.token,
					refreshToken: result.data.refreshToken || ""
				});
			}
			
			// Show success message from backend
			toast.success(result.message ?? t("sys.login.loginSuccessTitle"), {
				closeButton: true,
			});
			
			// Navigate to dashboard
			navigate("/dashboard", { replace: true });
		} catch (error) {
			// Error case - show specific message from backend
			const message = error instanceof Error ? error.message : t("common.errorTip");
			toast.error(message, { closeButton: true });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={cn("w-full", className)}>
			<Form {...form} {...props}>
				<form onSubmit={form.handleSubmit(handleFinish)} className="w-full space-y-6">
					<div className="flex flex-col items-center gap-2 text-center">
						<h1 className="text-2xl font-bold">{t("sys.login.signInFormTitle")}</h1>
						<p className="text-balance text-sm text-muted-foreground">{t("sys.login.signInFormDescription")}</p>
					</div>

					<FormField
						control={form.control}
						name="email"
						rules={{
							required: t("sys.login.emaildPlaceholder"),
							pattern: {
						value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
						message: t("sys.login.emaildPlaceholder"),
					},
						}}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("sys.login.email", { defaultValue: "Email" })}</FormLabel>
								<FormControl>
									<Input {...field} autoComplete="email" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="password"
						rules={{
							required: t("sys.login.passwordPlaceholder"),
							minLength: { value: 6, message: t("sys.login.passwordPlaceholder") },
						}}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("sys.login.password")}</FormLabel>
								<FormControl>
									<Input type="password" {...field} autoComplete="current-password" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* 登录按钮 */}
					<Button type="submit" className="w-full" disabled={loading}>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{t("sys.login.loginButton")}
					</Button>

					{/* 手机登录/二维码登录 */}
					{/* <div className="grid gap-4 sm:grid-cols-2">
						<Button variant="outline" className="w-full" onClick={() => setLoginState(LoginStateEnum.MOBILE)}>
							<Icon icon="uil:mobile-android" size={20} />
							{t("sys.login.mobileSignInFormTitle")}
						</Button>
						<Button variant="outline" className="w-full" onClick={() => setLoginState(LoginStateEnum.QR_CODE)}>
							<Icon icon="uil:qrcode-scan" size={20} />
							{t("sys.login.qrSignInFormTitle")}
						</Button>
					</div> */}

					{/* 其他登录方式 */}
					{/* <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
						<span className="relative z-10 bg-background px-2 text-muted-foreground">{t("sys.login.otherSignIn")}</span>
					</div>
					<div className="flex cursor-pointer justify-around text-2xl">
						<Button variant="ghost" size="icon">
							<Icon icon="mdi:github" size={24} />
						</Button>
						<Button variant="ghost" size="icon">
							<Icon icon="mdi:wechat" size={24} />
						</Button>
						<Button variant="ghost" size="icon">
							<Icon icon="ant-design:google-circle-filled" size={24} />
						</Button>
					</div> */}

					{/* 注册 */}
					{/* <div className="text-center text-sm">
						{t("sys.login.noAccount")}
						<Button variant="link" className="px-1" onClick={() => setLoginState(LoginStateEnum.REGISTER)}>
							{t("sys.login.signUpFormTitle")}
						</Button>
					</div> */}
				</form>
			</Form>
		</div>
	);
}

export default LoginForm;
