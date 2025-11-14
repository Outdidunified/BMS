import apiClient from "../apiClient";

export interface DashboardSummary {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalStations: number;
  activeStations: number;
  inactiveStations: number;
  totalUsers: number;
  activeUsers: number;
  totalWarnings: number;
  batteryHealth: {
    avgPackVoltage: number;
    avgTemperature: number;
    avgChargingCurrent: number;
  };
  usersByRole: Record<string, number>;
  warningsByType: Record<string, number>;
}

export interface DeviceStatusChart {
  labels: string[];
  data: number[];
}

export interface TrendChart {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
}

export interface WarningsSummaryChart {
  labels: string[];
  data: number[];
}

export interface ChartData {
  deviceStatus: DeviceStatusChart;
  batteryVoltageTrend: TrendChart;
  temperatureTrend: TrendChart;
  currentTrend: TrendChart;
  warningsSummary: WarningsSummaryChart;
}

export enum DashboardApi {
  Summary = "/dashboard/summary",
  Charts = "/dashboard/charts",
  DeviceStatus = "/dashboard/device-status",
  BatteryVoltage = "/dashboard/battery-voltage",
  TemperatureTrend = "/dashboard/temperature-trend",
  CurrentTrend = "/dashboard/current-trend",
  WarningsSummary = "/dashboard/warnings-summary",
}

const summaryCache: { data: DashboardSummary | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

const chartCaches: Record<keyof typeof DashboardApi, { data: unknown; timestamp: number }> = {
  Summary: summaryCache,
  Charts: { data: null, timestamp: 0 },
  DeviceStatus: { data: null, timestamp: 0 },
  BatteryVoltage: { data: null, timestamp: 0 },
  TemperatureTrend: { data: null, timestamp: 0 },
  CurrentTrend: { data: null, timestamp: 0 },
  WarningsSummary: { data: null, timestamp: 0 },
};

const CACHE_TTL_MS = 60_000; // 1 minute client-side cache window for responsiveness

const getSummary = async () => {
  const now = Date.now();
  const cacheEntry = chartCaches.Summary as { data: DashboardSummary | null; timestamp: number };
  if (cacheEntry.data && now - cacheEntry.timestamp < CACHE_TTL_MS) {
    return cacheEntry.data;
  }

  const data = await apiClient.get<DashboardSummary>({ url: DashboardApi.Summary });
  cacheEntry.data = data;
  cacheEntry.timestamp = now;
  return data;
};

const getCharts = async () => {
  const now = Date.now();
  const cacheEntry = chartCaches.Charts as { data: ChartData | null; timestamp: number };
  if (cacheEntry.data && now - cacheEntry.timestamp < CACHE_TTL_MS) {
    return cacheEntry.data;
  }

  const data = await apiClient.get<ChartData>({ url: DashboardApi.Charts });
  cacheEntry.data = data;
  cacheEntry.timestamp = now;
  return data;
};

const getDeviceStatus = async () => {
  const now = Date.now();
  const cacheEntry = chartCaches.DeviceStatus as { data: DeviceStatusChart | null; timestamp: number };
  if (cacheEntry.data && now - cacheEntry.timestamp < CACHE_TTL_MS) {
    return cacheEntry.data;
  }

  const data = await apiClient.get<DeviceStatusChart>({ url: DashboardApi.DeviceStatus });
  cacheEntry.data = data;
  cacheEntry.timestamp = now;
  return data;
};

const getBatteryVoltageTrend = async () => {
  const now = Date.now();
  const cacheEntry = chartCaches.BatteryVoltage as { data: TrendChart | null; timestamp: number };
  if (cacheEntry.data && now - cacheEntry.timestamp < CACHE_TTL_MS) {
    return cacheEntry.data;
  }

  const data = await apiClient.get<TrendChart>({ url: DashboardApi.BatteryVoltage });
  cacheEntry.data = data;
  cacheEntry.timestamp = now;
  return data;
};

const getTemperatureTrend = async () => {
  const now = Date.now();
  const cacheEntry = chartCaches.TemperatureTrend as { data: TrendChart | null; timestamp: number };
  if (cacheEntry.data && now - cacheEntry.timestamp < CACHE_TTL_MS) {
    return cacheEntry.data;
  }

  const data = await apiClient.get<TrendChart>({ url: DashboardApi.TemperatureTrend });
  cacheEntry.data = data;
  cacheEntry.timestamp = now;
  return data;
};

const getCurrentTrend = async () => {
  const now = Date.now();
  const cacheEntry = chartCaches.CurrentTrend as { data: TrendChart | null; timestamp: number };
  if (cacheEntry.data && now - cacheEntry.timestamp < CACHE_TTL_MS) {
    return cacheEntry.data;
  }

  const data = await apiClient.get<TrendChart>({ url: DashboardApi.CurrentTrend });
  cacheEntry.data = data;
  cacheEntry.timestamp = now;
  return data;
};

const getWarningsSummary = async () => {
  const now = Date.now();
  const cacheEntry = chartCaches.WarningsSummary as { data: WarningsSummaryChart | null; timestamp: number };
  if (cacheEntry.data && now - cacheEntry.timestamp < CACHE_TTL_MS) {
    return cacheEntry.data;
  }

  const data = await apiClient.get<WarningsSummaryChart>({ url: DashboardApi.WarningsSummary });
  cacheEntry.data = data;
  cacheEntry.timestamp = now;
  return data;
};

export default {
  getSummary,
  getCharts,
  getDeviceStatus,
  getBatteryVoltageTrend,
  getTemperatureTrend,
  getCurrentTrend,
  getWarningsSummary,
};