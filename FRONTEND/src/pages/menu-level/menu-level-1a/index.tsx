import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Chart } from "@/components/chart";
import { useChart } from "@/components/chart/useChart";
import { Icon } from "@/components/icon";
import { Title } from "@/ui/typography";

// Static mock live data for multiple devices
const mockLiveData = [
  {
    deviceId: "DVC-001",
    batteryId: "BAT-001",
    status: "online",
    telemetry: {
      packVoltage: 48.2,
      current: 2.0,
      temperatures: [24, 25],
      voltages: [3.8, 3.9, 3.7],
    },
    chartData: [
      { time: "10:00", voltage: 48.0, current: 1.8, temp: 24 },
      { time: "10:15", voltage: 48.1, current: 1.9, temp: 24 },
      { time: "10:30", voltage: 48.2, current: 2.0, temp: 25 },
      { time: "10:45", voltage: 48.2, current: 2.0, temp: 25 },
    ],
  },
  {
    deviceId: "DVC-002",
    batteryId: "BAT-002",
    status: "offline",
    telemetry: {
      packVoltage: 0.0,
      current: 0.0,
      temperatures: [20, 20],
      voltages: [0.0, 0.0, 0.0],
    },
    chartData: [],
  },
  {
    deviceId: "DVC-003",
    batteryId: "BAT-003",
    status: "online",
    telemetry: {
      packVoltage: 47.8,
      current: 1.5,
      temperatures: [26, 27],
      voltages: [3.7, 3.8, 3.9],
    },
    chartData: [
      { time: "10:00", voltage: 47.5, current: 1.2, temp: 25 },
      { time: "10:15", voltage: 47.6, current: 1.3, temp: 26 },
      { time: "10:30", voltage: 47.8, current: 1.5, temp: 26 },
      { time: "10:45", voltage: 47.8, current: 1.5, temp: 27 },
    ],
  },
  {
    deviceId: "DVC-004",
    batteryId: "BAT-004",
    status: "online",
    telemetry: {
      packVoltage: 49.0,
      current: 2.5,
      temperatures: [23, 24],
      voltages: [3.9, 4.0, 3.8],
    },
    chartData: [
      { time: "10:00", voltage: 48.8, current: 2.2, temp: 22 },
      { time: "10:15", voltage: 48.9, current: 2.3, temp: 23 },
      { time: "10:30", voltage: 49.0, current: 2.5, temp: 23 },
      { time: "10:45", voltage: 49.0, current: 2.5, temp: 24 },
    ],
  },
];

export default function MenuLevel() {
  const chartOptions = useChart({
    xaxis: { categories: [] }, // Will be set per device
    colors: ["#22c55e", "#3b82f6", "#ef4444"], // Green, Blue, Red
  });

  const transformChartData = (chartData: any[]) => {
    if (!chartData || chartData.length === 0) return { categories: [], series: [] };

    const categories = chartData.map(item => item.time);
    const series = [
      {
        name: "Voltage",
        data: chartData.map(item => item.voltage),
      },
      {
        name: "Current",
        data: chartData.map(item => item.current),
      },
      {
        name: "Temperature",
        data: chartData.map(item => item.temp),
      },
    ];

    return { categories, series };
  };

  return (
    <div className="p-6 space-y-6">
      <Title as="h1">Live Grid</Title>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
        {mockLiveData.map((device) => {
          const { categories, series } = transformChartData(device.chartData);
          const deviceChartOptions = {
            ...chartOptions,
            xaxis: { ...chartOptions.xaxis, categories },
          };

          return (
            <Card key={device.deviceId} className="shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span>{device.deviceId} ({device.batteryId})</span>
                  <Badge variant={device.status === "online" ? "default" : "secondary"}>
                    {device.status === "online" ? (
                      <Icon icon="mdi:wifi" size="16" className="mr-1" />
                    ) : (
                      <Icon icon="mdi:wifi-off" size="16" className="mr-1" />
                    )}
                    {device.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {device.status === "online" ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pack Voltage</p>
                        <p className="text-2xl font-bold text-green-600">{device.telemetry.packVoltage}V</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Current</p>
                        <p className="text-2xl font-bold text-blue-600">{device.telemetry.current}A</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Temperature</p>
                        <p className="text-2xl font-bold text-red-600">{Math.max(...device.telemetry.temperatures)}°C</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Voltage</p>
                        <p className="text-2xl font-bold text-green-600">
                          {(device.telemetry.voltages.reduce((a, b) => a + b, 0) / device.telemetry.voltages.length).toFixed(1)}V
                        </p>
                      </div>
                    </div>
                    <div className="h-32">
                      <Chart
                        type="line"
                        height={128}
                        options={deviceChartOptions}
                        series={series}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Icon icon="mdi:wifi-off" size="48" className="mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Device Offline</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}