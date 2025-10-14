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
  ListByStation = "/devices/by-station",
  ById = "/devices/", // + :di
  Update = "/devices/update/", // + :di
  Status = "/devices/", // + :di + "/status"
  Delete = "/devices/delete/", // + :di
}

type ListDevicesParams = {
  includeInactive?: boolean;
};

type ListDevicesByStationParams = {
  includeAssignments?: boolean;
};

const createDevice = (data: DeviceDto) => apiClient.post<DeviceDoc>({ url: DevicesApi.Create, data });
const listDevices = (includeInactive = false) => {
  const params: ListDevicesParams = {};
  if (includeInactive) {
    params.includeInactive = true;
  }
  return apiClient.get<DeviceDoc[]>({ url: DevicesApi.List, params });
};
const listDevicesByStation = (includeAssignments = false) => {
  const params: ListDevicesByStationParams = {};
  if (includeAssignments) {
    params.includeAssignments = true;
  }
  return apiClient.get<DeviceDoc[]>({ url: DevicesApi.ListByStation, params });
};
const getDevice = (di: string) => apiClient.get<DeviceDoc>({ url: `${DevicesApi.ById}${di}` });
const updateDevice = (di: string, data: Partial<DeviceDto>) =>
  apiClient.put<DeviceDoc>({ url: `${DevicesApi.Update}${di}`, data });
const updateDeviceStatus = (di: string, status: boolean) =>
  apiClient.put<DeviceDoc>({ url: `${DevicesApi.Status}${di}/status`, data: { status } });
const deleteDevice = (di: string) => apiClient.delete<{ deleted: boolean }>({ url: `${DevicesApi.Delete}${di}` });

export default {
  createDevice,
  listDevices,
  listDevicesByStation,
  getDevice,
  updateDevice,
  updateDeviceStatus,
  deleteDevice,
};