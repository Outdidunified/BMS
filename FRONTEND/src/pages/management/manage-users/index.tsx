import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { Title } from "@/ui/typography";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { useState } from "react";

interface User {
	id: number;
	username: string;
	email: string;
	fullName: string;
	role: string;
	roleId: number;
	status: "active" | "inactive" | "suspended";
	lastLogin: string;
	createdAt: string;
	avatar?: string;
}

// Mock data - replace with actual API call
const mockUsers: User[] = [
	{
		id: 1,
		username: "admin",
		email: "admin@bms.com",
		fullName: "System Administrator",
		role: "Administrator",
		roleId: 1,
		status: "active",
		lastLogin: "2024-12-20 10:30:00",
		createdAt: "2024-01-15",
	},
	{
		id: 2,
		username: "manager1",
		email: "manager1@bms.com",
		fullName: "John Manager",
		role: "Manager",
		roleId: 2,
		status: "active",
		lastLogin: "2024-12-19 16:45:00",
		createdAt: "2024-02-01",
	},
	{
		id: 3,
		username: "operator1",
		email: "operator1@bms.com",
		fullName: "Jane Operator",
		role: "Operator",
		roleId: 3,
		status: "active",
		lastLogin: "2024-12-20 08:15:00",
		createdAt: "2024-02-15",
	},
	{
		id: 4,
		username: "viewer1",
		email: "viewer1@bms.com",
		fullName: "Bob Viewer",
		role: "Viewer",
		roleId: 4,
		status: "inactive",
		lastLogin: "2024-12-10 14:20:00",
		createdAt: "2024-03-01",
	},
	{
		id: 5,
		username: "operator2",
		email: "operator2@bms.com",
		fullName: "Alice Smith",
		role: "Operator",
		roleId: 3,
		status: "suspended",
		lastLogin: "2024-12-05 11:30:00",
		createdAt: "2024-03-15",
	}
];

function ManageUsers() {
	const [users] = useState<User[]>(mockUsers);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [roleFilter, setRoleFilter] = useState<string>("all");

	// Filter users based on search and filters
	const filteredUsers = users.filter(user => {
		const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
			user.email.toLowerCase().includes(searchTerm.toLowerCase());
		
		const matchesStatus = statusFilter === "all" || user.status === statusFilter;
		const matchesRole = roleFilter === "all" || user.role === roleFilter;
		
		return matchesSearch && matchesStatus && matchesRole;
	});

	const handleCreateUser = () => {
		// TODO: Implement create user functionality
		console.log("Create new user");
	};

	const handleEditUser = (userId: number) => {
		// TODO: Implement edit user functionality
		console.log("Edit user:", userId);
	};

	const handleDeleteUser = (userId: number) => {
		// TODO: Implement delete user functionality
		console.log("Delete user:", userId);
	};

	const handleToggleStatus = (userId: number) => {
		// TODO: Implement toggle user status functionality
		console.log("Toggle status for user:", userId);
	};

	const getStatusBadge = (status: string) => {
		const variants = {
			active: "default",
			inactive: "secondary",
			suspended: "destructive"
		} as const;
		
		return (
			<Badge variant={variants[status as keyof typeof variants] || "secondary"}>
				{status}
			</Badge>
		);
	};

	const getRoleBadge = (role: string) => {
		const colors = {
			Administrator: "bg-red-100 text-red-800",
			Manager: "bg-blue-100 text-blue-800",
			Operator: "bg-green-100 text-green-800",
			Viewer: "bg-gray-100 text-gray-800"
		} as const;
		
		return (
			<Badge className={colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
				{role}
			</Badge>
		);
	};

	const getInitials = (name: string) => {
		return name.split(' ').map(n => n[0]).join('').toUpperCase();
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<Title as="h1" className="text-2xl font-bold">
						Manage Users
					</Title>
					<p className="text-muted-foreground mt-1">
						Create and manage system users and their access
					</p>
				</div>
				<Button onClick={handleCreateUser} className="flex items-center gap-2">
					<Icon icon="mdi:plus" size={16} />
					Create User
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{users.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Active Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{users.filter(user => user.status === "active").length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{users.filter(user => user.status === "inactive").length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{users.filter(user => user.status === "suspended").length}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Users</CardTitle>
					<CardDescription>
						Manage system users and their permissions
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col sm:flex-row gap-4 mb-6">
						<div className="flex-1">
							<Input
								placeholder="Search users..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="max-w-sm"
							/>
						</div>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
								<SelectItem value="suspended">Suspended</SelectItem>
							</SelectContent>
						</Select>
						<Select value={roleFilter} onValueChange={setRoleFilter}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by role" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Roles</SelectItem>
								<SelectItem value="Administrator">Administrator</SelectItem>
								<SelectItem value="Manager">Manager</SelectItem>
								<SelectItem value="Operator">Operator</SelectItem>
								<SelectItem value="Viewer">Viewer</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Users Table */}
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Last Login</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredUsers.map((user) => (
								<TableRow key={user.id}>
									<TableCell>
										<div className="flex items-center gap-3">
											<Avatar className="h-8 w-8">
												<AvatarImage src={user.avatar} />
												<AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
											</Avatar>
											<div>
												<div className="font-medium">{user.fullName}</div>
												<div className="text-sm text-muted-foreground">@{user.username}</div>
											</div>
										</div>
									</TableCell>
									<TableCell>{user.email}</TableCell>
									<TableCell>{getRoleBadge(user.role)}</TableCell>
									<TableCell>{getStatusBadge(user.status)}</TableCell>
									<TableCell className="text-sm">{user.lastLogin}</TableCell>
									<TableCell>{user.createdAt}</TableCell>
									<TableCell className="text-right">
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleToggleStatus(user.id)}
												title={user.status === "active" ? "Suspend user" : "Activate user"}
											>
												<Icon 
													icon={user.status === "active" ? "mdi:pause" : "mdi:play"} 
													size={16} 
												/>
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleEditUser(user.id)}
											>
												<Icon icon="mdi:pencil" size={16} />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDeleteUser(user.id)}
												disabled={user.id === 1} // Prevent deleting admin user
											>
												<Icon icon="mdi:delete" size={16} />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{filteredUsers.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							No users found matching your criteria.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default ManageUsers;