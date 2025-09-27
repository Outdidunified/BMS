import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
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

const API_BASE = "http://192.168.1.17:8070";

export default function DeviceHistoryDetail() {
  const { deviceId } = useParams();
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTelemetry = async () => {
      if (!deviceId) return;

      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/telemetry/latest?di=${deviceId}`);
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

  // Prepare chart data
  const combinedChartData = data.telemetry.voltages.map((voltage, index) => ({
    index: index + 1,
    voltage,
    temperature: data.telemetry.temperatures[index] || null,
  }));

  const currentData = [
    { name: "Charging", value: data.telemetry.currents.charging },
    { name: "Discharging", value: data.telemetry.currents.discharging },
    { name: "Load", value: data.telemetry.currents.load },
  ];

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

      {/* Device Info and Electrical Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Device Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Device ID</span>
              <Icon icon="lucide:monitor" className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">{data.deviceFull.deviceId}</div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Battery ID</span>
              <Icon icon="lucide:battery" className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">{data.deviceFull.batteryId}</div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">MAC Address</span>
              <Icon icon="lucide:wifi" className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{data.deviceFull.macId}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Electrical Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {data.telemetry.packVoltage.toFixed(2)} V
                </div>
                <p className="text-sm text-gray-600">Pack Voltage</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Icon icon="lucide:zap" className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Charging</span>
                  </div>
                  <div className="text-xl font-bold text-green-600">
                    {data.telemetry.currents.charging.toFixed(2)} A
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Icon icon="lucide:minus-circle" className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium">Discharging</span>
                  </div>
                  <div className="text-xl font-bold text-red-600">
                    {data.telemetry.currents.discharging.toFixed(2)} A
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Icon icon="lucide:bolt" className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">Load</span>
                  </div>
                  <div className="text-xl font-bold text-blue-600">
                    {data.telemetry.currents.load.toFixed(2)} A
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

    </div>
  );
}