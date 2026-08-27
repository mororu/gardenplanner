#!/bin/sh
#
# Sicherung der SQLite-Datei aus dem Named Volume.
#
# Cron-Zeile auf dem Host, jede Nacht um 02:00 (`crontab -e`):
#
#   0 2 * * * cd /opt/gartenplaner && /bin/sh scripts/backup.sh >> "$HOME/gartenplaner-backup.log" 2>&1
#
# `sqlite3 .backup` statt `cp`: die Datenbank läuft im WAL-Modus. Eine kopierte
# Datei ohne ihre -wal-Datei ist unvollständig, und zwar lautlos — der Fehler
# zeigt sich erst beim Wiederherstellen. `.backup` nimmt die Sperren, die dafür
# nötig sind, und läuft im selben Container, der auch schreibt: dieselbe
# SQLite-Familie.
#
# Auf dem Host braucht dieses Skript nur `docker` und eine POSIX-Shell mit
# `sed` und `date`. `sqlite3` und `find` laufen im Container — auch die
# Rotation, denn die Dateien gehören der UID 1000 des Containers, und ein
# Cron-Benutzer mit anderer UID dürfte sie nicht löschen.
#
# Aufbewahrung: 30 Tage. Eine 31 Tage alte Datei fällt beim nächsten Lauf weg,
# eine 29 Tage alte bleibt.
#
# Was dieses Skript NICHT leistet, benannt statt versteckt: es meldet sich bei
# niemandem. Schlägt es fehl, steht das im Log und sonst nirgends. Siehe
# "Benannte Kosten" in README.md.

set -eu

# Vom Skriptort aus in die Projektwurzel — `docker compose` braucht sie, und
# Cron startet ohne sinnvolles Arbeitsverzeichnis.
wurzel=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$wurzel"

QUELLE=/data/db/db.sqlite
TEMP=/data/db/backup.tmp

# ---------------------------------------------------------------------------
# BACKUP_DIR ermitteln
# ---------------------------------------------------------------------------
# Aus der Umgebung, sonst aus .env. .env wird dabei NICHT als Shell ausgeführt:
# die Datei enthält auch das Sitzungsgeheimnis, und ein `.`-Aufruf machte jeden
# Tippfehler darin zu einem Befehl.
#
# Gelesen wird trotzdem tolerant, weil .env von Hand geschrieben wird:
# `export `-Präfix, CR am Zeilenende (aus Windows kopiert), Leerraum um das
# Gleichheitszeichen, nachlaufender Leerraum und einfache oder doppelte
# Anführungszeichen um den Wert. Wer das nicht abfängt, meldet am Ende einen
# falschen Grund — "Verzeichnis gibt es nicht" für einen Wert, der nur ein
# Anführungszeichen zu viel trägt.
envWert() {
	sed -n \
		-e 's/\r$//' \
		-e 's/^[[:space:]]*export[[:space:]][[:space:]]*//' \
		-e "s/^$1[[:space:]]*=[[:space:]]*//p" \
		.env |
		tail -n 1 |
		sed -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

if [ -z "${BACKUP_DIR:-}" ] && [ -f .env ]; then
	BACKUP_DIR=$(envWert BACKUP_DIR)
fi

if [ -z "${BACKUP_DIR:-}" ]; then
	echo "BACKUP_DIR ist weder gesetzt noch in .env zu finden. Siehe .env.example." >&2
	exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
	echo "Das Sicherungsverzeichnis $BACKUP_DIR gibt es nicht. Anlegen mit" >&2
	echo "  mkdir -p $BACKUP_DIR && chown 1000:1000 $BACKUP_DIR" >&2
	exit 1
fi

# ---------------------------------------------------------------------------
# Sperre gegen überlappende Läufe
# ---------------------------------------------------------------------------
# Zwei Läufe teilten sich sonst dieselbe feste Temporärdatei im Volume: der
# zweite überschriebe die Quelle des ersten mitten im Kopieren. `mkdir` ist die
# atomare Operation, die jede POSIX-Shell dafür hat.
SPERRE="$wurzel/.backup.lock"
if ! mkdir "$SPERRE" 2>/dev/null; then
	echo "Es läuft schon eine Sicherung ($SPERRE besteht)." >&2
	echo "Bleibt das Verzeichnis nach einem Abbruch liegen: rmdir $SPERRE" >&2
	exit 1
fi

# Ab hier räumt der Trap alles Halbfertige weg — auch wenn set -e zuschlägt.
ZIEL=""
aufraeumen() {
	code=$?
	docker compose exec -T app rm -f \
		"$TEMP" "$TEMP-wal" "$TEMP-shm" "$TEMP-journal" \
		>/dev/null 2>&1 || true
	if [ -n "$ZIEL" ]; then
		docker compose exec -T app rm -f \
			"$ZIEL.teil" "$ZIEL.teil-wal" "$ZIEL.teil-shm" "$ZIEL.teil-journal" \
			>/dev/null 2>&1 || true
	fi
	rmdir "$SPERRE" 2>/dev/null || true
	exit $code
}
trap aufraeumen EXIT INT TERM

# ---------------------------------------------------------------------------
# Fail-Fast auf den Stapel und auf die Quelle
# ---------------------------------------------------------------------------
if ! docker compose exec -T app true >/dev/null 2>&1; then
	echo "Der app-Container läuft nicht — es gibt nichts zu sichern." >&2
	echo "Prüfen mit: docker compose ps" >&2
	exit 1
fi

# Diese Prüfung ist nicht Zierde, sondern gemessen: `sqlite3 fehlt.sqlite
# \".backup '/ziel'\"` endet mit **0** und legt eine gültige, leere Datenbank von
# rund 4 KB an, deren `PRAGMA integrity_check` brav `ok` meldet. Ohne die
# Prüfung füllte sich das Sicherungsverzeichnis mit Attrappen, und die Rotation
# löschte 31 Tage später die letzte echte Kopie.
if ! docker compose exec -T app test -f "$QUELLE" >/dev/null 2>&1; then
	echo "Die Quelldatenbank $QUELLE gibt es im Container nicht." >&2
	echo "Ist das Volume verloren? Siehe 'Wiederherstellung' in README.md." >&2
	exit 1
fi

# ---------------------------------------------------------------------------
# Sichern
# ---------------------------------------------------------------------------
# Sekunden im Namen, nicht nur Minuten: das Runbook empfiehlt selbst eine
# Sicherung von Hand vor jeder Aktualisierung, und die fiele sonst mit dem
# Cron-Lauf derselben Minute zusammen.
name="db-$(date +%Y-%m-%d-%H%M%S).sqlite"
ZIEL="/sicherungen/$name"

if ! docker compose exec -T app sqlite3 "$QUELLE" ".backup '$TEMP'"; then
	echo "Die Sicherung ist fehlgeschlagen: sqlite3 .backup lief nicht durch." >&2
	exit 1
fi

# Erst auf einen .teil-Namen. Bricht der Lauf danach ab, liegt im
# Sicherungsverzeichnis nichts, was beim nächsten Wiederherstellen für eine
# vollständige Kopie gehalten würde — und die Rotation räumt eine liegen
# gebliebene .teil-Datei nach 30 Tagen mit weg.
if ! docker compose exec -T app cp "$TEMP" "$ZIEL.teil"; then
	echo "Die Kopie liess sich nicht nach $BACKUP_DIR schreiben." >&2
	echo "Gehört das Verzeichnis der UID 1000? chown 1000:1000 $BACKUP_DIR" >&2
	exit 1
fi

# ---------------------------------------------------------------------------
# Prüfen, bevor die Kopie ihren endgültigen Namen bekommt
# ---------------------------------------------------------------------------
# Kein `if !` mit Zuweisung: unter set -e beendete ein Fehlschlag hier das
# Skript, und der Trap oben ist genau dafür da. Explizit ist es trotzdem
# besser — die Meldung nennt den Grund.
ergebnis=$(docker compose exec -T app sqlite3 "$ZIEL.teil" 'PRAGMA integrity_check;' 2>&1 | tr -d '\r' || true)
if [ "$ergebnis" != "ok" ]; then
	echo "PRAGMA integrity_check auf $name sagt: $ergebnis" >&2
	echo "Die unbrauchbare Kopie wird nicht behalten." >&2
	exit 1
fi

# Fingerabdruck aus Quelle und Kopie. `integrity_check` allein genügt nicht:
# eine leere Datenbank ist strukturell einwandfrei. Die drei Zahlen — Objekte
# im Schema, Mitglieder, Aufgaben — fallen auseinander, sobald die Kopie eine
# andere Datenbank ist als die Quelle, und die Abfrage scheitert von selbst,
# wenn eine der Tabellen fehlt.
fingerabdruck() {
	docker compose exec -T app sqlite3 "$1" \
		"select (select count(*) from sqlite_master) || '/' || (select count(*) from members) || '/' || (select count(*) from tasks);" 2>&1 |
		tr -d '\r'
}
quelleAbdruck=$(fingerabdruck "$QUELLE" || true)
kopieAbdruck=$(fingerabdruck "$ZIEL.teil" || true)
if [ -z "$kopieAbdruck" ] || [ "$quelleAbdruck" != "$kopieAbdruck" ]; then
	echo "Quelle und Kopie stimmen nicht überein: '$quelleAbdruck' gegen '$kopieAbdruck'." >&2
	echo "Die Kopie wird nicht behalten." >&2
	exit 1
fi

# Die Beiwagen, die der integrity_check angelegt hat. Die Kopie steht im
# WAL-Modus, also entstehen -wal und -shm beim Öffnen. Ohne diese Zeile
# wanderten sie unter dem .teil-Namen ins Verzeichnis und blieben dort für
# immer liegen — das Rotationsmuster unten fängt sie zwar, aber erst nach 30
# Tagen, und bis dahin sähe jedes Verzeichnislisting nach doppelt so vielen
# Sicherungen aus, wie es gibt.
docker compose exec -T app rm -f "$ZIEL.teil-wal" "$ZIEL.teil-shm" >/dev/null 2>&1 || true

# Erst jetzt der endgültige Name. `mv` innerhalb desselben Dateisystems ist
# atomar: einen Zwischenzustand mit halbem Inhalt unter dem Endnamen gibt es
# nicht.
docker compose exec -T app mv "$ZIEL.teil" "$ZIEL"
ZIEL=""

# ---------------------------------------------------------------------------
# Rotation
# ---------------------------------------------------------------------------
# Im Container, nicht auf dem Host: die Dateien gehören der UID 1000, und ein
# Cron-Benutzer mit anderer UID scheiterte an `-delete` — und zwar erst NACH
# einer erfolgreichen Sicherung, die set -e dann rot beendete.
#
# Das Muster ist `db-*.sqlite*` und nicht `db-*.sqlite`: es muss auch die
# -wal-/-shm-Beiwagen und eine liegen gebliebene .teil-Datei aus einem
# abgebrochenen Lauf erwischen. `-mtime +30` heisst: älter als volle 30 Tage.
docker compose exec -T app \
	find /sicherungen -maxdepth 1 -type f -name 'db-*.sqlite*' -mtime +30 -delete

echo "Sicherung: $BACKUP_DIR/$name (integrity_check: ok, $kopieAbdruck)"
