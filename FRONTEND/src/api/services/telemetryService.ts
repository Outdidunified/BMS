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
}

const latest = (di: string) => apiClient.get<TelemetryLatest>({ url: TelemetryApi.Latest, params: { di } });
const range = (di: string, from?: string, to?: string) =>
  apiClient.get<TelemetryLatest[]>({ url: TelemetryApi.Range, params: { di, from, to } });

export default { latest, range };