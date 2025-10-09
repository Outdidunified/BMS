import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import { Title } from "@/ui/typography";
import { Skeleton } from "@/ui/skeleton";
import Swal from 'sweetalert2';
import { useDeviceWebSocket } from "@/hooks/useDeviceWebSocket";
import devicesService from "@/api/services/devicesService";
import telemetryService from "@/api/services/telemetryService";
import { Wifi } from "lucide-react";
import * as XLSX from 'xlsx'; 


// No static data - all data will come from API and WebSocket

// Helper functions for telemetry processing
function statusFromParams(p = {}) {
  const cc = Number(p.cc || 0);
  const dc = Number(p.dc || 0);
  if (cc > 0) return 'Charging';
  if (dc > 0) return 'Discharging';
  return 'Idle';
}

function extractParams(frame) {
  // Supports both { telemetry: {voltages[], temperatures[], packVoltage, currents{charging,discharging,load}} } and legacy { params: {v1.., T1.., pv, cc, dc, lc} }
  const out = {};
  const t = frame?.telemetry || {};
  if (Array.isArray(t.voltages)) t.voltages.forEach((v, i) => out[`v${i + 1}`] = v);
  if (Array.isArray(t.temperatures)) t.temperatures.forEach((v, i) => out[`T${i + 1}`] = v);
  if (typeof t.packVoltage === 'number') out.pv = t.packVoltage;
  if (t.currents) {
    if (typeof t.currents.charging === 'number') out.cc = t.currents.charging;
    if (typeof t.currents.discharging === 'number') out.dc = t.currents.discharging;
    if (typeof t.currents.load === 'number') out.lc = t.currents.load;
  }
  const p = frame?.params || {};
  for (const [k, v] of Object.entries(p)) if (typeof v === 'number') out[k] = v;
  return out;
}

export default function MenuLevel() {
  const [currentPage, setCurrentPage] = useState("Live Monitoring");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [liveData, setLiveData] = useState([]);
  const [activeDevices, setActiveDevices] = useState<string[]>([]);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLogsPopup, setShowLogsPopup] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [isLoadingDevice, setIsLoadingDevice] = useState(false);
  const [liveStreamingMode, setLiveStreamingMode] = useState(false);
  
  // Enhanced live monitoring state
  const [live, setLive] = useState(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [events, setEvents] = useState([]);
  const [toastAlerts, setToastAlerts] = useState([]);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [warningHistory, setWarningHistory] = useState<any[]>([]);
  const [showWarningsModal, setShowWarningsModal] = useState(false);
  const [isLoadingWarnings, setIsLoadingWarnings] = useState(false);
  const maxHistoryPoints = 50; // Keep last 50 data points for trends
  const logsContainerRef = useRef(null);
  const alertIdCounter = useRef(0); // For unique alert IDs

  // Device mapping for quick lookup
  const deviceMap = useMemo(() => new Map(liveData.map(d => [d.deviceId, d])), [liveData]);

  // Selected device and its warnings
  const selectedDevice = liveData.find(d => d.deviceId === selectedDeviceId);
  const warnings = selectedDevice?.warningSettings;

  // Load devices from API
  useEffect(() => {
    const loadDevices = async () => {
      try {
        console.log('Fetching devices from API...');
        const response = await devicesService.listDevices(true);
        console.log('Devices fetched:', response);
        const devices = Array.isArray(response) ? response : response?.data || [];
        if (devices && Array.isArray(devices)) {
          console.log(`Processing ${devices.length} devices`);
          setLiveData(devices.map(d => ({
            deviceId: d.deviceId,
            batteryId: d.batteryId,
            connected: d.connected || false,
            stationDetails: d.stationDetails,
            warningSettings: d.warningSettings,
            telemetry: { packVoltage: 0, current: 0, temperatures: [], voltages: [] },
            chartData: []
          })));
          console.log('Live data set:', liveData);
          if (devices.length > 0) {
            setSelectedDeviceId(devices[0].deviceId);
            console.log('Selected first device:', devices[0].deviceId);
          }
          setFetchError(false);
        } else {
          console.log('No devices returned or invalid format');
        }
      } catch (err) {
        console.error('Failed to fetch devices:', err);
        setFetchError(true);
        Swal.fire({ title: 'Server Connection Failed', text: 'Unable to fetch device data.', icon: 'error' });
      }
    };
    loadDevices();
  }, []);

  // Helper function to add events
  const addEvent = useCallback((type, detail, severity = 'warning') => {
    const event = {
      id: ++alertIdCounter.current,
      type,
      detail,
      severity,
      timestamp: new Date().toLocaleTimeString()
    };
    setEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events

    // Add toast alert for critical events
    if (severity === 'error') {
      setToastAlerts(prev => [event, ...prev.slice(0, 2)]); // Keep last 3 toast alerts
      setTimeout(() => {
        setToastAlerts(prev => prev.filter(a => a.id !== event.id));
      }, 10000); // Remove after 10 seconds
    }
  }, []);

  // Function to fetch warning history
  const fetchWarningHistory = async () => {
    if (!selectedDeviceId || !selectedDevice) {
      Swal.fire('Error', 'No device selected', 'error');
      return;
    }
    setIsLoadingWarnings(true);
    try {
      const stationId = selectedDevice.stationDetails?._id;
      const token = sessionStorage.getItem("authToken") || sessionStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_APP_API_BASE_URL}/warnings/history?deviceId=${selectedDeviceId}&stationId=${stationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setWarningHistory(data.data.warnings);
        setShowWarningsModal(true);
      } else {
        Swal.fire('Error', 'Failed to fetch warning history', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch warning history:', error);
      Swal.fire('Error', 'Failed to fetch warning history', 'error');
    } finally {
      setIsLoadingWarnings(false);
    }
  };

  // Function to export warning history to Excel
  const exportToExcel = () => {
    if (warningHistory.length === 0) {
      Swal.fire('No Data', 'No warning history to export', 'info');
      return;
    }

    // Prepare data for Excel
    const excelData = warningHistory.map(warning => ({
      'Parameter': warning.parameter || '',
      'Type': warning.type || '',
      'Value': warning.value || '',
      'Threshold': warning.threshold || '',
      'Message': warning.message || '',
      'Timestamp': warning.timestamp ? new Date(warning.timestamp).toLocaleString() : '',
      'Resolved': warning.resolved ? 'Yes' : 'No'
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const colWidths = [
      { wch: 15 }, // Parameter
      { wch: 10 }, // Type
      { wch: 10 }, // Value
      { wch: 12 }, // Threshold
      { wch: 30 }, // Message
      { wch: 20 }, // Timestamp
      { wch: 10 }  // Resolved
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Warning History');

    // Generate filename with device ID and date
    const filename = `Warning_History_${selectedDeviceId}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  };

  // Memoized WebSocket message handler
  const handleWebSocketMessage = useCallback((msg) => {
    console.log('WebSocket message received:', msg);

    // Log incoming WebSocket frames
    setLogs(prev => [...prev.slice(-99), `${new Date().toLocaleTimeString()} - ${JSON.stringify(msg)}`]);

    if (msg?.type === 'hello') {
      setActiveDevices(msg.devices || []);
      console.log('Active devices from backend:', msg.devices);
      return;
    }

    if (msg?.type === 'live') {
      const di = msg.data?.device?.DI || msg.data?.deviceFull?.deviceId || msg.data?.deviceId;

      // Only process messages for the selected device
      if (di !== selectedDeviceId) {
        console.log(`Ignoring live message for device ${di}, selected is ${selectedDeviceId}`);
        return;
      }

      // Update live data for the selected device
      setLiveData(prev => prev.map(device => {
        if (device.deviceId === di) {
          const newTelemetry = msg.data;
          const params = extractParams(newTelemetry);

          return {
            ...device,
            telemetry: {
              packVoltage: params.pv || 0,
              current: Math.max(params.cc || 0, params.dc || 0, params.lc || 0),
              temperatures: Object.keys(params).filter(k => k.startsWith('T')).map(k => params[k]),
              voltages: Object.keys(params).filter(k => k.startsWith('v')).map(k => params[k])
            },
            lastUpdate: new Date().toISOString()
          };
        }
        return device;
      }));

      // Update live state and historical data for selected device
      const newData = msg.data;
      setLive(newData);
      setLastLiveUpdate(Date.now());
      setIsLoadingDevice(false);

      // Add to historical data for trends
      const timestamp = new Date().toLocaleTimeString();
      const params = extractParams(newData);

      setHistoricalData(prev => {
        const newHistory = [...prev, { timestamp, ...params }];
        return newHistory.slice(-maxHistoryPoints);
      });

      // Update device status
      const now = Date.now();
      const lastUpdate = new Date(newData.time || newData.timestamp || Date.now()).getTime();
      if (now - lastUpdate > 30000) { // 30 seconds threshold
        addEvent('Disconnection', 'Device appears to be disconnected', 'error');
      }
    } else if (msg?.type === 'device_connected') {
      const di = msg.deviceId;
      setLiveData(prev => prev.map(device =>
        device.deviceId === di ? { ...device, connected: true } : device
      ));
      addEvent('Device Online', `Device ${di} is online`, 'info');
    } else if (msg?.type === 'device_disconnected') {
      const di = msg.deviceId;
      setLiveData(prev => prev.map(device =>
        device.deviceId === di ? { ...device, connected: false } : device
      ));
      addEvent('Device Offline', `Device ${di} is offline`, 'warning');
    } else if (msg?.type === 'hello') {
      console.log('WebSocket connected successfully');
      addEvent('Connection', 'WebSocket connected successfully', 'info');
    }
  }, [selectedDeviceId, maxHistoryPoints, addEvent]);

  // WebSocket connection for live data
  const { connected: wsConnected, send: wsSend } = useDeviceWebSocket({
    url: import.meta.env.VITE_APP_WS_BASE_URL,
    reconnect: true,
    reconnectDelayMs: 2000,
    onMessage: handleWebSocketMessage,
    key: selectedDeviceId,
  });

  // Connection status monitoring
  useEffect(() => {
    if (wsConnected) {
      console.log('WebSocket connected');
      addEvent('Connection', 'Live monitoring connected', 'info');
    } else {
      console.log('WebSocket disconnected');
      addEvent('Connection', 'Live monitoring disconnected', 'warning');
    }
  }, [wsConnected]);

  // Subscribe to selected device when connected
  useEffect(() => {
    if (wsConnected && selectedDeviceId) {
      console.log('Subscribing to device:', selectedDeviceId);
      wsSend({ type: 'subscribe', deviceId: selectedDeviceId });
    }
  }, [selectedDeviceId, wsConnected]);

  // Periodic heartbeat and stale data detection
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsConnected) {
        // Send heartbeat
        wsSend({ type: 'ping', timestamp: Date.now() });
        
        // Check for stale data (devices not updated in last 60 seconds)
        const now = Date.now();
        liveData.forEach(device => {
          if (device.lastUpdate) {
            const lastUpdate = new Date(device.lastUpdate).getTime();
            if (now - lastUpdate > 60000) {
              addEvent('Stale Data', `Device ${device.deviceId} data is stale`, 'warning');
            }
          }
        });
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [wsConnected, liveData]);

  // Clear live data when device changes - only show real-time WS data
  useEffect(() => {
    setLive(null);
    setLastLiveUpdate(0);
    setHistoricalData([]);
    setIsLoadingDevice(true);
    setShowWarningsModal(false); // Hide warning history when device changes
    setToastAlerts([]); // Clear toast alerts when device changes
    const timeout = setTimeout(() => setIsLoadingDevice(false), 10000); // Stop loading after 10 seconds if no data
    return () => clearTimeout(timeout);
  }, [selectedDeviceId]);

  // Clear stale live data if no update for 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastLiveUpdate > 0 && Date.now() - lastLiveUpdate > 30000) {
        console.log('Clearing stale live data');
        setLive(null);
        setLastLiveUpdate(0);
        addEvent('Stale Data', 'Live data cleared due to no updates', 'warning');
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [lastLiveUpdate, addEvent]);

  const params = useMemo(() => extractParams(live), [live]);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Enhanced alerts system with event detection
  useEffect(() => {
    // Only run if we have valid params
    if (!params || Object.keys(params).length === 0) return;

    const a = [];
    const prevParams = historicalData[historicalData.length - 2] || {};

    // Voltage alerts and spike detection
    const highVolt = warnings?.cellVoltage?.high ?? 4.2;
    const lowVolt = warnings?.cellVoltage?.low ?? 3.0;
    for (let i = 1; i <= 24; i++) {
      const v = Number(params[`v${i}`]);
      const prevV = Number(prevParams[`v${i}`]) || v;

      // Only process if we have valid voltage values
      if (!isFinite(v) || v === 0) continue;

      if (v > highVolt) {
        a.push({ type: 'High Voltage', detail: `Cell v${i} = ${v.toFixed(2)}V`, severity: 'error' });
        addEvent('Over Voltage', `Cell v${i} exceeded ${highVolt}V: ${v.toFixed(2)}V`, 'error');
      }
      if (v < lowVolt && v > 0) {
        a.push({ type: 'Low Voltage', detail: `Cell v${i} = ${v.toFixed(2)}V`, severity: 'error' });
        addEvent('Under Voltage', `Cell v${i} below ${lowVolt}V: ${v.toFixed(2)}V`, 'error');
      }

      // Voltage spike detection
      if (Math.abs(v - prevV) > 0.5 && prevV > 0 && isFinite(prevV)) {
        addEvent('Voltage Spike', `Cell v${i} changed by ${(v - prevV).toFixed(2)}V`, 'warning');
      }
    }

    // Temperature alerts and variance detection
    const highTemp = warnings?.temperature?.high ?? 60;
    const lowTemp = warnings?.temperature?.low ?? 0;
    for (let i = 1; i <= 25; i++) {
      const t = Number(params[`T${i}`]);
      const prevT = Number(prevParams[`T${i}`]) || t;

      // Only process if we have valid temperature values
      if (!isFinite(t)) continue;

      if (t > highTemp) {
        a.push({ type: 'High Temperature', detail: `Sensor T${i} = ${t.toFixed(1)}°C`, severity: 'error' });
        addEvent('Over Temperature', `Sensor T${i} exceeded ${highTemp}°C: ${t.toFixed(1)}°C`, 'error');
      }
      if (t < lowTemp && t !== 0) {
        a.push({ type: 'Low Temperature', detail: `Sensor T${i} = ${t.toFixed(1)}°C`, severity: 'warning' });
        addEvent('Under Temperature', `Sensor T${i} below ${lowTemp}°C: ${t.toFixed(1)}°C`, 'warning');
      }

      // Temperature spike detection
      if (Math.abs(t - prevT) > 10 && prevT > 0 && isFinite(prevT)) {
        addEvent('Temperature Spike', `Sensor T${i} changed by ${(t - prevT).toFixed(1)}°C`, 'warning');
      }
    }

    // Current alerts
    const highCurr = warnings?.current?.high ?? 50;
    const cc = Number(params.cc) || 0;
    const dc = Number(params.dc) || 0;
    const lc = Number(params.lc) || 0;
    const prevCc = Number(prevParams.cc) || 0;
    const prevDc = Number(prevParams.dc) || 0;

    // Only process if we have valid current values
    if (isFinite(cc) && cc > highCurr) {
      a.push({ type: 'High Charging Current', detail: `${cc.toFixed(2)}A`, severity: 'warning' });
      addEvent('Over Current', `Charging current exceeded ${highCurr}A: ${cc.toFixed(2)}A`, 'warning');
    }
    if (isFinite(dc) && dc > highCurr) {
      a.push({ type: 'High Discharge Current', detail: `${dc.toFixed(2)}A`, severity: 'warning' });
      addEvent('Over Current', `Discharge current exceeded ${highCurr}A: ${dc.toFixed(2)}A`, 'warning');
    }

    // Current spike detection
    if (isFinite(cc) && isFinite(prevCc) && Math.abs(cc - prevCc) > 20 && prevCc > 0) {
      addEvent('Current Spike', `Charging current changed by ${(cc - prevCc).toFixed(2)}A`, 'warning');
    }
    if (isFinite(dc) && isFinite(prevDc) && Math.abs(dc - prevDc) > 20 && prevDc > 0) {
      addEvent('Current Spike', `Discharge current changed by ${(dc - prevDc).toFixed(2)}A`, 'warning');
    }

    setAlerts(a);
  }, [params, historicalData, warnings]);

  // Prepare chart data
  const voltageChartData = useMemo(() => {
    const highVolt = warnings?.cellVoltage?.high ?? 4.2;
    const lowVolt = warnings?.cellVoltage?.low ?? 3.0;
    const data = [];
    for (let i = 1; i <= 24; i++) {
      const voltage = Number(params[`v${i}`]) || 0;
      data.push({
        cell: `v${i}`,
        voltage: voltage,
        status: voltage > highVolt ? 'High' : voltage < lowVolt ? 'Low' : 'Normal'
      });
    }
    return data;
  }, [params, warnings]);

  const temperatureChartData = useMemo(() => {
    const highTemp = warnings?.temperature?.high ?? 60;
    const lowTemp = warnings?.temperature?.low ?? 0;
    const data = [];
    for (let i = 1; i <= 25; i++) {
      const temp = Number(params[`T${i}`]) || 0;
      data.push({
        sensor: `T${i}`,
        temperature: temp,
        status: temp > highTemp ? 'High' : temp < lowTemp ? 'Low' : 'Normal'
      });
    }
    return data;
  }, [params, warnings]);

  const currentAnalytics = useMemo(() => {
    const cc = Number(params.cc) || 0;
    const dc = Number(params.dc) || 0;
    const lc = Number(params.lc) || 0;

    return [
      { name: 'Charging', value: cc, color: '#10B981' },
      { name: 'Discharging', value: dc, color: '#EF4444' },
      { name: 'Load', value: lc, color: '#F59E0B' }
    ].filter(item => item.value > 0);
  }, [params]);

  const systemAnalytics = useMemo(() => {
    const voltages = voltageChartData.map(d => d.voltage).filter(v => v > 0);
    const temperatures = temperatureChartData.map(d => d.temperature).filter(t => t > 0);

    const avgVoltage = voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : 0;
    const minVoltage = voltages.length > 0 ? Math.min(...voltages) : 0;
    const maxVoltage = voltages.length > 0 ? Math.max(...voltages) : 0;
    const voltageImbalance = maxVoltage - minVoltage;

    const avgTemp = temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : 0;
    const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : 0;
    const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 0;
    const tempVariance = maxTemp - minTemp;

    const packVoltage = Number(params.pv) || 0;
    const chargingCurrent = Number(params.cc) || 0;
    const dischargingCurrent = Number(params.dc) || 0;
    const loadCurrent = Number(params.lc) || 0;

    const power = packVoltage * (chargingCurrent || dischargingCurrent || 0);

    // SOC estimation (simplified - based on average cell voltage)
    const socEstimate = avgVoltage > 0 ? Math.max(0, Math.min(100, ((avgVoltage - 3.0) / (4.2 - 3.0)) * 100)) : 0;

    // SOH estimation (simplified - based on voltage imbalance and capacity)
    const sohEstimate = voltageImbalance < 0.1 ? 100 : Math.max(70, 100 - (voltageImbalance * 100));

    // Rolling averages from historical data
    const recentData = historicalData.slice(-10); // Last 10 points
    const rollingAvgVoltage = recentData.length > 0 ?
      recentData.reduce((sum, d) => sum + (Number(d.pv) || 0), 0) / recentData.length : packVoltage;
    const rollingAvgCurrent = recentData.length > 0 ?
      recentData.reduce((sum, d) => sum + (Number(d.cc) || Number(d.dc) || 0), 0) / recentData.length : (chargingCurrent || dischargingCurrent);

    return {
      avgVoltage,
      minVoltage,
      maxVoltage,
      voltageImbalance,
      avgTemp,
      minTemp,
      maxTemp,
      tempVariance,
      packVoltage,
      chargingCurrent,
      dischargingCurrent,
      loadCurrent,
      power,
      socEstimate,
      sohEstimate,
      rollingAvgVoltage,
      rollingAvgCurrent,
      efficiency: power > 0 ? (packVoltage / power * 100) : 0
    };
  }, [params, voltageChartData, temperatureChartData, historicalData]);

  // Prepare trend data for charts
  const trendData = useMemo(() => {
    return historicalData.map(d => ({
      timestamp: d.timestamp,
      packVoltage: Number(d.pv) || 0,
      avgVoltage: (() => {
        const voltages = [];
        for (let i = 1; i <= 24; i++) {
          const v = Number(d[`v${i}`]);
          if (v > 0) voltages.push(v);
        }
        return voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : 0;
      })(),
      maxTemp: (() => {
        const temps = [];
        for (let i = 1; i <= 25; i++) {
          const t = Number(d[`T${i}`]);
          if (t > 0) temps.push(t);
        }
        return temps.length > 0 ? Math.max(...temps) : 0;
      })(),
      chargingCurrent: Number(d.cc) || 0,
      dischargingCurrent: Number(d.dc) || 0
    }));
  }, [historicalData]);

useEffect(() => {
  if (currentPage === "Analytics") {
    fetch(`${import.meta.env.VITE_APP_API_BASE_URL}/analytics`) // assuming endpoint
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setAnalyticsData(data.data);
        } else {
          console.error('No analytics data available:', data);
          Swal.fire({ title: 'No Analytics Data', text: 'No analytics data is currently available.', icon: 'info' });
          setAnalyticsData([]); // fallback to empty array
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
        ).sort((a, b) => {
          if (liveStreamingMode) {
            if (a.connected && !b.connected) return -1;
            if (!a.connected && b.connected) return 1;
            return 0;
          }
          return 0;
        });
        const selectedDevice = selectedDeviceId ? liveData.find(d => d.deviceId === selectedDeviceId) : null;
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Title as="h1">Live Monitoring</Title>
              <div className="flex space-x-4">
                <button onClick={() => setShowLogsPopup(true)} className="px-3 py-1 rounded bg-blue-500 text-white text-sm">View Logs</button>
                <button onClick={() => {
                  fetchWarningHistory();
                  setTimeout(() => {
                    const warningsSection = document.getElementById('warnings-section');
                    if (warningsSection) {
                      warningsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 500);
                }} disabled={isLoadingWarnings} className="relative px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium shadow-lg hover:from-orange-600 hover:to-red-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none disabled:scale-100 border-2 border-orange-400">
                  <div className="flex items-center space-x-2">
                    <Icon icon="mdi:alert-circle-outline" className="text-lg" />
                    <span>{isLoadingWarnings ? 'Loading...' : 'View Warning History'}</span>
                    {isLoadingWarnings && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
                  </div>
                  {!isLoadingWarnings && (
                    <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                      !
                    </div>
                  )}
                </button>

                {/* <button onClick={() => setShowAlertsModal(true)} className={`px-2 py-1 rounded ${alerts.length > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}>
                  <Icon icon="mdi:bell" />
                </button> */}
             <span
    className={`flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium ${
      wsConnected
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-800'
    }`}
  >
    WS: {wsConnected ? 'Connected' : 'Disconnected'}
  </span>

  <span
    className={`flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium ${
      !fetchError
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-800'
    }`}
  >
    Server: {!fetchError ? 'OK' : 'Failed'}
  </span>

  <span className="flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
    Last: {new Date().toLocaleTimeString()}
  </span>
              </div>
            </div>

            {/* Toast Alerts */}
            {toastAlerts.length > 0 && (
              <div className="fixed top-4 right-4 z-50 space-y-2">
                {toastAlerts.map(alert => (
                  <div key={alert.id} className={`relative p-4 pr-10 rounded-lg shadow-lg ${alert.severity === 'error' ? 'bg-red-100 border-red-500 text-red-800' : 'bg-yellow-100 border-yellow-500 text-yellow-800'} border-l-4 animate-slide-in-right`}>
                    <button
                      onClick={() => setToastAlerts(prev => prev.filter(a => a.id !== alert.id))}
                      className="absolute top-2 right-2 p-1 hover:bg-black hover:bg-opacity-10 rounded-full transition-colors duration-200"
                      title="Close alert"
                    >
                      <Icon icon="mdi:close" className="text-sm" />
                    </button>
                    <div className="font-semibold flex items-center">
                      <Icon
                        icon={alert.severity === 'error' ? 'mdi:alert-circle' : 'mdi:alert'}
                        className="mr-2"
                      />
                      {alert.type}
                    </div>
                    <div className="text-sm mt-1">{alert.detail}</div>
                    <div className="text-xs opacity-75 mt-2">{alert.timestamp}</div>
                  </div>
                ))}
              </div>
            )}



            {/* System Analytics Overview */}
            {params && Object.keys(params).length > 0 && selectedDevice?.connected && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Pack Voltage</p>
                        <p className="text-2xl font-bold">{systemAnalytics.packVoltage.toFixed(1)}V</p>
                      </div>
                      <Icon icon="mdi:battery" size="24" className="text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Current</p>
                        <p className="text-2xl font-bold">{(systemAnalytics.chargingCurrent || systemAnalytics.dischargingCurrent).toFixed(1)}A</p>
                        <p className="text-xs text-gray-500">{statusFromParams(params)}</p>
                      </div>
                      <Icon icon="mdi:current-ac" size="24" className="text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Max Temperature</p>
                        <p className="text-2xl font-bold">{systemAnalytics.maxTemp.toFixed(1)}°C</p>
                      </div>
                      <Icon icon="mdi:thermometer" size="24" className="text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">SOC Estimate</p>
                        <p className="text-2xl font-bold">{systemAnalytics.socEstimate.toFixed(0)}%</p>
                      </div>
                      <Icon icon="mdi:battery-charging" size="24" className="text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
{/* Device Selection */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>Device Selection</CardTitle>

        {/* When WebSocket is connected */}
        {wsConnected ? (
          filteredData.length === 0 ? (
            // Case: No devices available
            <button
              className="flex items-center gap-2 px-3 py-1 rounded text-sm font-medium bg-gray-300 text-gray-700 cursor-not-allowed"
              disabled
            >
              <Wifi size={16} />
              No devices available
            </button>
          ) : filteredData.some((device) => device.connected) ? (
            // Case: At least one online device
            <button
              onClick={() => setLiveStreamingMode(!liveStreamingMode)}
              className="flex items-center gap-2 px-3 py-1 rounded text-sm font-medium bg-green-500 text-white animate-pulse hover:bg-green-600 transition-colors"
            >
              <Wifi size={16} />
              Click to see online devices
            </button>
          ) : (
            // Case: All devices offline
            <button
              className="flex items-center gap-2 px-3 py-1 rounded text-sm font-medium bg-red-500 text-white cursor-not-allowed"
              disabled
            >
              <Wifi size={16} />
              Every device is offline
            </button>
          )
        ) : (
          // When WebSocket is disconnected
          <button
            className="flex items-center gap-2 px-3 py-1 rounded text-sm font-medium bg-gray-400 text-gray-700 cursor-not-allowed"
            disabled
          >
            <Wifi size={16} />
            Click to see online devices
          </button>
        )}
      </div>
    </CardHeader>

                <CardContent>
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search devices..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 text-black rounded px-3 py-2"
                    />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredData.map(device => (
                      <button
                        key={device.deviceId}
                        onClick={() => setSelectedDeviceId(device.deviceId)}
                        className={`p-3 border rounded-lg text-left w-full transition-colors ${
                          selectedDeviceId === device.deviceId
                            ? 'bg-blue-100 border-blue-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{device.deviceId}</div>
                        <div className="text-sm text-gray-600">{device.stationDetails?.name || 'No Station Assigned'}</div>
                        <div className={`text-sm ${device.connected ? 'text-green-600' : 'text-red-600'}`}>
                          {device.connected ? 'Online' : 'Offline'}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Events Log */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {liveData.filter(d => !d.connected).length > 0 ? (
                      liveData.filter(d => !d.connected).map(device => (
                        <div key={device.deviceId} className="p-2 rounded text-sm border-l-2 bg-yellow-50 border-yellow-500 text-yellow-800">
                          <div className="font-semibold">Device {device.deviceId} Offline</div>
                          <div className="text-xs">The device {device.deviceId} is currently offline. Please check the connection.</div>
                          <div className="text-xs opacity-75">{new Date().toLocaleTimeString()}</div>
                        </div>
                      ))
                    ) : events.length === 0 ? (
                      <p className="text-gray-500 text-sm">No events recorded</p>
                    ) : (
                      events.slice(0, 10).map(event => (
                        <div key={event.id} className={`p-2 rounded text-sm border-l-2 ${
                          event.severity === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
                          event.severity === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                          'bg-blue-50 border-blue-500 text-blue-800'
                        }`}>
                          <div className="font-semibold">{event.type}</div>
                          <div className="text-xs">{event.detail}</div>
                          <div className="text-xs opacity-75">{event.timestamp}</div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Current Analytics */}
              {currentAnalytics.length > 0 && selectedDevice?.connected && (
                <Card>
                  <CardHeader>
                    <CardTitle>Current Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={currentAnalytics}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {currentAnalytics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value.toFixed(2)}A`, 'Current']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
            {/* Device Status Message */}
            {selectedDeviceId && !selectedDevice?.connected && (
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="p-6">
                  <div className="flex items-center text-red-600">
                    <Icon icon="mdi:alert-circle" className="mr-3 text-xl" />
                    <div>
                      <h3 className="font-semibold">Device Offline</h3>
                      <p className="text-sm">The selected device ({selectedDeviceId}) is currently offline. No live data or analytics are available.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detailed Device Monitoring */}
            {selectedDeviceId && selectedDevice?.connected && (isLoadingDevice || (params && Object.keys(params).length > 0)) && (
  <div className="space-y-6">
    {isLoadingDevice ? (
      // Skeleton loading UI
      <>
        {/* Device Info and Pack Overview Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Voltage and Temperature Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-80 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-80 w-full" />
            </CardContent>
          </Card>
        </div>
        {/* Detailed Tables Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
        {/* Trend Analysis Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </>
    ) : (
      // Device Info and Monitoring UI
      <>
        {/* Device Info and Pack Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-gray-600">Device ID</div>
                <div className="text-black font-medium">{selectedDeviceId}</div>
                <div className="text-gray-600">Connection</div>
                <div className={`font-medium ${selectedDevice?.connected ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedDevice?.connected ? 'Online' : 'Offline'}
                </div>
                <div className="text-gray-600">Mode</div>
                <div className="text-black font-medium">{statusFromParams(params)}</div>
                <div className="text-gray-600">Last Update</div>
                <div className="text-black font-medium">{new Date().toLocaleTimeString()}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Voltage Imbalance</span>
                  <span className={`font-medium ${systemAnalytics.voltageImbalance > 0.2 ? 'text-red-600' : 'text-green-600'}`}>
                    {systemAnalytics.voltageImbalance.toFixed(3)}V
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Temperature Variance</span>
                  <span className={`font-medium ${systemAnalytics.tempVariance > 15 ? 'text-red-600' : 'text-green-600'}`}>
                    {systemAnalytics.tempVariance.toFixed(1)}°C
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">SOH Estimate</span>
                  <span className={`font-medium ${systemAnalytics.sohEstimate < 80 ? 'text-red-600' : 'text-green-600'}`}>
                    {systemAnalytics.sohEstimate.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Power</span>
                  <span className="font-medium text-blue-600">
                    {systemAnalytics.power.toFixed(1)}W
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Voltage and Temperature Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       <Card>
  <CardHeader>
    <CardTitle>Cell Voltages</CardTitle>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={voltageChartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="cell" />
        <YAxis domain={['dataMin - 0.1', 'dataMax + 0.1']} />
        <Tooltip formatter={(value: number) => [`${value.toFixed(3)}V`, 'Voltage']} />
        <Bar dataKey="voltage">
          {voltageChartData.map((entry, index) => {
            const voltage = entry.voltage;
            const highVolt = warnings?.cellVoltage?.high ?? 4.2;
            const lowVolt = warnings?.cellVoltage?.low ?? 3.0;
            const fill = voltage > highVolt ? '#EF4444' : voltage < lowVolt ? '#F59E0B' : '#10B981';
            return <Cell key={`cell-${index}`} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </CardContent>
</Card>
  <Card>
            <CardHeader>
              <CardTitle>Cell Voltage Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2">Cell</th>
                      <th className="text-left py-2">Voltage</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voltageChartData.map((cell, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2">{cell.cell}</td>
                        <td className="py-2 font-mono">{cell.voltage.toFixed(3)}V</td>
                        <td className="py-2">
                          <Badge variant={cell.status === 'High' ? 'destructive' : cell.status === 'Low' ? 'secondary' : 'default'}>
                            {cell.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>
        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

           <Card>
            <CardHeader>
              <CardTitle>Temperature Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2">Sensor</th>
                      <th className="text-left py-2">Temperature</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {temperatureChartData.map((sensor, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2">{sensor.sensor}</td>
                        <td className="py-2 font-mono">{sensor.temperature.toFixed(1)}°C</td>
                        <td className="py-2">
                          <Badge variant={sensor.status === 'High' ? 'destructive' : sensor.status === 'Low' ? 'secondary' : 'default'}>
                            {sensor.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Temperature Sensors</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={temperatureChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sensor" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value.toFixed(1)}°C`, 'Temperature']} />
                  <Bar dataKey="temperature">
                    {temperatureChartData.map((entry, index) => {
                      const temp = entry.temperature;
                      const highTemp = warnings?.temperature?.high ?? 60;
                      const lowTemp = warnings?.temperature?.low ?? 0;
                      const fill = temp > highTemp ? '#EF4444' : temp < lowTemp ? '#3B82F6' : '#10B981';
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        
         
        </div>
        {/* Trend Analysis */}
        {trendData.length > 0 && selectedDevice?.connected && (
          <Card>
            <CardHeader>
              <CardTitle>Historical Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis yAxisId="voltage" orientation="left" />
                  <YAxis yAxisId="current" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="voltage" type="monotone" dataKey="packVoltage" stroke="#8B5CF6" name="Pack Voltage (V)" />
                  <Line yAxisId="voltage" type="monotone" dataKey="avgVoltage" stroke="#10B981" name="Avg Cell Voltage (V)" />
                  <Line yAxisId="current" type="monotone" dataKey="chargingCurrent" stroke="#06B6D4" name="Charging Current (A)" />
                  <Line yAxisId="current" type="monotone" dataKey="dischargingCurrent" stroke="#EF4444" name="Discharge Current (A)" />
                  <Area yAxisId="voltage" type="monotone" dataKey="maxTemp" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} name="Max Temperature (°C)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {/* System Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Voltage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Average</span>
                  <span className="font-mono">{systemAnalytics.avgVoltage.toFixed(3)}V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Minimum</span>
                  <span className="font-mono">{systemAnalytics.minVoltage.toFixed(3)}V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Maximum</span>
                  <span className="font-mono">{systemAnalytics.maxVoltage.toFixed(3)}V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Imbalance</span>
                  <span className={`font-mono ${systemAnalytics.voltageImbalance > 0.2 ? 'text-red-600' : 'text-green-600'}`}>
                    {systemAnalytics.voltageImbalance.toFixed(3)}V
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Temperature Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Average</span>
                  <span className="font-mono">{systemAnalytics.avgTemp.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Minimum</span>
                  <span className="font-mono">{systemAnalytics.minTemp.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Maximum</span>
                  <span className="font-mono">{systemAnalytics.maxTemp.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Variance</span>
                  <span className={`font-mono ${systemAnalytics.tempVariance > 15 ? 'text-red-600' : 'text-green-600'}`}>
                    {systemAnalytics.tempVariance.toFixed(1)}°C
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Power & Efficiency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Power</span>
                  <span className="font-mono">{systemAnalytics.power.toFixed(1)}W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Rolling Avg Voltage</span>
                  <span className="font-mono">{systemAnalytics.rollingAvgVoltage.toFixed(2)}V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Rolling Avg Current</span>
                  <span className="font-mono">{systemAnalytics.rollingAvgCurrent.toFixed(2)}A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Efficiency</span>
                  <span className="font-mono">{systemAnalytics.efficiency.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warning History Section */}
        {showWarningsModal && (
          <div id="warnings-section" className="mt-6">
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-orange-50 to-red-50">
                <CardTitle className="text-orange-800 flex items-center">
                  <Icon icon="mdi:alert-circle" className="mr-2 text-orange-600" />
                  Warning History for {selectedDeviceId}
                </CardTitle>
                <div className="flex items-center space-x-2">
               <button
  onClick={exportToExcel}
  className="flex items-center gap-2 border border-gray-600 text-gray-700 px-4 py-2 rounded-full hover:bg-green-50 hover:text-green-800 transition-colors duration-200"
  title="Export Data"
>
  <Icon icon="mdi:download" className="text-green-600 text-lg" />
  <span className="font-medium">Export Data</span>
</button>

                  <button
                    onClick={() => setShowWarningsModal(false)}
                    className="p-2 hover:bg-red-100 rounded-full transition-colors duration-200"
                    title="Close warning history"
                  >
                    <Icon icon="mdi:close" className="text-red-600 text-xl" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {warningHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="min-w-full bg-white border border-gray-300">
                        <thead className="sticky top-0 bg-gradient-to-r from-gray-100 to-gray-200">
                          <tr>
                            <th className="px-4 py-2 border font-semibold">Parameter</th>
                            <th className="px-4 py-2 border font-semibold">Type</th>
                            <th className="px-4 py-2 border font-semibold">Value</th>
                            <th className="px-4 py-2 border font-semibold">Threshold</th>
                            <th className="px-4 py-2 border font-semibold">Message</th>
                            <th className="px-4 py-2 border font-semibold">Timestamp</th>
                            <th className="px-4 py-2 border font-semibold">Resolved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warningHistory.map((warning, index) => {
                            const isRecent = new Date(warning.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
                            const getTypeColor = (type) => {
                              switch (type?.toLowerCase()) {
                                case 'high': return 'bg-red-100 text-red-800 border-red-200';
                                case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
                                case 'over': return 'bg-orange-100 text-orange-800 border-orange-200';
                                case 'under': return 'bg-purple-100 text-purple-800 border-purple-200';
                                default: return 'bg-gray-100 text-gray-800 border-gray-200';
                              }
                            };
                            return (
                              <tr
                                key={warning._id || index}
                                className={`hover:bg-gray-50 transition-colors duration-200 ${
                                  isRecent ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
                                }`}
                              >
                                <td className="px-4 py-2 border font-medium">{warning.parameter}</td>
                                <td className="px-4 py-2 border">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(warning.type)}`}>
                                    {warning.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 border text-red-600 font-mono">{warning.value}</td>
                                <td className="px-4 py-2 border text-blue-600 font-mono">{warning.threshold}</td>
                                <td className="px-4 py-2 border">{warning.message}</td>
                                <td className="px-4 py-2 border text-gray-600 text-sm">
                                  {isRecent && <span className="text-yellow-600 font-semibold mr-1">NEW</span>}
                                  {new Date(warning.timestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-2 border">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    warning.resolved
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {warning.resolved ? '✓ Resolved' : '✗ Active'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Icon icon="mdi:check-circle" className="text-green-500 text-4xl mx-auto mb-2" />
                    <p>No warnings found for this device.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </>
    )}
  </div>
)}
            {selectedDeviceId && !isLoadingDevice && (!params || Object.keys(params).length === 0) && (
              <div className="text-center py-12">
                <Icon icon="mdi:information-outline" size="48" className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Live Data Available</h3>
                <p className="text-gray-500">
                  {selectedDeviceId ? 
                    'Waiting for telemetry data from the selected device...' : 
                    'Please select a device to view live monitoring data.'
                  }
                </p>
              </div>
            )}
          </div>
        );
      }
      case "Reports": {
        const exportCSV = () => {
          const header = "Device ID,Battery ID,Voltage,Temperature,Current,Status";
          const data = liveData.map(device => [
            device.deviceId,
            device.batteryId || 'N/A',
            device.telemetry?.packVoltage?.toFixed(2) || '0.00',
            device.telemetry?.temperatures?.[0]?.toFixed(1) || '0.0',
            device.telemetry?.current?.toFixed(2) || '0.00',
           device.connected ? 'connected' : 'disconnected'
          ].join(",")).join("\n");
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
                      <th>Voltage (V)</th>
                      <th>Temperature (°C)</th>
                      <th>Current (A)</th>
                      <th>Status</th>
                      <th>Last Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveData.length > 0 ? liveData.map(device => (
                      <tr key={device.deviceId} className="border-b">
                        <td>{device.deviceId}</td>
                        <td>{device.batteryId || 'N/A'}</td>
                        <td>{device.telemetry?.packVoltage?.toFixed(2) || '0.00'}</td>
                        <td>{device.telemetry?.temperatures?.[0]?.toFixed(1) || '0.0'}</td>
                        <td>{device.telemetry?.current?.toFixed(2) || '0.00'}</td>
                        <td>
                          <Badge variant={device.connected ? 'default' : 'destructive'}>
                            {device.connected ? 'Online' : 'Offline'}
                          </Badge>
                        </td>
                        <td>{device.lastUpdate ? new Date(device.lastUpdate).toLocaleTimeString() : 'Never'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-gray-500">
                          No devices available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={liveData.map(device => ({
                    deviceId: device.deviceId,
                    voltage: device.telemetry?.packVoltage || 0,
                    temperature: device.telemetry?.temperatures?.[0] || 0,
                    current: device.telemetry?.current || 0
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="deviceId" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="voltage" fill="#22c55e" name="Voltage (V)" />
                    <Bar dataKey="temperature" fill="#ef4444" name="Temperature (°C)" />
                    <Bar dataKey="current" fill="#3b82f6" name="Current (A)" />
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
                    <tr className="border-b">
                      <td colSpan={3} className="text-center py-4 text-gray-500">
                        No notification settings configured. This feature will be implemented based on user requirements.
                      </td>
                    </tr>
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
        <main className="flex-1 p-6">{renderContent()}</main>
      </div>
      {showLogsPopup && (
        <div className="fixed inset-0 bg-black z-50 p-4">
          <div className="w-full h-full bg-black text-green-400 font-mono flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-green-400">
              <h3 className="text-lg font-bold">Terminal Logs</h3>
              <button
                onClick={() => setShowLogsPopup(false)}
                className="text-green-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <div ref={logsContainerRef} className="flex-1 overflow-y-auto p-4">
              {logs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showAlertsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Active Alerts ({alerts.length})</h2>
              <button onClick={() => setShowAlertsModal(false)} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
            </div>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 ${alert.severity === 'error' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-yellow-50 border-yellow-500 text-yellow-800'}`}>
                  <div className="font-semibold">{alert.type}</div>
                  <div className="text-sm">{alert.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
