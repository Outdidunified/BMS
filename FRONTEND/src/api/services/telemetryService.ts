import apiClient from "../apiClient";

export interface TelemetryLatest {
  device?: { DI?: string };
  deviceFull?: { deviceId?: string };
  telemetry?: {
    voltages?: number[];
    temperatures?: number[];
    packVoltage?: number;
    currents?: { charging?: number; discharging?: number; load?: number };
  };
  params?: Record<string, number>;
  timestamp?: string;
}

export enum TelemetryApi {
  Latest = "/telemetry/latest",
  Range = "/telemetry/range",
  BatteryStateReport = "/telemetry/battery-state-report",
  BatteryStateExport = "/telemetry/battery-state-export",
}

export interface BatteryStateReportParams {
  di: string;
  from?: string;
  to?: string;
  state?: "charging" | "discharging";
  page?: number;
  pageSize?: number;
}

const latest = (di: string) => apiClient.get<TelemetryLatest>({ url: TelemetryApi.Latest, params: { di } });

const range = (di: string, from?: string, to?: string) =>
  apiClient.get<TelemetryLatest[]>({ url: TelemetryApi.Range, params: { di, from, to } });

const batteryStateReport = (params: BatteryStateReportParams) =>
  apiClient.get<BatteryStateReportResponse>({ url: TelemetryApi.BatteryStateReport, params });

const batteryStateExport = (params: BatteryStateReportParams) =>
  apiClient.get<BatteryStateReportResponse>({ url: TelemetryApi.BatteryStateExport, params });

export interface BatteryCycleMetric {
  min: number;
  max: number;
  avg: number;
}

export interface BatteryStateReportCycle {
  deviceId: string;
  batteryId: string | null;
  macId: string | null;
  bankName: string;
  state: "charging" | "discharging";
  startTimestamp: string;
  endTimestamp: string;
  durationSeconds: number;
  ampHours: number;
  ampHourPercent: number;
  ratedCapacityAh: number;
  ambientTemperature: BatteryCycleMetric | null;
  current: BatteryCycleMetric | null;
  powerAvg: number | null;
  sessionCount: number | null;
}

export interface BatteryStateReportSummary {
  totalSessions: number;
  totalAmpHours: number;
  totalChargeAmpHours: number;
  totalDischargeAmpHours: number;
}

export interface BatteryStateReportPagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface BatteryStateReportResponse {
  deviceId: string;
  ratedCapacityAh: number;
  summary: BatteryStateReportSummary;
  sessions: BatteryStateReportCycle[];
  pagination: BatteryStateReportPagination;
}

export default { latest, range, batteryStateReport, batteryStateExport };