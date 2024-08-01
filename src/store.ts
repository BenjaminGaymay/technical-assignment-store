import 'reflect-metadata';

import { JSONArray, JSONObject, JSONPrimitive } from './json-types';

export type Permission = 'r' | 'w' | 'rw' | 'none';

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue = JSONObject | JSONArray | StoreResult | (() => StoreResult);

export interface IStore {
	defaultPolicy: Permission;
	allowedToRead(key: string): boolean;
	allowedToWrite(key: string): boolean;
	read(path: string): StoreResult;
	write(path: string, value: StoreValue): StoreValue;
	writeEntries(entries: JSONObject): void;
	entries(): JSONObject;
}

const PermissionMetadataKey = Symbol('permission');

export function Restrict(policy: Permission = 'none'): any {
	return function (target: Store, key: string) {
		Reflect.defineMetadata(PermissionMetadataKey, policy, target, key);
	};
}

function consume(data: any) {
	return typeof data === 'function' ? data() : data;
}

function isKeyPermissionAllowedByStore(store: Store, key: string, permission: Permission): boolean {
	const policy: Permission = Reflect.getMetadata(PermissionMetadataKey, store, key) || store.defaultPolicy;

	return policy.includes(permission);
}

function turnObjectIntoStore(obj: StoreValue): StoreValue {
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

export class Store implements IStore {
	defaultPolicy: Permission = 'rw';

	private isNestedPermissionAllowed(path: string, permission: Permission): boolean {
		let target: any = this;
		let deepestStore: Store = this;

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

	allowedToRead(path: string): boolean {
		return this.isNestedPermissionAllowed(path, 'r');
	}

	allowedToWrite(path: string): boolean {
		return this.isNestedPermissionAllowed(path, 'w');
	}

	read(path: string): StoreResult {
		if (!this.isNestedPermissionAllowed(path, 'r')) throw new Error(`${path} not accessible`);

		let target: any = this;

		const keys = path.split(':');
		const lastKey = keys.pop() || '';

		for (const key of keys) {
			if (!(key in target)) throw new Error(`${key} doesn't exist`);
			target = consume(target?.[key]);
		}

		return consume(target[lastKey]);
	}

	write(path: string, value: StoreValue): StoreValue {
		if (!this.isNestedPermissionAllowed(path, 'w')) throw new Error(`${path} not accessible`);

		let target: any = this;

		const keys = path.split(':');
		const lastKey = keys.pop() || '';

		for (const key of keys) {
			if (!(key in target)) target[key] = new Store();
			target = consume(target[key]);
		}

		target[lastKey] = turnObjectIntoStore(value);

		return this;
	}

	writeEntries(entries: JSONObject): void {
		for (const [key, value] of Object.entries(entries)) {
			this.write(key, value);
		}
	}

	entries(): JSONObject {
		return Object.entries(this).reduce((acc, [key, value]) => {
			if (!this.isNestedPermissionAllowed(key, 'r')) return acc;
			acc[key] = value;

			return acc;
		}, {} as JSONObject);
	}
}
