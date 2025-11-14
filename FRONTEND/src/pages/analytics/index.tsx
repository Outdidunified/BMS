import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Icon } from "@/components/icon";
import { Chart } from "@/components/chart/chart";
import { useChart } from "@/components/chart/useChart";
import dayjs from "dayjs";

export default function AnalyticsPage() {
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("day");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Static mock devices
  const devices = [
    { deviceId: "DVC-001", batteryId: "BAT-001", macId: "AA:BB:CC:DD:EE:01", status: true },
    { deviceId: "DVC-002", batteryId: "BAT-002", macId: "AA:BB:CC:DD:EE:02", status: false },
    { deviceId: "DVC-003", batteryId: "BAT-003", macId: "AA:BB:CC:DD:EE:03", status: true },
  ];

  // Mock telemetry data
  const mockTelemetryData = [
    {
      timestamp: dayjs().subtract(4, 'hour').format("YYYY-MM-DDTHH:mm:ss"),
      telemetry: {
        packVoltage: 48.2,
        currents: { charging: 2.0, discharging: 0.0, load: 1.8 },
        voltages: [3.8, 3.9, 3.7],
        temperatures: [24, 25],
      },
    },
    {
      timestamp: dayjs().subtract(3, 'hour').format("YYYY-MM-DDTHH:mm:ss"),
      telemetry: {
        packVoltage: 48.5,
        currents: { charging: 2.1, discharging: 0.0, load: 1.9 },
        voltages: [3.8, 3.9, 3.7],
        temperatures: [25, 26],
      },
    },
    {
      timestamp: dayjs().subtract(2, 'hour').format("YYYY-MM-DDTHH:mm:ss"),
      telemetry: {
        packVoltage: 48.3,
        currents: { charging: 2.0, discharging: 0.0, load: 1.8 },
        voltages: [3.8, 3.9, 3.7],
        temperatures: [24, 25],
      },
    },
    {
      timestamp: dayjs().subtract(1, 'hour').format("YYYY-MM-DDTHH:mm:ss"),
      telemetry: {
        packVoltage: 48.4,
        currents: { charging: 2.2, discharging: 0.0, load: 2.0 },
        voltages: [3.9, 3.9, 3.8],
        temperatures: [26, 27],
      },
    },
  ];

  const telemetryData = selectedDevice ? mockTelemetryData : [];

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!telemetryData.length) return { timestamps: [], voltages: [], temperatures: [], packVoltages: [], currents: [] };

    const timestamps = telemetryData.map((t) => dayjs(t.timestamp).format("HH:mm"));
    const voltages = telemetryData.map((t) => t.telemetry?.voltages?.[0] || 0); // First cell voltage
    const temperatures = telemetryData.map((t) => t.telemetry?.temperatures?.[0] || 0); // First temperature
    const packVoltages = telemetryData.map((t) => t.telemetry?.packVoltage || 0);
    const currents = telemetryData.map((t) => t.telemetry?.currents?.charging || 0);

    return { timestamps, voltages, temperatures, packVoltages, currents };
  }, [telemetryData]);

  const voltageChartOptions = useChart({
    xaxis: { categories: chartData.timestamps },
    colors: ["#10b981"], // green
  });

  const tempChartOptions = useChart({
    xaxis: { categories: chartData.timestamps },
    colors: ["#ef4444"], // red
  });

  const currentChartOptions = useChart({
    xaxis: { categories: chartData.timestamps },
    colors: ["#3b82f6"], // blue
  });

  // Export to CSV (simple implementation)
  const exportToCSV = () => {
    if (!telemetryData.length) return;

    const csvContent = [
      "Timestamp,Pack Voltage,Charging Current,Discharging Current,Load Current,Voltages,Temperatures",
      ...telemetryData.map((t) =>
        `${t.timestamp},${t.telemetry?.packVoltage || ""},${t.telemetry?.currents?.charging || ""},${t.telemetry?.currents?.discharging || ""},${t.telemetry?.currents?.load || ""},"${t.telemetry?.voltages?.join(",") || ""}","${t.telemetry?.temperatures?.join(",") || ""}"`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${selectedDevice}_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-800">Analytics</h1>
        <p className="text-gray-500">View historical telemetry data with charts and export options</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Device</label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.deviceId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium mb-2">Time Range</label>
              <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Last 24 Hours</SelectItem>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium mb-2">From Date</label>
              <Input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="Custom from date"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium mb-2">To Date</label>
              <Input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="Custom to date"
              />
            </div>
            <Button onClick={exportToCSV} disabled={!telemetryData.length} className="bg-green-500 hover:bg-green-600">
              <Icon icon="lucide:download" className="mr-2" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      {selectedDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pack Voltage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                type="line"
                height={300}
                options={voltageChartOptions}
                series={[{ name: "Pack Voltage", data: chartData.packVoltages }]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Charging Current Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                type="line"
                height={300}
                options={currentChartOptions}
                series={[{ name: "Charging Current", data: chartData.currents }]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cell Voltage (First Cell)</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                type="line"
                height={300}
                options={voltageChartOptions}
                series={[{ name: "Cell Voltage", data: chartData.voltages }]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Temperature (First Sensor)</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                type="line"
                height={300}
                options={tempChartOptions}
                series={[{ name: "Temperature", data: chartData.temperatures }]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedDevice && (
        <div className="text-center py-12 text-gray-500">
          Select a device to view analytics
        </div>
      )}
    </div>
  );
}