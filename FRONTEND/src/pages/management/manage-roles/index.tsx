import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Title } from "@/ui/typography";
import { useState } from "react";

interface Role {
	id: number;
	name: string;
	description: string;
	permissions: string[];
	userCount: number;
	createdAt: string;
	status: "active" | "inactive";
}

// Mock data - replace with actual API call
const mockRoles: Role[] = [
	{
		id: 1,
		name: "Administrator",
		description: "Full system access with all permissions",
		permissions: ["user.create", "user.read", "user.update", "user.delete", "role.manage", "system.config"],
		userCount: 2,
		createdAt: "2024-01-15",
		status: "active"
	},
	{
		id: 2,
		name: "Manager",
		description: "Management level access with limited permissions",
		permissions: ["user.read", "user.update", "device.manage", "history.view"],
		userCount: 5,
		createdAt: "2024-01-20",
		status: "active"
	},
	{
		id: 3,
		name: "Operator",
		description: "Basic operational access",
		permissions: ["device.view", "history.view", "notifications.view"],
		userCount: 12,
		createdAt: "2024-02-01",
		status: "active"
	},
	{
		id: 4,
		name: "Viewer",
		description: "Read-only access to system data",
		permissions: ["device.view", "history.view"],
		userCount: 8,
		createdAt: "2024-02-10",
		status: "inactive"
	}
];

function ManageRoles() {
	const [roles] = useState<Role[]>(mockRoles);

	const handleCreateRole = () => {
		// TODO: Implement create role functionality
		console.log("Create new role");
	};

	const handleEditRole = (roleId: number) => {
		// TODO: Implement edit role functionality
		console.log("Edit role:", roleId);
	};

	const handleDeleteRole = (roleId: number) => {
		// TODO: Implement delete role functionality
		console.log("Delete role:", roleId);
	};

	const getStatusBadge = (status: string) => {
		return (
			<Badge variant={status === "active" ? "default" : "secondary"}>
				{status}
			</Badge>
		);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<Title as="h1" className="text-2xl font-bold">
						Manage Roles
					</Title>
					<p className="text-muted-foreground mt-1">
						Create and manage user roles and permissions
					</p>
				</div>
				<Button onClick={handleCreateRole} className="flex items-center gap-2">
					<Icon icon="mdi:plus" size={16} />
					Create Role
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Roles</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{roles.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Active Roles</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{roles.filter(role => role.status === "active").length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{roles.reduce((sum, role) => sum + role.userCount, 0)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Permissions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{Array.from(new Set(roles.flatMap(role => role.permissions))).length}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Roles Table */}
			<Card>
				<CardHeader>
					<CardTitle>Roles</CardTitle>
					<CardDescription>
						Manage system roles and their permissions
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Role Name</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>Users</TableHead>
								<TableHead>Permissions</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{roles.map((role) => (
								<TableRow key={role.id}>
									<TableCell className="font-medium">{role.name}</TableCell>
									<TableCell className="max-w-xs truncate">{role.description}</TableCell>
									<TableCell>
										<Badge variant="outline">{role.userCount}</Badge>
									</TableCell>
									<TableCell>
										<Badge variant="secondary">{role.permissions.length}</Badge>
									</TableCell>
									<TableCell>{getStatusBadge(role.status)}</TableCell>
									<TableCell>{role.createdAt}</TableCell>
									<TableCell className="text-right">
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleEditRole(role.id)}
											>
												<Icon icon="mdi:pencil" size={16} />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDeleteRole(role.id)}
												disabled={role.id === 1} // Prevent deleting admin role
											>
												<Icon icon="mdi:delete" size={16} />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}

export default ManageRoles;