import 'reflect-metadata';
import type { Permission, Store } from './store';

export const PermissionMetadataKey = Symbol('permission');

export function Restrict(policy: Permission = 'none'): any {
	return function (target: Store, key: string) {
		Reflect.defineMetadata(PermissionMetadataKey, policy, target, key);
	};
}
