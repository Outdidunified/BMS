import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Title } from "@/ui/typography";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import Swal from "sweetalert2";

interface Station {
	_id: string;
	station_id: number;
	status: boolean;
	devices: {
		device_id: string;
	};
	warnings: {
		cellVoltage: {
			high: number;
			low: number;
			checkInterval: number;
		};
		temperature: {
			high: number;
			low: number;
			checkInterval: number;
		};
		current: {
			high: number;
			low: number;
			checkInterval: number;
		};
	};
	name: string;
	location: string;
	createdAt: string;
	updatedAt: string;
}

function ManageStationMaster() {
	const [stations, setStations] = useState<Station[]>([]);
	const [loading, setLoading] = useState(false);
	const [showAddForm, setShowAddForm] = useState(false);

	const getRoleId = (): number | null => {
		try {
			const authUser = sessionStorage.getItem("authUser");
			if (authUser) {
				const user = JSON.parse(authUser);
				return user.role_id || null;
			}
			return null;
		} catch (error) {
			console.error("Error getting role_id:", error);
			return null;
		}
	};

	const isAdmin = getRoleId() === 1;
	const [newStation, setNewStation] = useState({
		name: "",
		location: "",
	});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editStation, setEditStation] = useState({
		name: "",
		location: "",
	});
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");

	// Fetch all stations on component mount
	useEffect(() => {
		fetchStations();
	}, []);

	const fetchStations = async () => {
		try {
			setLoading(true);
				const response = await apiClient.get<Station[]>({
					url: "/stations/getStations/",
				});
				setStations(response);		} catch (error: any) {
			console.error("Error fetching stations:", error);
		} finally {
			setLoading(false);
		}
	};

	// Filter stations based on search and filters
	const filteredStations = stations.filter(station => {
		const matchesSearch = station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			station.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(station.devices?.device_id || '').toLowerCase().includes(searchTerm.toLowerCase());

		const matchesStatus = statusFilter === "all" ||
			(statusFilter === "active" && station.status === true) ||
			(statusFilter === "inactive" && station.status === false);

		return matchesSearch && matchesStatus;
	});

	const handleAdd = async () => {
		if (!newStation.name || !newStation.location) {
			Swal.fire({
				title: "Validation Error",
				text: "Please fill in all required fields",
				icon: "error",
				confirmButtonColor: "#3b82f6",
			});
			return;
		}

		try {
			setLoading(true);
			await apiClient.post({
				url: "/stations/createStation/",
				data: {
					name: newStation.name,
					location: newStation.location,
				},
			});

			Swal.fire({
				title: "Success!",
				text: "Station created successfully",
				icon: "success",
				confirmButtonColor: "#3b82f6",
				timer: 2000,
			});

			setNewStation({
				name: "",
				location: "",
			});
			setShowAddForm(false);
			fetchStations();
		} catch (error: any) {
			console.error("Error creating station:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleEdit = (station: Station) => {
		setEditingId(station._id);
		setEditStation({
			name: station.name,
			location: station.location,
		});
	};

	const handleUpdate = async (stationId: string) => {
		if (!editStation.name || !editStation.location) {
			Swal.fire({
				title: "Validation Error",
				text: "Name and location are required",
				icon: "error",
				confirmButtonColor: "#3b82f6",
			});
			return;
		}

		try {
			setLoading(true);
			await apiClient.put({
				url: `/stations/updateStation/${stationId}`,
				data: {
					name: editStation.name,
					location: editStation.location,
				},
			});

			Swal.fire({
				title: "Success!",
				text: "Station updated successfully",
				icon: "success",
				confirmButtonColor: "#3b82f6",
				timer: 2000,
			});

			setEditingId(null);
			fetchStations();
		} catch (error: any) {
			console.error("Error updating station:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleViewStation = async (stationId: string) => {
		try {
			setLoading(true);
			const response = await apiClient.get<Station>({
				url: `/stations/${stationId}`,
			});
			Swal.fire({
				title: "Station Details",
				html: `
					<div style="text-align: left; padding: 10px;">
						<p><strong>Name:</strong> ${response.name}</p>
						<p><strong>Location:</strong> ${response.location}</p>
						<p><strong>Status:</strong> ${response.status ? '<span style="color: green;">Active</span>' : '<span style="color: red;">Inactive</span>'}</p>
						<p><strong>Device ID:</strong> ${response.devices.device_id}</p>
						<p><strong>Created At:</strong> ${new Date(response.createdAt).toLocaleString()}</p>
						<p><strong>Updated At:</strong> ${new Date(response.updatedAt).toLocaleString()}</p>
					</div>
				`,
				icon: "info",
				confirmButtonColor: "#3b82f6",
				width: 600,
			});
		} catch (error: any) {
			console.error("Error viewing station:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleToggleStatus = async (stationId: string, currentStatus: boolean) => {
		const action = currentStatus ? "deactivate" : "activate";

		const result = await Swal.fire({
			title: `${action.charAt(0).toUpperCase() + action.slice(1)} Station?`,
			text: `Are you sure you want to ${action} this station?`,
			icon: "question",
			showCancelButton: true,
			confirmButtonColor: "#3b82f6",
			cancelButtonColor: "#6b7280",
			confirmButtonText: `Yes, ${action}!`,
			cancelButtonText: "Cancel",
		});

		if (result.isConfirmed) {
			try {
				setLoading(true);
				await apiClient.patch({
					url: `/stations/${stationId}/status`,
					data: {
						status: !currentStatus,
					},
				});

				Swal.fire({
					title: "Success!",
					text: `Station ${action}d successfully`,
					icon: "success",
					confirmButtonColor: "#3b82f6",
					timer: 2000,
				});

				fetchStations();
			} catch (error: any) {
				console.error("Error toggling station status:", error);
			} finally {
				setLoading(false);
			}
		}
	};

	const handleCreateStation = () => {
		setShowAddForm(true);
	};

	const handleViewWarnings = (station: Station) => {
		Swal.fire({
			title: "Warnings",
			html: `
				<div style="text-align: left; padding: 10px;">
					<h3>Cell Voltage</h3>
					<p>High: ${station.warnings.cellVoltage.high}V</p>
					<p>Low: ${station.warnings.cellVoltage.low}V</p>
					<p>Check Interval: ${station.warnings.cellVoltage.checkInterval}s</p>
					<h3>Temperature</h3>
					<p>High: ${station.warnings.temperature.high}°C</p>
					<p>Low: ${station.warnings.temperature.low}°C</p>
					<p>Check Interval: ${station.warnings.temperature.checkInterval}s</p>
					<h3>Current</h3>
					<p>High: ${station.warnings.current.high}A</p>
					<p>Low: ${station.warnings.current.low}A</p>
					<p>Check Interval: ${station.warnings.current.checkInterval}s</p>
				</div>
			`,
			confirmButtonColor: "#3b82f6",
		});
	};

	const getStatusBadge = (status: boolean) => {
		return (
			<Badge variant={status ? "default" : "secondary"}>
				{status ? "Active" : "Inactive"}
			</Badge>
		);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<Title as="h1" className="text-2xl font-bold">
						Manage Station
					</Title>
					<p className="text-muted-foreground mt-1">
						Manage all stations and their assigned devices
					</p>
				</div>
				{isAdmin && (
					<Button onClick={handleCreateStation} className="flex items-center gap-2">
						<Icon icon="mdi:plus" size={16} />
						Create Station
					</Button>
				)}
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
							{stations.filter(station => station.status === true).length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Devices</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stations.filter(station => station.devices && station.devices.device_id).length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Inactive Stations</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stations.filter(station => station.status === false).length}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Stations</CardTitle>
					<CardDescription>
						Manage all stations
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
					{/* Stations Table */}
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Station</TableHead>
      <TableHead>Location</TableHead>
      <TableHead>Device ID</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    {filteredStations.map((station) => (
      <TableRow key={station._id}>
        {/* Station Name */}
        <TableCell>
          <div className="font-medium">{station.name}</div>
        </TableCell>

        {/* Location */}
        <TableCell>
          <div className="flex items-center gap-2">
            <Icon icon="mdi:map-marker" size={16} className="text-muted-foreground" />
            <span className="text-sm">{station.location}</span>
          </div>
        </TableCell>

        {/* Device ID */}
        <TableCell>
          <Badge variant="outline">
            {station.devices?.device_id || "N/A"}
          </Badge>
        </TableCell>

        {/* Status Toggle */}
        <TableCell>
          <button
            onClick={() => handleToggleStatus(station._id, !station.status)}
            className={`relative w-10 h-5 rounded-full transition-colors 
              ${station.status ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform ${
                station.status ? "translate-x-5" : ""
              }`}
            ></span>
          </button>
        </TableCell>

        {/* Actions */}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
            //   onClick={() => handleViewDevices(station._id)}
              title="View station"
            >
              <Icon icon="mdi:eye" size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
            //   onClick={() => handleEditStation(station._id)}
              title="Edit station"
            >
              <Icon icon="mdi:pencil" size={16} />
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