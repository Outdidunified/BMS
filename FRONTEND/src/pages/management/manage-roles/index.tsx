import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import { Badge } from "@/ui/badge";
import { Title } from "@/ui/typography";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Checkbox } from "@/ui/checkbox";
import { Switch } from "@/ui/switch";
import apiClient from "@/api/apiClient"; // Adjust path as needed
import Swal from "sweetalert2";

interface Role {
  _id: string;
  role_id: number;
  name: string;
  permissions: {
    manage_users: boolean;
    manage_stations: boolean;
    manage_devices: boolean;
    view_devices: boolean;
    view_telemetry: boolean;
    view_analytics: boolean;
    manage_notifications: boolean;
    manage_warnings: boolean;
  };
  status: boolean;
  createdAt: string;
}

function ManageRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedViewRole, setSelectedViewRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    permissions: {
      manage_users: false,
      manage_stations: false,
      manage_devices: false,
      view_devices: false,
      view_telemetry: false,
      view_analytics: false,
      manage_notifications: false,
      manage_warnings: false,
    },
    status: true,
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await apiClient.get({ url: "/roles/getRoles" });
      setRoles(response);
      console.log("Fetched roles count:", roles.length, roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setFormData({
      name: "",
      permissions: {
        manage_users: false,
        manage_stations: false,
        manage_devices: false,
        view_devices: false,
        view_telemetry: false,
        view_analytics: false,
        manage_notifications: false,
        manage_warnings: false,
      },
      status: true,
    });
    setCreateModalOpen(true);
  };

  const handleEditRole = (roleId: string) => {
    const role = roles.find((r) => r._id === roleId);
    if (role) {
      setSelectedRole(role);
      setFormData({
        name: role.name,
        permissions: role.permissions,
        status: role.status,
      });
      setEditModalOpen(true);
    }
  };

  const handleToggleStatus = async (role: Role) => {
    try {
      await apiClient.put({
        url: `/roles/deactivateRole/${role._id}`,
        data: { status: !role.status },
      });
      fetchRoles(); // Refresh data
      Swal.fire("Success", "Role status updated successfully", "success");
    } catch (error) {
      console.error("Error toggling role status:", error);
      Swal.fire("Error", "Failed to update role status", "error");
    }
  };

  const handleCreateSubmit = async () => {
    try {
      await apiClient.post({
        url: "/roles/createRole",
        data: {
          name: formData.name,
          permissions: formData.permissions,
          status: formData.status,
        },
      });
      setCreateModalOpen(false);
      fetchRoles();
      Swal.fire("Success", "Role created successfully", "success");
    } catch (error) {
      console.error("Error creating role:", error);
      Swal.fire("Error", "Failed to create role", "error");
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedRole) return;
    try {
      await apiClient.put({
        url: `/roles/updateRole/${selectedRole._id}`,
        data: {
          name: formData.name,
          permissions: formData.permissions,
          status: formData.status,
        },
      });
      fetchRoles();
      setEditModalOpen(false);
      Swal.fire("Success", "Role updated successfully", "success");
    } catch (error) {
      console.error("Error updating role:", error);
      Swal.fire("Error", "Failed to update role", "error");
    }
  };

  const handleViewPermissions = (role: Role) => {
    setSelectedViewRole(role);
    setViewModalOpen(true);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePermissionChange = (key: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: checked },
    }));
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
            Manage Roles
          </Title>
          <p className="text-muted-foreground mt-1">
            Create and manage user roles and permissions
          </p>
        </div>
        <Button onClick={handleCreateRole} className="flex items-center gap-2">
          <Icon icon="mdi:plus" size={16} />
          Create Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.filter((role) => role.status).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            Manage system roles and their permissions
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Role ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role._id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="font-medium">
                      {role.role_id}
                    </TableCell>
                    <TableCell>{getStatusBadge(role.status)}</TableCell>
                    <TableCell>
                      {new Date(role.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View Permissions */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPermissions(role)}
                        >
                          <Icon icon="mdi:eye" size={16} />
                        </Button>

                        {/* Edit Role */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRole(role._id)}
                        >
                          <Icon icon="mdi:pencil" size={16} />
                        </Button>

                        {/* Toggle Status */}
                        <Switch
                          checked={role.status}
                          onCheckedChange={() => handleToggleStatus(role)}
                          disabled={role.role_id === 1}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Role Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Role Name"
              value={formData.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
            />

            <div>
              <h4 className="font-medium mb-2">Permissions</h4>
              <div className="space-y-1">
                {Object.keys(formData.permissions).map((key) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perm-${key}`}
                      checked={formData.permissions[key]}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(key, checked === true)
                      }
                    />
                    <label
                      htmlFor={`perm-${key}`}
                      className="text-sm capitalize cursor-pointer"
                    >
                      {key.replace(/_/g, " ")}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="status"
                checked={formData.status}
                onCheckedChange={(checked) =>
                  handleFormChange("status", checked === true)
                }
              />
              <label htmlFor="status" className="text-sm cursor-pointer">
                Active
              </label>
            </div>

            <Button className="w-full" onClick={handleCreateSubmit}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Role: {selectedRole?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Role Name"
              value={formData.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
            />

            <div>
              <h4 className="font-medium mb-2">Permissions</h4>
              <div className="space-y-1">
                {Object.keys(formData.permissions).map((key) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={formData.permissions[key]}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(key, checked === true)
                      }
                    />
                    <label
                      htmlFor={key}
                      className="text-sm capitalize cursor-pointer"
                    >
                      {key.replace(/_/g, " ")}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="status"
                checked={formData.status}
                onCheckedChange={(checked) =>
                  handleFormChange("status", checked === true)
                }
              />
              <label htmlFor="status" className="text-sm cursor-pointer">
                Active
              </label>
            </div>

            <Button className="w-full" onClick={handleEditSubmit}>
              Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Role Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Role Details: {selectedViewRole?.name}</DialogTitle>
          </DialogHeader>

          {selectedViewRole ? (
            <div className="space-y-4">
              {/* Role Basic Info */}
              <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Role ID:</span>
                  <span>{selectedViewRole.role_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{selectedViewRole.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <span>{selectedViewRole.status ? "Active" : "Inactive"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Created At:</span>
                  <span>
                    {new Date(selectedViewRole.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedViewRole.updatedAt && (
                  <div className="flex justify-between">
                    <span className="font-medium">Updated At:</span>
                    <span>
                      {new Date(selectedViewRole.updatedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Permissions Table */}
              <div>
                <h4 className="font-medium mb-2">Permissions</h4>
                {selectedViewRole.permissions &&
                Object.keys(selectedViewRole.permissions).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Permission</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(selectedViewRole.permissions).map(
                        ([permKey, permValue]) => (
                          <TableRow key={permKey}>
                            <TableCell className="capitalize">
                              {permKey.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={permValue ? "default" : "secondary"}
                              >
                                {permValue ? "Enabled" : "Disabled"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No permissions assigned
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setViewModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Loading...
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ManageRoles;
