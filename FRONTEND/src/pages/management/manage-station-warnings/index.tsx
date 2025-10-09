import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/dialog";
import { useEffect, useState, type FormEvent } from "react";
import apiClient from "@/api/apiClient";
import Swal from "sweetalert2";

interface Station {
	_id: string;
	station_id: number;
	status: boolean;
	devices: string[];
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
	assignments: { user: { id: string; user_id: string; email: string } }[];
}

interface WarningData {
	cellVoltage: {
		high: string;
		low: string;
		checkInterval: string;
	};
	temperature: {
		high: string;
		low: string;
		checkInterval: string;
	};
	current: {
		high: string;
		low: string;
		checkInterval: string;
	};
}

function ManageStationWarnings() {
	const [stations, setStations] = useState<Station[]>([]);
	const [loading, setLoading] = useState(false);
	const [showWarningDialog, setShowWarningDialog] = useState(false);
	const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
	const [showDevicesDialog, setShowDevicesDialog] = useState(false);
	const [showUsersDialog, setShowUsersDialog] = useState(false);
		const [showViewWarningsDialog, setShowViewWarningsDialog] = useState(false);
		const [viewWarningsData, setViewWarningsData] = useState<any>(null);
	const [warningData, setWarningData] = useState<WarningData>({
		cellVoltage: { high: '', low: '', checkInterval: '' },
		temperature: { high: '', low: '', checkInterval: '' },
		current: { high: '', low: '', checkInterval: '' },
	});

	const getCurrentUser = () => {
		try {
			const authUser = sessionStorage.getItem("authUser");
			if (authUser) {
				const user = JSON.parse(authUser);
				return user;
			}
			return null;
		} catch (error) {
			console.error("Error getting current user:", error);
			return null;
		}
	};

	const currentUser = getCurrentUser();
	console.log("Current User:", currentUser);

// Fetch all stations on component mount
useEffect(() => {
  fetchStations();
}, []);

const fetchStations = async () => {
  try {
    setLoading(true);
    const response = await apiClient.get({
      url: "/stations/getStations/",
    });

    setStations(response || []); // apiClient returns the data directly
    console.log("Fetched Stations:", response);
  } catch (error: any) {
    console.error("Error fetching stations:", error);
    Swal.fire({
      title: "Error",
      text: "Failed to fetch stations",
      icon: "error",
      confirmButtonColor: "#3b82f6",
    });
  } finally {
    setLoading(false);
  }
};

// Filter stations assigned to the current user
const userStations = stations.filter(station =>
 station.assignments?.some(assignment => assignment.user?.id === currentUser?._id)
);
console.log("User Stations:", userStations);


	const handleSetWarnings = (stationId: string) => {
		setSelectedStationId(stationId);
		setShowWarningDialog(true);
	};

	const handleCreateWarning = async (event: FormEvent) => {
		event.preventDefault();
		if (!selectedStationId) return;

		try {
			setLoading(true);
			const parsedWarningData = {
				cellVoltage: {
					high: parseFloat(warningData.cellVoltage.high) || 0,
					low: parseFloat(warningData.cellVoltage.low) || 0,
					checkInterval: parseInt(warningData.cellVoltage.checkInterval) || 0,
				},
				temperature: {
					high: parseFloat(warningData.temperature.high) || 0,
					low: parseFloat(warningData.temperature.low) || 0,
					checkInterval: parseInt(warningData.temperature.checkInterval) || 0,
				},
				current: {
					high: parseFloat(warningData.current.high) || 0,
					low: parseFloat(warningData.current.low) || 0,
					checkInterval: parseInt(warningData.current.checkInterval) || 0,
				},
			};
			await apiClient.post({
				url: `/warnings/createWarning/${selectedStationId}`,
				data: {
					warnings: parsedWarningData,
				},
			});

			Swal.fire({
				title: "Success!",
				text: "Warning created successfully",
				icon: "success",
				confirmButtonColor: "#3b82f6",
				timer: 2000,
			});

			setShowWarningDialog(false);
			fetchStations(); // Refresh stations to get updated warnings
		} catch (error: any) {
			console.error("Error creating warning:", error);
			Swal.fire({
				title: "Error",
				text: error?.response?.data?.message || "Failed to create warning",
				icon: "error",
				confirmButtonColor: "#3b82f6",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleViewWarnings = async (stationId: string) => {
		try {
			setLoading(true);
			const response = await apiClient.get({
				url: `/warnings/getWarnings/${stationId}`,
			});

			const warnings = response?.warnings || {};
			setViewWarningsData(warnings);
			setShowViewWarningsDialog(true);
		} catch (error: any) {
			console.error("Error fetching warnings:", error);
			Swal.fire({
				title: "Error",
				text: "Failed to fetch warnings",
				icon: "error",
				confirmButtonColor: "#3b82f6",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleWarningChange = (category: keyof WarningData, field: string, value: string) => {
		setWarningData(prev => ({
			...prev,
			[category]: {
				...prev[category],
				[field]: value,
			},
		}));
	};

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Manage Station & Warnings</h1>
					<p className="text-muted-foreground">
						Manage warnings for your assigned stations
					</p>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Your Stations</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{userStations.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Stations with Warnings</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{userStations.filter(station => station.warnings).length}
						</div>
					</CardContent>
				</Card>
			
			</div>

			{/* Stations Table */}
			<Card>
				<CardHeader>
					<CardTitle>Your Stations</CardTitle>
					<CardDescription>
						View and manage warnings for stations assigned to you
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Station</TableHead>
								<TableHead>Location</TableHead>
								<TableHead>Assigned Devices</TableHead>
								<TableHead>Assigned Users</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{userStations.map((station) => (
								<TableRow key={station._id}>
									<TableCell className="font-medium">{station.name}</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Icon icon="mdi:map-marker" size={16} className="text-muted-foreground" />
											<span className="text-sm">{station.location}</span>
										</div>
									</TableCell>
									{/* Devices column */}
<TableCell>
  {station.devices && station.devices.length > 0 ? (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-secondary/70"
      onClick={() => {
        setSelectedStationId(station._id);
        setShowDevicesDialog(true);
      }}
    >
      {station.devices.length} device(s)
    </Badge>
  ) : (
    <span className="text-muted-foreground">No devices</span>
  )}
</TableCell>

{/* Users column */}
<TableCell>
  {station.assignments && station.assignments.length > 0 ? (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-secondary/70"
      onClick={() => {
        setSelectedStationId(station._id);
        setShowUsersDialog(true);
      }}
    >
      {station.assignments.length} user(s)
    </Badge>
  ) : (
    <span className="text-muted-foreground">No users</span>
  )}
</TableCell>

									<TableCell>
										<Badge variant={station.status ? "default" : "secondary"}>
											{station.status ? "Active" : "Inactive"}
										</Badge>
									</TableCell>
									<TableCell className="text-right">
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleViewWarnings(station._id)}
												disabled={loading}
											>
												View Warnings
											</Button>
											<Button
												variant="default"
												size="sm"
												onClick={() => handleSetWarnings(station._id)}
												disabled={loading}
											>
												Set Warnings
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Set Warnings Dialog */}
			{/* Set Warnings Dialog */}
<Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
  <DialogContent className="sm:max-w-[600px]">
    <DialogHeader>
      <DialogTitle>Set Warnings</DialogTitle>
      <DialogDescription>
        Configure warning thresholds for cell voltage, temperature, and current.
      </DialogDescription>
    </DialogHeader>
    <form onSubmit={handleCreateWarning}>
      <div className="grid gap-4 py-4">

        {/* ===== CELL VOLTAGE ===== */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="cellVoltageHigh" className="text-right">Cell Voltage High</Label>
          <Input
            id="cellVoltageHigh"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g., 4.2"
            value={warningData.cellVoltage.high}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                handleWarningChange("cellVoltage", "high", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="cellVoltageLow" className="text-right">Cell Voltage Low</Label>
          <Input
            id="cellVoltageLow"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g., 3.0"
            value={warningData.cellVoltage.low}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                handleWarningChange("cellVoltage", "low", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="cellVoltageInterval" className="text-right">Check Interval (s)</Label>
          <Input
            id="cellVoltageInterval"
            type="number"
            min="0"
            placeholder="e.g., 120"
            value={warningData.cellVoltage.checkInterval}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*$/.test(value)) { // integers only
                handleWarningChange("cellVoltage", "checkInterval", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        {/* ===== TEMPERATURE ===== */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="temperatureHigh" className="text-right">Temperature High</Label>
          <Input
            id="temperatureHigh"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g., 70"
            value={warningData.temperature.high}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                handleWarningChange("temperature", "high", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="temperatureLow" className="text-right">Temperature Low</Label>
          <Input
            id="temperatureLow"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g., 10"
            value={warningData.temperature.low}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                handleWarningChange("temperature", "low", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="temperatureInterval" className="text-right">Check Interval (s)</Label>
          <Input
            id="temperatureInterval"
            type="number"
            min="0"
            placeholder="e.g., 300"
            value={warningData.temperature.checkInterval}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*$/.test(value)) {
                handleWarningChange("temperature", "checkInterval", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        {/* ===== CURRENT ===== */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="currentHigh" className="text-right">Current High</Label>
          <Input
            id="currentHigh"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g., 120"
            value={warningData.current.high}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                handleWarningChange("current", "high", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="currentLow" className="text-right">Current Low</Label>
          <Input
            id="currentLow"
            type="number"
            step="0.1"
            min="0"
            placeholder="e.g., 10"
            value={warningData.current.low}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value)) {
                handleWarningChange("current", "low", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="currentInterval" className="text-right">Check Interval (s)</Label>
          <Input
            id="currentInterval"
            type="number"
            min="0"
            placeholder="e.g., 180"
            value={warningData.current.checkInterval}
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d*$/.test(value)) {
                handleWarningChange("current", "checkInterval", value);
              }
            }}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
            }}
            className="col-span-3"
            required
          />
        </div>

      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Warning"}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>


			{/* View Warnings Dialog */}
			<Dialog open={showViewWarningsDialog} onOpenChange={setShowViewWarningsDialog}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>Station Warnings</DialogTitle>
						<DialogDescription>
							View configured warning thresholds for this station.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						{Object.keys(viewWarningsData || {}).length === 0 ? (
							<p className="text-center text-muted-foreground">No warnings configured for this station.</p>
						) : (
							<div className="grid gap-4">
								{/* Cell Voltage */}
								<div>
									<h4 className="font-semibold">Cell Voltage</h4>
									<p>High: {viewWarningsData.cellVoltage?.high ?? 'N/A'}</p>
									<p>Low: {viewWarningsData.cellVoltage?.low ?? 'N/A'}</p>
									<p>Check Interval: {viewWarningsData.cellVoltage?.checkInterval ?? 'N/A'}s</p>
								</div>
								{/* Temperature */}
								<div>
									<h4 className="font-semibold">Temperature</h4>
									<p>High: {viewWarningsData.temperature?.high ?? 'N/A'}</p>
									<p>Low: {viewWarningsData.temperature?.low ?? 'N/A'}</p>
									<p>Check Interval: {viewWarningsData.temperature?.checkInterval ?? 'N/A'}s</p>
								</div>
								{/* Current */}
								<div>
									<h4 className="font-semibold">Current</h4>
									<p>High: {viewWarningsData.current?.high ?? 'N/A'}</p>
									<p>Low: {viewWarningsData.current?.low ?? 'N/A'}</p>
									<p>Check Interval: {viewWarningsData.current?.checkInterval ?? 'N/A'}s</p>
								</div>
							</div>
						)}
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Close
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{/* View Devices Dialog */}
<Dialog open={showDevicesDialog} onOpenChange={setShowDevicesDialog}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Connected Devices</DialogTitle>
      <DialogDescription>
        Devices currently connected to this station.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      {selectedStationId &&
      stations.find((s) => s._id === selectedStationId)?.devices?.length ? (
        <ul className="list-disc pl-6 space-y-2">
          {stations
            .find((s) => s._id === selectedStationId)!
            .devices.map((device, index) => (
              <li key={index} className="text-sm font-medium">
                {device}
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-center text-muted-foreground">
          No devices connected to this station.
        </p>
      )}
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline">
          Close
        </Button>
      </DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* View Users Dialog */}
<Dialog open={showUsersDialog} onOpenChange={setShowUsersDialog}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Assigned Users</DialogTitle>
      <DialogDescription>
        Users assigned to this station.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      {selectedStationId &&
      stations.find((s) => s._id === selectedStationId)?.assignments?.length ? (
        <ul className="list-disc pl-6 space-y-2">
          {stations
            .find((s) => s._id === selectedStationId)!
            .assignments.map((assignment, index) => (
              <li key={index} className="text-sm">
                <div className="font-semibold">{assignment.user?.email}</div>
                <div className="text-muted-foreground text-xs">
                  User ID: {assignment.user?.user_id}
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-center text-muted-foreground">
          No users assigned to this station.
        </p>
      )}
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline">
          Close
        </Button>
      </DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>

		</div>
	);
}

export default ManageStationWarnings;