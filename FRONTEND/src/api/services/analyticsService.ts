import apiClient from "../apiClient";

export interface AnalyticsSummary {
  count: number;
  avg: Record<string, number>;
  min: Record<string, number>;
  max: Record<string, number>;
}

export enum AnalyticsApi {
  Summary = "/analytics/summary",
}

const getSummary = (di: string, from?: string, to?: string) =>
  apiClient.get<AnalyticsSummary>({ url: AnalyticsApi.Summary, params: { di, from, to } });

export default {
  getSummary,
};