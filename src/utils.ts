export function consume(data: unknown) {
	return typeof data === 'function' ? data() : data;
}
