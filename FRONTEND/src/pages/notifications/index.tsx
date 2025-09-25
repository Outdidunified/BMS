import { useMemo, useState } from "react";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";

type NotificationMapping = {
  di: string;
  emails: string[];
  threshold?: number;
  enabled: boolean;
};

export default function NotificationsPage() {
  // Static mock mappings
  const [mappings, setMappings] = useState<NotificationMapping[]>([
    { di: "DVC-001", emails: ["user1@example.com", "user2@example.com"], enabled: true },
    { di: "DVC-002", emails: ["admin@example.com"], enabled: false },
  ]);

  // Static mock devices
  const devices = [
    { deviceId: "DVC-001", batteryId: "BAT-001", macId: "AA:BB:CC:DD:EE:01", status: true },
    { deviceId: "DVC-002", batteryId: "BAT-002", macId: "AA:BB:CC:DD:EE:02", status: false },
    { deviceId: "DVC-003", batteryId: "BAT-003", macId: "AA:BB:CC:DD:EE:03", status: true },
  ];

  const upsertMapping = (data: NotificationMapping) => {
    const existing = mappings.find(m => m.di === data.di);
    if (existing) {
      setMappings(mappings.map(m => m.di === data.di ? data : m));
    } else {
      setMappings([...mappings, data]);
    }
  };

  const deleteMapping = (di: string) => {
    setMappings(mappings.filter(m => m.di !== di));
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newMapping, setNewMapping] = useState<Partial<NotificationMapping>>({ emails: [] });
  const [editingDi, setEditingDi] = useState<string | null>(null);
  const [editMapping, setEditMapping] = useState<Partial<NotificationMapping>>({ emails: [] });

  const handleAdd = () => {
    if (!newMapping.di || !newMapping.emails?.length) return;
    upsertMapping({
      di: newMapping.di,
      emails: newMapping.emails,
      threshold: newMapping.threshold,
      enabled: newMapping.enabled ?? true,
    });
    setNewMapping({ emails: [] });
    setShowAddForm(false);
  };

  const handleEdit = (mapping: NotificationMapping) => {
    setEditingDi(mapping.di);
    setEditMapping({ ...mapping });
  };

  const handleUpdate = () => {
    if (!editMapping.di || !editMapping.emails?.length) return;
    upsertMapping(editMapping as NotificationMapping);
    setEditingDi(null);
  };

  const handleDelete = (di: string) => {
    deleteMapping(di);
  };

  const addEmail = (emails: string[], setEmails: (emails: string[]) => void) => {
    setEmails([...emails, ""]);
  };

  const updateEmail = (emails: string[], index: number, value: string, setEmails: (emails: string[]) => void) => {
    const updated = [...emails];
    updated[index] = value;
    setEmails(updated);
  };

  const removeEmail = (emails: string[], index: number, setEmails: (emails: string[]) => void) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const [search, setSearch] = useState("");
  const filteredMappings = useMemo(() => {
    const term = search.toLowerCase();
    return mappings.filter((m) =>
      m.di?.toLowerCase().includes(term) ||
      m.emails?.some(e => e.toLowerCase().includes(term))
    );
  }, [mappings, search]);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Heading and Add Button */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-gray-800">Notifications</h1>
          <p className="text-gray-500">Manage email notifications and device mappings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-transparent" onClick={() => setShowAddForm(!showAddForm)}>
            <Icon icon="lucide:plus" /> Add Mapping
          </Button>
        </div>
      </div>

      {/* Add Mapping Form */}
      {showAddForm && (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
          <div className="flex gap-4">
            <select
              value={newMapping.di || ""}
              onChange={(e) => setNewMapping({ ...newMapping, di: e.target.value })}
              className="border rounded px-3 py-2 flex-1"
            >
              <option value="">Select Device</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.deviceId}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Emails</label>
            {newMapping.emails?.map((email, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => updateEmail(newMapping.emails!, index, e.target.value, (emails) => setNewMapping({ ...newMapping, emails }))}
                  className="flex-1"
                />
                <Button size="icon" variant="outline" onClick={() => removeEmail(newMapping.emails!, index, (emails) => setNewMapping({ ...newMapping, emails }))}>
                  <Icon icon="lucide:minus" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => addEmail(newMapping.emails!, (emails) => setNewMapping({ ...newMapping, emails }))}>
              <Icon icon="lucide:plus" /> Add Email
            </Button>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newMapping.enabled ?? true}
                onChange={(e) => setNewMapping({ ...newMapping, enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAdd}>
            Save Mapping
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Input placeholder="Search mappings..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>

      {/* Mappings List */}
      <div className="space-y-4">
        {filteredMappings.map((mapping) => (
          <div key={mapping.di} className="border rounded-lg p-4 bg-white">
            {editingDi === mapping.di ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Device ID</label>
                  <Input value={editMapping.di || ""} disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Emails</label>
                  {editMapping.emails?.map((email, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => updateEmail(editMapping.emails!, index, e.target.value, (emails) => setEditMapping({ ...editMapping, emails }))}
                        className="flex-1"
                      />
                      <Button size="icon" variant="outline" onClick={() => removeEmail(editMapping.emails!, index, (emails) => setEditMapping({ ...editMapping, emails }))}>
                        <Icon icon="lucide:minus" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => addEmail(editMapping.emails!, (emails) => setEditMapping({ ...editMapping, emails }))}>
                    <Icon icon="lucide:plus" /> Add Email
                  </Button>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editMapping.enabled ?? true}
                      onChange={(e) => setEditMapping({ ...editMapping, enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={handleUpdate}>
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setEditingDi(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{mapping.di}</h3>
                  <p className="text-gray-600">Emails: {mapping.emails?.join(", ")}</p>
                  <p className="text-sm text-gray-500">Enabled: {mapping.enabled ? "Yes" : "No"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => handleEdit(mapping)}>
                    <Icon icon="lucide:edit" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDelete(mapping.di)}>
                    <Icon icon="lucide:trash" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredMappings.length === 0 && (
          <div className="text-center text-gray-400 py-8">No notification mappings found.</div>
        )}
      </div>
    </div>
  );
}