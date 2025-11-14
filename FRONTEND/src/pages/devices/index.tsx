import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import apiClient from "@/api/apiClient";
import Swal from "sweetalert2";

interface Device {
  _id: string;
  deviceId: string;
  batteryId: string;
  macId: string;
  apiKey: string | null;
  alerts: Record<string, any>;
  meta: Record<string, any>;
  status: boolean;
  connected?: boolean;
  DI?: string;
  updatedAt?: string;
}

interface DeviceViewData extends Device {
  // Additional fields that might come from view endpoint
}

function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
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
  const [newDevice, setNewDevice] = useState({
    deviceId: "",
    batteryId: "",
    macId: "",
    // batteryCapacityAh: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDevice, setEditDevice] = useState({
    batteryId: "",
    macId: "",
  });
  const [search, setSearch] = useState("");
  const [viewingDevice, setViewingDevice] = useState<DeviceViewData | null>(null);

  // Fetch all devices on component mount
  useEffect(() => {
    console.log('role_id from sessionStorage authUser:', getRoleId());
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Device[]>({
        url: "/devices/fetch-all",
      });
      setDevices(response);
    } catch (error: any) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (
      !newDevice.deviceId ||
      !newDevice.batteryId ||
      !newDevice.macId
    ) {
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
        url: "/devices/create",
        data: {
          deviceId: newDevice.deviceId,
          batteryId: newDevice.batteryId,
          macId: newDevice.macId,
          // batteryCapacityAh: Number(newDevice.batteryCapacityAh),
        },
      });

      Swal.fire({
        title: "Success!",
        text: "Device created successfully",
        icon: "success",
        confirmButtonColor: "#3b82f6",
        timer: 2000,
      });

      setNewDevice({
        deviceId: "",
        batteryId: "",
        macId: "",
        // batteryCapacityAh: "",
      });
      setShowAddForm(false);
      fetchDevices();
    } catch (error: any) {
      console.error("Error creating device:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingId(device.deviceId);
    setEditDevice({
      batteryId: device.batteryId,
      macId: device.macId,
    });
  };

  const handleUpdate = async (deviceId: string) => {
    if (!editDevice.batteryId || !editDevice.macId) {
      Swal.fire({
        title: "Validation Error",
        text: "Battery ID and MAC ID are required",
        icon: "error",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    try {
      setLoading(true);
      await apiClient.put({
        url: `/devices/update/${deviceId}`,
        data: {
          batteryId: editDevice.batteryId,
          macId: editDevice.macId,
        },
      });

      Swal.fire({
        title: "Success!",
        text: "Device updated successfully",
        icon: "success",
        confirmButtonColor: "#3b82f6",
        timer: 2000,
      });

      setEditingId(null);
      fetchDevices();
    } catch (error: any) {
      console.error("Error updating device:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDevice = async (deviceId: string) => {
    try {
      setLoading(true);
      const response = await apiClient.get<DeviceViewData>({
        url: `/devices/${deviceId}`,
      });
      setViewingDevice(response);

      Swal.fire({
        title: "Device Details",
        html: `
          <div style="text-align: left; padding: 10px;">
            <p><strong>Device ID:</strong> ${response.deviceId}</p>
            <p><strong>Battery ID:</strong> ${response.batteryId}</p>
            <p><strong>MAC ID:</strong> ${response.macId}</p>
            <p><strong>Status:</strong> ${response.status ? '<span style="color: green;">Active</span>' : '<span style="color: red;">Inactive</span>'}</p>
            <p><strong>Connected:</strong> ${response.connected ? '<span style="color: green;">Yes</span>' : '<span style="color: gray;">No</span>'}</p>
            ${response.updatedAt ? `<p><strong>Last Updated:</strong> ${new Date(response.updatedAt).toLocaleString()}</p>` : ''}
          </div>
        `,
        icon: "info",
        confirmButtonColor: "#3b82f6",
        width: 600,
      });
    } catch (error: any) {
      console.error("Error viewing device:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (deviceId: string, currentStatus: boolean) => {
    const action = currentStatus ? "deactivate" : "activate";
    
    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Device?`,
      text: `Are you sure you want to ${action} this device?`,
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
          url: `/devices/${deviceId}/status`,
          data: {
            status: !currentStatus,
          },
        });

        Swal.fire({
          title: "Success!",
          text: `Device ${action}d successfully`,
          icon: "success",
          confirmButtonColor: "#3b82f6",
          timer: 2000,
        });

        fetchDevices();
      } catch (error: any) {
        console.error("Error toggling device status:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredDevices = devices.filter(
    (d) =>
      d.deviceId.toLowerCase().includes(search.toLowerCase()) ||
      d.batteryId.toLowerCase().includes(search.toLowerCase()) ||
      d.macId.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = devices.filter((d) => d.status === true).length;
  const inactiveCount = devices.filter((d) => d.status === false).length;
  const connectedCount = devices.filter((d) => d.connected === true).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Device Management</CardTitle>
            <CardDescription>
              Monitor and manage all your BMS devices from a single interface
            </CardDescription>
          </div>
          {isAdmin && (
            <Button
              className="flex items-center gap-2"
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={loading}
            >
              <Icon icon="lucide:plus" size={18} />
              Add Device
            </Button>
          )}
        </CardHeader>
      </Card>

      {/* Add Device Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Device</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                placeholder="Device ID"
                value={newDevice.deviceId}
                onChange={(e) =>
                  setNewDevice({ ...newDevice, deviceId: e.target.value })
                }
              />
              <Input
                placeholder="Battery ID"
                value={newDevice.batteryId}
                onChange={(e) =>
                  setNewDevice({ ...newDevice, batteryId: e.target.value })
                }
              />
              <Input
                placeholder="MAC ID (e.g., AA:BB:CC:DD:EE:FF)"
                value={newDevice.macId}
                onChange={(e) =>
                  setNewDevice({ ...newDevice, macId: e.target.value })
                }
              />
              {/* <Input
                placeholder="Battery Capacity (Ah)"
                type="number"
                value={newDevice.batteryCapacityAh}
                onChange={(e) =>
                  setNewDevice({ ...newDevice, batteryCapacityAh: e.target.value })
                }
              /> */}
              <div className="flex gap-2 md:col-span-2 lg:col-span-2">
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
                  onClick={handleAdd}
                  disabled={loading}
                >
                  <Icon icon="lucide:check" size={18} />
                  {loading ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewDevice({
                      deviceId: "",
                      batteryId: "",
                      macId: "",
                    });
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

      {/* Stats and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Icon
                icon="lucide:search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <Input
                placeholder="Search devices by Device ID, Battery ID, or MAC ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-4 flex-wrap">
              <Badge variant="default" className="px-4 py-2 bg-green-100 text-green-800 hover:bg-green-100">
                <Icon icon="mdi:check-circle" className="mr-1" size={16} />
                Active: {activeCount}
              </Badge>
              <Badge variant="default" className="px-4 py-2 bg-red-100 text-red-800 hover:bg-red-100">
                <Icon icon="mdi:close-circle" className="mr-1" size={16} />
                Inactive: {inactiveCount}
              </Badge>
              <Badge variant="default" className="px-4 py-2 bg-blue-100 text-blue-800 hover:bg-blue-100">
                <Icon icon="mdi:wifi" className="mr-1" size={16} />
                Connected: {connectedCount}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <CardContent className="pt-6">
          {loading && devices.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <Icon icon="lucide:loader-2" size={48} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold">Device ID</th>
                    <th className="py-3 px-4 text-left font-semibold">Battery ID</th>
                    <th className="py-3 px-4 text-left font-semibold">MAC ID</th>
                    <th className="py-3 px-4 text-left font-semibold">Status</th>
                    <th className="py-3 px-4 text-left font-semibold">Connected</th>
                    <th className="py-3 px-4 text-left font-semibold">Last Updated</th>
                    <th className="py-3 px-4 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((device) => (
                    <tr
                      key={device._id}
                      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{device.deviceId}</td>
                      <td className="py-3 px-4">
                        {editingId === device.deviceId ? (
                          <Input
                            value={editDevice.batteryId}
                            onChange={(e) =>
                              setEditDevice({ ...editDevice, batteryId: e.target.value })
                            }
                            className="min-w-[150px]"
                          />
                        ) : (
                          device.batteryId
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">
                        {editingId === device.deviceId ? (
                          <Input
                            value={editDevice.macId}
                            onChange={(e) =>
                              setEditDevice({ ...editDevice, macId: e.target.value })
                            }
                            className="min-w-[180px]"
                          />
                        ) : (
                          device.macId
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={device.status ? "default" : "destructive"}
                          className={
                            device.status
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                          }
                        >
                          {device.status ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            device.connected
                              ? "border-green-500 text-green-700"
                              : "border-gray-400 text-gray-600"
                          }
                        >
                          {device.connected ? "Online" : "Offline"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {device.updatedAt
                          ? new Date(device.updatedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          {editingId === device.deviceId ? (
                            <>
                              <Button
                                size="icon"
                                className="bg-green-500 hover:bg-green-600 text-white"
                                onClick={() => handleUpdate(device.deviceId)}
                                disabled={loading}
                                title="Save"
                              >
                                <Icon icon="lucide:check" size={18} />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                                disabled={loading}
                                title="Cancel"
                              >
                                <Icon icon="lucide:x" size={18} />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleViewDevice(device.deviceId)}
                                disabled={loading}
                                title="View Details"
                              >
                                <Icon icon="lucide:eye" size={18} />
                              </Button>
                              {isAdmin && (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleEdit(device)}
                                  disabled={loading}
                                  title="Edit"
                                >
                                  <Icon icon="lucide:edit" size={18} />
                                </Button>
                              )}
                              {isAdmin && (
                                                              <Button
  size="icon"
  variant="outline"
  className="relative w-12 h-6 rounded-full border-1 border-gray-400 transition-colors data-[active=true]:border-green-500"
  onClick={() => handleToggleStatus(device.deviceId, device.status)}
  disabled={!isAdmin || loading}
  title={device.status ? "Deactivate" : "Activate"}
  data-active={device.status}
>
  <span
    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow-md transition-transform ${
      device.status
        ? "translate-x-6 bg-green-400"
        : "translate-x-0 bg-gray-400"
    }`}
  />
</Button>)}



                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDevices.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 px-4 text-center text-gray-400"
                      >
                        <Icon icon="lucide:inbox" size={48} className="mx-auto mb-2 opacity-50" />
                        <p>No devices found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DevicesPage;