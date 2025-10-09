import React, { useEffect, useState } from "react";
import axios from "axios";
import Swal, { SweetAlertResult } from "sweetalert2";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Switch } from "@/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import { API_BASE_URL } from "@/global-config";
import { Eye, EyeOff } from "lucide-react";

interface Station {
  _id: string;
  station_id: number;
  name: string;
  location: string;
}

interface Role {
  _id: string;
  role_id: number;
  name: string;
}

interface Device {
  _id: string;
  deviceId: string;
  batteryId: string;
  macId: string;
  status: boolean;
}

interface User {
  _id: string;
  username: string;
  email: string;
  role_id: number;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  user_id?: string;
}

const ManageUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Create User Form States
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<number | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

   // Inline edit states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState("");

  const token = sessionStorage.getItem("authToken");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchStations();
    fetchUnassignedSummary();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/auth/getUsers`, { headers });
      if (res.data.success) setUsers(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/roles/getRoles`, { headers });
      if (res.data.success) setRoles(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stations/getStations`, { headers });
      if (res.data.success) setStations(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnassignedSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stations/unassignedSummary/`, { headers });
      if (res.data.success) {
        setStations(res.data.data.unassignedStations || []);
        setDevices(res.data.data.unassignedDevices || []);
      }
    } catch (err) {
      console.error("Error fetching unassigned summary", err);
    }
  };

  const createUser = async () => {
    if (!username || !email || !password || !roleId) {
      Swal.fire("Error", "Please fill all required fields (username, email, password, role)", "error");
      return;
    }

    try {
      const payload: any = {
        username,
        email,
        password,
        role_id: roleId,
      };

      if (stationId) payload.station_id = stationId;
      if (deviceId) payload.device_id = deviceId;

      console.log("Payload sent:", payload);

      const res = await axios.post(`${API_BASE_URL}/auth/CreateUser/`, payload, { headers });

      if (res.data.success) {
        Swal.fire("Success", res.data.message, "success");
        fetchUsers();
        setShowCreateForm(false);
        setUsername("");
        setEmail("");
        setPassword("");
        setRoleId(null);
        setStationId(null);
        setDeviceId(null);
      }
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data?.message || "Something went wrong", "error");
    }
  };

  const handleEditUser = (user: User) => {
    Swal.fire({
      title: "Edit Username",
      html: `<input id="swal-username" class="swal2-input" placeholder="Username" value="${user.username}" />`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const usernameInput = (document.getElementById("swal-username") as HTMLInputElement)?.value;
        if (!usernameInput) {
          Swal.showValidationMessage("Please enter a username");
          return;
        }
        return { username: usernameInput };
      },
    }).then((result: SweetAlertResult<{ username: string }>) => {
      if (result.isConfirmed && result.value) {
        axios
          .put(`${API_BASE_URL}/auth/updateUser/${user._id}`, { username: result.value.username }, { headers })
          .then(() => {
            Swal.fire("Success", "Username updated successfully", "success");
            fetchUsers();
          })
          .catch((err) => {
            Swal.fire("Error", err?.response?.data?.message || "Something went wrong", "error");
          });
      }
    });
  };

  const toggleUserStatus = (userId: string, currentStatus: boolean) => {
    Swal.fire({
      title: "Are you sure?",
      text: `You are about to ${currentStatus ? "deactivate" : "activate"} this user.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Yes, ${currentStatus ? "deactivate" : "activate"}!`,
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        axios
          .put(`${API_BASE_URL}/auth/deactivateuser/${userId}`, { status: !currentStatus }, { headers })
          .then((res) => {
            if (res.data.success) {
              Swal.fire("Success", "User status updated", "success");
              fetchUsers();
            }
          })
          .catch((err) => {
            Swal.fire("Error", err?.response?.data?.message || "Something went wrong", "error");
          });
      }
    });
  };

 const fetchUserDetails = async (userId?: string, user?: User) => {
  if (!userId && !user) return;

  try {
    // Fetch user details from backend
    const res = await axios.get(`${API_BASE_URL}/auth/getProfile`, {
      params: { userId: userId || user?.user_id },
      headers,
    });

    const data = res.data.success ? res.data.data : user;

    // Build dynamic details for the popup
    const htmlContent = `
      <p><strong>Username:</strong> ${data?.username || "N/A"}</p>
      <p><strong>Email:</strong> ${data?.email || "N/A"}</p>
      <p><strong>Role:</strong> ${data?.role || roles.find((r) => r.role_id === data?.role_id)?.name || "N/A"}</p>
<p>
  <strong>Status:</strong> 
  <span class="${data?.status ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}">
    ${data?.status ? 'Active' : 'Inactive'}
  </span>
</p>
      <p><strong>Created At:</strong> ${data?.createdAt ? new Date(data.createdAt).toLocaleString() : "N/A"}</p>
      <p><strong>Updated At:</strong> ${data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "N/A"}</p>
    `;

    Swal.fire({
      title: `User Details: ${data?.username || "N/A"}`,
      html: htmlContent,
      width: 500,
      confirmButtonText: "Close",
    });
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Failed to fetch user details", "error");
  }
};


    // Inline edit functions: <--- PASTE HERE
  const startEditing = (user: User) => {
    setEditingUserId(user._id);
    setEditingUsername(user.username);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditingUsername("");
  };

  const saveEditedUser = async (userId: string) => {
    if (!editingUsername.trim()) {
      Swal.fire("Error", "Username cannot be empty", "error");
      return;
    }

    try {
      const res = await axios.put(
        `${API_BASE_URL}/auth/updateUser/${userId}`,
        { username: editingUsername },
        { headers }
      );

      if (res.data.success) {
        Swal.fire("Success", "Username updated successfully", "success");
        fetchUsers();
        cancelEdit();
      }
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data?.message || "Something went wrong", "error");
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status).length;
  const inactiveUsers = totalUsers - activeUsers;

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Users</h1>
          <p className="text-gray-500 mt-1">Create and manage system users and their access</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>Create User</Button>
      </div>

      {showCreateForm && (
        <Card className="mb-6 p-6">
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="relative">
  <Input
    placeholder="Password"
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />
  <button
    type="button"
    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
    onClick={() => setShowPassword(!showPassword)}
  >
    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
  </button>
</div>
            {/* Role - Required */}
<Select onValueChange={(val) => setRoleId(Number(val))}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select Role *" />
  </SelectTrigger>
  <SelectContent className="w-full">
    {roles.map((role) => (
      <SelectItem key={role.role_id} value={role.role_id.toString()}>
        {role.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

{/* Station - Optional */}
<Select onValueChange={(val) => setStationId(val)}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select Station (Optional)" />
  </SelectTrigger>
  <SelectContent position="popper" className="w-full">
    {stations.map((station) => (
      <SelectItem key={station._id} value={station._id}>
        {station.name} - {station.location}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

{/* Device - Optional */}
{/* Device - Optional */}
<Select onValueChange={(val) => setDeviceId(val)}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select Device (Optional)" />
  </SelectTrigger>
  <SelectContent position="popper" className="w-full">
    {devices.map((device) => (
      <SelectItem key={device._id} value={device.deviceId}>
        {device.deviceId}
      </SelectItem>
    ))}
  </SelectContent>
</Select>


          </CardContent>

          <div className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateForm(false);
                setUsername("");
                setEmail("");
                setPassword("");
                setRoleId(null);
                setStationId(null);
                setDeviceId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={createUser}>Submit</Button>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <CardTitle>Total Users</CardTitle>
          <CardDescription>{totalUsers}</CardDescription>
        </Card>
        <Card className="p-4 text-center">
          <CardTitle>Active Users</CardTitle>
          <CardDescription>{activeUsers}</CardDescription>
        </Card>
        <Card className="p-4 text-center">
          <CardTitle>Inactive Users</CardTitle>
          <CardDescription>{inactiveUsers}</CardDescription>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage system users</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead className="p-4 text-left">Username</TableHead>
                <TableHead className="p-4 text-left">Email</TableHead>
                <TableHead className="p-4 text-left">Role</TableHead>
                <TableHead className="p-4 text-left">Status</TableHead>
                <TableHead className="p-4 text-left">Created</TableHead>
                <TableHead className="p-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
  {users.map((user) => {
    const isEditing = editingUserId === user._id;
    return (
      <TableRow key={user._id} className="hover:bg-gray-50 transition-colors">
        <TableCell className="p-4 font-medium">
          {isEditing ? (
            <Input
              value={editingUsername}
              onChange={(e) => setEditingUsername(e.target.value)}
              className="w-full"
            />
          ) : (
            user.username
          )}
        </TableCell>

        <TableCell className="p-4">{user.email}</TableCell>
        <TableCell className="p-4">
          {roles.find((r) => r.role_id === user.role_id)?.name || "N/A"}
        </TableCell>
        <TableCell className="p-4">
          <Badge
            variant={user.status ? "default" : "secondary"}
            className={user.status ? "bg-green-100 text-green-800" : ""}
          >
            {user.status ? "Active" : "Inactive"}
          </Badge>
        </TableCell>
        <TableCell className="p-4">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
       <TableCell className="text-right">
  <div className="flex items-center justify-end gap-2">
    {isEditing ? (
      <>
        <button
          onClick={() => saveEditedUser(user._id)}
          className="p-2 hover:bg-green-100 text-green-600 rounded"
          title="Save"
        >
          ✓
        </button>
        <button
          onClick={cancelEdit}
          className="p-2 hover:bg-red-100 text-red-600 rounded"
          title="Cancel"
        >
          ✕
        </button>
      </>
    ) : (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 hover:bg-gray-100 rounded"
          onClick={() => fetchUserDetails(user.user_id, user)}
        >
          <Icon icon="mdi:eye" size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 hover:bg-gray-100 rounded"
          onClick={() => startEditing(user)}
        >
          <Icon icon="mdi:pencil" size={16} />
        </Button>
        <Switch
          checked={user.status}
          onCheckedChange={() => toggleUserStatus(user._id, user.status)}
        />
      </>
    )}
  </div>
</TableCell>


      </TableRow>
    );
  })}
</TableBody>

          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageUsersPage;
