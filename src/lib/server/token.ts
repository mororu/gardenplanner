import { createHash, randomBytes } from 'node:crypto';

/*
 * Einladungstokens.
 *
 * Diese Datei ist bewusst frei von Importen aus $app/*, $env/* und
 * @sveltejs/kit — damit dieselbe Datei aus der Route und aus dem CLI-Skript
 * ladbar ist. Nacktes Node kann kein $lib auflösen und kein SvelteKit-Modul
 * aus einem Alias holen.
 */

/** Ein neues Token: 32 Byte Zufall, base64url, 43 Zeichen. */
export function tokenErzeugen(): string {
	return randomBytes(32).toString('base64url');
}

/**
 * Der SHA-256-Hash eines Tokens, 64 Hex-Zeichen. Nur dieser Wert steht in der
 * Datenbank; aus ihm lässt sich das Token nicht zurückrechnen.
 */
export function tokenHashen(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}
