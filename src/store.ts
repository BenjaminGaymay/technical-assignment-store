import { PermissionMetadataKey } from './decorators';
import { JSONArray, JSONObject, JSONPrimitive } from './json-types';
import { consume } from './utils';

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

	allowedToRead(key: string): boolean {
		return (Reflect.getMetadata(PermissionMetadataKey, this, key) || this.defaultPolicy).includes('r');
	}

	allowedToWrite(key: string): boolean {
		return (Reflect.getMetadata(PermissionMetadataKey, this, key) || this.defaultPolicy).includes('w');
	}

	read(path: string): StoreResult {
		let target: any = this;

		for (const key of path.split(':')) {
			if (!target.allowedToRead(key)) throw new Error(`read: forbidden access to ${key}`);
			if (!(key in target)) throw new Error(`read: ${key} doesn't exist`);

			target = consume(target?.[key]);
		}

		return target;
	}

	write(path: string, value: StoreValue): StoreValue {
		let target: any = this;

		const keys = path.split(':');
		const last = keys.pop() || '';

		for (const key of keys) {
			if (!(target.allowedToWrite(key) || target[key] instanceof Store)) {
				throw new Error(`write: forbidden access to ${key}`);
			}

			if (!(key in target)) target[key] = new Store();
			target = consume(target[key]);
		}

		if (!target.allowedToWrite(last)) {
			throw new Error(`write: forbidden access to ${last}`);
		}

		if (!value || typeof value !== 'object' || value instanceof Store) {
			target[last] = value;
			return this;
		}

		target[last] = new Store();
		for (const [key, v] of Object.entries(value)) {
			target[last].write(key, v);
		}

		return this;
	}

	writeEntries(entries: JSONObject): void {
		for (const [key, value] of Object.entries(entries)) {
			this.write(key, value);
		}
	}

	entries(): JSONObject {
		return Object.entries(this).reduce((acc, [key, value]) => {
			if (!this.allowedToRead(key)) return acc;
			acc[key] = value;

			return acc;
		}, {} as JSONObject);
	}
}
