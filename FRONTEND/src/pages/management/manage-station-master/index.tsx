import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Switch } from "@/ui/switch";
import { Title } from "@/ui/typography";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import apiClient from "@/api/apiClient";
import Swal from "sweetalert2";


interface Station {
	_id: string;
	station_id: number;
	status: boolean;
	devices?: unknown;
	warnings?: {
		cellVoltage?: {
			high?: number;
			low?: number;
			checkInterval?: number;
		};
		temperature?: {
			high?: number;
			low?: number;
			checkInterval?: number;
		};
		current?: {
			high?: number;
			low?: number;
			checkInterval?: number;
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
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showAssignUsersDialog, setShowAssignUsersDialog] = useState(false);
	const [deviceDialogStation, setDeviceDialogStation] = useState<Station | null>(null);









	

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
	const [newStationErrors, setNewStationErrors] = useState({
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
			setStations(response);
		} catch (error: any) {
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

	const handleAdd = async (event?: FormEvent<HTMLFormElement>) => {
		event?.preventDefault();

		const errors = {
			name: newStation.name.trim() ? "" : "Station name is required",
			location: newStation.location.trim() ? "" : "Location is required",
		};
		setNewStationErrors(errors);

		const hasErrors = Object.values(errors).some(Boolean);
		if (hasErrors) {
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
					name: newStation.name.trim(),
					location: newStation.location.trim(),
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
			setNewStationErrors({ name: "", location: "" });
			setShowCreateDialog(false);
			fetchStations();
		} catch (error: any) {
			console.error("Error creating station:", error);
			Swal.fire({
				title: "Error",
				text: error?.response?.data?.message || "Failed to create station",
				icon: "error",
				confirmButtonColor: "#3b82f6",
			});
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
			Swal.fire({
				title: "Error",
				text: error?.response?.data?.message || "Failed to update station",
				icon: "error",
				confirmButtonColor: "#3b82f6",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleViewStation = async (stationId: string) => {
		try {
			setLoading(true);
			const response = await apiClient.get<Station | { success?: boolean; data?: Station; message?: string }>({
				url: `/stations/getStation/${stationId}`,
			});

			const station =
				response && typeof response === "object" && "success" in response ? response.data : response;

			if (!station) {
				throw new Error(
					response && typeof response === "object" && "message" in response
						? response.message || "No station details returned"
						: "No station details returned",
				);
			}

			const {
				name,
				location,
				status,
				devices,
				warnings,
				createdAt,
				updatedAt,
			} = station;

			const deviceId = (() => {
				if (!devices) return "N/A";
				if (typeof devices === "string") return devices;
				if (Array.isArray(devices)) {
					const firstItem = devices[0];
					if (!firstItem) return "N/A";
					return typeof firstItem === "string" ? firstItem : firstItem?.device_id ?? "N/A";
				}
				if (typeof devices === "object") {
					const maybeDeviceId = (devices as Record<string, unknown>).device_id;
					return typeof maybeDeviceId === "string" ? maybeDeviceId : "N/A";
				}
				return "N/A";
			})();

			const formatWarning = (
				category?: { high?: number; low?: number; checkInterval?: number } | undefined,
			): string => {
				if (!category) return "N/A";
				const { high, low, checkInterval } = category;
				return [
					high != null ? `High: ${high}` : undefined,
					low != null ? `Low: ${low}` : undefined,
					checkInterval != null ? `Check Interval: ${checkInterval}s` : undefined,
				]
					.filter(Boolean)
					.join(", ");
			};

			Swal.fire({
				title: "Station Details",
				html: `
					<div style="text-align: left; padding: 10px;">
						<p><strong>Name:</strong> ${name ?? "N/A"}</p>
						<p><strong>Location:</strong> ${location ?? "N/A"}</p>
						<p><strong>Status:</strong> ${status ? '<span style="color: green;">Active</span>' : '<span style="color: red;">Inactive</span>'}</p>
						<p><strong>Device ID:</strong> ${deviceId}</p>
						<p><strong>Created At:</strong> ${createdAt ? new Date(createdAt).toLocaleString() : "N/A"}</p>
						<p><strong>Updated At:</strong> ${updatedAt ? new Date(updatedAt).toLocaleString() : "N/A"}</p>
						<h3>Warnings</h3>
						<p><strong>Cell Voltage:</strong> ${formatWarning(warnings?.cellVoltage)}</p>
						<p><strong>Temperature:</strong> ${formatWarning(warnings?.temperature)}</p>
						<p><strong>Current:</strong> ${formatWarning(warnings?.current)}</p>
					</div>
				`,
				icon: "info",
				confirmButtonColor: "#3b82f6",
				width: 600,
			});
		} catch (error: any) {
			console.error("Error viewing station:", error);
			Swal.fire({
				title: "Error",
				text: error?.message || error?.response?.data?.message || "Failed to load station details",
				icon: "error",
				confirmButtonColor: "#3b82f6",
			});
		} finally {
			setLoading(false);
		}
	};

const handleToggleStatus = async (stationId: string, currentStatus: boolean) => {
 const targetStatus = !currentStatus;
 const actionLabel = targetStatus ? "Activate" : "Deactivate";
 const endpoint = targetStatus
  ? `/stations/deactivateStation/${stationId}`
  : `/stations/deactivateStation/${stationId}`;

 const result = await Swal.fire({
  title: `${actionLabel} Station?`,
  text: `Are you sure you want to ${actionLabel.toLowerCase()} this station?`,
  icon: "question",
  showCancelButton: true,
  confirmButtonColor: "#3b82f6",
  cancelButtonColor: "#6b7280",
  confirmButtonText: `Yes, ${actionLabel.toLowerCase()}!`,
  cancelButtonText: "Cancel",
 });

 if (!result.isConfirmed) return;

 try {
  setLoading(true);
  await apiClient.put({
   url: endpoint,
   data: { status: targetStatus },
  });
  Swal.fire({
   title: "Success!",
   text: `Station ${actionLabel.toLowerCase()}d successfully`,
   icon: "success",
   confirmButtonColor: "#3b82f6",
   timer: 2000,
  });
  fetchStations();
 } catch (error: any) {
  console.error("Error toggling station status:", error);
  Swal.fire({
   title: "Error",
   text: error?.response?.data?.message || `Failed to ${actionLabel.toLowerCase()} station`,
   icon: "error",
   confirmButtonColor: "#3b82f6",
  });
 } finally {
  setLoading(false);
 }
};


	const handleAssignUsers = () => {
		setShowAssignUsersDialog(true);
	};

	const handleCreateStation = () => {
  setShowCreateDialog(true);
  setShowAddForm(false); // hide other forms if needed
};

const handleAddStation = async () => {
 if (!newStation.name || !newStation.location) {
  Swal.fire("Error", "Please fill in all fields", "error");
  return;
 }

 try {
  setLoading(true);

  const trimmedPayload = {
   name: newStation.name.trim(),
   location: newStation.location.trim(),
  };

  type CreateStationResponse = {
   success?: boolean;
   message?: string;
   data?: Station;
  };

  const response = await apiClient.post<CreateStationResponse | Station>({
   url: "/stations/createStation",
   data: trimmedPayload,
  });

  const isWrappedResponse = typeof response === "object" && response !== null && "success" in response;
  const requestSucceeded = isWrappedResponse ? (response.success ?? true) : true;

  if (requestSucceeded) {
   Swal.fire("Success", "Station created successfully", "success");
   setShowCreateDialog(false);
   setNewStation({ name: "", location: "" });
   fetchStations();
  } else {
   const errorMessage = isWrappedResponse && "message" in response ? response.message : "Failed to create station";
   Swal.fire("Error", errorMessage || "Failed to create station", "error");
  }
 } catch (error) {
  console.error(error);
  Swal.fire("Error", "Failed to create station", "error");
 } finally {
  setLoading(false);
 }
};



	const handleOpenDeviceDialog = (station: Station) => {
		setDeviceDialogStation(station);
	};

	const handleCloseDeviceDialog = () => {
		setDeviceDialogStation(null);
	};

	const handleCloseAssignUsers = () => {
		setShowAssignUsersDialog(false);
	};

	const handleViewWarnings = (station: Station) => {
		setSelectedWarningsStation(station);
		setTimeout(() => setViewWarningsModalOpen(true), 0);
	};

	const getStatusBadge = (status: boolean) => {
		return (
			<Badge variant={status ? "default" : "secondary"}>
				{status ? "Active" : "Inactive"}
			</Badge>
		);
	};

	const computedDevices = useMemo(() => {
		if (!deviceDialogStation?.devices) return [] as string[];

		const devices = deviceDialogStation.devices;

		if (Array.isArray(devices)) {
			return devices
				.map(device => (typeof device === "string" ? device : device?.device_id ?? ""))
				.filter(Boolean);
		}

		if (typeof devices === "string") {
			return [devices];
		}

		if (typeof devices === "object") {
			const collected: string[] = [];
			Object.values(devices).forEach(deviceValue => {
				if (Array.isArray(deviceValue)) {
					deviceValue.forEach(item => {
						const id = typeof item === "string" ? item : item?.device_id;
						if (id) collected.push(id);
					});
					return;
				}
				if (typeof deviceValue === "object" && deviceValue) {
					const id = (deviceValue as Record<string, unknown>).device_id;
					if (typeof id === "string") collected.push(id);
					return;
				}
				if (typeof deviceValue === "string") {
					collected.push(deviceValue);
				}
			});
			return collected;
		}

		return [] as string[];
	}, [deviceDialogStation]);

	const renderDevicesButtonLabel = (station: Station) => {
		if (!station.devices) return "N/A";
		if (typeof station.devices === "string") return station.devices;

		if (Array.isArray(station.devices)) {
			const first = station.devices[0];
			if (!first) return "N/A";
			return typeof first === "string" ? first : first?.device_id ?? "N/A";
		}

		if (typeof station.devices === "object") {
			if ("device_id" in station.devices) {
				return (station.devices as Record<string, unknown>).device_id as string ?? "N/A";
			}

			const firstValue = Object.values(station.devices)[0];
			if (!firstValue) return "N/A";

			if (Array.isArray(firstValue)) {
				const nestedFirst = firstValue[0];
				return typeof nestedFirst === "string" ? nestedFirst : nestedFirst?.device_id ?? "N/A";
			}

			if (typeof firstValue === "object") {
				return (firstValue as Record<string, unknown>).device_id as string ?? "N/A";
			}

			if (typeof firstValue === "string") {
				return firstValue;
			}
		}

		return "N/A";
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<Title as="h1" className="text-2xl font-bold">
						Manage Station
					</Title>
					<p className="text-muted-foreground mt-1">
						Manage all stations and their assigned devices
					</p>
				</div>
				{isAdmin && (
					<div className="flex flex-wrap items-center gap-2">
						<Button onClick={handleAssignUsers} variant="outline" className="flex items-center gap-2">
							<Icon icon="mdi:account-multiple-plus" size={16} />
							Assign Users
						</Button>
					<Button onClick={handleCreateStation} className="flex items-center gap-2">
  <Icon icon="mdi:plus" size={16} />
  Create Station
</Button>
					</div>

)}

			</div>


{/* Create Station Form */}
{showCreateDialog && (
  <Card>
    <CardHeader>
      <CardTitle>Create Station</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Station Name */}
        <Input
          placeholder="Station Name"
          value={newStation.name}
          onChange={(e) =>
            setNewStation({ ...newStation, name: e.target.value })
          }
        />

        {/* Station Location */}
        <Input
          placeholder="Location"
          value={newStation.location}
          onChange={(e) =>
            setNewStation({ ...newStation, location: e.target.value })
          }
        />

        {/* Action Buttons */}
        <div className="flex gap-2 md:col-span-2">
          <Button
            className="flex-1 bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
            onClick={handleAddStation}
            disabled={loading}
          >
            <Icon icon="lucide:check" size={18} />
            {loading ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setShowCreateDialog(false);
              setNewStation({ name: "", location: "" });
            }}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
)}

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
          {editingId === station._id ? (
            <Input
              value={editStation.name}
              onChange={(e) => setEditStation({ ...editStation, name: e.target.value })}
            />
          ) : (
            <div className="font-medium">{station.name}</div>
          )}
        </TableCell>

        {/* Location */}
        <TableCell>
          {editingId === station._id ? (
            <Input
              value={editStation.location}
              onChange={(e) => setEditStation({ ...editStation, location: e.target.value })}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Icon icon="mdi:map-marker" size={16} className="text-muted-foreground" />
              <span className="text-sm">{station.location}</span>
            </div>
          )}
        </TableCell>

{/* Device ID */}
<TableCell>
  <Dialog>
    <DialogTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        title="View devices"
        className="text-green-600 hover:text-blue-700 hover:bg-blue-50"
      >
        View Devices
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Device Data</DialogTitle>
        <DialogDescription>
          Device information for the station.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        {station.devices ? (
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(station.devices, null, 2)}
          </pre>
        ) : (
          <div className="text-center">No device details available.</div>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">
            Close
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</TableCell>










        {/* Status Toggle */}
        <TableCell>
          {getStatusBadge(station.status)}
        </TableCell>

        {/* Actions */}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {editingId === station._id ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdate(station._id)}
                  title="Save"
                >
                  <Icon icon="mdi:check" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(null)}
                  title="Cancel"
                >
                  <Icon icon="mdi:close" size={16} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewStation(station._id)}
                  title="View station"
                >
                  <Icon icon="mdi:eye" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(station)}
                  title="Edit station"
                >
                  <Icon icon="mdi:pencil" size={16} />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="View warnings"
                    >
                      <Icon icon="mdi:alert" size={16} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Warning Details</DialogTitle>
                      <DialogDescription>
                        Review recent alerts for this station.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">Cell Voltage</h4>
                        <p>High: {station.warnings?.cellVoltage?.high ?? "N/A"}V</p>
                        <p>Low: {station.warnings?.cellVoltage?.low ?? "N/A"}V</p>
                        <p>Check Interval: {station.warnings?.cellVoltage?.checkInterval ?? "N/A"}s</p>
                      </div>
                      <div>
                        <h4 className="font-medium">Temperature</h4>
                        <p>High: {station.warnings?.temperature?.high ?? "N/A"}°C</p>
                        <p>Low: {station.warnings?.temperature?.low ?? "N/A"}°C</p>
                        <p>Check Interval: {station.warnings?.temperature?.checkInterval ?? "N/A"}s</p>
                      </div>
                      <div>
                        <h4 className="font-medium">Current</h4>
                        <p>High: {station.warnings?.current?.high ?? "N/A"}A</p>
                        <p>Low: {station.warnings?.current?.low ?? "N/A"}A</p>
                        <p>Check Interval: {station.warnings?.current?.checkInterval ?? "N/A"}s</p>
                      </div>
                    </div>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">
                          Close
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
  <Switch
    checked={station.status}
    onCheckedChange={() => handleToggleStatus(station._id, station.status)}
  />

              </>
            )}
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