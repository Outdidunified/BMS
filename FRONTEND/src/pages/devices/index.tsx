import { useMemo, useState } from "react";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";

type DeviceDoc = {
  deviceId: string;
  batteryId: string;
  macId: string;
  status: boolean;
};

export default function DevicesPage() {
  // Static mock devices
  const [devices, setDevices] = useState<DeviceDoc[]>([
    { deviceId: "DVC-001", batteryId: "BAT-001", macId: "AA:BB:CC:DD:EE:01", status: true },
    { deviceId: "DVC-002", batteryId: "BAT-002", macId: "AA:BB:CC:DD:EE:02", status: false },
    { deviceId: "DVC-003", batteryId: "BAT-003", macId: "AA:BB:CC:DD:EE:03", status: true },
  ]);

  const refetch = () => {
    // Mock refetch, do nothing
  };

  const createDevice = (payload: any) => {
    // Mock create, add to list
    const newDevice = { ...payload, status: payload.status ?? true };
    setDevices([...devices, newDevice]);
  };

  const updateDevice = (di: string, data: Partial<any>) => {
    setDevices(devices.map(d => d.deviceId === di ? { ...d, ...data } : d));
  };

  const updateDeviceStatus = (di: string, status: boolean) => {
    setDevices(devices.map(d => d.deviceId === di ? { ...d, status } : d));
  };

  const deleteDevice = (di: string) => {
    setDevices(devices.filter(d => d.deviceId !== di));
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState<Partial<DeviceDto>>({});
  const [editingId, setEditingId] = useState<string | null>(null); // use deviceId as key
  const [editDevice, setEditDevice] = useState<Partial<DeviceDto>>({});

  const handleAdd = () => {
    if (!newDevice.deviceId || !newDevice.batteryId || !newDevice.macId) return;
    createDevice({
      deviceId: newDevice.deviceId,
      batteryId: newDevice.batteryId,
      macId: newDevice.macId,
      apiKey: newDevice.apiKey,
      alerts: newDevice.alerts,
      meta: newDevice.meta,
      status: typeof newDevice.status === "boolean" ? newDevice.status : true,
    });
    setNewDevice({});
    setShowAddForm(false);
  };

  const handleDelete = (deviceId: string) => {
    deleteDevice(deviceId);
  };

  const handleEdit = (device: DeviceDoc) => {
    const di = device.deviceId;
    setEditingId(di);
    setEditDevice({ deviceId: di, batteryId: device.batteryId, macId: device.macId, apiKey: device.apiKey, alerts: device.alerts, meta: device.meta, status: device.status });
  };

  const handleUpdate = (di: string) => {
    const { deviceId, batteryId, macId, apiKey, alerts, meta, status } = editDevice;
    updateDevice(di, { deviceId, batteryId, macId, apiKey, alerts, meta, status });
    setEditingId(null);
  };

  const [search, setSearch] = useState("");
  const filteredDevices = useMemo(() => {
    const term = search.toLowerCase();
    return devices.filter((d) =>
      d.deviceId?.toLowerCase().includes(term) ||
      d.batteryId?.toLowerCase().includes(term) ||
      d.macId?.toLowerCase().includes(term)
    );
  }, [devices, search]);

  const onlineCount = devices.filter((d) => d.status === true).length;
  const offlineCount = devices.filter((d) => d.status === false).length;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Heading and Add Button */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-gray-800">Devices</h1>
          <p className="text-gray-500">Monitor and manage all your BMS devices from a single interface</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-gray-100" onClick={() => refetch()} disabled={isLoading}>
            <Icon icon="lucide:refresh-ccw" /> Refresh
          </Button>
          <Button className="flex items-center gap-2 text-green-600 hover:text-green-700 bg-transparent" onClick={() => setShowAddForm(!showAddForm)}>
            <Icon icon="lucide:plus" /> Add Device
          </Button>
        </div>
      </div>

      {/* Add Device Form */}
      {showAddForm && (
        <div className="flex flex-wrap gap-2 items-center p-4 border rounded-lg bg-gray-50">
          <Input placeholder="Device ID" value={newDevice.deviceId || ""} onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })} className="flex-1 min-w-[120px]" />
          <Input placeholder="Battery ID" value={newDevice.batteryId || ""} onChange={(e) => setNewDevice({ ...newDevice, batteryId: e.target.value })} className="flex-1 min-w-[120px]" />
          <Input placeholder="MAC ID" value={newDevice.macId || ""} onChange={(e) => setNewDevice({ ...newDevice, macId: e.target.value })} className="flex-1 min-w-[150px]" />
          <Input placeholder="API Key (optional)" value={newDevice.apiKey || ""} onChange={(e) => setNewDevice({ ...newDevice, apiKey: e.target.value })} className="flex-1 min-w-[150px]" />
          <Button className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2" onClick={handleAdd}>
            <Icon icon="lucide:check" /> Save
          </Button>
        </div>
      )}

      {/* Search and Status */}
      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="flex gap-4 ml-4">
          <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">Online: {onlineCount}</div>
          <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">Offline: {offlineCount}</div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="py-3 px-4 text-left font-semibold">Device ID</th>
              <th className="py-3 px-4 text-left font-semibold">Battery ID</th>
              <th className="py-3 px-4 text-left font-semibold">MAC ID</th>
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
              <tr key={device.deviceId} className="bg-white hover:bg-gray-50 transition-colors border-t">
                <td className="py-3 px-4">{device.deviceId}</td>
                <td className="py-3 px-4">{device.batteryId}</td>
                <td className="py-3 px-4">{device.macId}</td>
                <td className="py-3 px-4">
                  {editingId === device.deviceId ? (
                    <select value={String(editDevice.status ?? device.status ?? true)} onChange={(e) => setEditDevice({ ...editDevice, status: e.target.value === "true" })} className="border rounded px-2 py-1">
                      <option value="true">Online</option>
                      <option value="false">Offline</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded-full font-medium ${device.status ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {device.status ? "Online" : "Offline"}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-center flex justify-center gap-2">
                  {editingId === device.deviceId ? (
                    <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={() => handleUpdate(device.deviceId)}>
                      <Icon icon="lucide:check" />
                    </Button>
                  ) : (
                    <>
                      <Button size="icon" variant="outline" onClick={() => handleEdit(device)}>
                        <Icon icon="lucide:edit" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => updateDeviceStatus(device.deviceId, !device.status)}>
                        <Icon icon={device.status ? "lucide:toggle-right" : "lucide:toggle-left"} />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => handleDelete(device.deviceId)}>
                        <Icon icon="lucide:trash" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredDevices.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 px-4 text-center text-gray-400">No devices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}