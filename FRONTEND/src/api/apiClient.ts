import axios, { type AxiosRequestConfig, type AxiosError, type AxiosResponse } from "axios";
import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import { toast } from "sonner";
import type { Result } from "#/api";
import { ResultStatus } from "#/enum";
import { API_BASE_URL } from "@/global-config";
import Swal from "sweetalert2";

// Centralized Axios instance for live backend
export const axiosInstance = axios.create({
	baseURL: API_BASE_URL,
	timeout: 50000,
	headers: { "Content-Type": "application/json;charset=utf-8" },
});

axiosInstance.interceptors.request.use(
	(config) => {
		// Attach auth token from sessionStorage (check both 'authToken' and 'token' keys)
		const token = sessionStorage.getItem("authToken") || sessionStorage.getItem("token") || userStore.getState().token;
		console.log("🔑 Token being sent:", token ? `${token.substring(0, 20)}...` : "NO TOKEN FOUND");
		console.log("📦 SessionStorage authToken:", sessionStorage.getItem("authToken"));
		console.log("📦 SessionStorage token:", sessionStorage.getItem("token"));
		console.log("📦 UserStore token:", userStore.getState().token);
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
		
		// Check for token expiry messages
		const isTokenExpired = 
			errMsg.toLowerCase().includes("token expired") ||
			errMsg.toLowerCase().includes("access token expired") ||
			errMsg.toLowerCase().includes("access token required") ||
			errMsg.toLowerCase().includes("token is missing") ||
			response?.status === 401;

		if (isTokenExpired) {
			// Clear user data immediately
			userStore.getState().actions.clearUserInfoAndToken();
			sessionStorage.clear();
			localStorage.clear();
			
			// Show SweetAlert2 for token expiry
			Swal.fire({
				title: "Session Expired",
				text: errMsg || "Your session has expired. Please login again.",
				icon: "warning",
				confirmButtonText: "OK",
				confirmButtonColor: "#3b82f6",
				allowOutsideClick: false,
			}).then(() => {
				// Redirect to login page directly
				window.location.replace("/login");
			});
		} else {
			// Show regular toast for other errors
			toast.error(errMsg, { position: "top-center" });
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
	patch<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "PATCH" });
	}
	delete<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "DELETE" });
	}
	request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return axiosInstance.request<any, T>(config);
	}
}

export default new APIClient();
