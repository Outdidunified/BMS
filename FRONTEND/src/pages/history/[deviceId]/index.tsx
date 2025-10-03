import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import { Title, Text } from "@/ui/typography";
import { Skeleton } from "@/ui/skeleton";
import { useParams } from "@/routes/hooks/use-params";
import MotionContainer from "@/components/animate/motion-container";
import { varBounce } from "@/components/animate/variants/bounce";
import { m } from "motion/react";
import Character from "@/assets/images/characters/character_4.png";
import { themeVars } from "@/theme/theme.css";
import telemetryService, {
  BatteryCycleMetric,
  BatteryStateReportCycle,
  BatteryStateReportResponse,
} from "@/api/services/telemetryService";
import * as XLSX from "xlsx";
import type { BatteryStateReportParams } from "@/api/services/telemetryService";
import { API_BASE_URL } from "@/global-config";

interface TelemetryData {
  timestamp: string;
  deviceFull: {
    deviceId: string;
    batteryId: string;
    macId: string;
  };
  telemetry: {
    voltages: number[];
    packVoltage: number;
    currents: {
      charging: number;
      discharging: number;
      load: number;
    };
    temperatures: number[];
  };
  _id: string;
}

function formatDate(value: string | Date | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return [
    hours ? `${hours} hr` : null,
    minutes ? `${minutes} min` : null,
    remainingSeconds ? `${remainingSeconds} sec` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatMetric(metric: BatteryCycleMetric | null) {
  if (!metric) return "-";
  return `${metric.min.toFixed(2)} / ${metric.max.toFixed(2)} / ${metric.avg.toFixed(2)}`;
}

function formatMetricValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toFixed(2);
}

export default function DeviceHistoryDetail() {
  const { deviceId } = useParams();
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<BatteryStateReportResponse | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [exportMode, setExportMode] = useState<'all' | 'daterange' | 'charging' | 'discharging'>('all');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [isExporting, setIsExporting] = useState(false);

  const loadBatteryReport = useCallback(async () => {
    if (!deviceId) return;
    try {
      setReportLoading(true);
      setReportError(null);
      const response = await telemetryService.batteryStateReport({
        di: deviceId,
        page,
        pageSize,
        from: exportMode === 'daterange' ? dateRange.from : undefined,
        to: exportMode === 'daterange' ? dateRange.to : undefined,
        state:
          exportMode === 'charging' ? 'charging' : exportMode === 'discharging' ? 'discharging' : undefined,
      });
      setReport(response);
    } catch (err) {
      console.error("Error fetching battery state report:", err);
      setReportError("Unable to load battery state report");
    } finally {
      setReportLoading(false);
    }
  }, [deviceId, exportMode, dateRange.from, dateRange.to, page, pageSize]);

  useEffect(() => {
    const fetchTelemetry = async () => {
      if (!deviceId) return;

      try {
        setLoading(true);
        const token = sessionStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/telemetry/latest?di=${deviceId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const result = await res.json();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.message || "Failed to fetch telemetry data");
        }
      } catch (err) {
        console.error("Error fetching telemetry:", err);
        setError("Network error");
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetry();
  }, [deviceId]);

  useEffect(() => {
    loadBatteryReport();
  }, [loadBatteryReport]);

  const combinedChartData = useMemo(() => {
    if (!data) return [];
    return data.telemetry.voltages.map((voltage, index) => ({
      index: index + 1,
      voltage,
      temperature: data.telemetry.temperatures[index] || null,
    }));
  }, [data]);

  const handleExportToExcel = useCallback(async () => {
    if (!deviceId || isExporting) return;

    try {
      setIsExporting(true);

      const exportParams: BatteryStateReportParams = {
        di: deviceId,
        from: exportMode === "daterange" ? dateRange.from : undefined,
        to: exportMode === "daterange" ? dateRange.to : undefined,
        state:
          exportMode === "charging" ? "charging" : exportMode === "discharging" ? "discharging" : undefined,
      };

      const exportResponse = await telemetryService.batteryStateExport(exportParams);
      if (!exportResponse.sessions.length) {
        setIsExporting(false);
        return;
      }

      const rows = exportResponse.sessions.map((session) => ({
        "Bank Name": session.bankName,
        State: session.state,
        "Amp Hours": Number(session.ampHours.toFixed(3)),
        "Amp Hour %": Number(session.ampHourPercent.toFixed(2)),
        "Start": formatDate(session.startTimestamp),
        "End": formatDate(session.endTimestamp),
        "Duration": formatDuration(session.durationSeconds),
        "Ambient Temp Min (°C)": session.ambientTemperature ? Number(session.ambientTemperature.min.toFixed(2)) : null,
        "Ambient Temp Max (°C)": session.ambientTemperature ? Number(session.ambientTemperature.max.toFixed(2)) : null,
        "Ambient Temp Avg (°C)": session.ambientTemperature ? Number(session.ambientTemperature.avg.toFixed(2)) : null,
        "Current Min (A)": session.current ? Number(session.current.min.toFixed(2)) : null,
        "Current Max (A)": session.current ? Number(session.current.max.toFixed(2)) : null,
        "Current Avg (A)": session.current ? Number(session.current.avg.toFixed(2)) : null,
        "Power Avg (W)":
          session.powerAvg !== null && session.powerAvg !== undefined ? Number(session.powerAvg.toFixed(3)) : null,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cycles");

      const rangeLabel =
        exportMode === "daterange"
          ? `${dateRange.from || "start"}_${dateRange.to || "end"}`
          : exportMode === "charging"
          ? "charging-only"
          : exportMode === "discharging"
          ? "discharging-only"
          : "all-data";

      const fileName = `${deviceId || "device"}-battery-cycles-${rangeLabel}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } finally {
      setIsExporting(false);
    }
  }, [deviceId, exportMode, dateRange.from, dateRange.to, isExporting]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    const svg = (
      <svg viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg" width={400} height={280} className="w-full">
        <title>No Telemetry Data</title>
        <defs>
          <linearGradient id="BG" x1="19.496%" x2="77.479%" y1="71.822%" y2="16.69%">
            <stop offset="0%" stopColor={themeVars.colors.palette.error.default} />
            <stop offset="100%" stopColor={themeVars.colors.palette.error.default} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          fill="url(#BG)"
          fillRule="nonzero"
          d="M0 198.78c0 41.458 14.945 79.236 39.539 107.786 28.214 32.765 69.128 53.365 114.734 53.434a148.44 148.44 0 0056.495-11.036c9.051-3.699 19.182-3.274 27.948 1.107a75.779 75.779 0 0033.957 8.01c5.023 0 9.942-.494 14.7-1.433 13.58-2.67 25.94-8.99 36.09-17.94 6.378-5.627 14.547-8.456 22.897-8.446h.142c27.589 0 53.215-8.732 74.492-23.696 19.021-13.36 34.554-31.696 44.904-53.224C474.92 234.58 480 213.388 480 190.958c0-76.93-59.774-139.305-133.498-139.305-7.516 0-14.88.663-22.063 1.899C305.418 21.42 271.355 0 232.499 0a103.651 103.651 0 00-45.88 10.661c-13.24 6.487-25.011 15.705-34.64 26.939-32.698.544-62.931 11.69-87.676 30.291C25.351 97.155 0 144.882 0 198.781z"
          opacity="0.2"
        />
        <image href={Character} height="300" x="170" y="20" />
        <path
          fill={themeVars.colors.palette.error.default}
          d="M200 180h60v30h-60zM180 220h100v30h-100zM220 260h60v30h-60z"
          opacity="0.8"
        />
      </svg>
    );

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <MotionContainer className="flex flex-col items-center justify-center px-2 w-full max-w-md gap-2">
          <m.div variants={varBounce().in}>
            {svg}
          </m.div>
          <m.div variants={varBounce().in}>
            <Title as="h1" className="text-center text-red-700 text-4xl whitespace-nowrap">
              No Telemetry Data
            </Title>
          </m.div>
          <m.div variants={varBounce().in}>
            <Text variant="body1" color="secondary" align="center" className="text-red-600 text-lg">
              {error || "No data available"}
            </Text>
          </m.div>
        </MotionContainer>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title as="h1" className="text-2xl font-bold">
            Device History: {data.deviceFull.deviceId}
          </Title>
          <p className="text-gray-600 mt-5">
            Latest telemetry data as of {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Icon icon="lucide:clock" className="w-4 h-4 mr-1" />
          {new Date(data.timestamp).toLocaleTimeString()}
        </Badge>
      </div>

      {/* Device Overview Cards */}
<Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Device Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Device Information Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Device Information</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Device ID</span>
                  <div className="text-lg font-bold text-gray-900">{data.deviceFull.deviceId}</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Battery ID</span>
                  <div className="text-lg font-bold text-gray-900">{data.deviceFull.batteryId}</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">MAC Address</span>
                  <div className="text-lg font-bold text-gray-900">{data.deviceFull.macId}</div>
                </div>
              </div>
            </div>

            {/* Electrical Overview Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Electrical Overview</h3>
              <div className="space-y-6">
                {/* Pack Voltage */}
                <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {data.telemetry.packVoltage.toFixed(2)} V
                  </div>
                  <p className="text-sm text-gray-700 font-medium">Pack Voltage</p>
                </div>

                {/* Currents */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Charging</span>
                    <div className="text-xl font-bold text-gray-900">
                      {data.telemetry.currents.charging.toFixed(2)} A
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Discharging</span>
                    <div className="text-xl font-bold text-gray-900">
                      {data.telemetry.currents.discharging.toFixed(2)} A
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Load</span>
                    <div className="text-xl font-bold text-gray-900">
                      {data.telemetry.currents.load.toFixed(2)} A
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Combined Voltage and Temperature Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cell Voltages & Temperature Sensors</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={combinedChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="voltage" stroke="#3b82f6" strokeWidth={2} name="Voltage (V)" />
              <Line type="monotone" dataKey="temperature" stroke="#ef4444" strokeWidth={2} name="Temperature (°C)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Battery State Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Battery Charge & Discharge Cycles</CardTitle>
          <Text variant="body2" color="secondary">
            Bank, energy, duration, ambient temperature, and current metrics derived from persisted cycles.
          </Text>
          {report && report.sessions.length ? (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={exportMode === "all" ? "default" : "outline"}
                    onClick={() => {
                      setExportMode("all");
                      setDateRange({});
                      setPage(1);
                    }}
                  >
                    All Data
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={exportMode === "charging" ? "default" : "outline"}
                    onClick={() => {
                      setExportMode("charging");
                      setDateRange({});
                      setPage(1);
                    }}
                  >
                    Charging Only
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={exportMode === "discharging" ? "default" : "outline"}
                    onClick={() => {
                      setExportMode("discharging");
                      setDateRange({});
                      setPage(1);
                    }}
                  >
                    Discharging Only
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={exportMode === "daterange" ? "default" : "outline"}
                    onClick={() => {
                      setExportMode("daterange");
                      setPage(1);
                    }}
                  >
                    Custom Date Range
                  </Button>
                  {exportMode !== "all" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setExportMode("all");
                        setDateRange({});
                        setPage(1);
                      }}
                    >
                      Clear Filter
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleExportToExcel}>
                    <Icon icon="lucide:download" className="w-4 h-4 mr-2" />
                    Export to Excel
                  </Button>
                </div>
              </div>
              {exportMode === "daterange" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">From</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={dateRange.from || ""}
                      onChange={(event) => {
                        setDateRange((prev) => ({ ...prev, from: event.target.value || undefined }));
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">To</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={dateRange.to || ""}
                      onChange={(event) => {
                        setDateRange((prev) => ({ ...prev, to: event.target.value || undefined }));
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {reportLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : reportError ? (
            <div className="text-red-600 text-sm">{reportError}</div>
          ) : report && report.sessions.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                  <tr>
                    <th rowSpan={2} className="px-6 py-3 text-center align-bottom">
                      Bank Name
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-center align-bottom">
                      State
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-center align-bottom">
                      AH
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-center align-bottom">
                      AH %
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-center align-bottom">
                      Start
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-center align-bottom">
                      End
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-center align-bottom">
                      Duration
                    </th>
                    <th colSpan={3} className="px-4 py-2 text-center">
                      Ambient Temp (°C)
                    </th>
                    <th colSpan={3} className="px-4 py-2 text-center">
                      Current (A)
                    </th>
                    <th rowSpan={2} className="px-4 py-3 text-center align-bottom">
                      Power Avg (W)
                    </th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 text-center">Min</th>
                    <th className="px-3 py-2 text-center">Max</th>
                    <th className="px-3 py-2 text-center">Avg</th>
                    <th className="px-3 py-2 text-center">Min</th>
                    <th className="px-3 py-2 text-center">Max</th>
                    <th className="px-3 py-2 text-center">Avg</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-800">
                  {report.sessions.map((session: BatteryStateReportCycle, index: number) => (
                    <tr key={`${session.startTimestamp}-${index}`} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{session.bankName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                            session.state === "charging"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {session.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{session.ampHours.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right">{session.ampHourPercent.toFixed(2)}%</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(session.startTimestamp)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(session.endTimestamp)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(session.durationSeconds)}</td>
                      <td className="px-3 py-3 text-right">{formatMetricValue(session.ambientTemperature.min)}</td>
                      <td className="px-3 py-3 text-right">{formatMetricValue(session.ambientTemperature.max)}</td>
                      <td className="px-3 py-3 text-right">{formatMetricValue(session.ambientTemperature.avg)}</td>
                      <td className="px-3 py-3 text-right">{formatMetricValue(session.current.min)}</td>
                      <td className="px-3 py-3 text-right">{formatMetricValue(session.current.max)}</td>
                      <td className="px-3 py-3 text-right">{formatMetricValue(session.current.avg)}</td>
                      <td className="px-4 py-3 text-right">
                        {session.powerAvg !== null && session.powerAvg !== undefined
                          ? session.powerAvg.toFixed(3)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between mt-4 text-sm">
                <Text variant="body2" color="secondary">
                  Page {report.pagination.page} of {report.pagination.pageCount} · Total cycles: {report.pagination.total}
                </Text>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    onClick={() =>
                      setPage((prev) =>
                        report.pagination.pageCount ? Math.min(report.pagination.pageCount, prev + 1) : prev + 1,
                      )
                    }
                    disabled={report.pagination.pageCount !== 0 && page >= report.pagination.pageCount}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No charge or discharge cycles available yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}