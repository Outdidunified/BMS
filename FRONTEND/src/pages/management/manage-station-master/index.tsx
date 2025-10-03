import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Title } from "@/ui/typography";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { useState } from "react";

interface Station {
	id: number;
	stationName: string;
	stationCode: string;
	location: string;
	masterName: string;
	masterEmail: string;
	masterPhone: string;
	deviceCount: number;
	status: "active" | "inactive" | "maintenance";
	createdAt: string;
	lastUpdated: string;
}

// Mock data - replace with actual API call
const mockStations: Station[] = [
	{
		id: 1,
		stationName: "Central Station",
		stationCode: "CS-001",
		location: "Downtown, City Center",
		masterName: "John Smith",
		masterEmail: "john.smith@bms.com",
		masterPhone: "+1 234-567-8901",
		deviceCount: 25,
		status: "active",
		createdAt: "2024-01-15",
		lastUpdated: "2024-12-20 10:30:00"
	},
	{
		id: 2,
		stationName: "North Station",
		stationCode: "NS-002",
		location: "North District, Zone A",
		masterName: "Sarah Johnson",
		masterEmail: "sarah.johnson@bms.com",
		masterPhone: "+1 234-567-8902",
		deviceCount: 18,
		status: "active",
		createdAt: "2024-02-01",
		lastUpdated: "2024-12-19 15:20:00"
	},
	{
		id: 3,
		stationName: "East Station",
		stationCode: "ES-003",
		location: "East District, Industrial Area",
		masterName: "Michael Brown",
		masterEmail: "michael.brown@bms.com",
		masterPhone: "+1 234-567-8903",
		deviceCount: 32,
		status: "maintenance",
		createdAt: "2024-02-15",
		lastUpdated: "2024-12-18 09:45:00"
	},
	{
		id: 4,
		stationName: "West Station",
		stationCode: "WS-004",
		location: "West District, Residential",
		masterName: "Emily Davis",
		masterEmail: "emily.davis@bms.com",
		masterPhone: "+1 234-567-8904",
		deviceCount: 15,
		status: "active",
		createdAt: "2024-03-01",
		lastUpdated: "2024-12-20 08:15:00"
	},
	{
		id: 5,
		stationName: "South Station",
		stationCode: "SS-005",
		location: "South District, Commercial",
		masterName: "Robert Wilson",
		masterEmail: "robert.wilson@bms.com",
		masterPhone: "+1 234-567-8905",
		deviceCount: 12,
		status: "inactive",
		createdAt: "2024-03-15",
		lastUpdated: "2024-12-15 14:30:00"
	}
];

function ManageStationMaster() {
	const [stations] = useState<Station[]>(mockStations);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");

	// Filter stations based on search and filters
	const filteredStations = stations.filter(station => {
		const matchesSearch = station.stationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			station.stationCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
			station.masterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			station.location.toLowerCase().includes(searchTerm.toLowerCase());
		
		const matchesStatus = statusFilter === "all" || station.status === statusFilter;
		
		return matchesSearch && matchesStatus;
	});

	const handleCreateStation = () => {
		// TODO: Implement create station functionality
		console.log("Create new station");
	};

	const handleEditStation = (stationId: number) => {
		// TODO: Implement edit station functionality
		console.log("Edit station:", stationId);
	};

	const handleDeleteStation = (stationId: number) => {
		// TODO: Implement delete station functionality
		console.log("Delete station:", stationId);
	};

	const handleViewDevices = (stationId: number) => {
		// TODO: Implement view devices functionality
		console.log("View devices for station:", stationId);
	};

	const getStatusBadge = (status: string) => {
		const variants = {
			active: "default",
			inactive: "secondary",
			maintenance: "destructive"
		} as const;
		
		return (
			<Badge variant={variants[status as keyof typeof variants] || "secondary"}>
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
						Manage Station Master
					</Title>
					<p className="text-muted-foreground mt-1">
						Manage stations, station masters, and their assigned devices
					</p>
				</div>
				<Button onClick={handleCreateStation} className="flex items-center gap-2">
					<Icon icon="mdi:plus" size={16} />
					Create Station
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Stations</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{stations.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Active Stations</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stations.filter(station => station.status === "active").length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Devices</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stations.reduce((sum, station) => sum + station.deviceCount, 0)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stations.filter(station => station.status === "maintenance").length}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Stations</CardTitle>
					<CardDescription>
						Manage all stations and their station masters
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col sm:flex-row gap-4 mb-6">
						<div className="flex-1">
							<Input
								placeholder="Search stations, masters, or locations..."
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
								<SelectItem value="maintenance">Maintenance</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Stations Table */}
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Station</TableHead>
								<TableHead>Location</TableHead>
								<TableHead>Station Master</TableHead>
								<TableHead>Contact</TableHead>
								<TableHead>Devices</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Last Updated</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredStations.map((station) => (
								<TableRow key={station.id}>
									<TableCell>
										<div>
											<div className="font-medium">{station.stationName}</div>
											<div className="text-sm text-muted-foreground">{station.stationCode}</div>
										</div>
									</TableCell>
									<TableCell className="max-w-xs">
										<div className="flex items-center gap-2">
											<Icon icon="mdi:map-marker" size={16} className="text-muted-foreground" />
											<span className="text-sm">{station.location}</span>
										</div>
									</TableCell>
									<TableCell>
										<div>
											<div className="font-medium">{station.masterName}</div>
											<div className="text-sm text-muted-foreground">{station.masterEmail}</div>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Icon icon="mdi:phone" size={16} className="text-muted-foreground" />
											<span className="text-sm">{station.masterPhone}</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline">{station.deviceCount}</Badge>
									</TableCell>
									<TableCell>{getStatusBadge(station.status)}</TableCell>
									<TableCell className="text-sm">{station.lastUpdated}</TableCell>
									<TableCell className="text-right">
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleViewDevices(station.id)}
												title="View devices"
											>
												<Icon icon="mdi:devices" size={16} />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleEditStation(station.id)}
												title="Edit station"
											>
												<Icon icon="mdi:pencil" size={16} />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDeleteStation(station.id)}
												title="Delete station"
											>
												<Icon icon="mdi:delete" size={16} />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{filteredStations.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							No stations found matching your criteria.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default ManageStationMaster;