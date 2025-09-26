import { useState, useEffect } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Checkbox } from "@/ui/checkbox";
import { Switch } from "@/ui/switch";
import { Label } from "@/ui/label";
import { Card } from "@/ui/card";
import { Trash2 } from "lucide-react";

interface EmailEntry {
  id: number;
  email: string;
  device: string;
  count: number;
  active: boolean;
}

export default function ManageNotificationPage() {
  const [showForm, setShowForm] = useState(false);

  // Load emails from localStorage if present
  const [emails, setEmails] = useState<EmailEntry[]>(() => {
    const saved = localStorage.getItem("emails");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            email: "user1@example.com",
            device: "Device A",
            count: 2,
            active: true,
          },
          {
            id: 2,
            email: "user2@example.com",
            device: "Device B",
            count: 1,
            active: false,
          },
        ];
  });

  // Save emails to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("emails", JSON.stringify(emails));
  }, [emails]);

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [device1, setDevice1] = useState(false);
  const [device2, setDevice2] = useState(false);
  const [alertActive, setAlertActive] = useState(true);

  const toggleStatus = (id: number) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e))
    );
  };

  const deleteEmail = (id: number) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSendEmail = () => {
    const linkedDevices = [];
    if (device1) linkedDevices.push("Device 1");
    if (device2) linkedDevices.push("Device 2");

    if (!newEmail || linkedDevices.length === 0) return;

    const newEntry: EmailEntry = {
      id: Date.now(),
      email: newEmail,
      device: linkedDevices.join(", "),
      count: linkedDevices.length,
      active: alertActive,
    };

    setEmails((prev) => [...prev, newEntry]);

    // Reset form
    setNewEmail("");
    setDevice1(false);
    setDevice2(false);
    setAlertActive(true);
    setShowForm(false);
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Top Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Manage Notification</h1>
          <p className="text-gray-600 text-sm">
            Configure email alerts for device monitoring
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>Send Mail</Button>
      </div>

      {/* Notification Form */}
      {showForm && (
        <div className="border rounded-lg p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Notification Email</h2>
            <p className="text-gray-600 text-sm">
              Configure email notifications for device alerts and status update
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="Enter email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Select Device</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="device1"
                  checked={device1}
                  onCheckedChange={(checked) => setDevice1(Boolean(checked))}
                />
                <Label htmlFor="device1">Device 1</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="device2"
                  checked={device2}
                  onCheckedChange={(checked) => setDevice2(Boolean(checked))}
                />
                <Label htmlFor="device2">Device 2</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Label>Alert Notification</Label>
            <Switch
              checked={alertActive}
              onCheckedChange={(checked) => setAlertActive(Boolean(checked))}
            />
          </div>

          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail}>Send Email</Button>
          </div>
        </div>
      )}

      {/* Stats Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold">Total Email Details</h2>
          <p className="text-2xl font-bold">{emails.length}</p>
        </Card>

        <Card className="p-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold">Active Emails</h2>
          <p className="text-2xl font-bold">
            {emails.filter((e) => e.active).length}
          </p>
        </Card>

        <Card className="p-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold">Device Linked</h2>
          <p className="text-2xl font-bold">
            {emails.reduce((acc, e) => acc + e.count, 0)}
          </p>
        </Card>
      </div>

      {/* Notification Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Notification Email</h2>
        <p className="text-gray-600 text-sm mb-4">
          Manage email addresses that receive device alerts and notifications
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Email Address</th>
                <th className="p-2">Linked Device</th>
                <th className="p-2">Device Count</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.email}</td>
                  <td className="p-2">{row.device}</td>
                  <td className="p-2">{row.count}</td>
                  <td className="p-2 flex items-center gap-2">
                    <Switch
                      checked={row.active}
                      onCheckedChange={() => toggleStatus(row.id)}
                    />
                    <span
                      className={`text-sm ${
                        row.active ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {row.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteEmail(row.id)}
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
