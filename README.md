# Gemeinschaftsgarten

Aufgabenliste für einen Gemeinschaftsgarten: rund zwanzig Gärtner\*innen sehen auf
dem Handy, was offen ist, und haken mit einem Griff ab. Serverseitig gerenderter
SvelteKit-Monolith, eine SQLite-Datei, nur online.

Dieser Stand ist Story 2.2: Überfällige Aufgaben erkennen. Es gibt
Titelleiste, Navigationsleiste, das PWA-Manifest, die SQLite-Datenschicht mit
`members` und `tasks` (letztere seit Story 2.1 mit `due_at`), den einzigen
Zugangsweg (`GET /i/<token>` löst die Einladung ein, ein Wächter lässt ohne
gültige Sitzung niemanden weiter), die Verwaltung unter `/verwaltung`, auf `/`
die ganze Schleife (die offenen Aufgaben, abgehakt mit einem Griff, unter einer
seit drei Wochen liegenden Zeile der Satz `seit N Wochen offen`, und unter dem
Pool der Knopf `+ Aufgabe`, der auf `/aufgabe` führt), unter `/mehr` den
Einstieg zu `/monatsplan`, wo die planende Person ihren ganzen Monatsplan in
einem Zug ablegt — und den Compose-Stapel, der das alles auf einen Server
bringt: siehe [Betrieb und Runbook](#betrieb-und-runbook).

Das Projekt ist an npm gebunden: `npm run db:generate` ruft
`node_modules/drizzle-kit/bin.cjs` über einen festen Pfad, und der setzt npms
flache Ablage (Hoisting) voraus. Mit pnpm oder Yarn PnP liegt die Datei
woanders.

## Voraussetzungen

- Node 24 oder neuer (`.nvmrc`), npm 11 oder neuer. `engine-strict=true` lässt
  `npm install` mit einer klaren Meldung abbrechen, wenn die Version nicht passt.
- `save-exact=true`: jede Abhängigkeit wird ohne Caret gepinnt.

## Start

`cp .env.example .env` allein genügt **nicht**: die Vorlage lässt die drei
Pflichtwerte absichtlich leer, und der Start bricht dann per Entwurf ab. Dieses
Tripel ist für die lokale Entwicklung gedacht und kopierbar:

```sh
npm install                     # installiert exakt die gepinnten Versionen
mkdir -p data                   # SQLite legt das Verzeichnis nicht selbst an
cat > .env <<ENV
DATABASE_PATH=./data/dev.sqlite
SESSION_SECRET=$(openssl rand -base64 32)
ORIGIN=http://localhost:5173
ENV
npm run dev                     # Entwicklungsserver auf http://localhost:5173
```

Das `<<ENV` steht bewusst **ohne** Anführungszeichen: nur so ersetzt die Shell
`$(openssl …)` und in `.env` landet ein echtes Geheimnis. Wer den Wert lieber
sieht, führt `openssl rand -base64 32` einzeln aus und setzt ihn von Hand ein.
Ein Wert unter 32 Zeichen oder aus weniger als acht verschiedenen Zeichen wird
beim Start abgewiesen.

### Vom leeren System zum ersten Link

Ohne Mitglied kommt niemand herein — auch nicht der Mensch, der die Anwendung
gerade gestartet hat. Es gibt bewusst kein Registrierungsformular. Der einzige
Weg zum ersten Mitglied ist dieses Skript:

```sh
npm run create-admin -- Anna
```

Es startet die Datenschicht, lässt die Migrationen laufen (auf einer leeren
Datei legt es die Tabellen und die Migrationskette selbst an), erzeugt ein Token, speichert
dessen SHA-256-Hash und gibt den Klartext-Link **genau einmal** aus:

```
http://localhost:5173/i/NXpe6MFBD0LjD4ftXGppqAJL2vt-aVibzj_b_J_5Hrg
```

In der Datenbank steht nur der Hash; ein verlorener Link lässt sich nicht
wiederherstellen.

Diese Zeile ist die einzige Stelle, an der ein Token **auf der Konsole**
erscheint — seit Story 1.3 nicht mehr die einzige im System. `/verwaltung` zeigt
beim Aufnehmen und beim Neuausstellen ebenfalls einen Klartext-Link, dort im
Rumpf **einer** POST-Antwort. Beides ist derselbe Handel: einmal sichtbar,
danach nur noch als Hash vorhanden.

Und auch nicht einfach neu erzeugen: `create-admin` legt **nur das erste**
Mitglied an und bricht ab, sobald es schon eines gibt — sonst entstünde
unbemerkt ein zweiter Admin mit einem zweiten lebenden Link.

**Der Alleinverwalter ist eine Sollbruchstelle, und zwar mit Ansage.** Es gibt
genau eine Adminperson und keinen Weg, eine zweite zu machen: `create-admin`
läuft nur auf einem leeren System, und `/verwaltung` nimmt ausschliesslich
Mitglieder ohne Adminrechte auf. Wer also den Admin-Link verliert und kein
angemeldetes Gerät mehr hat, kommt in die Verwaltung nicht zurück — es ist
niemand da, der ihm einen neuen ausstellen könnte. Der Ausweg führt dann über
die Datenbank: die Admin-Zeile in `members` löschen und `create-admin` erneut
laufen lassen. Die Sitzung überlebt einen verlorenen Link übrigens: das Cookie
hängt an der `member_id` und nicht am Token, und es läuft ein Jahr. Der Verlust
schlägt erst beim Gerätewechsel zu.

Der Link wird auf dem Handy einmal angetippt: der Server stellt ein signiertes
Cookie aus und leitet mit 303 auf `/`. Danach liegt zwischen Öffnen und Liste
kein weiterer Schritt. Dasselbe Token lässt sich beliebig oft einlösen — ein
zweites Gerät braucht keinen neuen Link, und die erste Sitzung bleibt gültig.

Produktionsbau und Produktionsstart:

```sh
npm run build        # baut nach build/ über adapter-node
npm start            # startet den Bau, also node build/index.js — so läuft es auf dem Server
```

`npm run build` braucht **keine** Umgebungsvariable: die Prüfungen sitzen im
`init`-Hook, und den ruft SvelteKits Analyseschritt nicht. Ein frisch geklontes
Repository ohne `.env` baut durch.

**`drizzle/` muss beim Produktionsstart neben `build/` liegen.** Der Ordner
landet nicht im Bau — `build/` enthält keine einzige `.sql`-Datei —, und
`migrationsFolder` ist arbeitsverzeichnisrelativ. Fehlt er, endet der Start mit
einer benannten Meldung statt mit einer halb migrierten Datenbank. Das
`Dockerfile` kopiert das Verzeichnis darum neben `build/` ins Laufzeit-Image —
samt `drizzle/meta/`, sonst scheitert die Migration erst auf der ersten leeren
Datenbank.

`npm run preview` ist etwas anderes: das ist Vites eigene Vorschau des Baus für
einen schnellen Blick von Hand, nicht der Produktionsstart.

> **Anmelden geht in `preview` und `start` über nacktes HTTP nicht.** Das
> Sitzungs-Cookie trägt `Secure` überall ausser in der Entwicklung
> (`NODE_ENV=development`, was `vite dev` setzt). Über `http://localhost:4173`
> beziehungsweise `http://localhost:3000` verwirft der Browser ein
> `Secure`-Cookie — das Einlösen antwortet mit 303 und `set-cookie`, aber das
> Cookie kommt nie zurück, und `/` weist danach mit 403 ab. Das ist kein Fehler,
> sondern der Grund für den Schalter: im Betrieb steht nginx mit TLS davor —
> seit Story 1.6 tatsächlich, siehe [Betrieb und Runbook](#betrieb-und-runbook).
> Wer die gebaute Anwendung von Hand durchklicken will, nimmt `npm run dev` oder
> stellt einen TLS-Endpunkt davor. Ein `Secure`-Cookie über HTTP zuzulassen wäre
> der falsche Ausweg: dann liegt die Sitzung im Betrieb einmal im Klartext auf
> der Leitung, und ein einziger Fehlgriff in der Proxy-Konfiguration genügt.

## Umgebungsvariablen

Alle Werte stehen in `.env` (lokal) beziehungsweise in der Umgebung des
Containers. `.env.example` ist die Vorlage; die Werte bleiben dort leer, der
Beispielwert steht jeweils im Kommentar darüber.

Drei Variablen sind Pflicht und haben **keinen** Vorgabewert. Fehlt eine davon,
gibt der Server beim Start eine benannte deutsche Meldung aus und endet — kein
Stacktrace, kein Fallback-Pfad, kein erfundenes Geheimnis. Geprüft wird im
`init`-Hook, also beim Start und nicht beim Bauen.

| Variable         | Bedeutung                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`  | **Pflicht.** Pfad zur SQLite-Datei. Lokal etwa `./data/dev.sqlite`, im Container `/data/db/db.sqlite` — eine Ebene unter dem Mountpunkt des Volumes, absichtlich, siehe [Betrieb und Runbook](#betrieb-und-runbook). Das Verzeichnis muss existieren.                                                                                                   |
| `SESSION_SECRET` | **Pflicht.** Geheimnis für die Signatur des Sitzungs-Cookies (`openssl rand -base64 32`). Mindestens 32 Zeichen und mindestens acht verschiedene — `aaaa…` besteht die Prüfung nicht.                                                                                                                                                                   |
| `ORIGIN`         | **Pflicht**, für den Server und für `create-admin`. Reine Herkunft als absolute `http(s)`-Adresse — Schema, Host, höchstens ein Port, etwa `https://garten.example.ch`. Ein Pfad oder Abfrageteil wird abgewiesen, weil der Einladungslink sonst unklickbar wäre. Ohne `ORIGIN` weist `adapter-node` jeden POST einer form action als CSRF-Verstoss ab. |
| `PORT`           | Optional — die einzige Variable mit Vorgabewert: ohne sie nimmt `adapter-node` `3000`. Der Vite-Dev-Server nutzt unabhängig davon `5173`.                                                                                                                                                                                                               |
| `NODE_ENV`       | Optional, aber wirksam: steuert das `Secure`-Flag des Sitzungs-Cookies und damit das einzige Zugangsmittel. Nur bei `development` fehlt `Secure`; `vite dev` setzt den Wert selbst. Siehe die Warnung oben.                                                                                                                                             |
| `DOMAIN`         | **Pflicht im Betrieb**, sonst ungenutzt. Öffentlicher Hostname ohne Schema, etwa `garten.example.ch`. nginx setzt ihn über `envsubst` in `server_name` und in beide Zertifikatspfade ein; `docker-compose.yml` bildet daraus `ORIGIN=https://<DOMAIN>`. Im Repository steht kein echter Hostname.                                                       |
| `CERTBOT_EMAIL`  | **Pflicht im Betrieb**, sonst ungenutzt. Adresse, an die Let's Encrypt warnt, wenn eine Erneuerung ausbleibt. Wird nur beim einmaligen Holen des ersten Zertifikats gebraucht.                                                                                                                                                                          |
| `BACKUP_DIR`     | **Pflicht im Betrieb**, sonst ungenutzt. Absoluter Pfad auf dem Host, in den `scripts/backup.sh` schreibt. `docker-compose.yml` hängt ihn als Bind-Mount unter `/sicherungen` in den `app`-Container; er muss existieren und der UID 1000 gehören.                                                                                                      |

Die letzten drei Zeilen betreffen ausschliesslich den Compose-Stapel. Lokal
bleiben sie leer — `npm run dev` liest keine davon. Umgekehrt wird `ORIGIN` im
Stapel **nicht** aus `.env` gelesen: `docker-compose.yml` bildet den Wert aus
`DOMAIN`, damit Herkunft und Zertifikatsname nicht auseinanderlaufen können.

Ein Wert aus der Aufrufzeile gewinnt gegen `.env`. Damit lässt sich eine
Fehlkonfiguration von Hand prüfen:
`SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa npm run dev`.

**Wer `.env` liest und wer nicht.** `npm run dev` liest sie über
`vite.config.ts`; `npm run create-admin` und `npm run db:generate` über Nodes
`--env-file-if-exists`. **`npm start` liest `.env` nicht** — der
Produktionsstart erwartet die Werte in der Umgebung. Lokal heisst das
`DATABASE_PATH=… SESSION_SECRET=… ORIGIN=… npm start`, sonst bricht der Start
mit der benannten Meldung ab.

## Betrieb und Runbook

Im Betrieb läuft die Anwendung als Docker-Compose-Stapel aus **drei Diensten**
auf einem Infomaniak VPS light. Zwei Umgebungen, kein Staging: lokal
`npm run dev`, produktiv `docker compose up -d`. Eine dritte Umgebung wäre bei
dieser Grösse Aufwand ohne Gegenwert.

| Dienst    | Image               | Aufgabe                                                                                                                                                                                    |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app`     | aus `Dockerfile`    | Die Anwendung, `node build/index.js`. **Veröffentlicht keinen Port** — nur über das interne Bridge-Netz `intern` als `app:3000` erreichbar. Läuft als `node` (UID 1000), nicht als `root`. |
| `nginx`   | `nginx:1.29-alpine` | TLS-Terminierung auf 80 und 443, Umleitung auf HTTPS, Sicherheits-Kopfzeilen, Ratenbegrenzung auf `/i/`. Reicht alles an `app:3000` weiter.                                                |
| `certbot` | `certbot/certbot`   | Erneuerungsschleife: alle zwölf Stunden `certbot renew` über das geteilte Webroot. Das **erste** Zertifikat holt der Mensch einmal je Maschine, siehe Runbook.                             |

Drei Named Volumes: `daten` (die SQLite-Datei unter `/data/db/`), `letsencrypt`
(Zertifikate und certbots Zustand) und `acme` (das geteilte Webroot für die
ACME-Prüfung). Dazu ein Bind-Mount von `BACKUP_DIR` nach `/sicherungen` im
`app`-Container.

Die Dateien: `Dockerfile`, `.dockerignore`, `docker-compose.yml`,
`nginx/nginx.conf`, `nginx/templates/app.conf.template`, `scripts/backup.sh`.
Jede trägt ihre Begründungen als Kommentar; hier steht nur, was man beim
Bedienen wissen muss.

### Sechs Entscheidungen, die beim Lesen sonst überraschen

- **`app` hat keinen `ports`-Eintrag.** Das ist Absicht, keine Auslassung. Wer
  ihn hinzufügt, stellt einen Server ohne TLS ins Netz, dessen Sitzungs-Cookie
  `Secure` trägt — er wäre erreichbar und unbenutzbar zugleich.
- **Der Healthcheck hält `403` für gesund.** Es gibt bewusst keinen
  Health-Endpunkt: jeder Pfad ausser `/i/<token>` läuft durch den Wächter und
  antwortet ohne Cookie mit `403`. Genau das beweist mehr als ein `200` auf
  einer freien Route — der Prozess hört, und der `init`-Hook ist ohne
  `process.exit(1)` durchgelaufen, also stehen Datenbank, Sitzungsgeheimnis und
  Herkunft. Der Preis ist benannt: ändert sich der Statuscode des Wächters je,
  meldet der Healthcheck den Container als krank.
- **`/i/` steht in keinem Zugriffsprotokoll.** `access_log off` in beiden
  `/i/`-Blöcken, dazu `limit_req_log_level info`, damit auch das Bremsen der
  Ratenbegrenzung den Pfad nicht ins Fehlerprotokoll schreibt. Das
  Klartext-Token steht im Pfad; in `access.log` läge es leichter lesbar als in
  der Datenbank, die nur den Hash kennt.
- **nginx liefert keine einzige Datei selbst aus.** Kein `try_files`, kein
  `gzip`, kein Cache-Header. `adapter-node` liefert `build/client` mit
  `precompress` aus, also liegen `.br` und `.gz` schon vor. Ein zweiter
  Ausliefernder wäre eine zweite Wahrheit.
- **Die Server-Blöcke liegen unter `nginx/templates/` und heissen `.template`.**
  Nur diese Dateien durchlaufen im offiziellen Image die
  `envsubst`-Ersetzung — sonst stünde der echte Hostname fest im Repository.
  Gerendert landen sie unter `/etc/nginx/conf.d/app.conf`.
- **Die Datenbank liegt unter `/data/db/db.sqlite`, nicht unter
  `/data/db.sqlite`.** Das Image legt `/data` bewusst **nicht** an. Docker
  befüllt ein frisches Named Volume aus dem gleichnamigen Verzeichnis des
  Images: gäbe es `/data` dort, entstünde es nach jedem Volume-Verlust sofort
  wieder, und die Anwendung startete still mit einer leeren Datenbank — die
  Gemeinschaft sähe `Nichts offen.` ohne jeden Hinweis und schriebe in die
  frische Datei hinein. So aber ist ein verlorenes Volume ein leerer,
  root-eigener Mountpunkt ohne `/data/db`, und der Start endet mit
  `Das Verzeichnis für die Datenbank fehlt: /data/db`. `/data/db` wird genau
  einmal je Maschine von Hand angelegt (Schritt 7) — das ist die einzige
  Stelle, an der ein leerer Datenbestand bewusst entsteht, und genau die
  Unterscheidung zwischen „erster Start" und „Volume verloren". Ein
  Automatismus dafür wäre derselbe stille Datenverlust in bequem.

### Runbook: von der leeren Maschine zur laufenden Anwendung

Alle Befehle laufen als Benutzer mit `sudo`-Recht auf einem frischen
Debian- oder Ubuntu-VPS. `garten.example.ch` steht überall stellvertretend für
deinen Hostnamen — abzutippen ist er allerdings nur ein einziges Mal, in
Schritt 5.

**1. Docker installieren und prüfen.**

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker
docker compose version
```

**2. DNS prüfen, bevor irgendetwas anderes passiert.** Ohne einen A-Eintrag,
der auf diesen Server zeigt, scheitert Schritt 9 und Let's Encrypt zählt den
Fehlversuch gegen das Kontingent.

```sh
dig +short A    garten.example.ch
dig +short AAAA garten.example.ch
curl -s  https://api.ipify.org
curl -s6 https://api6.ipify.org || echo 'kein IPv6 auf dieser Maschine'
```

Der A-Eintrag muss auf die IPv4-Adresse des Servers zeigen. **Und der
AAAA-Eintrag muss entweder fehlen oder stimmen** — nginx hört auf beiden
Familien, aber Let's Encrypt bevorzugt IPv6, wenn ein AAAA-Eintrag da ist. Ein
verwaister AAAA-Eintrag lässt Schritt 9 scheitern, obwohl über IPv4 alles
richtig steht, und schickt zugleich jeden Browser mit IPv6 ins Leere.

**3. Repository holen.**

```sh
sudo mkdir -p /opt/gartenplaner && sudo chown "$USER" /opt/gartenplaner
git clone <URL-des-Repositorys> /opt/gartenplaner
cd /opt/gartenplaner
```

Der Verzeichnisname bestimmt den Compose-Projektnamen und damit die
Volume-Namen (`gartenplaner_daten` und so weiter). Alle folgenden Befehle
laufen aus diesem Verzeichnis.

**4. Sicherungsverzeichnis anlegen.** Es gehört der UID 1000, weil der
`app`-Container als `node` schreibt.

```sh
sudo mkdir -p /var/backups/gartenplaner
sudo chown 1000:1000 /var/backups/gartenplaner
```

**5. `.env` füllen.** Das `<<ENV` steht bewusst **ohne** Anführungszeichen: nur
so ersetzt die Shell `$(openssl …)` und in `.env` landet ein echtes Geheimnis.

```sh
cat > .env <<ENV
DATABASE_PATH=/data/db/db.sqlite
SESSION_SECRET=$(openssl rand -base64 32)
DOMAIN=garten.example.ch
CERTBOT_EMAIL=garten@example.ch
BACKUP_DIR=/var/backups/gartenplaner
ENV
chmod 600 .env
```

**`ORIGIN` steht hier bewusst nicht.** `docker-compose.yml` bildet den Wert aus
`DOMAIN`, damit Herkunft und Zertifikatsname nicht auseinanderlaufen können; ein
Eintrag hier wäre tot und beim nächsten Umzug eine zweite, veraltete Wahrheit.
Für die lokale Entwicklung ist `ORIGIN` weiterhin Pflicht — dort gibt es kein
Compose.

**`DOMAIN` prüfen, bevor irgendetwas darauf baut.** Der Wert wandert in
`server_name`, in beide Zertifikatspfade und in `ORIGIN`; ein Schema, ein Pfad,
ein Port oder ein Schrägstrich am Ende macht alle drei falsch, und zwar
unterschiedlich falsch:

```sh
grep -qE '^DOMAIN=[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' .env \
  && echo 'DOMAIN sieht gut aus.' \
  || echo 'DOMAIN ist keine nackte Domain: kein https://, kein Pfad, kein :Port, kein / am Ende.'
```

Für die folgenden Schritte den Wert einmal in die Shell holen — damit kommt der
Rest des Runbooks ohne einen einzigen abgetippten Hostnamen aus. Nach einer
neuen Anmeldung ist die Zeile zu wiederholen:

```sh
DOMAIN=$(sed -n 's/^DOMAIN=//p' .env)
echo "$DOMAIN"
```

**6. Attrappen-Zertifikat legen.** nginx startet nicht, wenn die in
`ssl_certificate` genannte Datei fehlt; certbot kommt aber nur an die
ACME-Prüfung, wenn nginx läuft. Diesen Ring löst kein Compose-Kunstgriff
sauber auf, darum ist er hier ein ausdrücklicher Schritt: ein selbstsigniertes
Zertifikat hinlegen, hochfahren, das echte holen, neu laden.

Der Hostname steht in keinem dieser Befehle: der `certbot`-Dienst bekommt
`DOMAIN` und `CERTBOT_EMAIL` aus `.env` in seine Umgebung gereicht, und die
einfachen Anführungszeichen sorgen dafür, dass `$DOMAIN` erst **im Container**
eingesetzt wird. Nichts ist abzutippen.

```sh
docker compose run --rm --no-deps --entrypoint sh certbot -c '
  apk add --no-cache openssl >/dev/null &&
  mkdir -p "/etc/letsencrypt/live/$DOMAIN" &&
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
    -keyout "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
    -out    "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
    -subj   "/CN=$DOMAIN"'
```

**7. Das Datenverzeichnis im Volume anlegen.** Der einzige Schritt, der von
Hand geschieht, obwohl ein Skript ihn könnte — und er geschieht von Hand,
**weil** ein Skript ihn könnte. Er ist die einzige Stelle, an der ein leerer
Datenbestand bewusst entsteht, und damit die Grenze zwischen „erster Start" und
„Volume verloren"; die Begründung steht oben bei den sechs Entscheidungen.

```sh
docker compose run --rm --build --no-deps --user root --entrypoint sh app \
  -c 'mkdir -p /data/db && chown node:node /data/db'
```

Läuft dieser Schritt ein zweites Mal auf einem befüllten Volume, tut er nichts
— `mkdir -p` und `chown` auf ein vorhandenes, richtig gehörendes Verzeichnis
sind folgenlos.

**8. Bauen und hochfahren.** Das Image entsteht auf dem Server.

```sh
docker compose up -d --build
docker compose ps
```

Erwartet: drei Dienste auf `running`, `app` auf `healthy`. `nginx` startet erst,
wenn `app` gesund ist — das dauert beim ersten Mal einige Sekunden.

**9. Echtes Zertifikat holen.** Erst die Attrappe wegräumen: certbot legt sonst
keine Kette über ein Verzeichnis, das es nicht selbst angelegt hat. Das
laufende nginx hält seine Dateien offen und liefert währenddessen weiter aus.

```sh
docker compose run --rm --no-deps --entrypoint sh certbot -c '
  rm -rf "/etc/letsencrypt/live/$DOMAIN" \
         "/etc/letsencrypt/archive/$DOMAIN" \
         "/etc/letsencrypt/renewal/$DOMAIN.conf"'

docker compose run --rm --no-deps --entrypoint sh certbot -c '
  certbot certonly --webroot --webroot-path /var/www/certbot \
    -d "$DOMAIN" --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email'
```

Auch hier kommen Hostname und Adresse aus `.env`, nicht aus der Zwischenablage.
`CERTBOT_EMAIL` ist die Adresse, an die Let's Encrypt warnt, wenn eine
Erneuerung ausbleibt — die einzige Stelle, an der sie gebraucht wird.

**10. nginx neu laden.** Erst jetzt liegt die echte Kette in den Dateien, die
nginx beim Start gelesen hat.

```sh
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
curl -sI "https://$DOMAIN/" | head -1
```

Erwartet: `syntax is ok`, `test is successful`, dann `HTTP/2 403`. **Das `403`
ist richtig** — ohne Einladungslink kommt niemand herein, auch der Mensch nicht,
der das gerade aufgesetzt hat.

**11. Erstes Admin-Mitglied anlegen.** `scripts/create-admin.ts` liegt bewusst
**nicht** im Laufzeit-Image; es braucht `src/`, und das Laufzeit-Image trägt nur
`build/`. Der Weg führt darum einmalig über die Builder-Stufe.

```sh
docker build --target bauer -t gartenplaner-werkzeug .
docker run --rm --user node \
  --volumes-from "$(docker compose ps -q app)" \
  -e DATABASE_PATH=/data/db/db.sqlite \
  -e ORIGIN="https://$DOMAIN" \
  gartenplaner-werkzeug node scripts/create-admin.ts "Anna Meier"
docker image rm gartenplaner-werkzeug
```

Die letzte Zeile der Ausgabe ist der Einladungslink. **Er erscheint genau
einmal** und ist nicht wiederherstellbar — in der Datenbank steht nur sein
SHA-256-Hash. Kopiere ihn, bevor du das Terminal schliesst. Alle weiteren
Mitglieder nimmt diese Person danach unter `/verwaltung` auf.

**12. Cron eintragen.** Zwei Zeilen: die nächtliche Sicherung und ein
wöchentliches Neuladen von nginx, damit ein erneuertes Zertifikat auch wirksam
wird (siehe [Erneuerung](#erneuerung)).

Das Log liegt im Heimatverzeichnis, **nicht** unter `/var/log/`. Der Benutzer
aus Schritt 1 ist nicht root und darf dort nichts anlegen: die Umleitung
scheiterte, bevor `backup.sh` überhaupt startete — und weil das Log der einzige
Kanal dieses Skripts ist, fiele genau das nie auf. Wer die Datei doch unter
`/var/log/` will, legt sie einmalig an und übereignet sie:
`sudo install -o "$USER" -m 600 /dev/null /var/log/gartenplaner-backup.log`.

```sh
(
  crontab -l 2>/dev/null
  echo '0 2 * * * cd /opt/gartenplaner && /bin/sh scripts/backup.sh >> "$HOME/gartenplaner-backup.log" 2>&1'
  echo '30 4 * * 1 cd /opt/gartenplaner && docker compose exec -T nginx nginx -s reload'
) | crontab -
crontab -l
```

Am nächsten Morgen einmal nachsehen, ob die Nacht funktioniert hat — danach
sieht niemand mehr hin, und das ist eine benannte Kosten dieser Story:

```sh
tail -5 "$HOME/gartenplaner-backup.log"
ls -lt /var/backups/gartenplaner | head -3
```

**13. Die Wiederherstellung einmal proben — jetzt, nicht im Ernstfall.** Von
allen Wegen dieser Story ist das der am wenigsten geübte und der einzige, den
man unter Zeitdruck geht. Er lässt sich gefahrlos üben, solange die Anwendung
noch leer ist: eine Sicherung ziehen, sie zurückspielen, nachsehen, dass der
Stapel wieder gesund ist.

```sh
sh scripts/backup.sh
SICHERUNG=$(ls -t /var/backups/gartenplaner/db-*.sqlite | head -1 | xargs basename)
echo "$SICHERUNG"
```

Dann den Ablauf aus [Wiederherstellung](#wiederherstellung) einmal ganz
durchgehen und am Ende prüfen:

```sh
docker compose ps                       # app healthy
curl -sI "https://$DOMAIN/" | head -1   # HTTP/2 403
```

Wer diesen Schritt überspringt, liest die Wiederherstellung zum ersten Mal an
dem Abend, an dem sie gebraucht wird.

**14. Einmal von Hand durchprüfen.**

```sh
curl -sI "http://$DOMAIN/" | head -2             # 301 auf https
docker compose exec app id -u                    # 1000, nicht 0
docker compose exec nginx cat /etc/nginx/conf.d/app.conf | grep -nE 'server_name|[$]host|[$]binary_remote_addr'
sh scripts/backup.sh                             # legt eine Datei an und meldet ok
```

In der gerenderten `app.conf` muss der echte Hostname stehen — **und** jede
nginx-eigene Variable unversehrt: `$host` in `proxy_set_header Host $host`,
`$binary_remote_addr` im Kopfkommentar. Steht dort `proxy_set_header Host ;`,
war `NGINX_ENVSUBST_FILTER` nicht auf `^DOMAIN$` begrenzt und `envsubst` hat
alles geleert, was mit `$` beginnt — die Ratenbegrenzung in `nginx.conf`
durchläuft `envsubst` nicht und bliebe davon unberührt, der Proxy wäre aber
kaputt.

### Sicherung

`scripts/backup.sh` läuft auf dem **Host** und braucht dort nur `docker` und
eine POSIX-Shell mit `sed` und `date`. `sqlite3` **und** `find` laufen im
Container. Der Ablauf:

1. Eine Sperre (`mkdir .backup.lock`) gegen zwei gleichzeitige Läufe. Sie
   teilten sich sonst dieselbe feste Temporärdatei im Volume.
2. Fail-Fast: läuft `app`, und gibt es `/data/db/db.sqlite` überhaupt? Das
   zweite ist nicht Zierde — `sqlite3 fehlt.sqlite ".backup '…'"` endet mit
   **0** und legt eine gültige, leere 4-KB-Datenbank an, deren
   `integrity_check` brav `ok` meldet. Ohne die Prüfung füllte sich das
   Verzeichnis mit Attrappen, und die Rotation löschte 31 Tage später die
   letzte echte Kopie.
3. `sqlite3 /data/db/db.sqlite ".backup '/data/db/backup.tmp'"` im Container.
   `.backup` statt `cp`, weil die Datenbank im WAL-Modus läuft: eine kopierte
   Datei ohne ihre `-wal`-Datei ist unvollständig, und zwar lautlos.
4. Kopie nach `/sicherungen/db-JJJJ-MM-TT-hhmmss.sqlite.teil`, also in
   `BACKUP_DIR` auf dem Host. **Erst unter `.teil`**: bricht der Lauf danach
   ab, liegt draussen nichts, was beim nächsten Wiederherstellen für eine
   vollständige Kopie gehalten würde. Sekunden im Namen, damit eine Sicherung
   von Hand nicht mit dem Cron-Lauf derselben Minute kollidiert.
5. `PRAGMA integrity_check` auf die Kopie — **und** ein Fingerabdruck aus drei
   Zahlen (Objekte im Schema, Mitglieder, Aufgaben), verglichen zwischen Quelle
   und Kopie. `integrity_check` allein genügt nicht: eine leere Datenbank ist
   strukturell einwandfrei.
6. Erst danach das `mv` auf den endgültigen Namen — innerhalb desselben
   Dateisystems atomar.
7. Rotation, im Container: `find /sicherungen -name 'db-*.sqlite*' -mtime +30
-delete`. Das Muster endet auf `*`, damit es auch `-wal`- und
   `-shm`-Beiwagen und eine liegen gebliebene `.teil`-Datei erwischt. Eine 31
   Tage alte Datei geht, eine 29 Tage alte bleibt.

**Warum die Rotation im Container läuft und nicht auf dem Host:** die Dateien
gehören der UID 1000, mit der der Container schreibt. Ein Cron-Benutzer mit
anderer UID scheiterte an `-delete` — und zwar erst _nach_ einer erfolgreichen
Sicherung, die `set -e` dann rot beendete. Ein rotes Skript nach getaner Arbeit
ist die unangenehmste Sorte Fehlalarm.

Die temporäre Datei liegt im Volume und nicht im Sicherungsverzeichnis, und
zwar in `/data/db/` und nicht in `/data/` — `/data` ist der Mountpunkt und
gehört `root`, der Container schreibt als `node`. Bricht der Lauf an irgendeiner
Stelle ab, räumt ein Trap Temporärdatei, `.teil`-Kopie und Sperre weg. Läuft
`app` nicht, endet das Skript sofort mit Meldung und ohne Sicherungsdatei.

Von Hand anstossen und nachsehen:

```sh
sh scripts/backup.sh
ls -lt /var/backups/gartenplaner | head
```

### Wiederherstellung

Den Namen der Sicherung zuerst in eine Variable, dann wird er genau einmal
getippt:

```sh
SICHERUNG=db-2026-08-27-020001.sqlite
ls -lt /var/backups/gartenplaner | head -3        # welche gibt es?
```

**Die Reihenfolge ist Absicht: erst prüfen, dann kopieren, zuletzt ersetzen.**
Eine Fassung, die mit `rm` beginnt, löscht bei einem Tippfehler im Dateinamen
die laufende Datenbank und schreibt nichts zurück — aus einem Bedienfehler
würde ein Totalverlust.

```sh
docker compose stop app
docker compose run --rm --no-deps --entrypoint sh -e SICHERUNG="$SICHERUNG" app -c '
  test -f "/sicherungen/$SICHERUNG" || { echo "Es gibt keine Sicherung $SICHERUNG."; exit 1; }
  sqlite3 "/sicherungen/$SICHERUNG" "PRAGMA integrity_check;" | grep -qx ok ||
    { echo "$SICHERUNG besteht den integrity_check nicht."; exit 1; }
  cp "/sicherungen/$SICHERUNG" /data/db/db.sqlite.neu &&
  chown node:node /data/db/db.sqlite.neu &&
  rm -f /data/db/db.sqlite /data/db/db.sqlite-wal /data/db/db.sqlite-shm &&
  mv /data/db/db.sqlite.neu /data/db/db.sqlite'
docker compose start app
docker compose ps
```

Schlägt eine der beiden Prüfungen an, endet der Container mit einer Meldung und
die alte Datenbank steht unberührt da — `docker compose start app` bringt dann
den Stand von vorher zurück. Nach einem erfolgreichen Lauf laufen die
Migrationen erneut über die wiederhergestellte Datei; das ist gewollt und
folgenlos, wenn die Sicherung denselben Stand der Migrationskette trägt.

**Ist das Volume ganz weg** (etwa nach `docker compose down -v`), legt Docker es
beim nächsten `up -d` leer neu an — und **`app` startet dann nicht**. Das ist
Absicht: das leere Volume ist ein root-eigener Mountpunkt ohne `/data/db`, und
`docker compose logs app` zeigt

```text
Das Verzeichnis für die Datenbank fehlt: /data/db
SQLite legt Verzeichnisse nicht selbst an. Erstelle es einmal, zum Beispiel
  mkdir -p /data/db
```

`docker compose ps` führt `app` als `Restarting`, und `nginx` startet gar nicht
erst, weil sein `depends_on` auf `service_healthy` steht. Der Ausfall ist damit
laut und sofort sichtbar, statt sich als leere Aufgabenliste zu tarnen.

Der Weg zurück, mit der Sicherung in der Hand:

```sh
SICHERUNG=db-2026-08-27-020001.sqlite
docker compose stop app
docker compose run --rm --no-deps --user root --entrypoint sh app -c '
  mkdir -p /data/db && chown node:node /data/db'
docker compose run --rm --no-deps --entrypoint sh -e SICHERUNG="$SICHERUNG" app -c '
  test -f "/sicherungen/$SICHERUNG" || { echo "Es gibt keine Sicherung $SICHERUNG."; exit 1; }
  cp "/sicherungen/$SICHERUNG" /data/db/db.sqlite &&
  chown node:node /data/db/db.sqlite'
docker compose up -d
```

**Ohne** Sicherung genügt der `mkdir`-Schritt allein: `app` startet dann mit
leerer Datenbank, die Migrationen legen die Tabellen selbst an, und
Schritt 11 des Runbooks (`create-admin`) ist wieder nötig — alle
Einladungslinks sind dann neu auszustellen.

### Erneuerung

Der `certbot`-Dienst ruft alle zwölf Stunden `certbot renew` auf; Let's Encrypt
erneuert innerhalb der letzten 30 Tage der Laufzeit. Die ACME-Prüfung läuft über
das geteilte Webroot-Volume, das nginx unter `/.well-known/acme-challenge/`
ausliefert — **vor** der Umleitung auf HTTPS, sonst folgte die Prüfung ins
Leere.

**nginx merkt davon nichts von selbst.** Es hat die Zertifikatsdateien beim
Start gelesen und hält sie offen. Darum die zweite Cron-Zeile aus Schritt 12:
ein wöchentliches `nginx -s reload` genügt bei 90 Tagen Laufzeit und 30 Tagen
Erneuerungsfenster mit grossem Abstand. Von Hand:

```sh
docker compose exec nginx nginx -s reload
```

Stand und Ablaufdatum nachsehen:

```sh
docker compose run --rm --no-deps --entrypoint certbot certbot certificates
docker compose logs certbot --tail 20
```

### Wenn etwas nicht startet

```sh
docker compose ps
docker compose logs app --tail 50
docker compose logs nginx --tail 50
```

- **`app` beendet sich sofort, das Log nennt einen deutschen Satz ohne
  Stacktrace.** Dann fehlt eine Pflichtvariable oder sie taugt nicht: die
  Meldung nennt sie beim Namen. `restart: unless-stopped` startet den Container
  erneut, und jeder Lauf schreibt denselben Satz — es gibt keinen
  Neustart-Sturm, aber auch keine Selbstheilung. `.env` korrigieren und
  `docker compose up -d` erneut.
- **`nginx` startet gar nicht.** Meist fehlt die Zertifikatsdatei — Schritt 6
  wurde übersprungen oder der Hostname in `.env` weicht von dem im Volume ab.
  `docker compose exec nginx nginx -t` sagt es genau.
- **`nginx` wartet ewig.** `depends_on … service_healthy`: solange `app`
  ungesund ist, startet nginx nicht. Erst das `app`-Log lesen.
- **Ein Update einspielen:** `git pull && docker compose up -d --build`. Die
  Migrationen laufen beim Start der Anwendung, es gibt keinen eigenen Schritt
  dafür.

### Benannte Kosten

- **Kein Staging.** Eine Änderung geht vom Entwicklerrechner direkt auf den
  einen Server. Bei zwanzig Nutzenden und einer SQLite-Datei ist das die
  richtige Grösse; wer mehr Sicherheit will, macht vorher eine Sicherung von
  Hand.
- **Der Entwicklerrechner ist arm64, der VPS amd64.** `docker compose build`
  lokal baut ein **anderes** Image als auf dem Server. Das ist unkritisch, weil
  `better-sqlite3` beide `prebuilds` mitliefert (`linuxmusl-arm64` und
  `linuxmusl-x64`) — aber ein lokal gebautes Image gehört **nicht** auf den VPS
  geschoben. Auf dem Server wird gebaut, Punkt.
- **Falls der VPS light das Bauen nicht trägt:** der Ausweg ist ein lokal für
  `linux/amd64` gebautes Image über eine Registry
  (`docker buildx build --platform linux/amd64 --push …`, dann in
  `docker-compose.yml` `build: .` durch `image: …` ersetzen). Eine
  Betriebsentscheidung, kein Architekturbruch — und bisher nicht nötig
  gewesen.
- **TLS-Handschlag und certbot sind lokal nicht prüfbar** und bleiben
  ausdrücklich ungetestet: sie brauchen einen von aussen erreichbaren
  Hostnamen. Lokal tritt das selbstsignierte Attrappen-Zertifikat an ihre
  Stelle, geprüft mit `curl -k`. Der erste echte Handschlag findet auf dem
  Server statt.
- **Die Sicherungen liegen auf derselben Maschine wie die Datenbank.** Der
  Verlust des VPS nimmt beide mit, alle 30 Kopien eingeschlossen. Die
  Wiederherstellung in diesem Runbook ist für den Volume-Verlust geschrieben —
  den überlebbaren Fall. Ein Kopieren an einen zweiten Ort wäre die
  naheliegende Ergänzung und ist bewusst nicht Teil dieser Story.
- **`SESSION_SECRET` ist nicht gesichert.** Es steht nur in `.env` auf dem
  Server. Wer die Datenbank auf einer neu aufgesetzten Maschine mit frischem
  Geheimnis wiederherstellt, entwertet damit jedes ausgestellte
  Sitzungs-Cookie: alle rund zwanzig Mitglieder sind ausgesperrt, und weil es
  keinen Anmeldevorgang gibt, hilft nur ein neuer Einladungslink für jede
  Person. Wer `.env` mitsichert, sichert das Geheimnis im Klartext mit — beides
  hat einen Preis, und keiner davon ist hier bezahlt.
- **Eine fehlgeschlagene Sicherung meldet sich bei niemandem.** Kein `MAILTO`
  in der crontab, keine Prüfung, ob die jüngste Kopie von heute Nacht ist. Das
  Log wird genau einmal angesehen — am Morgen nach Schritt 12 —, und danach
  nie wieder. Eine seit Wochen stumm scheiternde Sicherung fiele erst in dem
  Moment auf, in dem sie gebraucht wird.
- **Kein Autoheal.** `restart: unless-stopped` fasst einen Container an, der
  _beendet_. Ein Prozess, der lebt, aber am Healthcheck scheitert, bleibt
  `unhealthy` stehen — Docker startet ihn von sich aus nicht neu. `nginx`
  antwortet dann mit 502, und jemand muss hinsehen.
- **Keine Firewall und keine Systemhärtung im Runbook.** Kein `ufw`, kein
  `fail2ban`, keine SSH-Härtung. Dazu eine Falle, die man kennen muss: Dockers
  eigene iptables-Regeln hängen sich vor `ufw`, ein veröffentlichter Port ist
  also auch dann offen, wenn `ufw` ihn zu sperren scheint. Bewusst nicht Teil
  dieser Story, aber kein Grund, es für erledigt zu halten.
- **Keine Content-Security-Policy.** nginx setzt HSTS, `X-Frame-Options`,
  `X-Content-Type-Options` und `Referrer-Policy` — keine CSP. Das ist eine
  Auslassung, keine Vergesslichkeit: die Anwendung lädt nichts von fremden
  Hosts, und eine CSP ohne einen Anlass, sie zu pflegen, veraltet zum
  wirkungslosen Kopfzeilentext. Der Kommentar am Kopfzeilenblock in
  `nginx/templates/app.conf.template` sagt dasselbe an Ort und Stelle.
- **Ein Upstream-Fehler auf `/i/` schreibt den Pfad weiterhin ins
  Fehlerprotokoll.** `access_log off` und `limit_req_log_level info` decken das
  Zugriffsprotokoll und die Ratenbegrenzung ab; einen Verbindungsfehler zu
  `app:3000` protokolliert nginx auf `error`-Ebene mit vollem Request. Der Fall
  setzt voraus, dass die Anwendung ohnehin am Boden liegt, und ist damit
  benannt statt behoben.

## Skripte

| Skript                      | Zweck                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Entwicklungsserver mit Hot Reload.                                                                                   |
| `npm run build`             | Produktionsbau nach `build/` über `adapter-node`.                                                                    |
| `npm run preview`           | Vites Vorschau des vorhandenen Baus — zum Anschauen, nicht zum Betreiben.                                            |
| `npm start`                 | Produktionsstart: `node build/index.js`.                                                                             |
| `npm run check`             | `svelte-check` mit `--fail-on-warnings`, dann `tsc -p tsconfig.scripts.json` für `scripts/` und `drizzle.config.ts`. |
| `npm run gate`              | Prüft die neun Regeln des Gestaltungsrahmens und der Schichtgrenze (siehe unten).                                    |
| `npm run gate:selftest`     | Richtet das Tor auf `scripts/gate-fixtures/` und beweist, dass jede der neun Regeln beisst.                          |
| `npm run db:generate`       | Erzeugt die nächste Migration aus `schema.ts` nach `drizzle/`. Braucht `DATABASE_PATH`.                              |
| `npm run db:check`          | Führt `drizzle.config.ts` aus und vergleicht `schema.ts` mit `drizzle/`.                                             |
| `npm run db:check:selftest` | Richtet `db:check` auf `scripts/db-check-fixtures/` und beweist, dass es beisst.                                     |
| `npm run create-admin`      | Legt das erste Admin-Mitglied an und gibt seinen Einladungslink genau einmal aus.                                    |
| `npm run smoke`             | Führt die Zusagen der Zugangsschicht aus und prüft sie (siehe unten).                                                |
| `npm run lint`              | `prettier --check`, `eslint`, `gate`, `gate:selftest`, `db:check`, `db:check:selftest`, `smoke`.                     |
| `npm run format`            | Schreibt die Formatierung mit Prettier.                                                                              |

Ein Skript steht nicht in dieser Tabelle, weil es kein npm-Skript ist:
`sh scripts/backup.sh` zieht eine Sicherung der SQLite-Datei aus dem
Compose-Stapel. Es läuft auf dem Server per Cron und braucht dort einen
laufenden `app`-Container — siehe [Sicherung](#sicherung).

Das Qualitätstor vor jeder Abgabe:

```sh
npm run build && npm run lint && npm run check
```

Dazu kommt der Blick von Hand auf `/` bei 375px Breite, in Hell und in Dunkel.
Es gibt bewusst kein Testframework — deshalb muss das Tor sich selbst prüfen
(`npm run gate:selftest`), und deshalb führt `npm run smoke` die Zusagen der
Zugangsschicht aus statt sie zu behaupten.

### Zwei Typprüf-Programme

`.svelte-kit/tsconfig.json` deckt nur `src/**`. `scripts/create-admin.ts` und
`drizzle.config.ts` lägen damit aussen, und ein umbenanntes Feld in
`queries/members.ts` fiele nicht auf — der erste Admin entstünde still **ohne**
Adminrechte, weil ein unbekanntes Feld auf den SQL-Vorgabewert `false`
zurückfällt. Darum gibt es `tsconfig.scripts.json`, und `npm run check` ruft
beide.

Importe unter `src/lib/server/`, in `src/hooks.server.ts` und in
`src/routes/i/[token]/+server.ts` tragen die Endung `.ts` und stehen relativ,
nicht über `$lib`: `scripts/create-admin.ts` und `scripts/smoke-zugang.ts` laden
dieselben Dateien mit nacktem Node, und Node löst weder `$lib` noch eine
`.js`-Endung auf eine `.ts`-Datei auf. Dafür steht
`allowImportingTsExtensions: true` in beiden Programmen.

## Gestaltungsrahmen

Jeder Farb-, Grössen-, Radius- und Abstandswert steht als CSS Custom Property im
`:root`-Block in `src/app.html`, einmal für Hell und einmal für Dunkel.
Komponenten lesen jeden Wert über eine Custom Property und nie mit Fallback.
Die Schriften Figtree und Inter kommen aus `@fontsource-variable/*` und werden
in `src/lib/styles/fonts.css` eingebunden — zur Laufzeit geht keine Anfrage an
einen fremden Host.

Die Werte kommen aus
`_bmad-output/planning-artifacts/ux-designs/ux-Gartenplaner-2026-08-26/DESIGN.md`.
Bei Widerspruch gewinnt diese Datei.

### Was `npm run gate` prüft

`scripts/gate.mjs` liest jede Datei als Ganzes, nie zeilenweise, und blendet
CSS-Kommentare vorher aus. Zwölf Regeln:

1. In `.svelte` und `.css` unter `src/` kein Farbliteral — weder Hex noch
   `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color(` noch ein CSS-Farbname —,
   kein rohes `px`/`rem`-Literal ausser `0` und **kein rohes `ms`/`s`-Literal
   ausser `0`** im Wert von `transition`, `animation` und deren
   `-duration`/`-delay`-Langformen. Der Zeitteil kam mit Story 1.4 dazu: die
   Anwendung hat genau **eine** Animation (140ms, der Übergang der
   Aufgabenzeile), und der Massteil prüfte nur `px` und `rem` — ein hartes
   `140ms` wäre durchgekommen und `--duration-quick` von seinem ersten Tag an
   umgehbar gewesen. In `.html` unter `src/` gilt
   der Farbteil der Regel: `src/error.html` trägt Gestaltungswerte, die vorher
   keine Regel gelesen hat, und ihre Masse müssen dort als Zahl stehen, weil die
   Seite keinen Zugriff auf den Token-Block hat. **Systemfarben** (`Canvas`,
   `CanvasText`, `GrayText` …) zählen mit zur Farbsprache: in einer Komponente
   sind sie immer falsch, in `.html` ist nur die Auswahl `Canvas`/`CanvasText`
   zugelassen. `src/error.html` ist ausschliesslich in Systemfarben gestaltet —
   ohne diese Erweiterung wurde die eine Datei, für die die Regel ausgedehnt
   wurde, auf eine Wertform geprüft, die sie nicht benutzt. Damit ist auch das
   Verbot von `GrayText` eine Regel und keine Prüfung von Hand mehr.
   Ausgenommen ist allein der Token-Block in `src/app.html`; die Bedingung einer
   Medienabfrage ist ausgenommen, weil sie keine Custom Property lesen kann.
2. Kein `var()` mit Fallback-Wert. Der Fallback verdeckt genau Regel 3.
3. Jedes in `src/` benutzte `var(--x)` ist im `:root`-Block von `src/app.html`
   deklariert. Der Block wird per Klammertiefe geschnitten: eine Erwähnung in
   einem Kommentar oder eine Deklaration in einem anderen Selektor zählt nicht.
4. Beide Richtungen: jedes Farb-Token aus `:root` hat einen Wert im
   Dunkel-Block, und kein Token existiert nur im Dunkel-Block. Ein fehlender,
   leerer, doppelter oder unbalancierter Dunkel-Block ist selbst eine
   Verletzung.
5. Die `theme-color`-Metas und `theme_color`/`background_color` in
   `static/manifest.webmanifest` stimmen mit `--accent` beziehungsweise
   `--surface-base` überein, Schreibweise unerheblich.
6. Jeder Icon- und Manifest-Pfad aus `src/app.html` und aus dem Manifest zeigt
   auf eine Datei, die unter `static/` existiert.
7. Für jede `.svelte`-Datei liefert `eslint --print-config` mindestens so viele
   `svelte/*`- und `@typescript-eslint/*`-Regeln, wie die Plugins in ihren
   `recommended`-Arrays führen. Die Schwellen werden aus den Plugins abgeleitet,
   nicht im Skript festgeschrieben.
8. Tokens, die nirgends benutzt werden, sind ein Hinweis und kein Fehler — sie
   dürfen für spätere Stories reserviert sein.
9. Unter `src/routes/` kein Import von `drizzle-orm`, keiner von
   `better-sqlite3` und keiner des Datenbank-Handles — weder als
   `$lib/server/db` noch als `$lib/server/db/index` noch über einen relativen
   Pfad auf `db/index.ts`. Datenzugriff läuft ausschliesslich über die benannten
   Funktionen aus `src/lib/server/db/queries/*.ts`. Die drei Pfadformen werden
   auf dieselbe Modulform zurückgeführt, statt jede einzeln zu suchen — sonst
   fehlt die dritte. `better-sqlite3` gehört dazu, weil eine Route, die den
   Treiber selbst öffnet, eine zweite Verbindung ohne WAL, ohne `busy_timeout`
   und ohne Migrationsstand hätte. Ein reines `import type { … }` ist
   **ausgenommen**: TypeScript löscht die Anweisung beim Bauen, es entsteht kein
   Modulaufruf, und eine Route darf einen Zeilentyp benennen. Eine Gegenprobe
   hält diese Richtung fest.
10. Jede `.css` unter `src/lib/styles/` wird von mindestens einer Datei unter
    `src/routes/` importiert. Ein Stilblatt, das niemand einbindet, ist für
    eslint, svelte-check und vite build vollständig unsichtbar: die Datei ist
    gültig, sie wird nur nie geladen. Belegt hat das die gelöschte Importzeile
    von `bedienelemente.css` — gate blieb grün, während alle 44px-Trefferfelder
    aus der Auslieferung fielen.
11. Jedes `action="?/name"` im Markup unter `src/routes/` hat einen
    gleichnamigen Eintrag in der `actions` der Nachbar-`+page.server.ts`. Ein
    verschriebener Name passiert `check`, `eslint` und `smoke` grün, und der
    Knopf tut am laufenden Server nichts. Die Form `action="/pfad?/name"` deutet
    die Regel bewusst nicht.
12. In keinem HTML-Kommentar unter `src/` steht eine SvelteKit-Marke wie
    `%sveltekit.head%`. Die Ersetzung fragt nicht, wo die Marke steht; der
    eingesetzte Kopfbereich bringt eigene Kommentarmarken mit, und deren Ende
    schliesst den umgebenden Kommentar vorzeitig. Gefunden hat das kein
    Werkzeug, sondern das Auge des Users.

Kommentare werden vor jeder Auswertung ausgeblendet: Block- und
HTML-Kommentare überall, **Zeilenkommentare nur dort, wo `//` wirklich ein
Kommentar sein kann** — also nie in `.css` und nie in einem `<style>`-Block.
Die Zeilenregel wird gebraucht, damit ein auskommentierter Import unter
`src/routes/` keinen falschen Verstoss gibt; sie über CSS zu ziehen war eine
Regression und ist gemessen: `url(//cdn.example.com/x.png); color: #ff0000;` in
einer Zeile liess Regel 1 schweigen, weil der Zeilenrest samt Farbliteral
geleert wurde. Die Probe `regel-1b-doppelschraegstrich-in-url` hält beide
Richtungen fest.

Jeder Lesefehler und jeder Fehlschlag eines Unterprozesses wird als benannte
Verletzung gemeldet, nie als Stacktrace.

`npm run gate:selftest` richtet das Tor auf `scripts/gate-fixtures/`. Dort liegt
je ein Kleinprojekt mit einer absichtlichen Verletzung pro Regel, darunter ein
von Prettier über drei Zeilen umbrochenes `var()` mit Fallback, ein `rgb()`, ein
Hex in einer `.css`, ein Hex in `src/error.html`, ein nur in einem Kommentar
erwähntes Token, ein nur im Hell-Block deklariertes Farb-Token, ein
unbalancierter Dunkel-Block, eine abweichende Manifest-Farbe, ein nicht
existierender Icon-Pfad, eine `eslint.config.js` mit dem No-op
`...configs.recommended.rules` — und **je eine Probe pro verbotener Importform**
der Regel 9.

Dazu kommen **Gegenproben**, die beweisen, dass die Regeln nicht zu weit
greifen: erlaubte Importe unter `src/routes/` (Abfragefunktion über Alias und
über relativen Pfad, dazu ein reines `import type`) müssen null Treffer geben;
`Canvas` und `CanvasText` in `src/error.html` dürfen nicht fallen; ein
Farbliteral hinter einer `//`-Adresse in derselben Zeile muss weiterhin fallen;
und im Zeitteil der Regel 1 dürfen `var(--duration-quick)`, eine Null mit
Einheit, eine Zahl **ohne** Einheit im Wert einer Bewegungs-Eigenschaft (die
Wiederholungszahl einer Animation), `transition-property` und `cubic-bezier`
nicht fallen.
Eine zu breite Regel bliebe ohne sie im Selbsttest grün und fiele erst als
rätselhafter Verstoss im echten Baum auf.

Jede Probe trägt ihre erwartete **Trefferzahl** samt Begründung, nicht bloss
„mindestens einer". Vorher hing Regel 9 an einem einzigen Treffer je Probe: die
Hälfte der Regel hätte still wegfallen können, während der Selbsttest weiter
„jede Regel beisst" meldete. Die Begründung zählt auf, welche Verletzungen die
Zahl zusammensetzen — eine nackte Zahl liesse sich beim nächsten roten Lauf
bequem hochsetzen, statt zu fragen, woher der zusätzliche Treffer kommt. Das Verzeichnis steht in `.prettierignore`, in den `ignores` von
`eslint.config.js` und im `exclude` von `tsconfig.scripts.json`: die Proben sind
absichtlich kaputt und dürfen nicht formatiert, gelintet oder typgeprüft werden.

### Was `npm run smoke` prüft

`scripts/smoke-zugang.ts` legt eine Datenbank in einem Wegwerfverzeichnis an,
ruft den echten `handle`-Hook und die echte Einlöseroute mit nacktem Node und
legt über hundert Behauptungen ab: `locals.mitglied` ist gesetzt und trägt die
Hash-Spalte **nicht**, das Cookie wird gleitend erneuert und trägt `httpOnly`,
`sameSite=lax`, `path=/`, ein Jahr `maxAge` und `secure`, ein zweites Gerät
funktioniert mit demselben Token, ein Widerruf wirkt auf eine **bereits lebende**
Sitzung, die Fälle ohne Zugang sind ununterscheidbar, der vorgeschriebene Satz
steht im gerenderten `<h1>`, `Referrer-Policy` steht auch auf der
tokentragenden Antwort, `handleError`, `startPruefen` und der `init`-Hook werden
**ausgeführt**, `sitzungsgeheimnisPruefen()` weist leer, 31 Zeichen und 32
gleiche Zeichen ab, `create-admin` legt `is_admin = 1` an, nimmt den Namen aus
allen Argumenten, weist einen zweiten Lauf und ein `ORIGIN` mit Pfad oder
Fragment ab, und in `members` steht nirgends ein Klartext-Token.

Seit Story 1.3 fährt das Skript zusätzlich die Routenmodule von `/verwaltung`
und `/mehr` direkt, mit gesetztem `locals.mitglied` und mit **echten**
Formulardaten (`POST` mit `FormData`, damit `await request.formData()` in der
action wirklich etwas zu parsen hat). Belegt sind dort: ein Nicht-Admin bekommt
auf die `load` **und** auf jede der drei actions `303` auf `/` und ändert dabei
nichts; `aufnehmen` legt `is_admin = 0`/`is_active = 1` an und gibt den Klartext
genau einmal heraus, während in der Datenbank dessen Hash steht und der Klartext
in **keiner** Datenbankdatei vorkommt (die Suche geht über `smoke.sqlite` **und**
`-wal`, sonst fände sie auch den Hash nicht); ein Name aus Leerzeichen ergibt
`400`, legt kein Mitglied an und lässt kein Token nach draussen; `neuAusstellen`
ersetzt den Hash derselben Zeile, der alte Link wird danach mit `403`
abgewiesen und der neue mit `303` eingelöst; `widerrufen` setzt `is_active = 0`
und lässt Name und Hash stehen; Selbstwiderruf und Selbst-Neuausstellen ändern
nichts; und eine fehlende, nicht numerische, unbekannte oder schon beendete
`mitgliedId` ergibt in beiden actions denselben Satz, ohne die Tabelle
anzufassen. Zuletzt wird jeder Token-Hash aus `members` im Rückgabewert beider
`load`-Funktionen gesucht — gefunden wird keiner.

Seit Story 1.4 fährt es zusätzlich `src/routes/+page.server.ts` — `load` und
beide actions. Belegt sind dort: die `load` gibt genau die offenen Aufgaben,
**älteste zuerst** (die drei Vorbereitungszeilen werden ausdrücklich nicht in der
Reihenfolge ihres `created_at` eingefügt, sonst wäre eine Sortierung nach der Id
grün); in den Seitendaten steht weder ein `completed`-Feldname noch der
Zeitstempel eines Erledigten; `abhaken` gelingt auch für ein Mitglied **ohne**
Adminrechte, setzt `completed_by` auf dessen Id und `completed_at` auf jetzt, und
die Zeile fehlt danach in einer frischen `load`; ein **zweites** `abhaken` auf
dieselbe Zeile ergibt `400` und lässt den ersten Abhakenden unverändert — das ist
das Wettrennen zweier gleichzeitiger Abhaker, entschieden in der `where`-Klausel;
`wiederOeffnen` leert beide Spalten, auch für jemanden, der nicht abgehakt hat,
und die Zeile steht danach wieder an ihrem Platz nach `created_at`; und eine
fehlende, nicht numerische, unbekannte `aufgabeId` sowie der falsche
Erledigt-Zustand ergeben in **beiden** actions denselben Satz, ohne die Tabelle
anzufassen.

**Sieben** Behauptungen über `src/routes/+page.svelte` sind ausdrücklich
**Textprüfungen** und kein ausgeführter Nachweis. Zwei stammen aus Story 1.4:
dass der `use:enhance`-Rückruf `update({ reset: false, invalidateAll: false })`
ruft, und dass die Seite kein `<label>` trägt. Fünf kommen mit Story 2.2 dazu und
sind unten im Überfälligkeitsblock beschrieben. Alle sieben Zusagen hängen an
genau einer Textstelle und wären sonst still zu brechen — die Svelte-Schicht
deckt in diesem Projekt keine ausgeführte Prüfung. Alle laufen auf der Datei
**ohne Kommentare**: die Komponente erklärt an jeder dieser Stellen wörtlich, was
dort zu stehen hat, und auf dem Rohtext hätten sich die Behauptungen an der
eigenen Begründung erfüllt. Gemessen.

Seit Story 1.5 kommt `src/routes/aufgabe/+page.server.ts` dazu — die eine action
`ablegen`, gefahren mit einem Ereignis **ohne** `locals.mitglied`, weil sie keine
Identität liest. Belegt sind dort: ein Versand mit Leerraum vorn, hinten und
doppelt in der Mitte legt genau **eine** Zeile mit gefaltetem Text an, deren
`created_at` in Unix-Sekunden bei jetzt liegt und deren Erledigt-Spalten leer
sind, und leitet mit `303` auf `/?abgelegt`; die neue Aufgabe steht danach als
jüngste am Ende der `load` von `/`, die `abgelegt: true` **nur** mit dem
Parameter gibt und keinen Satz mitliefert; ein leeres Feld, reiner Leerraum,
reine Nullbreiten-Zeichen, Umbruch mit Tabulator, ein fehlendes Feld und ein
**Blob statt eines Strings** ergeben alle `400` mit `feld: 'text'`, demselben Satz
und unveränderter Zeilenzahl, während die Eingabe unverändert zurückkommt; genau
200 Codepoints gehen durch, 201 nicht, und 200 Buchstaben plus ein Emoji sind
201 — mit `.length` statt `[...text]` wäre diese Zeile grün geblieben; ein Text
**mit** einem Nullbreiten-Zeichen darin, der lesbar bleibt, geht als Gegenprobe
durch und steht gesäubert in der Tabelle.

Elf weitere **Textprüfungen** stehen dort, aus demselben Grund wie die sieben der
Startseite — die Svelte-Schicht deckt kein ausgeführtes Werkzeug, und diese
Zusagen hängen an genau einer Textstelle:

- **die Verdrahtung des Formulars** auf `/aufgabe`: `name="text"`,
  `value={eingabe}`, `aria-describedby` auf `text-fehler`, das `id="text-fehler"`
  am Satz und `use:enhance={versand}` am Formular. Benennt man das Feld um,
  endet **jeder** Versand mit `400` — und ohne diese Zeile bliebe die ganze
  Prüfliste grün, weil die Behauptungen ihr `FormData` selbst bauen.
- **die Never-Zusagen** derselben Seite: sichtbare `<label for="text">` mit Text,
  kein `placeholder`, kein Zurück-Knopf und kein Zurück-Link, kein `<textarea>`,
  genau ein Eingabefeld, genau ein `button-primary`.
- **der Fehlersatz ist eine immer vorhandene Live-Region** und nicht bedingt
  gerendert.
- **die Doppelsperre** ist vollständig: `imFlug`, `cancel()` und
  `disabled={imFlug}` am Knopf — die drei zusammen sind die Sperre, einzeln
  nicht.
- **das `maxlength` am Feld** wird gegen `TEXT_HOECHSTLAENGE` aus der Route
  gehalten. Die Zahl steht zweimal; ohne dieses Band bliebe das Attribut beim
  nächsten Ändern der Grenze stehen.
- **keine Identität** auf `/aufgabe` — weder in der Komponente noch in der
  `+page.server.ts` kommt `locals`, ein Mitglied oder eine Zuständigkeit vor.
- **der `+ Aufgabe`-Anker ist verortet**, nicht bloss gezählt: der `{#if}`-Block
  des Pools wird klammerbalanciert geschnitten, und darin darf kein
  `button-primary` stehen. Schöbe man den Anker in den `{:else}`-Zweig, zählte
  weiter genau einer und der leere Pool stünde wieder ohne Knopf da.
- **`/` trägt genau einen `button-primary`.** „Höchstens ein primärer Knopf pro
  Seite" war bis hierher eine Prüfung von Hand, die kein Werkzeug kennt — auch
  `gate` nicht.
- **die Meldungsregion trägt `tabindex="-1"` und `bind:this`** in einer
  Behauptung: ohne das erste ist `focus()` ein stiller Leerlauf.
- **`Abgelegt.` hängt an `form === null` und `data.abgelegt`**, und der
  `abgehakt`-Zweig steht dahinter — ein vorhandenes `form` gewinnt gegen den
  Parameter.
- **der fokussierende `$effect`** hängt an demselben Wahrheitswert, prüft das
  gebundene Element, **bevor** er das Einmal-Flag verbraucht, und holt den Fokus.

Seit Story 2.1 kommt `src/routes/monatsplan/+page.server.ts` dazu — die `load`
und die eine action `ablegen`, ebenfalls mit einem Ereignis **ohne**
`locals.mitglied`. Belegt sind dort: `/monatsplan` ohne Cookie endet am Wächter
mit `403` (es gibt keine zentrale Liste geschützter Pfade, jede Route bringt
ihre eigene Zeile mit); die `load` gibt **genau ein** Feld, und die Vorgabe ist
der letzte Tag des laufenden Monats als `JJJJ-MM-TT`, unabhängig nachgerechnet
statt über dieselbe Funktion; ein Stapel aus drei Zeilen — eingefügt mit
Leerraum, Leerzeilen, einer Zeile aus reinen Nullbreiten-Zeichen und einem
Nullbreiten-Zeichen mitten im Wort — legt genau drei Zeilen mit **gefalteten**
Texten und **einem** gemeinsamen `due_at` an, das auf dem Tagesende in
Europe/Zurich liegt und nicht auf Mitternacht UTC, mit leeren Erledigt-Spalten
und einem `created_at` aus dem Schema, und leitet mit `303` auf `/?abgelegt=3`;
die `load` von `/` reicht `due_at` heraus, ohne dabei eine `completed`-Spalte
mitzunehmen — darauf rechnet der Überfälligkeitsblock weiter unten; zwölf Eingaben ergeben `400` **am richtigen Feld** und lassen die
Zeilenzahl unverändert (fehlende, leere, nur aus Leerraum oder Nullbreiten
bestehende Zeilen, ein fehlendes Feld, ein Blob statt eines Strings — und für
das Datum: fehlend, leer, `30.09.2026`, das unmögliche `2026-02-31`, ein Blob),
wobei alle fünf Datums-Abweisungen denselben Satz tragen; zwei Zeilen zu 201
Codepoints weisen den **ganzen** Stapel ab und der Satz nennt die Zahl der zu
langen Zeilen und die Grenze; 101 Zeilen ergeben `400` mit der `100` im Satz;
genau 200 Codepoints je Zeile und genau 100 Zeilen gehen durch; eine einzelne
Zeile leitet auf `/?abgelegt=1`; zwei wortgleiche Zeilen ergeben zwei Aufgaben;
und `/aufgabe` leitet unverändert auf das bare `/?abgelegt` und legt weiterhin
eine Zeile **ohne** Frist an. Dazu prüft `smoke` den Parameter selbst: `?abgelegt`
ohne Wert ergibt `1`, `?abgelegt=22` ergibt `22`, und ein Wort, eine Null, eine
negative Zahl oder eine Kommazahl fallen auf `1` zurück.

Die Zahl unter dem Textfeld ist **ausgeführt** belegt und nicht nur textlich:
`zeilenErkennen` kommt als Wert in das Skript, und 27 Zeilen — davon eine ganz
leere, eine aus Leerraum und eine aus einem Nullbreiten-Zeichen — ergeben 24.
Die drei leeren Zeilen sind absichtlich verschieden leer: mit nur einer ganz
leeren bliebe die Behauptung grün, wenn die Faltung aus `zeilenErkennen` fiele.
Das ist die eine Zahl, die ein Akzeptanzkriterium wörtlich nennt; die
Textprüfung daneben sagt nur, dass Zähler und action dieselbe Funktion rufen,
nicht was sie zählt.

Zwei Behauptungen fahren `aufgabenStapelAnlegen` **direkt** aus der
Repository-Schicht: ein leerer Stapel gibt die leere Liste zurück und legt nichts
an. Die action erreicht diesen Zweig nie — sie fängt den leeren Stapel schon ab —,
und genau darum hing die Wache an nichts; ohne sie bricht die Prüfliste heute mit
einem benannten Wurf ab (`values() must be called with at least one value`).
Gate-Regel 9 verbietet den direkten Zugriff nur unter `src/routes/`.

`src/lib/zeit.ts` ist ausserdem **ausgeführt** gedeckt, und das ist keine
Zierde: ersetzt man die zweistufige Versatzrechnung durch ein hartes
`annahme - 7200`, bleibt jede andere Behauptung grün — jedes sonst gefahrene
Datum liegt in der Sommerzeit, und `/monatsplan` wiese erst zwischen Ende
Oktober und Ende März jeden Plan mit `400` ab. Gefahren werden darum beide
Zonen, **beide** Umstellungstage, ein Schalttag und die Gegenprobe
(`2027-02-29` → `null`), jeweils gegen unabhängig gerechnete
`Date.UTC(…)`-Werte; `monatsendeAlsFeldwert` läuft an **festen**
Bezugszeitpunkten, darunter dem, an dem Zone und UTC in verschiedenen Monaten
stehen (31. August 2026, 22:30 UTC → `2026-09-30`). Die Behauptung über die
Vorbelegung misst zusätzlich **vor und nach** der `load` und lässt beide Werte
gelten — sonst wäre sie am letzten Tag eines Monats um 23:59:59 zufällig rot.

Achtzehn weitere **Textprüfungen** decken die Browserseite von `/monatsplan` und
`/mehr`, aus
demselben Grund wie die auf `/aufgabe` und `/`: je Schritt genau ein
`button-primary` (über die ganze Datei gezählt wären es zwei, und eine reine
Zählung liesse zwei Knöpfe in **einem** Schritt durchgehen — geschnitten wird
darum am `{:else}`); die Verdrahtung des Formulars mit literalem
`action="?/ablegen"`, `use:enhance` und den zwei versteckten Feldern
`faelligBis` und `zeilen`; die Never-Zusagen (kein `placeholder`, zwei sichtbare
Beschriftungen, genau ein `<textarea>`, kein Eingabefeld je Zeile, kein Anker,
kein dynamisches `action={…}`, kein Rot); das `×` ist ein echtes
`<button type="button">` mit einem Namen aus Zeilentext plus verborgenem
`, entfernen` und einer eigenen Kennung, an der der Fokusgriff hängt; der Zähler
ist **keine** Live-Region, liest dieselbe Funktion wie der Server und nennt die
Höchstzahl, statt nur den Knopf zu sperren; beide Felder sind über
`aria-describedby` beschrieben — das Textfeld über den Zähler — und markieren
sich über `aria-invalid`, wenn die Abweisung ihnen gilt; der Fehlersatz **ist**
eine Live-Region, steht immer im Markup **und wird quittiert**, sobald die
Person den Schritt wechselt oder eines der Felder anfasst (ohne das stünde ein
`role="alert"` über längst korrigiertem Inhalt); die Überschrift trägt
`tabindex="-1"` und `bind:this`, und der Schrittwechsel holt den Fokus; das
Entfernen der letzten Zeile lässt den Fokus **nicht** fallen, sondern gibt ihn an
das nachgerückte `×` oder an die Überschrift, unter der dann der leere Zustand
mit dem Weg hinaus steht; die Doppelsperre ist vollständig samt `try/finally`;
`Weiter` steht ausserhalb jedes Formulars und sperrt aus **allen drei** Gründen
(keine Zeile, mehr als `PLAN_HOECHSTZAHL`, kein brauchbares Datum); ein
`<noscript>` sagt, dass die Seite JavaScript braucht und was stattdessen geht;
der primäre Knopf des Prüfschritts
sperrt zusätzlich bei **null** verbliebenen Zeilen (die Doppelsperre-Behauptung
liest nur `disabled={imFlug` und bliebe grün, wenn der zweite Teil fiele — der
Knopf böte dann `0 Aufgaben ablegen` an); `Zurück zum Text` lässt den Text
stehen und bringt die entfernten Zeilen zurück, getragen von zwei Stellen
zugleich (`zurueck` wechselt nur den Schritt, `weiter` baut die Prüfliste jedes
Mal neu aus dem Textfeld); auf der ganzen Seite kommt keine
Identität vor; und auf `/mehr` steht `Monatsplan ablegen` **vor** dem
`{#if data.istAdmin}` — `Nichts zu verwalten.` ist fort.

Die geprüften Ausschnitte werden vorher auf einfache Leerzeichen geglättet und
der `$effect` wird am Bezeichner `fokusGeholt` gesucht statt an seiner Position:
ein reiner Formatierungslauf von Prettier oder ein zweiter Effekt darf die
Prüfliste nicht rot machen. Der Preis jeder Textprüfung ist benannt: sie belegt,
dass die Stelle **dasteht**, nicht, dass sie **wirkt**.

Seit Story 2.2 steht am **Ende** der Prüfliste der Überfälligkeitsblock, und die
Stelle ist Absicht: er sät Aufgaben mit Zeitstempeln von bis zu 60 Tagen, die
nach `created_at` **vor** allen bisherigen stehen — weiter oben eingefügt machte
er die vier Sortierbehauptungen mit ihren festen Id-Ketten rot, ohne dass an der
Sortierung etwas falsch wäre. Gemessen wird zweimal, und die zwei Messungen
haben verschiedene Aufgaben. Gegen `offeneAufgabenAuflisten` mit **fester** Uhr
läuft jede Zeile der Matrix auf die Sekunde genau: genau an der Schwelle keine
Zahl, eine Sekunde darüber `3`, in der vollen vierten Woche `4`, ohne Frist ab
`created_at`, mit Fälligkeit in der Zukunft nichts, nach der Fälligkeit `3` statt
`8` (`due_at` gewinnt über `created_at`), ein vertipptes Jahr ungekappt mit über
1800 Wochen, und eine erledigte Aufgabe steht gar nicht in der Liste. Gegen die
`load` von `/` läuft dieselbe Saat an der **echten** Uhr, und darum liegt dort
keine Behauptung an einer Wochengrenze; die eine Zeile, die es nicht kann — genau
an der Schwelle —, trägt eine ausdrücklich benannte Toleranz: `null` ist die
einzige zugelassene Antwort, solange die Uhr nachweislich nicht getickt ist. Die
sieben Ids belegen zusätzlich, dass die Sortierung **nicht** auf Überfälligkeit
reagiert: sie laufen in der Einfügereihenfolge aufsteigend, ihre `created_at` in
einer anderen, und die zwei Zeilen ohne Zahl stehen mitten drin — „überfällige
zuerst" und „nach Id" sind beide rot. `wochenOffenSeit` läuft daneben direkt an
festen Zeitpunkten (Schwelle, eine Sekunde darüber, negative Differenz); zwei
Behauptungen gehen über den **ganzen Baum** und belegen, dass die Schwelle in
`src/` und `drizzle/` genau einmal deklariert ist und dass dort weder ein
`is_overdue` noch ein Timer vorkommt. Zwei Zeilen der Matrix — abgehakt und in
derselben Sitzung wieder geöffnet — sind Verhalten im Browser und stehen als
**Textprüfung** da, zusammen mit vier weiteren. Drei davon greifen ausdrücklich
**nicht** über die ganze Datei, sondern über einen geschnittenen Bereich: das
Formular mit `action="?/abhaken"` (dort muss `aria-describedby` stehen, im
wiederOeffnen-Formular darf es nicht vorkommen), der Spaltencontainer (der
Aufgabentext kommt vor dem `<p>`) und die zwei Regelrümpfe. Der Grund ist
gemessen: zwei Mutationen liefen grün durch die ganze Kette, solange die Suche
über die Datei ging — das verschobene `aria-describedby` landete an einem
Kästchen, an dem die Bedingung konstruktionsbedingt nie greift, und der
`{#if}`-Block liess sich über den Aufgabentext heben. Die vierte hält die
Gestaltung fest: ein `<p>` in `var(--overdue)` und in der meta-Rolle, kein
Abzeichen, und der Aufgabentext bleibt allein in dem Element, auf das
`aria-labelledby` zeigt.

**Was die Vergleiche vergleichen.** Die Fehlerseiten kommen über SvelteKits
**eigene** aus `src/error.html` erzeugte Vorlage (`svelte-kit sync` läuft dazu am
Anfang). Der Abdruck eines Fehlerfalls besteht aus Status, allen Kopfzeilen, den
Rumpfbytes **und jeder Nebenwirkung, die an der Wurfstelle aufgezeichnet wurde**
— Cookie-Setzungen samt Optionsobjekt und jeder `setHeaders`-Aufruf. Ohne diesen
letzten Teil wäre der Abdruck eine reine Funktion über Status und Satz, beides
vorher schon einzeln behauptet, und der Vergleich nur ein Zweitsymptom. Mit ihm
fällt ein `setHeaders` an **einer** der beiden Wurfstellen auf.

Aus demselben Grund zählt die Attrappe ein **eingehendes** Cookie nicht als
Setzung: sonst wäre die Schwelle der gleitenden Erneuerung schon durch die
Vorbereitung erfüllt.

**Die Attrappe verhält sich wie das Original.** Alles, was Produktionscode aus
dem Ereignis oder aus `cookies` herausnehmen darf — `setHeaders`, `get`, `set`,
`delete` — liegt als gebundene eigene Eigenschaft auf der Instanz, nicht als
Prototyp-Methode. SvelteKit baut diese Objekte mit eigenen Funktionen, weshalb
`export async function GET({ params, cookies, setHeaders })` dort idiomatisch
ist; mit Prototyp-Methoden hätte eine so geschriebene Route das Prüfskript mit
einem `TypeError` zum Absturz gebracht, statt geprüft zu werden. Gemessen.

**Ein unerwarteter Wurf ist ein Befund, kein Absturz.** Ein Rahmen um die
Prüfliste übersetzt jeden Wurf in eine benannte Verletzung samt einer einzelnen
beschrifteten Fundstelle, räumt die Wegwerfverzeichnisse weg und endet mit 1 —
dasselbe Versprechen, das `scripts/gate.mjs` schon gibt. Die Schlusszählung
sagt dann, wie viele Behauptungen noch gelaufen sind.

Nicht abgedeckt ist `respond.js`, die Schicht, die den Wurf in die Vorlage
überführt, Kopfzeilen anhängt und Cookies ausliefert. Ihr Verhalten ist am
laufenden Server gemessen und in der Spezifikation festgehalten; im Skript steht
darüber ausdrücklich keine Behauptung. Die Empfehlung, das Skript stattdessen
gegen einen echten Server zu fahren, ist für eine spätere Story notiert.

Am Ende zählt das Skript, wie viele Behauptungen tatsächlich gelaufen sind, und
vergleicht mit einer festen Zahl. Eine Behauptung, die in einem `if`
stillschweigend ausfällt, fällt damit auf.

Der Grund für all das ist gemessen. Die Tabelle nennt nur Mutationen, die
**vorher grün** blieben — eine Mutation, die schon vorher rot war, beweist nichts
über die Prüfung, die dazukam:

| Mutation                                                        | War grün bis | Wird heute rot in                                                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `\|\| !mitglied.isActive` aus der **Einlöseroute** entfernt     | Iteration 2  | widerrufenes gespeichertes Token                                                                                                                                                                                           |
| `httpOnly: true` aus den Cookie-Optionen entfernt               | Iteration 2  | drei Cookie-Attribut-Behauptungen                                                                                                                                                                                          |
| Wächter schlägt jedes Mitglied nur einmal pro Prozess nach      | Iteration 2  | Widerruf einer lebenden Sitzung                                                                                                                                                                                            |
| `secure: false` in den Cookie-Optionen                          | Iteration 3  | drei Cookie-Attribut-Behauptungen                                                                                                                                                                                          |
| die beiden Konstanten in `handleError` getauscht                | Iteration 3  | zwei `handleError`-Behauptungen                                                                                                                                                                                            |
| ein Aufruf in `startPruefen` in ein schluckendes `catch`        | Iteration 3  | `startPruefen` und der `init`-Unterprozess                                                                                                                                                                                 |
| `setHeaders` an **einer** der beiden 403-Wurfstellen            | Iteration 3  | Kopfzeilen-Behauptung und beide Abdrücke                                                                                                                                                                                   |
| `?? './data/dev.sqlite'` statt Fail-Fast in `drizzle.config.ts` | Iteration 3  | `db:check`, Prüfung Fail-Fast                                                                                                                                                                                              |
| ein Befund in `db:check` zur Warnung gemacht                    | Iteration 3  | `db:check:selftest`, zwei von drei Proben                                                                                                                                                                                  |
| Zeilenkommentare wieder in **jeder** Datei ausgeblendet         | Iteration 3  | `gate:selftest`, Probe `regel-1b`                                                                                                                                                                                          |
| `invalidateAll: false` aus dem Rückruf auf `/` entfernt         | Story 1.4    | die Textprüfung an `+page.svelte`                                                                                                                                                                                          |
| ein `<label>` um den Aufgabentext                               | Story 1.4    | die Textprüfung an `+page.svelte`                                                                                                                                                                                          |
| `completed_at IS NULL` aus `aufgabeAbhaken` entfernt            | Story 1.4    | zweites `abhaken`, der erste Abhakende                                                                                                                                                                                     |
| `completed_by` in die Projektion der offenen Aufgaben           | Story 1.4    | zwei Seitendaten-Behauptungen, `check`                                                                                                                                                                                     |
| ein rohes `140ms` in einem Komponenten-`<style>`                | Story 1.4    | `gate`, Regel 1                                                                                                                                                                                                            |
| die Längenprüfung aus `ablegen` entfernt                        | Story 1.5    | `smoke`, 201 Codepoints                                                                                                                                                                                                    |
| `returning()` statt `returning(sichtbareSpalten)`               | Story 1.5    | `check`, die Annotation `NurSichtbar`                                                                                                                                                                                      |
| `action="?/ablegen"` verschrieben                               | Story 1.5    | `gate`, Regel 11                                                                                                                                                                                                           |
| `name="text"` am Feld in `name="aufgabentext"` umbenannt        | Story 1.5    | `smoke`, die Verdrahtung des Formulars                                                                                                                                                                                     |
| `+ Aufgabe` in den `{:else}`-Zweig geschoben                    | Story 1.5    | `smoke`, die Verortung des Ankers                                                                                                                                                                                          |
| `tabindex="-1"` an der Meldungsregion entfernt                  | Story 1.5    | `smoke`, tabindex und bind:this                                                                                                                                                                                            |
| `maxlength` am Feld von der Konstante abgekoppelt               | Story 1.5    | `smoke`, das Band zur Längengrenze                                                                                                                                                                                         |
| die `load` von `/` liest `locals`                               | Story 1.5    | `smoke`, das werfende Ereignis                                                                                                                                                                                             |
| `dueAt` aus `sichtbareSpalten` entfernt                         | Story 2.1    | `check`, `satisfies` auf der Spaltenauswahl                                                                                                                                                                                |
| `action="?/ablegen"` auf `/monatsplan` verschrieben             | Story 2.1    | `gate`, Regel 11                                                                                                                                                                                                           |
| Tagesende durch Mitternacht UTC ersetzt                         | Story 2.1    | `smoke`, das gemeinsame `due_at`                                                                                                                                                                                           |
| `due_at` je Zeile um eins erhöht                                | Story 2.1    | `smoke`, das gemeinsame `due_at`                                                                                                                                                                                           |
| die Zeilenlängen-Prüfung aus `ablegen` entfernt                 | Story 2.1    | `smoke`, zwei Zeilen zu 201 Codepoints                                                                                                                                                                                     |
| `use:enhance` am Monatsplan-Formular entfernt                   | Story 2.1    | `smoke`, die Verdrahtung des Formulars                                                                                                                                                                                     |
| das `×` als `<span role="button">` statt als `<button>`         | Story 2.1    | `smoke`, das × ist ein echter Knopf                                                                                                                                                                                        |
| `zeilenListe.length === 0` aus dem Ablegen-Knopf entfernt       | Story 2.1    | `smoke`, der Knopf sperrt bei null Zeilen                                                                                                                                                                                  |
| `zurueck` setzt das Textfeld zusätzlich zurück                  | Story 2.1    | `smoke`, `Zurück zum Text`                                                                                                                                                                                                 |
| leere Zeilen fallen in `zeilenErkennen` nicht mehr weg          | Story 2.1    | `smoke`, die 24 aus 27 Zeilen                                                                                                                                                                                              |
| die Versatzrechnung in `zeit.ts` durch `annahme - 7200` ersetzt | Story 2.1    | `smoke`, Winterzeit und beide Umstellungstage                                                                                                                                                                              |
| `PLAN_HOECHSTZAHL` zurück in die Route statt ins geteilte Modul | Story 2.1    | `check`, der Import in der Komponente                                                                                                                                                                                      |
| die Datumssperre aus `weiterGesperrt` entfernt                  | Story 2.1    | `smoke`, `Weiter` sperrt aus drei Gründen                                                                                                                                                                                  |
| `quittiert = false` vor dem Versand entfernt                    | Story 2.1    | `smoke`, der Fehlersatz wird quittiert                                                                                                                                                                                     |
| der Fokusgriff in `entfernen` entfernt                          | Story 2.1    | `smoke`, das Entfernen lässt den Fokus stehen                                                                                                                                                                              |
| das `<noscript>` entfernt                                       | Story 2.1    | `smoke`, /monatsplan sagt es ohne JavaScript                                                                                                                                                                               |
| die Leerheits-Wache aus `aufgabenStapelAnlegen` entfernt        | Story 2.1    | `smoke`, unerwarteter Wurf aus `values([])`                                                                                                                                                                                |
| `aria-describedby` vom Zähler am Textfeld entfernt              | Story 2.1    | `smoke`, beide Felder sind beschrieben                                                                                                                                                                                     |
| das `<=` in `wochenOffenSeit` durch `<` ersetzt                 | Story 2.2    | `smoke`, `wochenOffenSeit` und die feste Uhr an der Schwelle (zwei Behauptungen; die dritte, an der echten Uhr, wird nur rot, wenn Saat und `load` in dieselbe Sekunde fallen — ihre benannte Toleranz lässt sonst `3` zu) |
| `dueAt ?? createdAt` auf `createdAt` verkürzt                   | Story 2.2    | `smoke`, drei Zeilen der Überfälligkeitsmatrix plus die `load`-Behauptung                                                                                                                                                  |
| `aria-describedby` aufs wiederOeffnen-Kästchen verschoben       | Story 2.2    | `smoke`, die formularweise geschnittene Beschreibungs-Behauptung                                                                                                                                                           |
| der `{#if istUeberfaellig}`-Block vor den Aufgabentext gestellt | Story 2.2    | `smoke`, die Reihenfolge im Spaltencontainer                                                                                                                                                                               |
| `flex-direction: column` aus `.zeile__spalte` entfernt          | Story 2.2    | `smoke`, der Rumpf der Spaltenregel                                                                                                                                                                                        |
| `min-width: 0` aus `.zeile__spalte` entfernt                    | Story 2.2    | `smoke`, der Rumpf der Spaltenregel                                                                                                                                                                                        |
| ein nackter `21 * 24 * 60 * 60` in `queries/tasks.ts`           | Story 2.2    | `smoke`, die Schwelle über den ganzen Baum                                                                                                                                                                                 |
| ein `setImmediate` in der Komponente                            | Story 2.2    | `smoke`, die Timer-Wache über `src/`                                                                                                                                                                                       |
| eine Spalte `ueberfaellig_seit` im Schema                       | Story 2.2    | `smoke`, das Spaltenverbot über Schema und Migrationen                                                                                                                                                                     |
| `!istErledigt` aus der Bedingung der zweiten Zeile entfernt     | Story 2.2    | `smoke`, die Überfälligkeitszeile                                                                                                                                                                                          |

`\|\| !mitglied.isActive` aus dem **Wächter** entfernt steht bewusst **nicht** in
der Tabelle: diese Mutation war schon vor Iteration 2 rot.

### Was `npm run db:check` prüft

Drei Prüfungen, und jede **führt etwas aus**, statt Text zu durchsuchen:

1. **Fail-Fast** — der Generator wird mit der echten `drizzle.config.ts` und
   ohne `DATABASE_PATH` aus einem Wegwerfverzeichnis gefahren. Erwartet wird ein
   Abbruch mit einer Meldung, die `DATABASE_PATH` benennt. Die frühere Fassung
   verglich die Datei mit zwei `includes`; ein erfundener Vorgabewert
   (`?? './data/dev.sqlite'`) liess beide passen und alles grün, obwohl der
   eingefrorene Block der Spezifikation genau das verbietet.
2. **Konfiguration** — die Datei wird geladen und ihr Ausfuhrwert gelesen:
   `dialect`, `schema` und `out` kommen von dort und nicht aus Konstanten im
   Prüfskript. `dialect` war vorher von gar keiner Prüfung gedeckt.
3. **Drift** — `drizzle/` wandert in ein Wegwerfverzeichnis, der echte Generator
   läuft darauf. Eine Spalte in `schema.ts` ohne `npm run db:generate` baute
   sonst grün durch und starb beim ersten Aufruf.

`npm run db:check:selftest` richtet das Skript auf `scripts/db-check-fixtures/`:
ein deckungsgleiches Projekt, das schweigen muss, ein Schema mit einer Spalte
ohne Migration, und eine Konfiguration mit erfundenem Vorgabewert statt
Fail-Fast. Jede Probe läuft als **Unterprozess**, damit der Exit-Code beobachtet
ist und nicht bloss die Befundliste — einen Befund zur Warnung zu machen liesse
sonst `lint` grün, während der Schutz aufhört zu greifen.

## Zugang und Fehlerseiten

Identität kommt ausschliesslich aus dem Einladungslink, nie aus einer Eingabe.
Es gibt kein Passwort, kein Login-Formular und keinen Registrierungsvorgang.

- **Ein Statuscode, ein Satz.** Kein Cookie, ein manipuliertes oder abgelaufenes
  Cookie, ein unbekanntes Token und ein deaktiviertes Mitglied führen alle auf
  403 mit `Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.` Status,
  Kopfzeilen und Rumpflänge sind in allen Fällen identisch — an keiner Stelle
  liesse sich ablesen, welcher Fall vorliegt.
- **Diese 403 erscheint ohne Rahmen.** Sie kommt aus `src/error.html`, nicht aus
  `src/routes/+error.svelte`: ein `error()` aus `handle` verlässt SvelteKit über
  `handle_fatal_error` → `static_error_page` und erreicht das Routing nie.
  Gemessen an 2.70.3. Das ist Absicht — eine Navigationsleiste mit vier Zielen,
  die alle auf dieselbe Abweisung führen, hilft niemandem.
- **Das Cookie bleibt auf dieser Antwort liegen** und wird nicht gelöscht:
  auf demselben Fatal-Pfad liefert SvelteKit keine `set-cookie`-Kopfzeile aus.
  Ohne Folge, weil Mitglied und `is_active` bei **jedem** Aufruf frisch aus der
  Datenbank kommen — ein liegengebliebenes Cookie öffnet nichts, und ein Widerruf
  wirkt beim nächsten Aufruf.
- `src/routes/+error.svelte` greift für Fehler **innerhalb** des Routings, etwa
  einen unbekannten Pfad bei gültiger Sitzung. Dort ist der Rahmen sichtbar. Die
  Auswahl des Satzes hängt dort an der **Meldung** aus dem Wurf und nicht am
  nackten Status: ein `status === 403 ? …` zeigte bei jeder künftigen 403 aus
  einer Route fälschlich „Dieser Link gilt nicht mehr", obwohl der Link tadellos
  gilt. `/verwaltung` ohne Adminrechte war der erwartete erste Fall dieser Art
  und ist es nicht geworden — dort wird weitergeleitet statt geworfen.
- Ein unbekannter Pfad bekommt seinen eigenen Satz — `Diese Seite gibt es nicht.`
  Ein 404 mit „Etwas ist schiefgelaufen" zu beantworten wäre eine Lüge, und der
  englische Vorgabetext `Not Found` keine Option: die Oberfläche ist durchgehend
  deutsch.
- Fünf Zustände, zwei Wurfstellen. Neben den vier Fällen der Matrix deckt der
  Wächter auch „Cookie gültig, Mitgliedszeile weg" ab — kein Weg der Anwendung
  löscht eine Zeile, ein Eingriff von Hand an der Datenbank erzeugt den Fall
  trotzdem. Die Aufstellung steht in `src/lib/texte.ts`.
- Jede aus dem Routing ausgelieferte Antwort trägt `Referrer-Policy: no-referrer`
  — die Identität steht im Pfad von `/i/<token>`. Die rahmenlose 403 entsteht
  aussen und trägt die Kopfzeile nicht; dafür steht in `src/error.html` ein
  `<meta name="referrer" content="no-referrer">`, und die Seite verweist auf
  nichts von draussen.

## Aufgaben sehen und abhaken

`/` ist die ganze Anwendung in einem Bild. Die Seite führt genau drei Blöcke in
dieser Reihenfolge — Diensthinweis, freie Einzelaufgaben, offener Pool. Die
ersten zwei kommen mit Epic 3 und rendern in diesem Stand nichts; die Reihenfolge
steht trotzdem schon, weil sie eine Entscheidung über die Aufmerksamkeit im
Garten ist und nicht eine Folge davon, in welcher Reihenfolge gebaut wurde.

Der dritte Block trägt unter der Marke `OFFEN` alle offenen Aufgaben, **älteste
zuerst**, vollständig und ohne Nachladen. Erledigte erscheinen nicht — auch nicht
durchgestrichen, auch nicht eingeklappt. Eine Zeile, die seit über drei Wochen
liegt, bekommt eine zweite Textzeile und bleibt im Übrigen unverändert an ihrem
Platz: siehe
[Überfällige Aufgaben erkennen](#überfällige-aufgaben-erkennen).

- **Ein Antippen erledigt.** Kein Formular, kein Statusfeld, kein Pflichtkommentar,
  kein Bestätigungsdialog, kein zweiter Knopf. Es ist das einzige
  Interaktionsmuster, das jede Person kennen muss.
- **Nur das Kästchen ist antippbar**, nicht die Zeile und nicht der Text. Sichtbar
  22px, Trefferfeld 44px über Innenabstand — ein Trefferfeld über die ganze Zeile
  würde im Beet, mit Handschuhen, versehentlich Aufgaben erledigen. Der
  Aufgabentext ist toter Text.
- **Das Kästchen ist ein echtes `<input type="checkbox">`** in einem Formular, kein
  `<div>` mit Klick-Handler. Seine Beschriftung entsteht über `aria-labelledby`
  aus dem sichtbaren Aufgabentext **und** einem verborgenen Verb: ein Screenreader
  liest `Beet 25 Nüsslisalat jäten, erledigen` mit der Rolle Kontrollkästchen.
  Bewusst **kein** `<label for>` — ein Label schaltet sein Bedienelement, und
  damit wäre der Text wieder antippbar. Diese Zusage gilt **auch** für eine
  überfällige Zeile: `seit N Wochen offen` hängt über `aria-describedby` als
  **Beschreibung** am Kästchen und liegt ausdrücklich nicht in dem Element, auf
  das `aria-labelledby` zeigt — sonst hiesse das Kästchen
  `Beet 25 Nüsslisalat jäten seit 4 Wochen offen, erledigen`.
- **Die Zeile bleibt an ihrem Platz stehen**, durchgestrichen und gedämpft,
  Kästchen gefüllt mit Haken. Sie verschwindet erst beim nächsten Laden — dann
  auch für alle anderen. So ist ein Fehlgriff sofort sichtbar. Der Preis dieser
  Entscheidung ist benannt: die Liste ist nach dem Antippen nicht mehr frisch, und
  das Abhaken ist die eine Mutation der Anwendung, die **kein** `invalidateAll()`
  auslöst.
- **Nochmaliges Antippen öffnet die Aufgabe wieder** und setzt `completed_by` und
  `completed_at` zurück auf leer.
- **Niemand sieht, wer abgehakt hat.** Nicht im Text, nicht als Titel-Attribut,
  nicht in einem `data-`Attribut und nicht in den Seitendaten. `completed_by` und
  `completed_at` werden trotzdem gesetzt. Das ist keine Zusage der Oberfläche,
  sondern eine Eigenschaft des Typs: `SichtbareAufgabe` in
  `src/lib/server/db/schema.ts` hat die zwei Spalten nicht, und jede Abfrage in
  `queries/tasks.ts` projiziert schon in der Datenbank ohne sie. Die Seite
  **kann** den Abhakenden nicht ausliefern, weil das Feld nicht existiert.
- **Aufgaben sind namenlos und haben keine Zuständigkeit im Voraus.** `tasks` trägt
  keine Spalte dafür, und jedes Mitglied darf jede Aufgabe abhaken. Namen an
  allem macht das Werkzeug zum Dienstplan und vertreibt die spontan Kommenden.
- **Ein Satz für vier Zustände.** Eine fehlende, eine nicht numerische, eine
  unbekannte `aufgabeId` und der falsche Erledigt-Zustand ergeben alle `400` mit
  demselben Satz. Der letzte Fall ist zugleich der Ausgang des Wettrennens: haken
  zwei Personen dieselbe Aufgabe im selben Moment ab, trifft das zweite `UPDATE`
  keine Zeile — die Vorbedingung `completed_at IS NULL` steht in der
  `where`-Klausel und nicht in der Route. Der erste Abhakende bleibt gespeichert,
  und der zweite erfährt nicht, welcher der Fälle vorlag.
- **Der Übergang in den durchgestrichenen Zustand dauert 140ms** und ist die
  einzige Animation der Anwendung. Er steckt in
  `@media (prefers-reduced-motion: no-preference)`: keine Bewegung ist der
  Standardfall, Bewegung die ausdrücklich eingeschaltete Ausnahme.
- **Unter dem Pool steht `+ Aufgabe`** — in **beiden** Zuständen, also auch
  unter `Nichts offen.`. Der Knopf ist ein `<a>` und kein `<button>`: er
  navigiert nur, er tut nichts. Er ist zugleich der einzige primäre Knopf dieser
  Seite; die Kästchen sind Kästchen.

## Eine Aufgabe erfassen

`/aufgabe` ist **ein Feld und ein Knopf**. Kein Fälligkeitsdatum, keine
Kategorie, kein Beet, keine Priorität, kein Zuständiger, kein zweites Feld: wer
im Beet steht und Blattläuse entdeckt, tippt einen Satz und ist fertig. Ein
einzeiliges `<input>` und kein `<textarea>` — eine Aufgabe ist ein Satz, kein
Absatz, und die Eingabetaste legt sie ab. Es gibt keinen Zurück-Knopf: eine
Formularseite schliesst mit ihrer Aktion, und die Systemgeste des Browsers
genügt.

- **Was geprüft wird, wird serverseitig geprüft**, in derselben Kette wie der
  Mitgliedsname: Nullbreiten-Zeichen entfernen, jede Folge von Leerraum zu einem
  Leerzeichen falten, trimmen, leer abweisen, Codepoints zählen. Gespeichert wird
  die **gefaltete** Fassung — aus `  Beet   25   jäten  ` wird `Beet 25 jäten`.
  Ein leeres Feld, reiner Leerraum, reine Nullbreiten-Zeichen, ein fehlendes Feld
  und ein Datei-Upload statt eines Textes fallen alle auf denselben Satz und
  legen **nichts** an. Das `maxlength` am Feld ist die Bequemlichkeit, die
  Prüfung in der action die Regel: ein POST braucht kein Feld.
- **Höchstens 200 Zeichen**, einschliessend gemeint und nach Codepoints gezählt
  (ein Emoji ist ein Zeichen, nicht zwei). `Tunnel 2 Blattläuse nachbehandeln`
  braucht 34; 200 lassen Raum für Ort und Zusatz und halten die Zeile in der
  Liste lesbar. Die Grenze steht in der Route und **nicht** als CHECK in der
  Datenbank: sie ist eine Auslegung von „eine Aufgabe ist ein Satz" und keine
  Eigenschaft der Daten — in einer Migration liesse sie sich nur noch mit einer
  Migration ändern.
- **Ein abgewiesener Versand sagt zweierlei auf einmal.** Die Feldkante wird
  breiter (`aria-invalid`), und darunter steht ein Satz, der über
  `aria-describedby` am Feld hängt: der Zustand hängt nicht allein an der Farbe.
  Die Kante ist ausdrücklich **nicht** rot — Rot ist in dieser Anwendung dem
  zerstörenden Knopf vorbehalten. Die Eingabe bleibt im Feld stehen.
- **Die Meldung reist als Query-Parameter.** Ein `redirect()` aus einer form
  action verwirft deren Rückgabewert; `ablegen` leitet darum mit `303` auf
  `/?abgelegt`, die `load` von `/` macht daraus einen **Wahrheitswert** (keinen
  Satz), und die Oberfläche setzt `Abgelegt.` — der Knopf trägt das Verb, die
  Meldung dasselbe Verb im Perfekt. Das ist das Flash-Muster dieser Anwendung:
  kein zweites Cookie neben dem Sitzungs-Cookie, kein Store, kein
  `+layout.server.ts`, und es funktioniert ohne JavaScript.
- **Die Live-Region auf `/` nimmt beim Ankommen einmalig den Fokus.** Eine
  Live-Region sagt nur _Änderungen_ an; nach dem Ablegen ist `/` frisch gemountet
  und `Abgelegt.` stünde von Anfang an stumm da. Genau einmal, genau in diesem
  Fall — und ausdrücklich **nicht** nach dem Abhaken, wo der Daumen auf dem
  Kästchen bleiben soll.
- **Ein Doppeltipp legt eine Zeile an, nicht zwei.** Dieselbe Sperre wie in den
  Stories 1.3 und 1.4: `disabled` am Knopf ist der sichtbare und der für die
  Tastatur wirksame Riegel, `cancel()` im `use:enhance`-Rückruf deckt das Fenster
  davor ab.
- **Niemandem zugeordnet.** Es gibt keine Spalte für einen vorab Zuständigen und
  keine für einen Erfassenden — auch nicht „von mir erfasst". Die action liest
  `locals` gar nicht.
- **`created_at` kommt aus dem Schema** (`$defaultFn`, Unix-Sekunden), nie aus der
  Einfügefunktion und nie aus der Route. `completed_by` und `completed_at`
  bleiben leer: eine neue Aufgabe ist offen.

## Den Monatsplan ablegen

`/monatsplan` ist die Massen-Eingabe: die monatlich wechselnde planende Person
überträgt ihre 20 bis 40 Aufgaben in **einem** Zug in den Pool, statt sie auf
Papier zu schreiben oder in den Gruppenchat zu stellen. Erreichbar über `/mehr`,
und ausdrücklich **nicht** über die Navigationsleiste: vier Ziele, und das hier
tut man einmal im Monat.

Die Messlatte ist eine einzige — wenn das Ablegen mehr Aufwand kostet als die
Papierliste, tut es die rotierende Person nicht. Deshalb gibt es **ein Textfeld
für den ganzen Plan und kein Feld pro Aufgabe**, keinen „Zeile hinzufügen"-Knopf
und keinen Editor pro Zeile.

**Zwei Schritte, eine Route.**

1. **Schreiben.** Oben `Fällig bis`, vorbelegt mit dem Ende des laufenden Monats,
   darunter ein mehrzeiliges Feld ab `16em` — eine Aufgabe pro Zeile, einfügbar
   aus einer Notiz oder aus dem Chat. Darunter läuft die Zählung mit
   (`24 Aufgaben erkannt`); leere Zeilen zählen nicht. Ein Knopf: `Weiter`,
   gesperrt, solange nichts erkannt ist.
2. **Prüfen und ablegen.** Die erkannten Zeilen als Liste, jede mit einem `×` zum
   Entfernen — **kein Bearbeiten pro Zeile**; wer ändern will, geht mit
   `Zurück zum Text` an die eine Stelle, an der das geht. Der Schritt existiert,
   weil beim Einfügen aus einem Chat Zeilen mitkommen, die keine Aufgaben sind.
   Der primäre Knopf trägt Verb und Zahl: `24 Aufgaben ablegen`.

Danach `303` auf `/` mit der Meldung im Perfekt desselben Verbs:
`22 Aufgaben abgelegt.`

- **Der Prüfschritt ist kein Server-Rundgang.** AD-9 bindet jede Änderung an
  _Domänendaten_ an eine form action; Schritt 1 → 2 ändert nichts, er zerlegt
  einen Text, den die Person gerade selbst getippt hat. Ein Rundgang dafür
  kostete eine Roundtrip-Latenz pro `×`, brauchte eine zweite action oder eine
  zweite Route, und der Server müsste den Zwischenstand halten. Der Zähler muss
  ohnehin bei jedem Tastendruck stimmen — damit ist die Zerlegung im Browser
  gesetzt, und der Prüfschritt bekommt sie geschenkt. Der Server bleibt trotzdem
  die Instanz: er zerlegt die übergebenen Zeilen mit **derselben** Funktion noch
  einmal, bevor etwas entsteht.
- **Was eine Zeile ist, steht genau einmal.** `src/lib/aufgabentext.ts` hält
  `zeilenErkennen`, `aufgabentextFalten` und die `200` — gelesen vom Zähler im
  Browser **und** von beiden actions. Zwei Fassungen derselben Regel liefen
  auseinander, und der Knopf `24 Aufgaben ablegen` legte dann 23 an. Die
  Faltung ist dieselbe wie auf `/aufgabe`: Nullbreiten-Zeichen weg, `\s+` zu
  einem Leerzeichen, trimmen, leere Zeilen fallen weg.
- **Ein `due_at` für den ganzen Stapel**, nicht eines pro Zeile — ein Monatsplan
  hat ein Fälligkeitsdatum. `Fällig bis` ist **Pflicht**: eine Planaufgabe ohne
  Frist wäre von einer vor Ort erfassten nicht mehr zu unterscheiden. Die Spalte
  ist trotzdem nullbar, weil `/aufgabe` keine Frist setzt.
- **`Fällig bis` bezeichnet das Ende des Tages in Europe/Zurich**, nicht
  Mitternacht UTC. `Fällig bis 31. August` heisst umgangssprachlich „bis der 31.
  vorbei ist"; Mitternacht UTC läge in der Sommerzeit zwei Stunden **vor** dem
  Beginn des gemeinten Tages, und die Zeile trüge am 31. schon den Satz aus
  [Überfällige Aufgaben erkennen](#überfällige-aufgaben-erkennen), obwohl der
  gemeinte Tag noch läuft. Die Zone steht genau einmal, in `src/lib/zeit.ts`, und
  wird von der Formatierung und von der Umrechnung gelesen — die Schwelle der
  Überfälligkeit steht seit Story 2.2 in derselben Datei, aus demselben Grund.
- **Ein Aufruf, ein INSERT, keine Transaktion.** `aufgabenStapelAnlegen` setzt
  alle Zeilen in einem mehrzeiligen `INSERT` — ein einzelnes Statement ist in
  SQLite von sich aus atomar. Eine Schleife mit einem INSERT je Zeile bräuchte
  die Transaktion dann wirklich; sie ist der teurere Weg zu demselben Ergebnis.
  Diese Bauform trägt nur, weil `PLAN_HOECHSTZAHL` bei 100 steht: zwei gebundene
  Parameter je Zeile ergeben 200, und die liegen unter **beiden** Schranken, die
  SQLite je nach Build zieht (999 oder 32 766). Wer die Höchstzahl über 499 hebt,
  muss die Funktion mitanfassen — der Docblock dort sagt es. Einen leeren Stapel
  fängt sie selbst ab: `values([])` wäre ungültiges SQL und eine Fehlerseite
  statt eines Satzes.
- **Zwei Grenzen, beide einschliessend, beide auch im Browser.** Höchstens `200`
  Codepoints je Zeile (dieselbe Zahl wie auf `/aufgabe`) und höchstens `100`
  Zeilen je Stapel. Ein realer Monatsplan hat 20 bis 40 Aufgaben; die 100 fangen
  den einen teuren Fall ab, nämlich einen versehentlich eingefügten ganzen
  Chatverlauf, den keine Löschen-Aktion wieder aufräumte. `PLAN_HOECHSTZAHL`
  steht darum **neben** `AUFGABE_HOECHSTLAENGE` im geteilten Modul: solange sie
  allein in der Route lag, sagte der Zähler `500 Aufgaben erkannt`, `Weiter`
  blieb frei, der Prüfschritt zeigte 500 Zeilen — und erst der POST wies ab. Der
  Server bleibt die Instanz, der Browser sagt es nur früher.
- **Eine zu lange Zeile weist den ganzen Stapel ab.** Still zu kürzen erzeugte
  eine Aufgabe, die niemand so geschrieben hat; still zu überspringen bräche die
  Zusage, die der Knopf trägt. Der Satz nennt darum die Zahl der zu langen
  Zeilen, und `Zurück zum Text` führt an die Stelle, an der sich das beheben
  lässt.
- **Nichts wird entdoppelt.** Zwei Mal `Tunnel lüften` sind zwei Aufgaben — es
  gibt zwei Tunnel.
- **Namenlos wie der Rest des Pools.** Es gibt keine Spalte für einen vorab
  Zuständigen und keine für einen Erfassenden; die action liest `locals` gar
  nicht. Die planende Person wechselt monatlich und ist nicht die Adminperson —
  darum gilt der Eintrag auf `/mehr` allen und hängt an keiner Adminschranke.
- **`Weiter` sperrt aus drei Gründen, und jeder trägt seinen Satz:** keine Zeile
  erkannt, mehr Zeilen als erlaubt, kein brauchbares Datum. Ein gesperrter Knopf
  ohne Satz wäre eine Sackgasse ohne Auskunft. Das `required` am Datumsfeld ist
  wirkungslos — Schritt 1 ist kein `<form>` —, was trägt, ist die Sperre.
- **Der Fehlersatz wird quittiert.** Er verschwindet, sobald die Person den
  Schritt wechselt oder eines der Felder anfasst. Sonst stünde ein
  `role="alert"` über einem Inhalt, den sie längst korrigiert hat, und der
  nächste Alarm hätte seine Glaubwürdigkeit verloren.
- **Der Fokus fällt nie auf den Seitenrumpf.** Das `×` zerstört sich beim
  Drücken selbst; der Fokus geht an das nachgerückte `×`, bei der letzten Zeile
  an die Überschrift — und darunter steht dann der leere Zustand mit dem
  einzigen Weg hinaus, `Zurück zum Text`.
- **Die Meldung reist als Query-Parameter mit Zahl** (`/?abgelegt=22`). Die
  `load` von `/` macht daraus eine **Zahl**, die Oberfläche den Satz. Das bare
  `?abgelegt` von `/aufgabe` bleibt gültig und bedeutet weiterhin `Abgelegt.`

## Überfällige Aufgaben erkennen

Eine Aufgabe, die drei Wochen liegt, sieht in einer nackten Liste aus wie eine
von heute — Liegengebliebenes fällt dann nur auf, wenn jemand mahnt. Auf `/`
bekommt eine solche Zeile darum unter dem Aufgabentext einen zweiten Satz:
`seit 4 Wochen offen`, in Nebentext-Grösse und im Lehmbraun aus `--overdue`.

- **Überfällig ist abgeleitet, nicht gespeichert.** Keine `is_overdue`-Spalte,
  kein Cron, kein Hintergrundjob: zwei Wahrheiten liefen auseinander, sobald ein
  Job einmal nicht läuft. Gerechnet wird zur Anzeigezeit, in
  `offeneAufgabenAuflisten`. Der Preis: die Zahl entsteht in JavaScript und nicht
  in SQL, es gibt also **keinen** Weg, überfällige Aufgaben in der Datenbank zu
  filtern oder zu zählen.
- **Die Schwelle steht an genau einer Stelle.** `UEBERFAELLIG_SEKUNDEN` in
  `src/lib/zeit.ts` als `3 * WOCHE_SEKUNDEN` — dieselbe Datei, in der auch die
  Zeitzone genau einmal steht, aus demselben Grund. Gelesen wird sie von
  `wochenOffenSeit` und vom Prüfskript, das seine Matrixzeilen relativ zu ihr sät,
  damit die Prüfliste nicht grün bleibt, wenn jemand sie verschiebt. Der
  Vergleich ist **strikt**: genau an der Schwelle ist eine Aufgabe noch nicht
  überfällig, eine Sekunde darüber sind es drei Wochen. Damit ist `3` der
  kleinste mögliche Wert, und `seit N Wochen offen` braucht keine Beugungsregel.
  Der Preis: die drei Wochen stehen nirgends in der Oberfläche, und die Zeile ist
  die einzige **Deklaration**, nicht die einzige Abhängigkeit — fällt die Schwelle
  je unter drei Wochen, kippt die Beugungsfreiheit mit, und `seit 1 Wochen offen`
  steht da. Der Docblock an der Konstante zählt auf, was mitwandert.
- **Die Frist zählt ab Fälligkeit, ersatzweise ab Anlage** (`dueAt ?? createdAt`).
  Ein Monatsplan mit Fälligkeit am Monatsende gilt darum nicht schon drei Wochen
  nach dem Ablegen als überfällig. Umgekehrt wird eine über `/aufgabe` erfasste
  Aufgabe 21 Tage nach der Erfassung überfällig, ohne dass jemand eine Frist
  gesetzt hat — und es gibt keinen Weg, diesen Zeitpunkt zu verschieben.
- **Der Satz ist doppeldeutig, und der Wortlaut bleibt trotzdem.** Bei einer
  Planaufgabe zählt `seit N Wochen offen` die Wochen **seit der Fälligkeit**, nicht
  die Liegedauer: vor 60 Tagen angelegt, vor 25 Tagen fällig, angezeigt
  `seit 3 Wochen offen`. Der Wortlaut steht so in den Akzeptanzkriterien des Epics
  und in `DESIGN.md` und wird nicht umformuliert — hier steht nur, wie er zu lesen
  ist.
- **Der Bezugszeitpunkt entsteht serverseitig in der `load`.** Ein `Date.now()` in
  der Komponente lief einmal beim Rendern und einmal beim Hydrieren und meldete
  einen Hydrierungsunterschied; zugleich wird so die ganze Liste an **einer** Uhr
  gemessen. Der Preis: die Zahl ist so alt wie der letzte Ladevorgang, und kein
  Timer zieht sie nach.
- **Der Text trägt die Aussage, die Farbe nie allein.** Bei Farbfehlsichtigkeit
  oder ausgeschalteter Farbdarstellung steht `seit N Wochen offen` unverändert da.
  Und **kein Rot**: eine Aufgabe, die vier Wochen liegt, ist kein Fehler und keine
  Gefahr, und `--danger` bleibt allein dem Zerstörenden vorbehalten.
- **Kein Abzeichen, keine Umsortierung, keine Eskalation.** Die Zeile bleibt an
  ihrem nach `created_at` sortierten Platz, der Text bleibt nicht antippbar, und
  nichts verschwindet — offene Aufgaben verfallen nie. Der Preis: wer wissen will,
  wie viel liegt, liest die Liste; es gibt keine Zählung und keine Erinnerung.
- **Beim Abhaken verschwindet die zweite Zeile.** `completed_at IS NULL` ist der
  erste Konjunkt der Regel, und `seit 4 Wochen offen` unter einer gerade
  erledigten Aufgabe wäre eine Falschaussage. Beim Wieder-Öffnen kommt sie mit
  **unveränderter** Zahl zurück, weil das Abhaken kein `invalidateAll()` auslöst —
  der Preis derselben Entscheidung, die die Zeile an ihrem Platz stehen lässt.
- **Der zweite Preis ist ein Höhensprung.** Verschwindet die zweite Zeile,
  schrumpft die Zeile um deren Höhe plus `gap`, und **alle Zeilen darunter rutschen
  nach oben** — im Moment des Antippens. „Die Zeile bleibt an ihrem Platz stehen,
  so ist ein Fehlgriff sofort sichtbar" gilt damit nur noch für die angetippte
  Zeile. Den Platz freizuhalten kostete jede frische Zeile eine Zeilenhöhe, die
  sie nie zeigt.
- **Der Satz wird nicht gekappt.** Ein vertipptes Jahr im Feld `Fällig bis`
  erzeugt `seit ~1900 Wochen offen`, und genau diese absurde Zahl ist das
  Diagnosesignal. Eine Obergrenze liesse einen Stapel von 1990 aussehen wie einen,
  der 14 Monate liegt. Der Preis: die Liste kann grotesk aussehen — eine
  Eingabeschranke am Datumsfeld ist eine eigene, noch offene Produktentscheidung.
- **Die zweite Zeile ist eine Beschreibung, kein Name.** Sie hängt über
  `aria-describedby` am Kästchen und liegt ausdrücklich **nicht** in dem Element,
  auf das `aria-labelledby` zeigt: das Kästchen heisst weiter
  `<Aufgabentext>, erledigen`, und die Überfälligkeit kommt danach.
- **Keine Schemaänderung, keine neue Migration** — die Story rechnet auf Spalten,
  die seit Story 2.1 stehen, und `npm run db:check` meldet weiter „No schema
  changes".

## Mitglieder aufnehmen und Zugang beenden

Alles Seltene liegt unter `/mehr`. Dort stehen zwei Einträge:
`Monatsplan ablegen` für **alle** — die planende Person wechselt monatlich und
ist nicht die Adminperson — und darunter `Verwaltung` nur für eine Adminperson.
Für alle anderen fehlt der zweite **ganz** — kein ausgegrauter Punkt, keine
Erklärung, und seit der Monatsplan-Eintrag da ist auch kein leerer Zustand mehr,
der verriete, dass es woanders mehr gäbe. Ein Direktaufruf von `/verwaltung`
ohne Adminrechte endet mit `303` auf `/`, nicht mit einer Fehlerseite: für
jemanden ohne Adminrechte soll die Verwaltung nicht existieren, nicht verboten
sein. Eine Fehlerseite wäre die Auskunft, dass es dort etwas gibt.

Die Schranke sitzt in **einer** Funktion (`src/lib/server/adminschranke.ts`) und
greift in der `load` **und** in jeder der drei form actions. Eine action ohne
Schranke wäre der Fehler, den die Oberfläche nicht sichtbar macht: für
Nicht-Admins fehlt der Knopf, ein POST braucht aber keinen.

- **Aufnehmen.** Ein Feld, ein Name, ein Knopf. Danach erscheint der
  Einladungslink **genau einmal** — im Klartext, in einem Feld zum Kopieren, mit
  dem Satz, dass er nur jetzt zu sehen ist. Er wird **von Hand** weitergegeben:
  die Anwendung verschickt nichts, keine E-Mail, keinen Messenger.
- **Der Server kann den Link nach der einen Antwort nicht mehr hergeben.** Das
  ist der belegbare Teil, und er ist Aufbau statt Zusage: der Klartext entsteht
  in der action und steht ausschliesslich im Rumpf **einer** POST-Antwort — kein
  Zwischenspeicher, kein Flash-Cookie, keine Weiterleitung mit Fragment. Ein
  Neuladen ist ein GET, dessen `load` ihn nicht kennt und nicht kennen kann: in
  `members` steht nur der SHA-256-Hash, und der ist nicht umkehrbar. Die POST-
  Antwort trägt `cache-control: no-store`, damit sie nicht im Verlauf und nicht
  im Plattenzwischenspeicher liegenbleibt.

  Was **nicht** behauptet wird: dass der Link damit überall fort ist. Solange
  die Seite offen bleibt, hält die Oberfläche ihn absichtlich fest — sonst
  löschte ihn jeder weitere Knopfdruck, bevor er weitergegeben wäre. Und wer
  `Link kopieren` gedrückt hat, hat ihn in der Zwischenablage des Geräts; siehe
  die benannt akzeptierten Risiken.

- **Link neu ausstellen** ersetzt den Hash derselben Zeile. Der alte Link ist
  damit sofort ungültig und führt auf `Dieser Link gilt nicht mehr.` Das ist der
  Zweck: für ein zweites Gerät braucht es die Aktion **nicht** — ein Token bleibt
  mehrfach einlösbar —, wohl aber für einen verlorenen oder in falsche Hände
  geratenen Link. Die Person behält Id, Name und ihre Historie.
- **Einladung widerrufen** setzt `is_active = 0`. Es wird **nichts gelöscht**:
  keine Zeile, kein Name, kein Hash. Die Zeile bleibt in der Liste stehen und ist
  dort im **Text** als beendet gekennzeichnet, nicht über eine Farbe. Abgehakte
  Aufgaben bleiben in der Historie, künftige Dienstwochen erscheinen als
  unbesetzt. Der Widerruf wirkt sofort, auch auf eine schon lebende Sitzung — der
  Wächter liest `is_active` bei jedem Aufruf frisch. Es ist die einzige Aktion
  mit einer Bestätigung und der einzige rote Knopf der Anwendung.
- **Adminrechte vergibt ausschliesslich `npm run create-admin`**, und nur für das
  erste Mitglied. Wer unter `/verwaltung` aufgenommen wird, entsteht immer mit
  `is_admin = 0`; es gibt keine Oberfläche, die Adminrechte vergibt oder
  entzieht, und keine, die einen beendeten Zugang reaktiviert.
- **Ein Admin kann sich nicht selbst widerrufen** und den eigenen Link nicht neu
  ausstellen — sonst bliebe die Verwaltung ohne Zugang. Geprüft wird das in der
  action, nicht nur in der Oberfläche: die eigene Zeile trägt keine Knöpfe, aber
  ein POST braucht keinen.
- **Ein Satz für vier Zustände.** Eine fehlende, eine nicht numerische, eine
  unbekannte und eine schon beendete `mitgliedId` ergeben alle `400` mit
  demselben Satz. Jede Abweichung im Wortlaut wäre ein Kanal, an dem sich ablesen
  liesse, welche Zeilen es gibt.

### Benannt akzeptierte Risiken

Diese Anwendung hat Kanten: der Zugang hängt allein an einem Link im Pfad, und
das Abhaken ist bewusst ohne Netz gebaut. Sie sind gesehen, gewogen und
angenommen — nicht übersehen:

- **Das Klartext-Token steht im Pfad.** Damit landet es in jedem Protokoll, das
  Pfade mitschreibt. **So gebaut:** beide `/i/`-Blöcke in
  `nginx/templates/app.conf.template` tragen `access_log off`, also erscheint
  keine `/i/`-Zeile in `access.log` — dort läse sie sich leichter als aus der
  Datenbank, in der nur der Hash steht. Der Block auf Port 80 trägt es mit,
  weil sonst schon die Umleitung auf HTTPS das Token mitschriebe. Dazu
  `limit_req_log_level info`, damit auch das Bremsen der Ratenbegrenzung den
  Pfad nicht ins Fehlerprotokoll schreibt. Was bleibt, ist benannt: ein
  Upstream-Fehler auf `/i/` protokolliert den Pfad weiterhin auf `error`-Ebene
  — ein Fall, der voraussetzt, dass die Anwendung ohnehin am Boden liegt. Die
  Ratenbegrenzung auf `/i/` sitzt ebenfalls in nginx (`20r/m`, `burst=10
nodelay`); im Anwendungscode gibt es bewusst keine. Siehe
  [Betrieb und Runbook](#betrieb-und-runbook).
- **Verbindungsvorschau.** Wird der Link in einem Chat verschickt, holt der
  Messenger die Adresse oft selbst ab, um eine Vorschau zu bauen. Das Token ist
  damit auf dessen Servern bekannt. Verbraucht wird es nicht — es bleibt
  absichtlich mehrfach einlösbar, damit ein Gerätewechsel keinen neuen Link
  braucht —, und die Vorschau selbst kann mit dem Cookie nichts anfangen. Der
  Ausweg wäre ein Einmal-Token, und der kostet genau die Eigenschaft, die die
  Gemeinschaft braucht.
- **Login-CSRF.** `GET /i/<token>` stellt ein Cookie aus. Wer jemanden dazu
  bringt, seinen Link zu öffnen, meldet ihn als sich selbst an. In dieser
  Anwendung ist der Gewinn klein — es gibt keine Zahlung, keine fremden Daten,
  und die betroffene Person sieht sofort einen falschen Namen —, und der
  Gegenentwurf (ein Formular mit Token-Feld) wirft die Kernzusage weg: ein
  Antippen, kein Eingeben. Angenommen.
- **Kein Ablauf ohne Widerruf.** Das Cookie läuft ein Jahr, das Token gilt bis
  zum Widerruf. Dafür kommen Mitglied und `is_active` bei **jedem** Aufruf frisch
  aus der Datenbank: Widerrufen wirkt sofort, ohne auf einen Ablauf zu warten.
- **Ein Widerruf ist ohne Datenbankeingriff unumkehrbar.** Es gibt bewusst keine
  Reaktivieren-Aktion und kein Undo-Fenster. Wer die falsche Zeile widerruft,
  nimmt die Person wieder auf — mit neuer Id und neuem Link. Die alte Zeile
  bleibt daneben stehen; ihre Historie hängt an der alten Id und wandert nicht
  mit. Der Bestätigungsdialog nennt darum Namen **und** Aufnahmedatum: auf
  `members.name` gibt es keine Eindeutigkeitsbedingung, zwei Mitglieder dürfen
  gleich heissen.
- **Ein Tippfehler im Namen bleibt für immer stehen.** Es gibt keine
  Umbenennen-Aktion. Der Name ist die einzige menschenlesbare Identität im
  System, und die einzige Korrektur ist Widerrufen plus Neuaufnehmen — was einen
  neuen Link nötig macht. Serverseitig abgewehrt sind nur die Fälle, in denen gar
  kein lesbarer Name entstünde: leere Eingabe, Nullbreiten-Zeichen und mehr als
  80 Zeichen.
- **Niemand protokolliert, wer wen widerrufen hat.** Es gibt kein Audit-Log,
  keine Spalte für den Handelnden und keine Zeitmarke des Widerrufs — nur
  `is_active = 0`. Bei einer Gemeinschaft mit genau einer Adminperson ist die
  Frage „wer war das" trivial beantwortet; die Frage „wann" ist es nicht mehr.
  Angenommen, weil eine Protokolltabelle hier mehr Bauwerk wäre als Nutzen.
- **Nach `Link kopieren` liegt der Klartext in der Zwischenablage.** iOS und
  Android synchronisieren die Zwischenablage geräteübergreifend (Universal
  Clipboard, Gboard-Verlauf), und jede App mit Vordergrundfokus darf sie lesen.
  Der Knopf ist trotzdem da: die Alternative ist Abtippen eines 43 Zeichen langen
  base64url-Tokens von Hand, und ein Tippfehler darin verbrennt einen Link, den
  niemand wiederherstellen kann. `navigator.clipboard` gibt es ohnehin nur auf
  einer sicheren Herkunft; ohne die fällt die Oberfläche auf „Feld antippen,
  Inhalt ist markiert" zurück.
- **Ohne JavaScript hakt nichts ab.** Das Kästchen schickt sein Formular über
  einen `change`-Handler ab; es gibt daneben keinen Knopf, der es ohne
  JavaScript täte. Ein Antippen tut dann **nichts** — und das ist die richtige
  Ausfallrichtung: lieber keine Wirkung als eine versehentlich erledigte
  Aufgabe. Ein Absenden-Knopf pro Zeile wäre der Gegenentwurf und kostet genau
  die Kernzusage, dass Abhaken eine Interaktion kostet. Die Anwendung ist
  ohnehin nur online.
- **Die Ablege-Meldung steht in der Adresse und lässt sich herbeiführen.** Sie
  reist als `?abgelegt` mit; ein Neuladen von `/?abgelegt` zeigt `Abgelegt.`
  erneut, und wer die Adresse von Hand eintippt, sieht den Satz auch, ohne dass
  etwas entstanden wäre. Der Gegenentwurf wäre ein Flash-Cookie: einmalig und mit
  sauberer Adresse, aber ein zweites Cookie neben dem einen Sitzungs-Cookie, das
  eine `load` schreibend wieder löschen müsste — ein Mechanismus, den danach jede
  Story kennen muss. Bei einer Bestätigung ohne Folgen ist der sichtbare
  Parameter der billigere Preis, und er ist von Hand nachvollziehbar. Angenommen.
- **Ohne JavaScript wird `Abgelegt.` nicht angesagt.** Das Ablegen selbst
  funktioniert vollständig ohne JavaScript — es ist ein gewöhnlicher POST mit
  einer `303` —, und die Meldung steht danach sichtbar auf `/`. Nur der Griff,
  der die Live-Region einmalig fokussiert, fällt aus; ein Screenreader liest den
  Satz dann erst beim Durchgehen der Seite. Angenommen: die sichtbare Bestätigung
  bleibt, und die Anwendung ist ohnehin nur online.
- **Das `maxlength` am Erfassen-Feld zählt anders als die Prüfung dahinter.**
  `maxlength="200"` zählt UTF-16-Einheiten, `AUFGABE_HOECHSTLAENGE` zählt
  Codepoints — auf `/aufgabe` wie auf `/monatsplan`. Ein
  gültiger Text aus 200 Codepoints, in dem ein Emoji steckt, ist im Browser 201
  Einheiten und lässt sich im Feld nicht zu Ende tippen — die **annehmende**
  Richtung der Codepoint-Zählung ist über das echte Formular also gar nicht
  erreichbar. Die abweisende Richtung stimmt: ein POST braucht kein Feld, und die
  Route zählt richtig. Der Ausweg wäre ein Zähler in JavaScript; er kostet
  Zustand auf einer Seite, die keinen hat, für einen Fall, den eine
  Gartenaufgabe kaum erreicht. Angenommen.
- **Ohne JavaScript greift die Doppelsperre nicht.** `imFlug` und `cancel()`
  leben im `use:enhance`-Rückruf; ohne JavaScript ist das Ablegen ein
  gewöhnlicher POST, und zwei schnelle Antippen erzeugen zwei gleichlautende
  Aufgaben. Es gibt keine Löschen-Aktion, die eine davon wieder wegnähme —
  abhaken ist das Einzige, was bleibt. Eine Entdopplungs-Schranke in der action
  wäre der Gegenentwurf und müsste entscheiden, welche zwei Aufgaben „dieselbe"
  sind; zwei Personen, die am selben Tag `Tunnel lüften` erfassen, meinen unter
  Umständen zwei verschiedene Tunnel. Angenommen: die Anwendung ist ohnehin nur
  online, und der Regelweg trägt die Sperre.
- **`/monatsplan` braucht JavaScript.** Der mitlaufende Zähler ist eine Zusage
  der Akzeptanzkriterien, und eine mitlaufende Zahl gibt es ohne JavaScript
  nicht. Die Ausfallrichtung ist die richtige: ohne JavaScript ist `Weiter` ein
  `type="button"` ohne Wirkung, es entsteht **nichts**, und die Person merkt es
  sofort — anders als bei einer stillen Teil-Anlage. Der Weg über `/aufgabe`,
  der vollständig ohne JavaScript funktioniert, bleibt daneben offen.
  Angenommen: die Anwendung ist ohnehin nur online.
- **Ein abgelegter Stapel lässt sich nicht rückgängig machen.** Es gibt keine
  Löschen-Aktion und kein „Stapel zurücknehmen"; wer versehentlich einen ganzen
  Chatverlauf einfügt und ablegt, hakt die Zeilen einzeln ab. Der Prüfschritt
  mit dem `×` ist der Ort, an dem das aufzufangen ist, und die Höchstzahl von
  `100` Zeilen die Notbremse dahinter. Eine Rücknahme bräuchte eine Kennung des
  Stapels in `tasks` — eine Spalte, die es nicht gibt und die nichts anderes
  brauchte. Angenommen.
- **Jedes Mitglied kann jede erledigte Aufgabe wieder öffnen** — auch eine
  fremde und eine alte. Es gibt keine Zeitschranke, keine Bindung an die
  abhakende Person und kein Protokoll darüber, wer geöffnet hat. Der Grund ist
  derselbe wie beim namenlosen Pool: eine Prüfung „darf ich das" bräuchte die
  Zuordnung, die AD-2 und AD-5 gerade nicht wollen. In einer Gruppe von zwanzig
  Leuten, die sich kennen, ist das kein Missbrauchsrisiko, sondern der Gegenzug
  zum Fehlgriff mit dem Handschuh.

## Was noch nicht hier ist

- **Eine Aufgabe bearbeiten oder löschen gibt es nicht.** Ein Tippfehler im
  Aufgabentext bleibt stehen; abhaken ist das Einzige, was bleibt. In keiner
  Story von Epic 1 vorgesehen.
- Eine Aufgabe **nachträglich** mit einer Frist versehen gibt es nicht: `due_at`
  entsteht beim Ablegen des Stapels und sonst nirgends. `/aufgabe` bekommt kein
  Datumsfeld. Das heisst nicht, dass eine so erfasste Aufgabe nie überfällig
  wird: sie wird es 21 Tage nach ihrer **Erfassung**, weil die Frist ersatzweise
  ab `created_at` zählt — ohne dass jemand ein Datum gesetzt hat und ohne dass es
  einen Weg gäbe, diesen Zeitpunkt zu verschieben.
- Diensthinweis und freie Einzelaufgaben, also Block 1 und 2 auf `/`: **Epic 3**.
  Die Reihenfolge ist angelegt, die Blöcke rendern nichts.
- Es gibt bewusst keinen Service Worker: `static/manifest.webmanifest` und die
  Icons genügen für die Installation zum Home-Bildschirm, und ein Datencache
  würde Erledigtes als offen zeigen.
