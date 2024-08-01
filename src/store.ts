import { JSONArray, JSONObject, JSONPrimitive } from './json-types';
import { consume, isNestedPermissionAllowed, turnObjectIntoStore } from './utils';

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

export class Store implements IStore {
	defaultPolicy: Permission = 'rw';

	allowedToRead(path: string): boolean {
		return isNestedPermissionAllowed(this, path, 'r');
	}

	allowedToWrite(path: string): boolean {
		return isNestedPermissionAllowed(this, path, 'w');
	}

	read(path: string): StoreResult {
		if (!isNestedPermissionAllowed(this, path, 'r')) throw new Error(`read: forbidden access to ${path}`);

		let target: any = this;

		const keys = path.split(':');
		const lastKey = keys.pop() || '';

		for (const key of keys) {
			if (!(key in target)) throw new Error(`read: ${key} doesn't exist`);
			target = consume(target?.[key]);
		}

		return consume(target[lastKey]);
	}

	write(path: string, value: StoreValue): StoreValue {
		if (!isNestedPermissionAllowed(this, path, 'w')) throw new Error(`write: forbidden access to ${path}`);

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
			if (!isNestedPermissionAllowed(this, key, 'r')) return acc;
			acc[key] = value;

			return acc;
		}, {} as JSONObject);
	}
}
