import { useState, useEffect } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Card } from "@/ui/card";
import { Trash2, Plus, Send, Edit2  } from "lucide-react";
import Swal from "sweetalert2";

const API_BASE = "http://192.168.1.17:8070";

interface EmailEntry {
  id: number;
  email: string;
  device: string;
  count: number;
  active: boolean;
}

interface Device {
  deviceId: string;
  batteryId: string;
  macId: string;
  status: boolean;
}

export default function ManageNotificationPage() {
  const [showForm, setShowForm] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [viewDevice, setViewDevice] = useState<string | null>(null);
  
   // Email validation helper
 const isValidEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};



  // Form state
  const [selectedDevice, setSelectedDevice] = useState("");
  const [emailList, setEmailList] = useState<string[]>([""]);
   const [formError, setFormError] = useState(""); 

   const [totalEmails, setTotalEmails] = useState(0);
const [deviceCount, setDeviceCount] = useState(0);


  // Load all devices from backend
  useEffect(() => {
    fetch(`${API_BASE}/devices/fetch-all?includeInactive=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDevices(data.data);
      });
  }, []);

  const fetchMappings = async () => {
  const res = await fetch(`${API_BASE}/notifications/mapping/fetch-all`);
  const data = await res.json();
  if (data.success && data.data) {
    const mappedEmails: EmailEntry[] = data.data.flatMap((item: any, idx: number) =>
      item.emails.map((email: string) => ({
        id: Date.now() + idx,
        email,
        device: item.deviceDI,
        count: 1,
        active: true,
      }))
    );
    setEmails(mappedEmails);

    // Unique emails (no duplicates)
    const uniqueEmails = new Set<string>();
    data.data.forEach((item: any) => {
      item.emails.forEach((email: string) => uniqueEmails.add(email));
    });
    setTotalEmails(uniqueEmails.size);

    // Device count
    setDeviceCount(data.data.length);
  }
};


  // Load all mapped emails from backend
useEffect(() => {
  fetchMappings();
}, []);



  // Delete email mapping
const deleteEmail = async (row: EmailEntry) => {
  Swal.fire({
    title: "Are you sure?",
    text: `This will delete ${row.email} from ${row.device}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(
          `${API_BASE}/notifications/mapping/delete-email/${row.device}/${row.email}`,
          { method: "DELETE" }
        );
        const data = await res.json();

        if (data.success) {
          Swal.fire("Deleted!", "Email deleted successfully.", "success");
          fetchMappings(); // ✅ refresh table data without reloading page
        } else {
          Swal.fire("Error", data.message || "Failed to delete email", "error");
        }
      } catch {
        Swal.fire("Error", "Something went wrong while deleting email", "error");
      }
    }
  });
};


  const deleteDeviceMapping = async (deviceId: string) => {
  Swal.fire({
    title: "Are you sure?",
    text: `This will delete all emails mapped to ${deviceId}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE}/notifications/mapping/delete/${deviceId}`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (data.success) {
          Swal.fire("Deleted!", "Mapping deleted successfully.", "success");
          fetchMappings(); // ✅ reload only API data, not whole page
        } else {
          Swal.fire("Error", data.message || "Failed to delete mapping", "error");
        }
      } catch {
        Swal.fire("Error", "Something went wrong while deleting mapping", "error");
      }
    }
  });
};


// Send notification to all emails of a device
const handleSendNotification = (deviceId: string) => {
  Swal.fire({
    title: `Send Notification to ${deviceId}`,
    input: "textarea",
    inputPlaceholder: "Type your message here...",
    showCancelButton: true,
    confirmButtonText: "Send",
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      try {
        const res = await fetch(`${API_BASE}/notifications/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceDI: deviceId,
            message: result.value,
          }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire("Sent!", "Notification sent successfully.", "success");
        } else {
          Swal.fire("Error", data.message || "Failed to send notification", "error");
        }
      } catch {
        Swal.fire("Error", "Something went wrong while sending notification", "error");
      }
    }
  });
};



  const handleEditEmail = (row: EmailEntry) => {
  Swal.fire({
    title: "Edit Email",
    input: "email",
    inputValue: row.email,
    showCancelButton: true,
    confirmButtonText: "Update",
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      try {
        const updatedEmails = emails.map((e) =>
          e.id === row.id ? { ...e, email: result.value } : e
        );

        const res = await fetch(`${API_BASE}/notifications/mapping/upsert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceDI: row.device,
            emails: updatedEmails.filter((e) => e.device === row.device).map((e) => e.email),
          }),
        });

        const data = await res.json();
        if (data.success) {
          setEmails(updatedEmails);
          Swal.fire("Success", "Email updated", "success");
        } else {
          Swal.fire("Error", data.message || "Failed to update", "error");
        }
      } catch {
        Swal.fire("Error", "Something went wrong", "error");
      }
    }
  });
};


  // Add new email input
  const addEmailInput = () => setEmailList([...emailList, ""]);
  const updateEmail = (index: number, value: string) => {
    const copy = [...emailList];
    copy[index] = value;
    setEmailList(copy);
  };
  const removeEmailInput = (index: number) => {
    const copy = [...emailList];
    copy.splice(index, 1);
    setEmailList(copy);
  };

  // Save mapping
const handleSaveMapping = async () => {
  if (!selectedDevice || emailList.length === 0) {
    setFormError("Select a device and enter at least one email");
    return;
  }

  // Check for duplicate emails
  const duplicates = emailList.filter((email, index) => emailList.indexOf(email) !== index);
  if (duplicates.length > 0) {
    setFormError("Duplicate emails are not allowed");
    return;
  }

   // Check for valid emails
  const invalidEmails = emailList.filter((email) => !isValidEmail(email));
  if (invalidEmails.length > 0) {
    setFormError(`Invalid email(s): ${invalidEmails.join(", ")}`);
    return;
  }

  setFormError(""); // clear error before saving

  try {
    const res = await fetch(`${API_BASE}/notifications/mapping/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceDI: selectedDevice, emails: emailList }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("Success", "Emails mapped to device successfully", "success");
       fetchMappings(); 
      setShowForm(false);
      setSelectedDevice("");
      setEmailList([""]);
      // Refresh table
      fetch(`${API_BASE}/notifications/mapping/fetch-all`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            const mappedEmails: EmailEntry[] = data.data.flatMap((item: any, idx: number) =>
              item.emails.map((email: string) => ({
                id: Date.now() + idx,
                email,
                device: item.deviceDI,
                count: 1,
                active: true,
              }))
            );
            setEmails(mappedEmails);
          }
        });
    } else {
      setFormError(data.message || "Failed to map emails");
    }
  } catch (err) {
    setFormError("Something went wrong");
  }
};



  const handleViewEmails = (deviceId: string) => {
  setViewDevice(deviceId);
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
        <Button onClick={() => setShowForm(!showForm)}>Map Device</Button>
      </div>

      {/* Notification Form (Popup) */}
      {showForm && (
        <div className="border rounded-lg p-6 flex flex-col gap-4 bg-white shadow-lg">
          <h2 className="text-lg font-semibold">Map Emails to Device</h2>

          {/* Device Dropdown */}
          <div className="flex flex-col gap-2">
            <Label>Select Device</Label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">-- Select Device --</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.deviceId}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Email Inputs */}
<div className="flex flex-col gap-2">
  <Label>Emails</Label>
  {emailList.map((email, idx) => (
  <div key={idx} className="flex gap-2 items-center">
    <Input
      type="email"
      placeholder="Enter email"
      value={email}
      onChange={(e) => updateEmail(idx, e.target.value)}
      className={!isValidEmail(email) && email ? "border-red-500" : ""}
    />
    <Button variant="ghost" size="icon" onClick={() => removeEmailInput(idx)}>
      <Trash2 className="w-4 h-4 text-red-600" />
    </Button>
  </div>
))}
{emailList.some((email) => email && !isValidEmail(email)) && (
  <p className="text-red-600 text-sm mt-1">One or more emails are invalid</p>
)}

  <Button
    variant="outline"
    size="sm"
    className="flex items-center gap-1"
    onClick={addEmailInput}
  >
    <Plus className="w-4 h-4" /> Add Email
  </Button>

  {formError && <p className="text-red-600 text-sm mt-1">{formError}</p>} {/* inline error */}
</div>


          <div className="flex justify-end gap-4 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMapping}>Save</Button>
          </div>
        </div>
      )}

      {/* Stats Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
       <Card className="p-4 flex flex-col items-center justify-center">
  <h2 className="text-lg font-semibold">Total Email Details</h2>
  <p className="text-2xl font-bold">{totalEmails}</p>
</Card>

        <Card className="p-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold">Active Emails</h2>
          <p className="text-2xl font-bold">{totalEmails}</p>
        </Card>

        <Card className="p-4 flex flex-col items-center justify-center">
  <h2 className="text-lg font-semibold">Device Linked</h2>
  <p className="text-2xl font-bold">{deviceCount}</p>
</Card>
      </div>

      {/* Notification Table */}
<Card className="p-6">
  <h2 className="text-lg font-semibold">Notification Email</h2>
  <p className="text-gray-600 text-sm mb-4">
    View and manage emails linked to devices
  </p>

  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-left border-b">
          <th className="p-2">Device ID</th>
          <th className="p-2">Emails</th>
           <th className="p-2">Action</th> 
        </tr>
      </thead>
      <tbody>
        {Array.from(new Set(emails.map((e) => e.device))).map((deviceId) => (
          <tr key={deviceId} className="border-b">
            <td className="p-2">{deviceId}</td>
            <td className="p-2">
              <Button size="sm" onClick={() => handleViewEmails(deviceId)}>
                View
              </Button>
            </td>
           <td className="p-2 flex gap-2">
  {/* Send Notification Icon */}
  <Button
    size="icon"
    variant="ghost"
    onClick={() => handleSendNotification(deviceId)}
  >
    <Send className="w-4 h-4 text-blue-600" />
  </Button>

  {/* Delete Mapping Icon */}
  <Button
    size="icon"
    variant="ghost"
    onClick={() => deleteDeviceMapping(deviceId)}
  >
    <Trash2 className="w-4 h-4 text-red-600" />
  </Button>
</td>



          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Card>
{viewDevice && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg w-96">
      <h2 className="text-lg font-semibold mb-4">Emails for {viewDevice}</h2>
{emails
  .filter((e) => e.device === viewDevice)
  .map((email) => (
    <div key={email.id} className="flex items-center justify-between gap-2 mb-2">
      <span>{email.email}</span>
      <div className="flex gap-2">
        {/* Edit Email */}
        <Button size="icon" variant="ghost" onClick={() => handleEditEmail(email)}>
          <Edit2 className="w-4 h-4 text-blue-600" />
        </Button>

        {/* Delete Email */}
        <Button size="icon" variant="ghost" onClick={() => deleteEmail(email)}>
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      </div>
    </div>
  ))}


      <div className="flex justify-end mt-4">
        <Button variant="outline" onClick={() => setViewDevice(null)}>Close</Button>
      </div>
    </div>
  </div>
)}


    </div>
  );
}
