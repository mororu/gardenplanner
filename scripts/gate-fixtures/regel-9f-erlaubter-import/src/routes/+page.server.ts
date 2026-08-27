import type { InferSelectModel } from 'drizzle-orm';
import { mitgliedNachId } from '$lib/server/db/queries/members';
import { mitgliedNachTokenHash } from '../lib/server/db/queries/members.ts';

/*
 * Gegenprobe zu Regel 9: **kein** Verstoss.
 *
 * Jede andere Regel-9-Probe trägt nur die verbotene Form. Eine zu breite Regel
 * bliebe damit im Selbsttest grün und fiele erst als rätselhafter Verstoss im
 * echten Baum auf. Diese Probe hält die Gegenrichtung fest:
 *
 *   - eine Abfragefunktion über den Alias                    erlaubt
 *   - dieselbe über einen relativen Pfad mit .ts-Endung      erlaubt
 *   - ein reines `import type` aus drizzle-orm               erlaubt, weil
 *     TypeScript die Anweisung beim Bauen löscht und kein Modulaufruf entsteht
 *
 * Erwartet sind null Regel-9-Treffer.
 */
export const load = () => {
	return { nachId: mitgliedNachId, nachHash: mitgliedNachTokenHash };
};

export type Zeile = InferSelectModel<never>;
