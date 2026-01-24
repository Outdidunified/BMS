import { useState, useEffect } from "react";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";
import Swal from "sweetalert2";
import { Switch } from "@/ui/switch"; 
import { API_BASE_URL } from "@/global-config";
import { useRouter } from "@/routes/hooks/use-router";

interface Device {
  deviceId: string;
  batteryId: string;
  macId: string;
  status: boolean;
  // status?: "Active" | "Inactive";
}

export default function DevicesTab() {
  const { push } = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState<Partial<Device>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDevice, setEditDevice] = useState<Partial<Device>>({});
  const [viewDevice, setViewDevice] = useState<Device | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch all devices
 const fetchDevices = async () => {
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch(`${API_BASE_URL}/devices/fetch-all?includeInactive=true`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();

    if (!res.ok || data?.success === false) {
      const errorMessage = data?.message ?? "Failed to fetch devices.";
      await Swal.fire({
        title: "Error",
        text: errorMessage,
        icon: "error",
        confirmButtonText: "OK",
      });

      if (res.status === 401 && errorMessage.includes("Access token required")) {
        push("/auth/login");
      }

      setDevices([]);
      return;
    }

    const devicesData: Device[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : [];

    // ✅ Normalize boolean -> "Active" | "Inactive"
   setDevices(
  devicesData.map((d: any) => ({
    ...d,
    status: d.status === true, // 👈 ensure it's boolean
  }))
);
  } catch (err) {
    console.error("Error fetching devices:", err);
  }
};


  useEffect(() => {
    fetchDevices();
  }, []);

  // Add device
  const handleAdd = async () => {
    if (!newDevice.deviceId || !newDevice.batteryId || !newDevice.macId) {
      setErrorMessage("All fields are required.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/devices/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDevice),
      });

      if (!res.ok) {
        const errData = await res.json();
        setErrorMessage(errData.message || "Failed to add device.");
        return;
      }

      setNewDevice({});
      setShowAddForm(false);
      fetchDevices();
      await Swal.fire({
  title: "Success",
  text: "Device added successfully!",
  icon: "success",
  confirmButtonText: "OK",
});
    } catch (err) {
      console.error("Error adding device:", err);
      setErrorMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // View device
  const handleView = async (deviceId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${deviceId}`, { method: "GET" });
      const data = await res.json();
      if (data && data.data) {
        setViewDevice(data.data);
      } else {
        console.error("Unexpected response:", data);
      }
    } catch (err) {
      console.error("Error viewing device:", err);
    }
  };

  // Handle inline edit
  const handleEditChange = (field: keyof Device, value: string) => {
    setEditDevice((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Update device
  const handleUpdate = async (deviceId: string) => {
    if (!editDevice.deviceId || !editDevice.batteryId || !editDevice.macId) {
      setErrorMessage("All fields are required.");
      return;
    }

    setUpdatingId(deviceId);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/devices/update/${deviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDevice),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || "Failed to update device.");
        return;
      }

      setDevices((prev) =>
        prev.map((d) => (d.deviceId === deviceId ? { ...d, ...editDevice } : d))
      );

      setEditingId(null);
      setEditDevice({});

      await Swal.fire({
        title: "Success",
        text: data.message || "Device updated successfully",
        icon: "success",
        confirmButtonText: "OK",
      });

      fetchDevices();
    } catch (err) {
      console.error("Error updating device:", err);
      setErrorMessage("Network error. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Activate/Deactivate device
 const handleToggleStatus = async (device: Device) => {
const newStatus = !device.status;   try {
    const res = await fetch(`${API_BASE}/devices/${device.deviceId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to update status:", data);
      return;
    }

     setDevices((prev) =>
      prev.map((d) =>
        d.deviceId === device.deviceId ? { ...d, status: newStatus } : d
      )
    );
     await Swal.fire({
      title: "Success",
      text: `Device ${device.deviceId} is now ${
        newStatus ? "Active" : "Inactive"
      }`,
      icon: "success",
      confirmButtonText: "OK",
    });
  } catch (err) {
    console.error("Error updating device status:", err);
     await Swal.fire({
      title: "Error",
      text: "Failed to update device status. Please try again.",
      icon: "error",
      confirmButtonText: "OK",
    });
  }
};



  return (
    <div className="p-6 border rounded-xl shadow-lg bg-white flex flex-col gap-6">
      {/* Heading */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Device Overview</h2>
          <p className="text-gray-500">Monitor and manage all your DataHive devices</p>
        </div>
        <Button
          className="flex items-center gap-2 text-green-600 hover:text-green-700 bg-transparent"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Icon icon="lucide:plus" /> Add Device
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mt-4">
        <Input
          type="text"
          placeholder="Search by Device ID, Battery ID, MAC Address, or Status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Add Device Form */}
     {/* Add Device Form */}
{showAddForm && (
  <div className="flex flex-col gap-2 mt-4 mb-4 p-4 border rounded-lg bg-gray-50">
    <div className="flex flex-wrap gap-2 items-center">
      <Input
        placeholder="Device ID"
        value={newDevice.deviceId || ""}
        onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
        className="flex-1 min-w-[120px]"
      />
      <Input
        placeholder="Battery ID"
        value={newDevice.batteryId || ""}
        onChange={(e) => setNewDevice({ ...newDevice, batteryId: e.target.value })}
        className="flex-1 min-w-[120px]"
      />
      <Input
        placeholder="MAC Address"
        value={newDevice.macId || ""}
        onChange={(e) => setNewDevice({ ...newDevice, macId: e.target.value })}
        className="flex-1 min-w-[150px]"
      />

      {/* Save Button */}
      <Button
        className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
        onClick={handleAdd}
        disabled={loading}
      >
        <Icon icon="lucide:check" /> {loading ? "Saving..." : "Save"}
      </Button>

      {/* Cancel Button with X Icon */}
      <Button
        className="bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center gap-2"
        onClick={() => setShowAddForm(false)}
      >
        <Icon icon="lucide:x" /> Cancel
      </Button>
    </div>

    {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
  </div>
)}


      {/* Devices Table */}
<div className="overflow-x-auto mt-4">
  <table className="min-w-full border-collapse">
    <thead className="bg-gray-100 text-gray-700">
      <tr>
        <th className="py-3 px-4 text-left font-semibold">Device ID</th>
        <th className="py-3 px-4 text-left font-semibold">Battery ID</th>
        <th className="py-3 px-4 text-left font-semibold">MAC Address</th>
            <th className="py-3 px-4 text-left font-semibold">Status</th>
        <th className="py-3 px-4 text-left font-semibold">Actions</th>
      </tr>
    </thead>

    <tbody>
      {devices.filter(device =>
        device.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.batteryId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.macId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.status ? "active" : "inactive").toLowerCase().includes(searchTerm.toLowerCase())
      ).map((device) => (
        <tr key={device.deviceId} className="bg-white hover:bg-gray-50 transition-colors">
          {/* Device ID */}
         <td className="py-3 px-4">
  {editingId === device.deviceId ? (
    updatingId === device.deviceId ? (
      <span className="text-gray-400">Updating...</span>
    ) : (
      // ✅ Show plain text instead of input
      <span className="text-gray-700 font-medium">{device.deviceId}</span>
    )
  ) : (
    device.deviceId
  )}
</td>


          {/* Battery ID */}
          <td className="py-3 px-4">
            {editingId === device.deviceId ? (
              updatingId === device.deviceId ? (
                <span className="text-gray-400">Updating...</span>
              ) : (
                <Input
                  value={editDevice.batteryId || ""}
                  onChange={(e) => handleEditChange("batteryId", e.target.value)}
                  className="w-full"
                />
              )
            ) : (
              device.batteryId
            )}
          </td>

          {/* MAC Address */}
          <td className="py-3 px-4">
            {editingId === device.deviceId ? (
              updatingId === device.deviceId ? (
                <span className="text-gray-400">Updating...</span>
              ) : (
                <Input
                  value={editDevice.macId || ""}
                  onChange={(e) => handleEditChange("macId", e.target.value)}
                  className="w-full"
                />
              )
            ) : (
              device.macId
            )}
          </td>
          {/* status column */}
            <td className="py-3 px-4">
  <span
    className={`px-3 py-1 rounded-full text-sm font-semibold ${
      device.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}
  >
    {device.status ? "Active" : "Inactive"}
  </span>
</td>


          {/* Actions Column */}
         <td className="py-3 px-4 flex gap-2">
  {editingId === device.deviceId ? (
    <>
      <Button
        className="bg-green-500 text-white"
        onClick={() => handleUpdate(device.deviceId)}
        disabled={loading}
      >
        <Icon icon="lucide:check" />
      </Button>
      <Button
        className="bg-gray-200 text-gray-700"
        onClick={() => setEditingId(null)}
      >
        Cancel
      </Button>
    </>
  ) : (
    <>
      <Button
        size="icon"
        variant="outline"
        onClick={() => {
          setEditingId(device.deviceId);
          setEditDevice(device);
        }}
      >
        <Icon icon="lucide:edit" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleView(device.deviceId)}
      >
        View
      </Button>
        {/* ✅ Centered Switch */}
      <div className="flex items-center justify-center">
        <Switch
          checked={device.status}
          onCheckedChange={() => handleToggleStatus(device)}
        />
      </div>
    </>
  )}
</td>

        </tr>
      ))}
    </tbody>
  </table>
</div>


      {/* Device Detail Modal */}
      {viewDevice && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-slide-up">
            <button
              onClick={() => setViewDevice(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <Icon icon="lucide:x" size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <Icon icon="lucide:cpu" size={28} className="text-green-500" />
              <h3 className="text-xl font-bold text-gray-800">Device Details</h3>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between bg-gray-50 p-3 rounded-lg shadow-sm">
                <span className="font-medium text-gray-600">Device ID:</span>
                <span className="text-gray-800">{viewDevice.deviceId}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-3 rounded-lg shadow-sm">
                <span className="font-medium text-gray-600">Battery ID:</span>
                <span className="text-gray-800">{viewDevice.batteryId}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-3 rounded-lg shadow-sm">
                <span className="font-medium text-gray-600">MAC Address:</span>
                <span className="text-gray-800">{viewDevice.macId}</span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg shadow-sm">
                <span className="font-medium text-gray-600">Status:</span>
                <span
  className={`px-3 py-1 rounded-full text-sm font-semibold ${
    viewDevice.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
  }`}
>
  {viewDevice.status ? "Active" : "Inactive"}
</span>

              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                className="hover:bg-gray-100"
                onClick={() => setViewDevice(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
