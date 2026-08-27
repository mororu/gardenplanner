---
title: 'Story 1.6 — Betrieb und Deployment'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: '0c517ecf08a8d453532e8644cc4cccd125d71a87'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nach fünf Stories ist die Anwendung vollständig, läuft aber nur auf einem Entwicklerrechner — und eine Anwendung auf einem Entwicklerrechner hakt niemand ab. Es gibt kein `Dockerfile`, kein `docker-compose.yml`, keine nginx-Konfiguration, kein Sicherungsskript und kein Runbook; `README.md:869` sagt das ausdrücklich. Zugleich ist das Sitzungs-Cookie `Secure`, weshalb die Anwendung **ohne** TLS-Endpunkt gar nicht bedienbar ist: ohne diese Story ist das Werkzeug nicht bloss unbequem, sondern unbenutzbar.

**Approach:** Ein Compose-Stapel aus drei Diensten — `app` (mehrstufig gebaut, non-root, ohne veröffentlichten Port), `nginx` als TLS-Terminierung mit Umleitung und Ratenbegrenzung auf `/i/`, `certbot` mit Erneuerungsschleife. Die SQLite-Datei liegt in einem Named Volume unter `/data`; `scripts/backup.sh` zieht per Host-Cron um 02:00 eine WAL-sichere Kopie über `sqlite3 .backup` und hält 30 Tage. Domain und certbot-Adresse kommen aus `.env`, nicht aus dem Repository. Ein Runbook in `README.md` führt von der leeren Maschine bis zur laufenden Anwendung. **Kein Byte unter `src/` wird angefasst** — die Story hat laut Epic-Kontext keine Codeabhängigkeit nach oben, und das bleibt so.

## Boundaries & Constraints

**Always:**

- `app` veröffentlicht keinen Port und ist nur über das interne Bridge-Netz erreichbar; nginx erreicht ihn über `proxy_pass http://app:3000`.
- Das Image ist mehrstufig und läuft als non-root. Basis `node:24-alpine` — nicht `node:20`, `better-sqlite3` 13 verlangt `node >=22`.
- Die drei Pflichtvariablen `DATABASE_PATH`, `SESSION_SECRET`, `ORIGIN` kommen aus der Umgebung. Kein Vorgabewert im Compose-File, keine Attrappe im Repository (AD-13).
- Nur TLS 1.2 und 1.3; HTTP wird auf HTTPS umgeleitet.
- **`/i/` erscheint in keinem nginx-Zugriffsprotokoll.** Bindende Zusage aus `README.md:763-768`: das Klartext-Token steht im Pfad und läge sonst in `access.log`.
- Domain und certbot-Adresse sind parametrisiert; im Repository steht kein echter Hostname.
- `npm run lint` und `npm run check` bleiben grün.

**Ask First:**

- Ein neuer Pfad unter `src/routes/` (etwa ein Health-Endpunkt) — das wäre eine unauthentifizierte Fläche mehr und bricht „keine Codeabhängigkeit nach oben".
- Ein anderer Ratenbegrenzungswert als der unten begründete.
- Eine Registry statt eines Builds auf dem VPS (die in der Architektur benannte Ausweichlösung).

**Never:**

- Kein Staging, keine dritte Umgebung, kein CI-Pipeline-File.
- Keine Zertifikate, keine `.env`, keine Datenbank im Repository.
- Kein `latest`-Tag auf `node`; kein Ausweichen auf `:alpine` ohne Version bei nginx.
- Keine Änderung an `src/`, an `drizzle/` oder am Schema. Diese Story legt keine Tabelle an und erzeugt keine Migration.
- Kein Cache-Header und keine Auslieferung statischer Dateien durch nginx: `adapter-node` liefert `build/client` selbst aus, mit `precompress`. Ein zweiter Ausliefernder wäre eine zweite Wahrheit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Kaltstart | `docker compose up -d` mit vollständiger `.env` | Drei Dienste laufen; `docker compose ps` zeigt `app`, `nginx`, `certbot`; `app` ohne Portbindung | — |
| Fehlende Pflichtvariable | `SESSION_SECRET` nicht gesetzt | `app` endet sofort mit der benannten deutschen Meldung, Exit 1; Compose meldet den Container als beendet | Kein Neustart-Sturm: `restart: unless-stopped` startet erneut, das Log nennt in jedem Lauf denselben Satz |
| Klartext-HTTP | `GET http://<domain>/` | 301 auf `https://<domain>/` | — |
| Veraltetes TLS | Handschlag mit TLS 1.1 | Verbindung abgelehnt | — |
| ACME-Prüfpfad | `GET http://<domain>/.well-known/acme-challenge/x` | 200 aus dem geteilten Webroot, **keine** Umleitung | 404 wenn die Datei fehlt |
| Neustart | `docker compose down` und danach `up -d` | Die Aufgabenliste zeigt dieselben Zeilen | — |
| Volume weg | Named Volume gelöscht, `up -d` | `app` endet mit der Meldung zum fehlenden Verzeichnis aus `db/index.ts:46-53` | Runbook nennt die Wiederherstellung |
| Einlöseflut | 40 Abrufe von `/i/<token>` in zehn Sekunden von einer Adresse | Die ersten greifen durch, danach 429 | 429 als schlichte nginx-Seite, kein Hinweis auf Gültigkeit des Tokens |
| Protokoll | Nach der Flut in `access.log` gesucht | Keine einzige `/i/`-Zeile | — |
| Sicherung | `scripts/backup.sh` läuft | Eine Kopie `db-JJJJ-MM-TT-hhmm.sqlite` im Sicherungsverzeichnis, mit `PRAGMA integrity_check` = `ok` | Exit ungleich 0 mit Meldung, wenn der Container nicht läuft oder `.backup` scheitert; keine halbe Datei bleibt liegen |
| Aufbewahrung | Eine Sicherungsdatei ist 31 Tage alt | Sie wird beim nächsten Lauf entfernt; eine 29 Tage alte bleibt | — |

</frozen-after-approval>

## Code Map

Am Stand `0c517ec` sondiert und belegt — nicht neu herleiten:

- **`better-sqlite3` 13.0.3 braucht keine Build-Werkzeuge, erzwingt aber `--ignore-scripts`.** Das Paket liefert `prebuilds/linuxmusl-x64.node` und `prebuilds/linuxmusl-arm64.node` mit, genau der Alpine/musl-Fall — **kein `apk add python3 make g++`**, wer es hinzufügt, bläht das Image ohne Wirkung auf. **Achtung, hier stand zuerst ein falscher Mechanismus:** `"gypfile": false` in der `package.json` des Pakets hält npm 11 *nicht* auf. `node_modules/better-sqlite3/binding.gyp` existiert, npm leitet daraus `node-gyp rebuild` ab, und ein blosses `npm ci` stirbt im Alpine-Image mit `Could not find any Python installation to use`. Der Schalter ist `npm ci --ignore-scripts`; `npm rebuild esbuild` holt danach das eine Script nach, das die Builder-Stufe wirklich braucht. Siehe den Eintrag im Änderungsprotokoll. Die Mehrstufigkeit begründet sich hier nicht mit Compilern, sondern damit, dass die 26 devDependencies (SvelteKit, Vite, ESLint, TypeScript) nicht ins Laufzeit-Image gehören: `dependencies` sind nur `better-sqlite3`, `drizzle-orm`, `jose` und die zwei `@fontsource-variable/*`-Pakete.
- **`build/` bringt keine eigene `package.json` mit** (nachgesehen: `build/` enthält `index.js`, `handler.js`, `env.js`, `shims.js`, `client/`, `server/`). Die Wurzel-`package.json` mit `"type": "module"` **muss** ins Laufzeit-Image, sonst lädt Node `build/index.js` als CommonJS und stürzt ab.
- **Migrationen laufen beim Serverstart, relativ zum Arbeitsverzeichnis.** `src/lib/server/db/index.ts:84-97` ruft `migrate(…, { migrationsFolder: 'drizzle' })`. Also muss `drizzle/` (beide `.sql` plus `meta/`) neben `build/` im Image liegen und `WORKDIR` der Elternordner sein. Kein separater Migrationsschritt, kein Init-Container.
- **Das Verzeichnis der Datenbank legt der Code nicht an** (`db/index.ts:46-53` wirft mit `mkdir -p`-Hinweis) — und **genau darauf ruht die Zusage bei Volume-Verlust**. `DATABASE_PATH=/data/db/db.sqlite`, das Volume hängt auf `/data`, und im Image existiert **kein** `/data`: Docker legt den Mountpunkt dann als root-eigenes Verzeichnis an, `/data/db` fehlt, und die Anwendung endet über diesen Fehlerpfad. Ein `/data` im Image würde von Docker in jedes frische Volume kopiert und machte den Verlust still. Siehe den zweiten Eintrag im Änderungsprotokoll.
- **Fail-Fast liegt im `init`-Hook, nicht beim Modulladen** (`src/hooks.server.ts:37-41` und `:44-52`, Begründung im Kommentar `:42-51`). Folge fürs Dockerfile: `npm run build` läuft **ohne jede Pflichtvariable** durch — die Builder-Stufe braucht keine `.env`, und ein `ARG` dafür wäre falsch.
- **`.npmrc` trägt `engine-strict=true`**, `package.json` verlangt `node >=24` und `npm >=11`. `node:24-alpine` erfüllt beides; eine ältere Basis bricht schon beim `npm ci` ab. `.nvmrc` steht auf `24`.
- **`adapter-node` liest zur Laufzeit** (`node_modules/@sveltejs/adapter-node/files/index.js:10-15`, `handler.js:17-25`): `HOST` (Vorgabe `0.0.0.0`), `PORT` (`3000`), `ORIGIN`, `SHUTDOWN_TIMEOUT` (`30`), `IDLE_TIMEOUT`, `BODY_SIZE_LIMIT` (`512K`), `XFF_DEPTH`, `ADDRESS_HEADER`, `PROTOCOL_HEADER`, `HOST_HEADER`. **Weil `ORIGIN` gesetzt ist, wertet `handler.js:100-103` (`origin || get_origin(req.headers)`) keinen Proxy-Header aus** — `PROTOCOL_HEADER` und `HOST_HEADER` sind überflüssig und wären eine Vertrauensstellung ohne Zweck. `ADDRESS_HEADER` ebenso: die Anwendung ruft `getClientAddress()` nirgends, die Ratenbegrenzung sitzt in nginx.
- **`svelte.config.js`** setzt `adapter-node({ out: 'build', precompress: true })`. Die vorkomprimierten `.br`/`.gz` liefert `handler.js` selbst aus — darum in nginx **kein** `gzip on` für Proxy-Antworten und kein `try_files` auf statische Pfade.
- **Kein Health-Endpunkt, und es soll keiner entstehen.** Jeder Pfad ausser `/i/<token>` läuft durch den Wächter `src/hooks.server.ts:80-109` und antwortet ohne gültiges Cookie mit `403`. Der Healthcheck nutzt genau das: **ein 403 auf `/` ist der Gesundheitsbeweis.** Er belegt mehr als ein 200 auf einer freien Route belegen würde — der Prozess hört, der `init`-Hook ist ohne `process.exit(1)` durchgelaufen, also stehen Datenbank, Geheimnis und Herkunft. Node 24 hat `fetch`, es braucht kein `curl` und kein `wget` im Image.
- **Die Anwendung setzt genau eine Kopfzeile:** `Referrer-Policy: no-referrer` in `src/hooks.server.ts:132-135`. **Kein HSTS, kein CSP, kein X-Frame-Options** — die gehören nach nginx. Auf den zwei 403-Antworten fehlt selbst diese Kopfzeile (`:119-131`), dort trägt `src/error.html` ein `<meta name="referrer">`; ein nginx-seitiges `add_header … always` schliesst diese Lücke mit.
- **Das Tor sieht die neuen Dateien heute nicht — und genau das ist die Lücke.** `scripts/gate.mjs` scannt `dateienUnter(join(ziel,'src'))` plus `static/manifest.webmanifest` (`:447ff`); Repo-Wurzel und `scripts/` kommen darin nicht vor. Keine der zwölf **bestehenden** Regeln ist betroffen. **Aber:** damit sichert nichts die bindende Zusage aus `README.md:763-768` ab. Wer `access_log off` aus einem `/i/`-Block löscht, bekommt grünes `npm run lint` und ein zufriedenes `nginx -t` — und jedes Klartext-Token landet in `access.log`. Diese Story ergänzt darum **Regel 13** samt Fixture. `db:check` betrifft nur `drizzle.config.ts` und `drizzle/` und bleibt unberührt.
- **Prettier stört sich an genau einer neuen Datei.** `prettier --check .` erkennt YAML nativ, also ist `docker-compose.yml` formatpflichtig (Tabs aus `.prettierrc` gelten nicht: `.editorconfig` setzt für `yml` zwei Leerzeichen). `Dockerfile`, `nginx/*.conf`, `*.template`, `.sh` und `.dockerignore` hat Prettier keinen Parser für und überspringt sie stillschweigend — belegt durch Probelauf. ESLint erfasst `.sh` nicht.
- **`scripts/smoke-zugang.ts` prüft den Compose-Stapel nicht — aber den Zweig, auf dem er ruht.** Es startet keinen Server (`:13` sagt das ausdrücklich), sondern lädt Module direkt; Container und nginx sind darin nicht prüfbar. **Eine Sache aber schon, und sie fehlt:** die Umgebungsschleife `:815-833` prüft nur `SESSION_SECRET` und `ORIGIN` auf Werfen; jeder dort gesetzte `DATABASE_PATH` zeigt in ein **existierendes** Verzeichnis (`:127`, `:840`, `:1216`, `:1234`, `:1252`, `:1265`), womit der `existsSync`-Zweig `src/lib/server/db/index.ts:47-53` **nie** betreten wird. Genau dieser Zweig trägt die ganze `/data/db`-Konstruktion. Diese Story ergänzt darum eine Behauptung und zieht `ERWARTETE_BEHAUPTUNGEN` (`:89`, steht auf `261`) nach.
- **`.gitignore`** deckt `.env`, `data/`, `*.sqlite*` bereits ab. `certs/` fehlt — wird aber auch nicht gebraucht, weil Zertifikate in einem Named Volume und nicht im Arbeitsverzeichnis liegen. Kein Eingriff.
- **Architektur-Zieldateien, wörtlich vorgegeben** (`ARCHITECTURE-SPINE.md:274-279`, `:296`): `docker-compose.yml`, `nginx/nginx.conf`, `nginx/conf.d/app.conf`, `scripts/backup.sh`. `:247` legt fest: `app` ohne Port, `client_max_body_size 1M`, Ratenbegrenzung von `/login` auf `/i/` verschoben. `:301-302` stellt den konkreten Ratenwert ausdrücklich **dieser** Story anheim.
- **`README.md`-Anker:** Gliederung endet auf `## Was noch nicht hier ist` (`:858`); dort steht `:869-870` wörtlich „Docker Compose, nginx …: **Story 1.6**. In diesem Stand gibt es davon nichts." — dieser Punkt fällt weg. `### Benannt akzeptierte Risiken` (`:757`) enthält `:763-768` den Auftrag zum Zugriffsprotokoll; er wird von „für Story 1.6 festhalten" auf „so gebaut" umgeschrieben. Der neue Abschnitt gehört **nach `## Umgebungsvariablen` (`:128-157`)**, dessen Tabelle um die neuen Variablen wächst. Die Warnung `:118-126` („im Betrieb steht nginx mit TLS davor") wird damit erstmals eingelöst und darf darauf verweisen.
- **Betriebssystem-Randbedingung:** Der Entwicklerrechner ist arm64, der VPS amd64. Der lokale Prüflauf baut also ein anderes Image als der VPS. Das ist unkritisch, weil beide `prebuilds` mitkommen — muss im Runbook aber stehen, damit niemand ein arm64-Image auf den VPS schiebt.

## Tasks & Acceptance

**Execution:**

- [x] `.dockerignore` -- neu, **zuerst**: `node_modules`, `build`, `.svelte-kit`, `data`, `.env*` (mit Ausnahme `!.env.example`), `.git`, `_bmad`, `_bmad-output`, `.claude`, `drizzle/meta` **nicht** ausschliessen. Ohne diese Datei wandern die 2,3 MB `build/` und ein lokales `node_modules` in den Kontext und die Builder-Stufe baut auf fremden Artefakten auf
- [x] `Dockerfile` -- neu, zwei Stufen auf `node:24-alpine`. Stufe `bauer`: `package.json` + `package-lock.json`, `npm ci`, Quellen, `npm run build`. Stufe Laufzeit: `npm ci --omit=dev`, dann `build/`, `drizzle/` und `package.json` aus der Builder-Stufe; `apk add --no-cache sqlite` für die Sicherung; `WORKDIR /app`; das mitgelieferte `node`-Konto (UID 1000) statt eines eigenen; `USER node`; `ENV NODE_ENV=production`; `EXPOSE` weglassen — der Dienst veröffentlicht nichts; `CMD ["node", "build/index.js"]`. **Kein `apk add python3 make g++`** und kein `npm rebuild`, Begründung in einem Kommentar, sonst fügt es der nächste wieder hinzu
- [x] `docker-compose.yml` -- neu, drei Dienste und ein Netz `intern`. `app`: `build: .`, `env_file: .env`, `volumes: [daten:/data]`, `restart: unless-stopped`, `healthcheck` über `node -e` gegen `http://127.0.0.1:3000/` mit **403 als gesund** samt Kommentar warum, `ports` bewusst abwesend. `nginx`: `nginx:1.29-alpine`, Ports `80:80`/`443:443`, `NGINX_ENVSUBST_FILTER` auf die eine Domain-Variable begrenzt, Volumes für Konfiguration, `letsencrypt` und `acme`, `depends_on: app: {condition: service_healthy}`. `certbot`: `certbot/certbot`, Erneuerungsschleife mit `trap` und `sleep 12h`, dieselben zwei Zertifikatsvolumes. Named Volumes `daten`, `letsencrypt`, `acme`; Sicherungen als Bind-Mount aus `.env`. In Prettier-YAML formatiert (zwei Leerzeichen), sonst fällt `npm run lint`
- [x] `nginx/nginx.conf` -- neu, Rahmen: `worker_processes auto`, `limit_req_zone` im `http`-Block (die Zone muss dort stehen, nicht im Server-Block), Protokollformat, `server_tokens off`, `client_max_body_size 1M` nach `ARCHITECTURE-SPINE.md:247`, `include /etc/nginx/conf.d/*.conf`
- [x] `nginx/templates/app.conf.template` -- neu; **Abweichung vom Architekturpfad `nginx/conf.d/app.conf` samt Begründung im Kopfkommentar**: nur `/etc/nginx/templates/*.template` durchläuft im offiziellen Image die `envsubst`-Ersetzung, und ohne sie stünde die Domain fest im Repository. Zwei Server-Blöcke: Port 80 mit `location /.well-known/acme-challenge/` aus dem Webroot **vor** der 301-Umleitung; Port 443 mit `ssl_protocols TLSv1.2 TLSv1.3`, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `proxy_pass http://app:3000` samt `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, Upgrade-Kopfzeilen. Ein eigener `location ^~ /i/` mit `limit_req` **und `access_log off`** — die Zugangsbeschränkung des Protokolls ist die bindende Zusage aus `README.md:763-768` und gehört als Kommentar an die Zeile. Beim ersten Start belegen, dass `$host` und `$binary_remote_addr` in der gerenderten Datei unversehrt stehen: `NGINX_ENVSUBST_FILTER` muss auf die Domain-Variable begrenzt sein, sonst leert `envsubst` jede nginx-Variable
- [x] `scripts/backup.sh` -- neu, `#!/bin/sh`, `set -eu`. `docker compose exec -T app sqlite3 /data/db.sqlite ".backup '/data/backup.tmp'"`, danach die Datei aus dem Volume ins Sicherungsverzeichnis mit Zeitstempelnamen holen, `PRAGMA integrity_check` darauf, erst dann die temporäre löschen und die Rotation `find … -mtime +30 -delete` fahren. `.backup` statt `cp`, weil eine kopierte WAL-Datenbank ohne ihr `-wal` unvollständig ist. Ausführbar (`chmod +x`) und mit einem Kopfkommentar, der die Cron-Zeile wörtlich enthält
- [x] `.env.example` -- die neuen Variablen mit Beispielwert im Kommentar und leerem Wert ergänzen: Domain (dient nginx **und** bildet `ORIGIN`), certbot-Adresse, Sicherungsverzeichnis auf dem Host. Am bestehenden `DATABASE_PATH`-Kommentar den Container-Wert `/data/db.sqlite` als den nun realen kennzeichnen
- [x] `README.md` -- neuer Abschnitt `## Betrieb und Runbook` nach `## Umgebungsvariablen` (`:157`): Aufbau der drei Dienste, die Tabelle der Umgebungsvariablen um die neuen Zeilen erweitern, dann das Runbook in nummerierten Schritten — leere Maschine, Docker installieren, Repository holen, `.env` füllen, **Attrappen-Zertifikat**, `up -d`, echtes Zertifikat holen, nginx neu laden, `create-admin`, Cron-Zeile eintragen; danach **Wiederherstellung** aus einer Sicherung und **Erneuerung**. Dazu die benannten Kosten: kein Staging, arm64 gegen amd64, `better-sqlite3` auf dem VPS light als Ausweichpunkt Registry. Den Punkt `:869-870` unter `## Was noch nicht hier ist` streichen und den Risikoeintrag `:763-768` von Zusage auf Umsetzung umschreiben

- [ ] `scripts/gate.mjs` -- **Regel 13** ergänzen: jeder `location`-Block, der auf `/i/` passt, in `nginx/templates/app.conf.template` muss `access_log off;` tragen — beide, der auf Port 80 und der auf 443. Ohne sie ist die bindende Zusage aus `README.md:763-768` von nichts gedeckt. Dazu ein Fixture `scripts/gate-fixtures/regel-13-*` mit einer gezielten Verletzung und ein Eintrag im `proben`-Array (`:465ff`) mit exakter Trefferzahl und `begruendung`. Der Kopfkommentar `:17-69` listet die Regeln auf und wird mitgezogen; der Scan-Bereich muss dafür erstmals über `src/` hinausreichen
- [ ] `scripts/smoke-zugang.ts` -- eine Behauptung in der Umgebungsschleife `:815-833`: `DATABASE_PATH` auf einen Pfad **unter einem nicht existierenden Verzeichnis** setzen, `startPruefen()` in `try` rufen und behaupten, dass es wirft **und** das fehlende Verzeichnis im Text nennt. Das ist der Zweig, auf dem die ganze `/data/db`-Konstruktion ruht. `ERWARTETE_BEHAUPTUNGEN` exakt nachziehen
- [ ] `scripts/backup.sh` -- **Fail-Fast auf die Quelle**, bevor `.backup` läuft: `sqlite3 ".backup"` auf eine fehlende Quelldatei endet mit **0** und erzeugt eine gültige 4-KB-Leerdatenbank, deren `integrity_check` `ok` sagt (gemessen). Ohne die Prüfung füllt sich das Sicherungsverzeichnis mit Attrappen, und die Rotation löscht 31 Tage später die letzte echte Kopie. Zusätzlich die Zeilenzahl zwischen Quelle und Kopie vergleichen, bevor der Erfolg gemeldet wird

**Acceptance Criteria:**

- Given `npm run lint` und `npm run check`, when sie nach der Story laufen, then enden beide mit 0 — `gate:selftest`, `db:check` und `smoke` eingeschlossen
- Given `access_log off` wird aus **einem** der beiden `/i/`-Blöcke entfernt, when `npm run gate` läuft, then endet es mit 1 (Regel 13)
- Given der `existsSync`-Wächter in `src/lib/server/db/index.ts:47-53` wird durch ein `mkdirSync(…, { recursive: true })` ersetzt, when `npm run smoke` läuft, then endet es mit 1 — die Zusage „lauter Abbruch bei Volume-Verlust" hängt danach nicht mehr am Augenschein
- Given die Quelldatenbank fehlt, when `scripts/backup.sh` läuft, then endet es ungleich 0 **ohne** eine Datei anzulegen — eine leere 4-KB-Datenbank mit `integrity_check: ok` darf nie als Sicherung durchgehen
- Given `git diff --stat` gegen `0c517ec`, when er betrachtet wird, then ist **keine** Datei unter `src/` und keine unter `drizzle/` enthalten
- Given `docker compose config` **mit vollständiger `.env`**, when es läuft, then endet es mit 0, und `app` trägt **keinen** `ports`-Eintrag. Ohne `.env` **muss** es scheitern: die `${VAR:?…}`-Pflichtdeklarationen sind Absicht, ein Vorgabewert für die Domain wäre ein stiller Fehlbetrieb
- Given `docker compose build`, when es auf dem Entwicklerrechner läuft, then endet es mit 0 ohne `node-gyp`-Ausgabe, und `docker image inspect` zeigt `User` = `node`
- Given der laufende Stapel, when `docker compose exec app id -u` läuft, then ist die Ausgabe nicht `0`
- Given `docker compose ps`, when der Stapel oben ist, then stehen alle drei Dienste auf `running` und `app` auf `healthy`
- Given `docker compose exec app ls drizzle/meta`, when es läuft, then liegen `_journal.json` und beide Snapshots im Image — sonst scheitert die Migration erst beim ersten Start auf einer leeren Datenbank
- Given eine Aufgabe wurde über die Oberfläche abgelegt, when `docker compose down` und danach `docker compose up -d` läuft, then steht sie danach wieder in der Liste
- Given `docker compose exec nginx nginx -t`, when es läuft, then meldet es `syntax is ok` und `test is successful`
- Given die gerenderte Datei `docker compose exec nginx cat /etc/nginx/conf.d/app.conf`, when sie gelesen wird, then steht die Domain aus `.env` darin und `$host` sowie `$binary_remote_addr` sind unversehrt
- Given 40 rasche Abrufe von `/i/x`, when danach `docker compose logs nginx` durchsucht wird, then kommt **keine** Zeile mit `/i/` vor, und mindestens einer der Abrufe wurde mit 429 beantwortet
- Given `scripts/backup.sh` bei laufendem Stapel, when es ausgeführt wird, then entsteht genau eine Datei im Sicherungsverzeichnis, `sqlite3 <datei> "PRAGMA integrity_check"` sagt `ok`, und im Volume bleibt keine `backup.tmp` liegen
- Given `scripts/backup.sh` bei gestopptem `app`, when es ausgeführt wird, then endet es mit einem Code ungleich 0 und einer Meldung, und im Sicherungsverzeichnis entsteht keine leere Datei
- Given eine Sicherungsdatei mit `touch -t` auf 31 Tage zurückdatiert und eine auf 29, when `scripts/backup.sh` läuft, then ist die erste weg und die zweite da
- Given `SESSION_SECRET` wird in `.env` geleert, when `docker compose up -d` läuft, then endet `app` mit Exit 1 und `docker compose logs app` zeigt die deutsche Meldung ohne Stacktrace
- Given das Runbook, when eine Person es an einer frischen Maschine Schritt für Schritt liest, then enthält jeder Schritt einen ausführbaren Befehl, und kein Schritt setzt Wissen voraus, das nur in dieser Spec steht

## Spec Change Log

**2026-08-27 — Die Code Map nannte einen falschen Mechanismus für den Verzicht auf Build-Werkzeuge.**

Behauptet war: `"gypfile": false` in `node_modules/better-sqlite3/package.json` verhindere, dass npm `node-gyp` anwirft. Ausgeführt bricht `npm ci` im Alpine-Image mit `Could not find any Python installation to use` ab. Der Grund: `binding.gyp` liegt im Paket, und npm 11 leitet daraus einen Build ab, ohne das Feld zu beachten. Die **Schlussfolgerung** der Code Map hielt — es braucht keine Build-Werkzeuge —, ihre **Begründung** nicht. Gebaut wurde `npm ci --ignore-scripts && npm rebuild esbuild`; die Prebuilds für `linuxmusl` greifen danach wie beschrieben. Nachgeprüft: `binding.gyp` ist vorhanden, `gypfile` steht auf `false`.

**2026-08-27 — Die Matrixzeile „Volume weg" war nicht erfüllt: ein `/data` im Image machte jeden Volume-Verlust still.**

Die erste Umsetzung legte `mkdir -p /data && chown node:node /data` ins Image, weil ein Named Volume auf einem Mountpunkt ohne Vorbild `root` gehört und der non-root-Prozess dort nicht schreiben kann (nachgestellt: `touch: Permission denied` als uid 1000). Damit befüllte Docker aber jedes frische Volume aus dem Image-Verzeichnis: `/data` existierte nach einem Verlust sofort wieder, die Anwendung startete und blieb oben — nachgestellt, `Up` nach acht Sekunden — und legte still eine leere Datenbank an. Die Matrix verlangt das Gegenteil, und sie hat recht: Nach einem Volume-Verlust sähe die Gemeinschaft `Nichts offen.` ohne jeden Hinweis auf Datenverlust und schriebe in eine frische Datenbank, was die Wiederherstellung nachträglich verkompliziert.

Gebaut wurde statt dessen die Datenbank **eine Ebene unter dem Mountpunkt**: kein `/data` im Image, `DATABASE_PATH=/data/db/db.sqlite`, Volume weiter auf `/data`. Ein frisches oder verlorenes Volume lässt `/data` als root-eigenen Mountpunkt entstehen, `/data/db` fehlt, und die Anwendung endet über ihren bereits geprüften Fehlerpfad `src/lib/server/db/index.ts:46-53` mit der benannten Meldung. `/data/db` entsteht einmal je Maschine durch einen ausdrücklichen Runbook-Schritt — die einzige Stelle, an der ein leerer Datenbestand bewusst entsteht, und damit genau die Unterscheidung zwischen „erster Start" und „Volume verloren". Kein Byte unter `src/`. Mitgezogen: `scripts/backup.sh` legt seine Temporärdatei nach `/data/db/`, weil `/data` root gehört.

Belegt durch Ausführung: `ls -ld /data` im Image meldet `No such file or directory`; auf frischem Volume endet der Container mit `Das Verzeichnis für die Datenbank fehlt: /data/db`; nach dem Einrichtungsschritt ist `/data` `root`, `/data/db` `node`, und der Stapel wird `healthy`.

**2026-08-27 — Die Spec behauptete, kein Prüfwerkzeug sei zu erweitern. Damit waren die zwei tragenden Zusagen der Story von nichts gedeckt.**

Die Code Map hielt fest: „Keine der zwölf Regeln ist betroffen, kein neues Fixture nötig, `gate:selftest` bleibt unverändert" und „`scripts/smoke-zugang.ts` bleibt unangetastet, `ERWARTETE_BEHAUPTUNGEN` ändert sich nicht". Beides stimmte für den **bestehenden** Prüfbestand und war als Beschreibung richtig — als Entscheidung war es falsch. Der Verifikationslücken-Reviewer hat beide Löcher mit ausgeführten Gegenproben belegt: `access_log off` aus einem `/i/`-Block löschen lässt `npm run lint` grün und `nginx -t` zufrieden, während jedes Klartext-Token in `access.log` läuft; und den `existsSync`-Wächter durch ein `mkdirSync` ersetzen lässt ebenfalls alles grün, obwohl damit genau der stille Leerstart zurückkehrt, gegen den diese Story gebaut ist. Dazu kam ein dritter, gemessener Fund: `sqlite3 ".backup"` auf eine fehlende Quelle endet mit 0 und legt eine gültige 4-KB-Leerdatenbank an, deren `integrity_check` `ok` meldet.

Ergänzt wurden darum drei Aufgaben: Gate-Regel 13 samt Fixture, eine Smoke-Behauptung auf den fehlenden-Verzeichnis-Zweig, und ein Fail-Fast auf die Quelldatei in `scripts/backup.sh`. Jede trägt ein Akzeptanzkriterium in Mutationsform — die Prüfung muss rot werden, wenn man die Zusage bricht.

**Abweichung vom Ablauf, bewusst und vom Menschen entschieden:** Formal ist dies ein `bad_spec` und löst eine Rückschleife mit Verwerfen des Codes aus. Da die drei Prüfungen rein additiv sind und der bereits gegen einen laufenden Stapel verifizierte Entwurf tragfähig ist, wurde statt dessen die Spec nachgezogen und der Code gepatcht. `review_loop_iteration` bleibt darum auf 0.

**KEEP** — was die Nachbesserung nicht verlieren durfte und nicht verloren hat: `limit_req_log_level info` (ohne das schreibt `limit_req` jedes gedrosselte Token in Voll­länge ins Fehlerprotokoll und die Protokollzusage fällt), `access_log off` **auch** im Port-80-Block von `/i/` (die Umleitung selbst würde das Token sonst protokollieren), `tmpfs` auf `/etc/nginx/conf.d` (verdeckt die `default.conf` des Images, die sonst statt der 301 die nginx-Willkommensseite ausliefert) und die `${VAR:?…}`-Pflichtdeklarationen.

## Design Notes

**Warum ein 403 der Healthcheck ist und kein neuer Endpunkt.** Der Epic-Kontext hält fest, dass Story 1.6 „keine Codeabhängigkeit nach oben" hat. Ein `/gesundheit` wäre eine neue unauthentifizierte Route, ein neuer Eintrag in der Ausnahmeliste von `hooks.server.ts:24`, und damit fiele diese Zusage. Das 403 des Wächters leistet dasselbe und mehr: es beweist, dass der Prozess hört **und** dass der `init`-Hook durchgelaufen ist, ohne mit `process.exit(1)` zu enden — also dass Datenbank, Sitzungsgeheimnis und Herkunft geprüft und in Ordnung sind. Ein 200 auf einer trivialen freien Route würde weniger beweisen. Der Preis ist benannt: ändert sich der Statuscode des Wächters je, meldet der Healthcheck den Container als krank. Das fällt sofort auf und steht als Kommentar an der Zeile.

**Warum die Ratenbegrenzung grosszügig ist.** `limit_req_zone … rate=20r/m` mit `burst=10 nodelay`. Ein Token hat 32 zufällige Bytes; Erraten ist keine realistische Gefahr, und die Begrenzung ist Tiefenstaffelung, nicht die Verteidigungslinie. Was sie wirklich verhindert, ist eine Protokoll- und Ressourcenflut. Zu eng gesetzt trifft sie die Falschen: zwanzig Leute in einem Garten hängen oft an derselben Mobilfunk-NAT-Adresse, und ein Messenger holt die Verbindungsvorschau selbst ab, bevor der Mensch tippt. Ein 429 auf den einzigen Weg herein wäre der teuerste Fehler dieser Story — teurer als eine zu lasche Grenze.

**Warum das Attrappen-Zertifikat im Runbook steht.** nginx startet nicht, wenn die in `ssl_certificate` genannte Datei fehlt; certbot kommt aber nur an die ACME-Prüfung, wenn nginx läuft. Diesen Ring löst kein Compose-Kunstgriff sauber auf. Das Runbook macht ihn darum zu einem ausdrücklichen Schritt: ein selbstsigniertes Zertifikat ins Volume legen, hochfahren, das echte holen, neu laden. Ein Schritt, den man einmal je Maschine tut und der erklärt ist, ist besser als ein Startskript, das ihn versteckt und beim zweiten Mal überrascht.

**Warum `sqlite3` im Laufzeit-Image liegt.** Die Alternative wäre `sqlite3` auf dem Host, der dann den internen Docker-Volume-Pfad kennen müsste — eine Kopplung an Docker-Interna, die bei jedem Umzug bricht. Ein `apk add --no-cache sqlite` kostet rund 1,5 MB und macht `scripts/backup.sh` zu einem Skript, das nur `docker` und `find` braucht. Die Sicherung nutzt damit dieselbe SQLite-Familie, die auch schreibt.

## Verification

**Commands:**

- `npm run lint` -- expected: Exit 0 über die ganze siebengliedrige Kette; belegt insbesondere, dass `docker-compose.yml` Prettier-konform ist
- `npm run check` -- expected: Exit 0
- `git diff --stat 0c517ec -- src drizzle` -- expected: leere Ausgabe
- `docker compose config -q` -- expected: Exit 0
- `docker compose build` -- expected: Exit 0, keine `node-gyp`-Zeile in der Ausgabe
- `docker compose up -d && docker compose ps` -- expected: drei Dienste `running`, `app` `healthy`
- `docker compose exec nginx nginx -t` -- expected: `syntax is ok`, `test is successful`
- `docker compose exec app id -u` -- expected: `1000`, nicht `0`
- `curl -sI http://localhost/ ` -- expected: `301` mit `Location: https://…`
- `for i in $(seq 40); do curl -so /dev/null -w '%{http_code}\n' -k https://localhost/i/x; done` -- expected: mindestens ein `429`
- `docker compose logs nginx | grep -c '/i/'` -- expected: `0`
- `sh scripts/backup.sh && sqlite3 <neueste Datei> 'PRAGMA integrity_check'` -- expected: `ok`

**Manual checks (if no CLI):**

- Der Docker-Daemon läuft auf diesem Rechner derzeit **nicht** — vor der Prüfung Docker Desktop starten. Ohne ihn ist keiner der `docker`-Befehle oben aussagekräftig
- TLS-Handschlag und certbot sind **lokal nicht prüfbar** und bleiben ausdrücklich ungetestet: sie brauchen einen von aussen erreichbaren Hostnamen. Für den lokalen Lauf tritt das selbstsignierte Attrappen-Zertifikat an ihre Stelle, `curl -k`. Was ungetestet bleibt, steht so auch im Runbook
- Das Runbook einmal von oben nach unten lesen und jeden Befehl darin gegen die tatsächlich gebauten Dateinamen prüfen — ein Runbook mit einem falschen Pfad ist schlimmer als keines

## Suggested Review Order

**Der Stapel und seine Grenzen**

- Einstieg: die drei Dienste auf einen Blick — `app` ohne `ports` ist die tragende Grenze.
  [`docker-compose.yml:9`](../../docker-compose.yml#L9)

- Der Healthcheck nimmt ein **403** als gesund; die Begründung steht daneben.
  [`docker-compose.yml:45`](../../docker-compose.yml#L45)

- `ORIGIN` entsteht aus `DOMAIN`, damit Herkunft und Zertifikatsname nicht auseinanderlaufen.
  [`docker-compose.yml:24`](../../docker-compose.yml#L24)

- `PORT` festgenagelt: derselbe Port steht an drei Stellen, die zusammenpassen müssen.
  [`docker-compose.yml:32`](../../docker-compose.yml#L32)

- Ein `tmpfs` verdeckt die `default.conf` des Images — sonst antwortet Port 80 mit der Willkommensseite.
  [`docker-compose.yml:94`](../../docker-compose.yml#L94)

**Das Image**

- Warum kein `apk add python3 make g++` — und warum das nicht an `gypfile` liegt.
  [`Dockerfile:8`](../../Dockerfile#L8)

- `--ignore-scripts` ist hier der Grund, dass der Bau überhaupt durchläuft, keine Vorsicht.
  [`Dockerfile:34`](../../Dockerfile#L34)

- Im Image entsteht **kein** `/data`: daran hängt der laute Abbruch bei Volume-Verlust.
  [`Dockerfile:86`](../../Dockerfile#L86)

- `drizzle/` neben `build/`, weil die Migration arbeitsverzeichnisrelativ läuft.
  [`Dockerfile:84`](../../Dockerfile#L84)

**TLS, Umleitung und der Einlösepfad**

- Der teuerste Fund der Story: `limit_req` neben `return` ist wirkungslos, `try_files` rettet es.
  [`app.conf.template:53`](../../nginx/templates/app.conf.template#L53)

- `access_log off` im Port-80-Block — auch die Umleitung würde das Token protokollieren.
  [`app.conf.template:42`](../../nginx/templates/app.conf.template#L42)

- Dasselbe auf 443, mit der bindenden Zusage als Kommentar.
  [`app.conf.template:137`](../../nginx/templates/app.conf.template#L137)

- Die `add_header`-Vererbungsfalle: eine eigene Kopfzeile in `/i/` nähme dem Pfad alle vier.
  [`app.conf.template:98`](../../nginx/templates/app.conf.template#L98)

- ACME vor der Umleitung — der Grund ist nicht, dass http-01 Umleitungen nicht folgte.
  [`app.conf.template:34`](../../nginx/templates/app.conf.template#L34)

- Die Zone gehört in den `http`-Block; 20r/m mit burst 10 ist bewusst grosszügig.
  [`nginx.conf:48`](../../nginx/nginx.conf#L48)

**Die Sicherung**

- Gemessen, nicht vermutet: `.backup` auf eine fehlende Quelle meldet Erfolg.
  [`backup.sh:114`](../../scripts/backup.sh#L114)

- Der Fingerabdruck-Abgleich — `integrity_check` allein hält eine Attrappe nicht auf.
  [`backup.sh:162`](../../scripts/backup.sh#L162)

- Erst `.teil`, umbenannt wird nach beiden Prüfungen; ein `trap` räumt jeden Ausgang.
  [`backup.sh:139`](../../scripts/backup.sh#L139)

- Die `mkdir`-Sperre gegen zwei überlappende Läufe auf dieselbe Temporärdatei.
  [`backup.sh:79`](../../scripts/backup.sh#L79)

**Die neuen Prüfungen — was die Zusagen erst bindend macht**

- Regel 13, die erste Torregel, die über `src/` hinausliest, samt Begründung.
  [`gate.mjs:78`](../../scripts/gate.mjs#L78)

- Der Kern der Regel: Kommentare werden ausgeblendet, sonst zählt ein totes `access_log off`.
  [`gate.mjs:1296`](../../scripts/gate.mjs#L1296)

- Die zwei Fehlerproben, Verstoss und Gegenprobe mit gestellten Fallen.
  [`gate.mjs:1623`](../../scripts/gate.mjs#L1623)

- Die Behauptung auf den `existsSync`-Zweig — der Zweig, auf dem `/data/db` ruht.
  [`smoke-zugang.ts:819`](../../scripts/smoke-zugang.ts#L819)

**Runbook und benannte Kosten**

- Die sechs Entscheidungen, die beim Lesen sonst überraschen.
  [`README.md:193`](../../README.md#L193)

- Das Runbook selbst, von der leeren Maschine bis zum ersten Link.
  [`README.md:232`](../../README.md#L232)

- Die Wiederherstellung: geprüft wird, bevor gelöscht wird.
  [`README.md:541`](../../README.md#L541)

- Zuletzt die benannten Kosten — darunter das ungesicherte `SESSION_SECRET`.
  [`README.md:657`](../../README.md#L657)
