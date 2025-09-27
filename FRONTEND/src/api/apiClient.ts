import axios, { type AxiosRequestConfig, type AxiosError, type AxiosResponse } from "axios";
import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import { toast } from "sonner";
import type { Result } from "#/api";
import { ResultStatus } from "#/enum";

// Centralized Axios instance for live backend
export const axiosInstance = axios.create({
	baseURL: "http://localhost:8070",
	timeout: 50000,
	headers: { "Content-Type": "application/json;charset=utf-8" },
});

axiosInstance.interceptors.request.use(
	(config) => {
		// Attach auth token if you have one
		const token = userStore.getState().token;
		if (token) config.headers.Authorization = `Bearer ${token}`;
		return config;
	},
	(error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
	(res: AxiosResponse<Result<any>>) => {
		// If backend already returns raw data, just return res.data
		// Otherwise, support Result wrapper
		const payload: any = res.data;
		if (payload && typeof payload === "object" && "status" in payload && "data" in payload) {
			const { status, data, message } = payload as Result<any>;
			if (status === ResultStatus.SUCCESS) return data as any;
			throw new Error(message || t("sys.api.apiRequestFailed"));
		}
		// Handle API responses with "success" field
		if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
			const { success, data, message } = payload;
			if (success === true) return data as any;
			throw new Error(message || t("sys.api.apiRequestFailed"));
		}
		return payload as any;
	},
	(error: AxiosError<Result>) => {
		const { response, message } = error || {};
		const errMsg = (response?.data as any)?.message || message || t("sys.api.errorMessage");
		toast.error(errMsg, { position: "top-center" });
		if (response?.status === 401) {
			userStore.getState().actions.clearUserInfoAndToken();
		}
		return Promise.reject(error);
	},
);

class APIClient {
	get<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "GET" });
	}
	post<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "POST" });
	}
	put<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "PUT" });
	}
	delete<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "DELETE" });
	}
	request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return axiosInstance.request<any, T>(config);
	}
}

export default new APIClient();
