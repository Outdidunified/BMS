import { useState, useEffect, useMemo } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Icon } from "@/components/icon";
import { useRouter } from "@/routes/hooks/use-router";

interface Device {
  deviceId: string;
  batteryId: string;
  macId: string;
  status: boolean;
}

const API_BASE = "http://192.168.1.17:8070";

export default function HistoryDevicesTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  // Fetch all devices
  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/devices/fetch-all?includeInactive=true`);
      const data = await res.json();

      let devicesData: Device[] = [];

      if (Array.isArray(data)) {
        devicesData = data;
      } else if (Array.isArray(data.data)) {
        devicesData = data.data;
      }

      setDevices(
        devicesData.map((d: any) => ({
          ...d,
          status: d.status === true,
        }))
      );
      setSearchTerm("");
    } catch (err) {
      console.error("Error fetching devices:", err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleViewHistory = (deviceId: string) => {
    router.push(`/history/${deviceId}`);
  };

  const filteredDevices = useMemo(() => {
    if (!searchTerm.trim()) return devices;
    const lowered = searchTerm.trim().toLowerCase();
    return devices.filter((device) =>
      [device.deviceId, device.batteryId, device.macId].some((field) =>
        field?.toLowerCase().includes(lowered)
      )
    );
  }, [devices, searchTerm]);

  return (
    <div className="p-6 border rounded-xl shadow-lg bg-white flex flex-col gap-6">
      {/* Heading */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Device History</h2>
          <p className="text-gray-500">View historical telemetry data for your BMS devices</p>
        </div>
        <div className="w-full max-w-xs">
          <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="history-device-search">
            Search devices
          </label>
          <Input
            id="history-device-search"
            placeholder="Search by device, battery, or MAC"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
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
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredDevices.length ? (
              filteredDevices.map((device) => (
                <tr key={device.deviceId} className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">{device.deviceId}</td>
                  <td className="py-3 px-4">{device.batteryId}</td>
                  <td className="py-3 px-4">{device.macId}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        device.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {device.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewHistory(device.deviceId)}
                      className="flex items-center gap-2"
                    >
                      <Icon icon="mdi:history" width="16" height="16" />
                      <span>View History</span>
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-6 px-4 text-center text-gray-500" colSpan={5}>
                  No devices match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}