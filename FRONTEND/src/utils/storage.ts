import type { StorageEnum } from "#/enum";

export const getItem = <T>(key: StorageEnum): T | null => {
	let value = null;
	try {
		const result = window.sessionStorage.getItem(key);
		if (result) {
			value = JSON.parse(result);
		}
	} catch (error) {
		console.error(error);
	}
	return value;
};

export const getStringItem = (key: StorageEnum): string | null => {
	return sessionStorage.getItem(key);
};

export const setItem = <T>(key: StorageEnum, value: T): void => {
	sessionStorage.setItem(key, JSON.stringify(value));
};
export const removeItem = (key: StorageEnum): void => {
	sessionStorage.removeItem(key);
};
export const clearItems = () => {
	sessionStorage.clear();
};
