import Database from 'better-sqlite3';

/*
 * Fehlerprobe zu Regel 9: eine Routendatei öffnet die Datenbank selbst. Das
 * umgeht Drizzle und das Repository in einem Schritt und erzeugt eine zweite
 * Verbindung ohne WAL, ohne busy_timeout und ohne Migrationsstand.
 */
export const load = () => {
	return { treiber: Database };
};
