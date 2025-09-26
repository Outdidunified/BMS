import { useState, useEffect } from "react";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";

interface Device {
  id: number;
  deviceId: string;
  batteryId: string;
  macAddress: string;
  name: string;
  status: "Online" | "Offline";
  lastSeen: string;
}

export default function DevicesTab() {
  // Load devices from localStorage or default list
  const [devices, setDevices] = useState<Device[]>(() => {
    const saved = localStorage.getItem("devices");
    return saved ? JSON.parse(saved) : [
      {
        id: 1,
        deviceId: "DVC-001",
        batteryId: "BAT-001",
        macAddress: "00:1B:44:11:3A:B7",
        name: "MacBook Pro",
        status: "Online",
        lastSeen: "2025-09-24 10:15 AM",
      },
      {
        id: 2,
        deviceId: "DVC-002",
        batteryId: "BAT-002",
        macAddress: "00:1B:44:11:3A:C8",
        name: "iPhone 15",
        status: "Offline",
        lastSeen: "2025-09-23 09:30 PM",
      },
    ];
  });

  // Save devices to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("devices", JSON.stringify(devices));
  }, [devices]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState<Partial<Device>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDevice, setEditDevice] = useState<Partial<Device>>({});

  const handleAdd = () => {
    if (!newDevice.deviceId || !newDevice.batteryId || !newDevice.macAddress || !newDevice.name || !newDevice.status) return;

    const deviceToAdd: Device = {
      id: Date.now(),
      lastSeen: new Date().toLocaleString(),
      ...newDevice,
    } as Device;

    setDevices([...devices, deviceToAdd]);

    setNewDevice({});
    setShowAddForm(false);
  };

  const handleDelete = (id: number) => {
    setDevices(devices.filter((d) => d.id !== id));
  };

  const handleEdit = (device: Device) => {
    setEditingId(device.id);
    setEditDevice({ ...device });
  };

  const handleUpdate = (id: number) => {
    setDevices(
      devices.map((d) => (d.id === id ? { ...d, ...editDevice } : d))
    );
    setEditingId(null);
  };

  const [search, setSearch] = useState("");
  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.deviceId.toLowerCase().includes(search.toLowerCase()) ||
      d.macAddress.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = devices.filter((d) => d.status === "Online").length;
  const offlineCount = devices.filter((d) => d.status === "Offline").length;

  return (
    <div className="p-6 border rounded-xl shadow-lg bg-white flex flex-col gap-6">
      {/* Heading and Add Button */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-gray-800">Device Overview</h2>
          <p className="text-gray-500">
            Monitor and manage all your BNS devices from a single interface
          </p>
        </div>
        <Button
          className="flex items-center gap-2 text-green-600 hover:text-green-700 bg-transparent"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Icon icon="lucide:plus" /> Add Device
        </Button>
      </div>

      {/* Add Device Form */}
      {showAddForm && (
        <div className="flex flex-wrap gap-2 items-center mt-4 mb-4 p-4 border rounded-lg bg-gray-50">
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
            value={newDevice.macAddress || ""}
            onChange={(e) => setNewDevice({ ...newDevice, macAddress: e.target.value })}
            className="flex-1 min-w-[150px]"
          />
          <Input
            placeholder="Device Name"
            value={newDevice.name || ""}
            onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
            className="flex-1 min-w-[150px]"
          />
          <Input
            placeholder="Status (Online/Offline)"
            value={newDevice.status || ""}
            onChange={(e) => setNewDevice({ ...newDevice, status: e.target.value as "Online" | "Offline" })}
            className="flex-1 min-w-[120px]"
          />
          <Button
            className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
            onClick={handleAdd}
          >
            <Icon icon="lucide:check" /> Save
          </Button>
        </div>
      )}

      {/* Search and Status */}
      <div className="flex justify-between items-center mt-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="flex gap-4 ml-4">
          <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
            Online: {onlineCount}
          </div>
          <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
            Offline: {offlineCount}
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="overflow-x-auto mt-4">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="py-3 px-4 text-left font-semibold">Device ID</th>
              <th className="py-3 px-4 text-left font-semibold">Battery ID</th>
              <th className="py-3 px-4 text-left font-semibold">MAC Address</th>
              <th className="py-3 px-4 text-left font-semibold">Name</th>
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Last Seen</th>
              <th className="py-3 px-4 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
              <tr key={device.id} className="bg-white hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">{device.deviceId}</td>
                <td className="py-3 px-4">{device.batteryId}</td>
                <td className="py-3 px-4">{device.macAddress}</td>
                <td className="py-3 px-4">
                  {editingId === device.id ? (
                    <Input
                      value={editDevice.name}
                      onChange={(e) => setEditDevice({ ...editDevice, name: e.target.value })}
                    />
                  ) : (
                    device.name
                  )}
                </td>
                <td className="py-3 px-4">
                  {editingId === device.id ? (
                    <Input
                      value={editDevice.status}
                      onChange={(e) => setEditDevice({ ...editDevice, status: e.target.value as "Online" | "Offline" })}
                    />
                  ) : (
                    <span
                      className={`px-2 py-1 rounded-full font-medium ${
                        device.status === "Online"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {device.status}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">{device.lastSeen}</td>
                <td className="py-3 px-4 text-center flex justify-center gap-2">
                  {editingId === device.id ? (
                    <Button
                      className="bg-green-500 hover:bg-green-600 text-white"
                      onClick={() => handleUpdate(device.id)}
                    >
                      <Icon icon="lucide:check" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(device)}
                      >
                        <Icon icon="lucide:edit" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDelete(device.id)}
                      >
                        <Icon icon="lucide:trash" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredDevices.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 px-4 text-center text-gray-400">
                  No devices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
