import { eq } from 'drizzle-orm';

/*
 * Fehlerprobe zu Regel 9: eine Routendatei ruft Drizzle selbst auf. Genau so
 * entstehen Abfragen inline in einer Route statt im Repository.
 */
export const load = () => {
	return { bedingung: eq };
};
