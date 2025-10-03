import { useState, useEffect } from "react";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";
import { useRouter } from "@/routes/hooks/use-router";
import { API_BASE_URL } from "@/global-config";

interface Device {
  deviceId: string;
  batteryId: string;
  macId: string;
  status: boolean;
}
// Demo data
export default function HistoryDevicesTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  // Fetch all devices
  const fetchDevices = async () => {
    try {
      const token = sessionStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/devices/fetch-all?includeInactive=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
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

  return (
    <div className="p-6 border rounded-xl shadow-lg bg-white flex flex-col gap-6">
      {/* Heading */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Device History</h2>
          <p className="text-gray-500">View historical telemetry data for your BMS devices</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search by Device ID, Battery ID, MAC Address, or Status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
            {devices.filter(device =>
              device.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              device.batteryId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              device.macId.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (device.status ? "active" : "inactive").toLowerCase().includes(searchTerm.toLowerCase())
            ).map((device) => (
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
    className="flex items-center space-x-2"
  >
    <Icon icon="mdi:history" width="16" height="16" />
    <span>View History</span>
  </Button>
</td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}