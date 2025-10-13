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

export interface ChartData {
  deviceStatusPie: {
    labels: string[];
    data: number[];
  };
  batteryVoltageTrend: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  };
  temperatureTrend: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  };
  currentTrend: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  };
  warningsBar: {
    labels: string[];
    data: number[];
  };
}

export enum DashboardApi {
  Summary = "/dashboard/summary",
  Charts = "/dashboard/charts",
}

const summaryCache: { data: DashboardSummary | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

const chartsCache: { data: ChartData | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 60_000; // 1 minute client-side cache window for responsiveness

const getSummary = async () => {
  const now = Date.now();
  if (summaryCache.data && now - summaryCache.timestamp < CACHE_TTL_MS) {
    return summaryCache.data;
  }

  const data = await apiClient.get<DashboardSummary>({ url: DashboardApi.Summary });
  summaryCache.data = data;
  summaryCache.timestamp = now;
  return data;
};

const getCharts = async () => {
  const now = Date.now();
  if (chartsCache.data && now - chartsCache.timestamp < CACHE_TTL_MS) {
    return chartsCache.data;
  }

  const data = await apiClient.get<ChartData>({ url: DashboardApi.Charts });
  chartsCache.data = data;
  chartsCache.timestamp = now;
  return data;
};

export default {
  getSummary,
  getCharts,
};