import apiClient from "../apiClient";

export interface NotificationMapping {
  di: string; // device id
  emails: string[];
  threshold?: Record<string, number>;
  enabled?: boolean;
}

export enum NotificationsApi {
  Upsert = "/notifications/mapping/upsert",
  List = "/notifications/mapping/fetch-all",
  ById = "/notifications/mapping/", // + :di
  Update = "/notifications/mapping/update/", // + :di
  Delete = "/notifications/mapping/delete/", // + :di
}

const upsertMapping = (data: NotificationMapping) =>
  apiClient.post<NotificationMapping>({ url: NotificationsApi.Upsert, data });
const listMappings = () => apiClient.get<NotificationMapping[]>({ url: NotificationsApi.List });
const getMapping = (di: string) => apiClient.get<NotificationMapping>({ url: `${NotificationsApi.ById}${di}` });
const updateMapping = (di: string, data: Partial<NotificationMapping>) =>
  apiClient.put<NotificationMapping>({ url: `${NotificationsApi.Update}${di}`, data });
const deleteMapping = (di: string) => apiClient.delete<{ deleted: boolean }>({ url: `${NotificationsApi.Delete}${di}` });

export default {
  upsertMapping,
  listMappings,
  getMapping,
  updateMapping,
  deleteMapping,
};