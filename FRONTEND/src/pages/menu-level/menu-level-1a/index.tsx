import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import { Title } from "@/ui/typography";
import Swal from 'sweetalert2';

const reportsData = [
  { deviceId: "BMS001", batteryId: "BAT1001", voltage: 48.2, temperature: 25, charge: 85, discharge: 15, ahValue: 100 },
  { deviceId: "BMS002", batteryId: "BAT1002", voltage: 48.0, temperature: 26, charge: 80, discharge: 20, ahValue: 95 },
  { deviceId: "BMS003", batteryId: "BAT1003", voltage: 47.8, temperature: 27, charge: 90, discharge: 10, ahValue: 110 },
  { deviceId: "BMS004", batteryId: "BAT1004", voltage: 49.0, temperature: 24, charge: 88, discharge: 12, ahValue: 105 },
  { deviceId: "BMS005", batteryId: "BAT1005", voltage: 48.5, temperature: 25, charge: 82, discharge: 18, ahValue: 98 },
];

const initialAnalyticsData = [
  { date: "2023-10-01", minVoltage: 47.5, maxVoltage: 49.0, avgVoltage: 48.3, minTemp: 23, maxTemp: 27, avgTemp: 25 },
  { date: "2023-10-02", minVoltage: 47.3, maxVoltage: 48.8, avgVoltage: 48.1, minTemp: 24, maxTemp: 26, avgTemp: 25 },
  { date: "2023-10-03", minVoltage: 47.8, maxVoltage: 49.2, avgVoltage: 48.5, minTemp: 22, maxTemp: 28, avgTemp: 26 },
];

const notificationsData = [
  { email: "admin@example.com", devices: ["BMS001", "BMS002"] },
  { email: "tech@example.com", devices: ["BMS003"] },
];

const initialLiveData = [
  {
    deviceId: "BMS001",
    batteryId: "BAT1001",
    status: "online",
    telemetry: { packVoltage: 48.2, current: 2.0, temperatures: [24, 25], voltages: [3.8, 3.9, 3.7] },
    chartData: [{ time: "10:00", voltage: 48.0, current: 1.8, temp: 24 }, { time: "10:15", voltage: 48.1, current: 1.9, temp: 24 }, { time: "10:30", voltage: 48.2, current: 2.0, temp: 25 }],
  },
  {
    deviceId: "BMS002",
    batteryId: "BAT1002",
    status: "online",
    telemetry: { packVoltage: 48.0, current: 1.8, temperatures: [25, 26], voltages: [3.9, 3.8, 3.7] },
    chartData: [{ time: "10:00", voltage: 47.8, current: 1.6, temp: 24 }, { time: "10:15", voltage: 47.9, current: 1.7, temp: 25 }, { time: "10:30", voltage: 48.0, current: 1.8, temp: 25 }],
  },
  {
    deviceId: "BMS003",
    batteryId: "BAT1003",
    status: "online",
    telemetry: { packVoltage: 47.8, current: 1.5, temperatures: [26, 27], voltages: [3.7, 3.8, 3.9] },
    chartData: [{ time: "10:00", voltage: 47.5, current: 1.2, temp: 25 }, { time: "10:15", voltage: 47.6, current: 1.3, temp: 26 }, { time: "10:30", voltage: 47.8, current: 1.5, temp: 26 }],
  },
  {
    deviceId: "BMS004",
    batteryId: "BAT1004",
    status: "online",
    telemetry: { packVoltage: 49.0, current: 2.5, temperatures: [23, 24], voltages: [3.9, 4.0, 3.8] },
    chartData: [{ time: "10:00", voltage: 48.8, current: 2.2, temp: 22 }, { time: "10:15", voltage: 48.9, current: 2.3, temp: 23 }, { time: "10:30", voltage: 49.0, current: 2.5, temp: 23 }],
  },
  {
    deviceId: "BMS005",
    batteryId: "BAT1005",
    status: "online",
    telemetry: { packVoltage: 48.5, current: 2.2, temperatures: [24, 25], voltages: [3.8, 3.9, 3.8] },
    chartData: [{ time: "10:00", voltage: 48.3, current: 2.0, temp: 23 }, { time: "10:15", voltage: 48.4, current: 2.1, temp: 24 }, { time: "10:30", voltage: 48.5, current: 2.2, temp: 24 }],
  },
];

export default function MenuLevel() {
  const [currentPage, setCurrentPage] = useState("Live Monitoring");
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialLiveData[0]?.deviceId || "");
  const [liveData, setLiveData] = useState(initialLiveData);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLogsPopup, setShowLogsPopup] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(initialAnalyticsData);

  useEffect(() => {
    fetch('http://192.168.1.8:8070/devices/fetch-all?includeInactive=true')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setLiveData(data.data);
          if (data.data.length > 0) {
            setSelectedDeviceId(data.data[0].deviceId);
          }
          setFetchError(false);
        } else {
          console.error('Fetched data is not in expected format:', data);
          setLiveData([]);
          setFetchError(true);
        }
      })
      .catch(err => {
        console.error('Failed to fetch devices:', err);
        setFetchError(true);
        Swal.fire({ title: 'Server Connection Failed', text: 'Unable to fetch device data.', icon: 'error' });
      });
  }, []);

useEffect(() => {
  const ws = new WebSocket('ws://192.168.1.8:8071');

  ws.onopen = () => {
    setWsConnected(true);
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'deviceUpdate' && message.data) {
        setLiveData(prev => prev.map(d =>
          d.deviceId === message.data.deviceId ? { ...d, ...message.data } : d
        ));
        setLogs(prev => [...prev, `WS: Updated device ${message.data.deviceId}`]);
      }
    } catch (err) {
      console.error('Failed to parse WS message:', err);
    }
  };

  ws.onclose = () => {
    setWsConnected(false);
    Swal.fire({ title: 'WebSocket Connection Failed', text: 'WebSocket connection failed.', icon: 'error' });
  };

  ws.onerror = () => {
    setWsConnected(false);
    Swal.fire({ title: 'WebSocket Connection Failed', text: 'WebSocket connection failed.', icon: 'error' });
  };

  return () => ws.close();
}, []);

useEffect(() => {
  if (currentPage === "Analytics") {
    fetch('http://192.168.1.8:8070/analytics') // assuming endpoint
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setAnalyticsData(data.data);
        } else {
          console.error('No analytics data available:', data);
          Swal.fire({ title: 'No Analytics Data', text: 'No analytics data is currently available.', icon: 'info' });
          setAnalyticsData(initialAnalyticsData); // fallback to initial data
        }
      })
      .catch(err => {
        console.error('Failed to fetch analytics:', err);
        Swal.fire({ title: 'Failed to Fetch Analytics', text: 'Unable to fetch analytics data.', icon: 'error' });
      });
  }
}, [currentPage]);

  const sidebarItems = [
    "System Connectivity",
    "Live Monitoring",
    "Reports",
    "Analytics",
    "Notifications",
    "Settings",
  ];

  const renderContent = () => {
    switch (currentPage) {
      case "System Connectivity":
        return (
          <div className="space-y-6">
            <Title as="h1">System Connectivity</Title>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center space-x-8">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-300 border-2 border-green-500 rounded flex items-center justify-center">
                      <Icon icon="mdi:battery" size="40" />
                    </div>
                    <p className="mt-2">Battery Bank</p>
                  </div>
                  <Icon icon="mdi:arrow-right" size="32" />
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-300 border-2 border-blue-500 rounded flex items-center justify-center">
                      <Icon icon="mdi:gauge" size="40" />
                    </div>
                    <p className="mt-2">BMS</p>
                  </div>
                  <Icon icon="mdi:arrow-right" size="32" />
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-300 border-2 border-red-500 rounded flex items-center justify-center">
                      <Icon icon="mdi:current-ac" size="40" />
                    </div>
                    <p className="mt-2">Current Sensor</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case "Live Monitoring": {
        const filteredData = liveData.filter(
          d =>
            searchTerm === "" ||
            d.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.batteryId.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const selectedDevice = selectedDeviceId ? liveData.find(d => d.deviceId === selectedDeviceId) : null;
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Title as="h1">Live Monitoring</Title>
              <div className="flex space-x-4">
                <button onClick={() => setShowLogsPopup(true)} className="px-3 py-1 rounded bg-blue-500 text-white text-sm">View Logs</button>
                <span className={`px-3 py-1 rounded-full text-sm ${wsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  WS: {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm ${!fetchError ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  Server: {!fetchError ? 'OK' : 'Failed'}
                </span>
                <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">Last: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">Search Devices</label>
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-black rounded px-3 py-2"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Devices</h3>
                <div className="space-y-2">
                  {filteredData.map(device => (
                    <button
                      key={device.deviceId}
                      onClick={() => setSelectedDeviceId(device.deviceId)}
                      className={`p-4 border rounded-lg text-left w-full ${
                        selectedDeviceId === device.deviceId
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{device.deviceId}</div>
                      <div className="text-sm text-gray-600">{device.batteryId}</div>
                      <div className={`text-sm ${device.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                        {device.status}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {selectedDevice && selectedDevice.telemetry && (
              <div className="space-y-6">
                <div className="grid grid-cols-12 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-4">
                    <h3 className="text-lg font-semibold mb-4">Device</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-gray-600">Device ID</div>
                      <div className="text-black">{selectedDevice.deviceId}</div>
                      <div className="text-gray-600">Battery ID</div>
                      <div className="text-black">{selectedDevice.batteryId}</div>
                      <div className="text-gray-600">Status</div>
                      <div className="text-black">{selectedDevice.status}</div>
                      <div className="text-gray-600">Mode</div>
                      <div className="text-black">
                        {selectedDevice.telemetry && selectedDevice.telemetry.current !== undefined
                          ? (selectedDevice.telemetry.current > 0
                            ? "Charging"
                            : selectedDevice.telemetry.current < 0
                            ? "Discharging"
                            : "Idle")
                          : "Unknown"}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-8">
                    <h3 className="text-lg font-semibold mb-4">Pack</h3>
                    <div className="flex flex-wrap gap-4">
                      <div className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1 text-sm">
                        Pack Voltage: {selectedDevice.telemetry.packVoltage.toFixed(1)} V
                      </div>
                      <div className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1 text-sm">
                        Current: {selectedDevice.telemetry.current.toFixed(1)} A
                      </div>
                      <div className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1 text-sm">
                        Max Temp: {Math.max(...selectedDevice.telemetry.temperatures).toFixed(1)} °C
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-6">
                    <h3 className="text-lg font-semibold mb-4">Cell Voltages</h3>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="pb-2">Cell</th>
                          <th className="pb-2">Voltage (V)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDevice.telemetry.voltages && selectedDevice.telemetry.voltages.map((v, i) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-2">{i + 1}</td>
                            <td className="py-2">{v.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-6">
                    <h3 className="text-lg font-semibold mb-4">Temperatures</h3>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="pb-2">Sensor</th>
                          <th className="pb-2">Temp (°C)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDevice.telemetry.temperatures && selectedDevice.telemetry.temperatures.map((t, i) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-2">{i + 1}</td>
                            <td className="py-2">{t.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {selectedDevice.chartData && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Chart</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={selectedDevice.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                      <XAxis dataKey="time" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #D1D5DB' }} />
                      <Legend />
                      <Line type="monotone" dataKey="voltage" stroke="#8B5CF6" />
                      <Line type="monotone" dataKey="current" stroke="#06B6D4" />
                      <Line type="monotone" dataKey="temp" stroke="#F59E0B" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                )}
                {selectedDevice.telemetry.voltages && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Cell Voltages</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={selectedDevice.telemetry.voltages.map((v, i) => ({ cell: `Cell ${i + 1}`, voltage: v }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                      <XAxis dataKey="cell" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #D1D5DB' }} />
                      <Bar dataKey="voltage" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                )}
              </div>
            )}
            {!selectedDevice && (
              <div className="text-center py-8 text-gray-500">
                Select a device to view its analytics.
              </div>
            )}
          </div>
        );
      }
      case "Reports": {
        const exportCSV = () => {
          const header = "Device ID,Battery ID,Voltage,Temperature,Charge,Discharge,AH Value";
          const data = reportsData.map(row => Object.values(row).join(",")).join("\n");
          const csv = header + "\n" + data;
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "reports.csv";
          a.click();
        };
        return (
          <div className="space-y-6">
            <div className="flex justify-between">
              <Title as="h1">Reports</Title>
              <button
                onClick={exportCSV}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Export CSV
              </button>
            </div>
            <Card>
              <CardContent>
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b">
                      <th>Device ID</th>
                      <th>Battery ID</th>
                      <th>Voltage</th>
                      <th>Temperature</th>
                      <th>Charge</th>
                      <th>Discharge</th>
                      <th>AH Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsData.map(row => (
                      <tr key={row.deviceId} className="border-b">
                        <td>{row.deviceId}</td>
                        <td>{row.batteryId}</td>
                        <td>{row.voltage}</td>
                        <td>{row.temperature}</td>
                        <td>{row.charge}</td>
                        <td>{row.discharge}</td>
                        <td>{row.ahValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="deviceId" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="voltage" fill="#22c55e" />
                    <Bar dataKey="temperature" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );
      }
      case "Analytics":
        return (
          <div className="space-y-6">
            <Title as="h1">Analytics</Title>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Average Voltage Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="avgVoltage" stroke="#22c55e" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Temperature Ranges</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.map(d => ({ ...d, tempRange: d.maxTemp - d.minTemp }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="tempRange" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Average Temperature Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="avgTemp" stroke="#8884d8" fill="#8884d8" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case "Notifications":
        return (
          <div className="space-y-6">
            <Title as="h1">Notifications</Title>
            <Card>
              <CardContent>
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b">
                      <th>Email</th>
                      <th>Devices</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificationsData.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td>{row.email}</td>
                        <td>{row.devices.join(", ")}</td>
                        <td>
                          <button className="text-blue-500">Edit</button> |{" "}
                          <button className="text-red-500">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        );
      case "Settings":
        return (
          <div className="space-y-6">
            <Title as="h1">Settings</Title>
            <Card>
              <CardContent>
                <p>Settings placeholder</p>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 overflow-y-auto">{renderContent()}</main>
      </div>
      {showLogsPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-black text-green-400 font-mono p-6 rounded-lg w-4/5 h-4/5 max-w-4xl max-h-96 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Terminal Logs</h3>
              <button
                onClick={() => setShowLogsPopup(false)}
                className="text-green-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-900 p-4 rounded border border-gray-700">
              {logs.slice(-100).map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
