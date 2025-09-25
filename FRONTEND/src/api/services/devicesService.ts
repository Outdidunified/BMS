import apiClient from "../apiClient";

export interface DeviceDto {
  deviceId: string;
  batteryId: string;
  macId: string;
  apiKey?: string;
  alerts?: Record<string, any>;
  meta?: Record<string, any>;
  status?: boolean; // active or not
}

export interface DeviceDoc extends DeviceDto {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum DevicesApi {
  Create = "/devices/create",
  List = "/devices/fetch-all",
  ById = "/devices/", // + :di
  Update = "/devices/update/", // + :di
  Status = "/devices/", // + :di + "/status"
  Delete = "/devices/delete/", // + :di
}

const createDevice = (data: DeviceDto) => apiClient.post<DeviceDoc>({ url: DevicesApi.Create, data });
const listDevices = (includeInactive = false) =>
  apiClient.get<DeviceDoc[]>({ url: DevicesApi.List, params: { includeInactive } });
const getDevice = (di: string) => apiClient.get<DeviceDoc>({ url: `${DevicesApi.ById}${di}` });
const updateDevice = (di: string, data: Partial<DeviceDto>) =>
  apiClient.put<DeviceDoc>({ url: `${DevicesApi.Update}${di}`, data });
const updateDeviceStatus = (di: string, status: boolean) =>
  apiClient.put<DeviceDoc>({ url: `${DevicesApi.Status}${di}/status`, data: { status } });
const deleteDevice = (di: string) => apiClient.delete<{ deleted: boolean }>({ url: `${DevicesApi.Delete}${di}` });

export default {
  createDevice,
  listDevices,
  getDevice,
  updateDevice,
  updateDeviceStatus,
  deleteDevice,
};