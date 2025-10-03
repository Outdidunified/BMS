import bannerImage from "@/assets/images/background/banner-1.png";
import { Icon } from "@/components/icon";
import { useUserInfo } from "@/store/userStore";
import { themeVars } from "@/theme/theme.css";
import { Avatar, AvatarImage, AvatarFallback } from "@/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Text, Title } from "@/ui/typography";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import type { CSSProperties } from "react";
import { useState, useEffect } from "react";
import DevicesTab from "./devices-tab";

interface UserData {
	username: string;
	email: string;
	role_id: number;
	role_name?: string;
}

function UserProfile() {
	const [userData, setUserData] = useState<UserData | null>(null);

	useEffect(() => {
		try {
			const authUser = sessionStorage.getItem("authUser");
			if (authUser) {
				const user = JSON.parse(authUser);
				setUserData(user);
			}
		} catch (error) {
			console.error("Error loading user data:", error);
		}
	}, []);

	const bgStyle: CSSProperties = {
		position: "absolute",
		inset: 0,
		background: `url(${bannerImage})`,
		backgroundSize: "cover",
		backgroundPosition: "50%",
		backgroundRepeat: "no-repeat",
	};

	const getRoleName = (roleId: number) => {
		const roles: Record<number, string> = {
			1: "Administrator",
			2: "Manager",
			3: "Operator",
			4: "Viewer"
		};
		return roles[roleId] || "User";
	};

	const getInitials = (name: string) => {
		return name.split(' ').map(n => n[0]).join('').toUpperCase();
	};

	const tabs = [
		{
			icon: <Icon icon="lucide:user" size={24} className="mr-2" />,
			title: "Profile",
			content: (
				<div className="space-y-6">
					{/* Profile Header Card */}
					<Card>
						<CardContent className="pt-6">
							<div className="flex flex-col md:flex-row items-center gap-6">
								<Avatar className="h-24 w-24">
									<AvatarImage src="" />
									<AvatarFallback className="text-2xl font-bold">
										{userData?.username ? getInitials(userData.username) : "U"}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 text-center md:text-left">
									<div className="flex items-center gap-2 justify-center md:justify-start">
										<Title as="h2" className="text-2xl font-bold">
											{userData?.username || "User"}
										</Title>
										<Icon icon="heroicons:check-badge-solid" size={24} color={themeVars.colors.palette.primary.default} />
									</div>
									<Text variant="body1" className="text-muted-foreground mt-1">
										{userData?.email || "No email"}
									</Text>
									<div className="mt-3">
										<Badge variant="default" className="text-sm">
											{userData?.role_id ? getRoleName(userData.role_id) : "User"}
										</Badge>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* User Information Card */}
					<Card>
						<CardHeader>
							<CardTitle>User Information</CardTitle>
							<CardDescription>Your account details and role information</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Icon icon="mdi:account" size={20} />
										<span className="font-medium">Username</span>
									</div>
									<p className="text-base font-semibold pl-7">{userData?.username || "N/A"}</p>
								</div>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Icon icon="mdi:email" size={20} />
										<span className="font-medium">Email</span>
									</div>
									<p className="text-base font-semibold pl-7">{userData?.email || "N/A"}</p>
								</div>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Icon icon="mdi:shield-account" size={20} />
										<span className="font-medium">Role</span>
									</div>
									<p className="text-base font-semibold pl-7">
										{userData?.role_id ? getRoleName(userData.role_id) : "N/A"}
									</p>
								</div>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Icon icon="mdi:identifier" size={20} />
										<span className="font-medium">Role ID</span>
									</div>
									<p className="text-base font-semibold pl-7">{userData?.role_id || "N/A"}</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Permissions Card (for Admin) */}
					{userData?.role_id === 1 && (
						<Card>
							<CardHeader>
								<CardTitle>Administrator Permissions</CardTitle>
								<CardDescription>You have full access to all system features</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{[
										"Manage Users",
										"Manage Roles",
										"Manage Station Master",
										"Manage Devices",
										"View History",
										"Manage Notifications",
										"System Configuration",
										"Full Dashboard Access"
									].map((permission) => (
										<div key={permission} className="flex items-center gap-2">
											<Icon icon="mdi:check-circle" size={20} className="text-green-600" />
											<span className="text-sm">{permission}</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			),
		},
		{
			icon: <Icon icon="lucide:monitor" size={24} className="mr-2" />,
			title: "Devices",
			content: <DevicesTab />,
		},
	];

	return (
		<Tabs defaultValue={tabs[0].title} className="w-full">
			<div className="relative flex flex-col justify-center items-center gap-4 p-4">
				<div style={bgStyle} className="h-full w-full z-1" />
				<div className="flex flex-col items-center justify-center gap-2 z-2">
					<Avatar className="h-24 w-24">
						<AvatarImage src="" />
						<AvatarFallback className="text-2xl font-bold">
							{userData?.username ? getInitials(userData.username) : "U"}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col justify-center items-center gap-2">
						<div className="flex items-center gap-2">
							<Title as="h5" className="text-xl">
								{userData?.username || "User"}
							</Title>
							<Icon icon="heroicons:check-badge-solid" size={20} color={themeVars.colors.palette.primary.default} />
						</div>
						<Text variant="body2">{userData?.role_id ? getRoleName(userData.role_id) : "User"}</Text>
					</div>
				</div>
				<TabsList className="z-5">
					{tabs.map((tab) => (
						<TabsTrigger key={tab.title} value={tab.title}>
							{tab.icon}
							{tab.title}
						</TabsTrigger>
					))}
				</TabsList>
			</div>

			{tabs.map((tab) => (
				<TabsContent key={tab.title} value={tab.title}>
					{tab.content}
				</TabsContent>
			))}
		</Tabs>
	);
}

export default UserProfile;
