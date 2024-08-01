import { PermissionMetadataKey } from './decorators';
import { Store, type Permission, type StoreValue } from './store';

function isKeyPermissionAllowedByStore(store: Store, key: string, permission: Permission): boolean {
	const policy: Permission = Reflect.getMetadata(PermissionMetadataKey, store, key) || store.defaultPolicy;

	return policy.includes(permission);
}

export function isNestedPermissionAllowed(store: Store, path: string, permission: Permission): boolean {
	let target: any = store;
	let deepestStore: Store = store;

	const keys = path.split(':');
	let currentPath = '';

	for (const key of keys) {
		currentPath = currentPath ? `${currentPath}:${key}` : key;

		target = consume(target?.[key]);
		if (target instanceof Store) {
			deepestStore = target;
			currentPath = key;
		}

		if (!isKeyPermissionAllowedByStore(deepestStore, currentPath, permission)) return false;
	}

	return true;
}

export function turnObjectIntoStore(obj: StoreValue): StoreValue {
	if (!obj) return obj;
	if (obj instanceof Store || typeof obj === 'function') return obj;
	if (Array.isArray(obj) || typeof obj !== 'object') return obj;

	const store: any = new Store();
	const keys = Object.keys(obj);

	for (const key of keys) {
		if (Array.isArray(obj[key]) || typeof obj[key] !== 'object') store[key] = obj[key];
		else store[key] = turnObjectIntoStore(obj[key]);
	}

	return store;
}

export function consume(data: any) {
	return typeof data === 'function' ? data() : data;
}
