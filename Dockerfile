# Zwei Stufen auf node:24-alpine.
#
# node:24 und nicht node:20: better-sqlite3 13 verlangt engines.node >=22, die
# package.json dieses Projekts >=24 und npm >=11, und .npmrc trägt
# engine-strict=true — eine ältere Basis bricht schon beim npm ci ab. Kein
# latest-Tag: die Version steht fest.
#
# KEIN `apk add python3 make g++`. better-sqlite3 13.0.3 liefert
# prebuilds/linuxmusl-x64.node und prebuilds/linuxmusl-arm64.node mit, also
# genau den Alpine/musl-Fall — kompiliert werden muss nichts.
#
# Trotzdem versucht npm es: das Paket bringt binding.gyp mit, und npm 11 leitet
# daraus ein `node-gyp rebuild` ab, auch wenn die package.json ausdrücklich
# "gypfile": false trägt. Ohne Gegenmassnahme bricht `npm ci` hier mit
# "Could not find any Python installation to use" ab — gemessen, nicht
# vermutet. Die Gegenmassnahme ist --ignore-scripts (siehe unten), nicht ein
# Werkzeugkasten von 150 MB, der am Ende dieselbe Bibliothek erzeugt, die schon
# im Paket liegt. Dieser Absatz steht hier, damit ihn niemand aus Gewohnheit
# doch wieder hinzufügt.
#
# Die zweite Stufe gibt es also nicht wegen Compilern, sondern wegen der 26
# devDependencies (SvelteKit, Vite, ESLint, TypeScript): sie gehören nicht in
# ein Laufzeit-Image. Zur Laufzeit reichen better-sqlite3, drizzle-orm, jose
# und die zwei @fontsource-variable/*-Pakete.

FROM node:24-alpine AS bauer

WORKDIR /app

# Erst die Manifeste: solange sich nur Quellcode ändert, bleibt die
# Abhängigkeitsschicht im Cache. .npmrc muss mit — es trägt engine-strict=true
# und save-exact=true.
COPY package.json package-lock.json .npmrc ./
# --ignore-scripts ist hier keine Vorsichtsmassnahme, sondern der Grund, warum
# oben keine Build-Werkzeuge stehen: better-sqlite3 liefert zwar binding.gyp
# mit, npm leitet daraus trotz "gypfile": false ein `node-gyp rebuild` ab, und
# das verlangte python3, make und g++ — um am Ende dieselbe Bibliothek zu
# erzeugen, die als prebuilds/linuxmusl-*.node schon im Paket liegt. Gemessen:
# ohne diesen Schalter bricht npm ci mit "Could not find any Python
# installation to use" ab.
#
# `npm rebuild esbuild` holt danach das eine Script nach, das wirklich gebraucht
# wird: esbuild legt darin die Programmdatei für diese Plattform an, und ohne
# sie findet vite build sie nicht. Kein anderes Paket im Baum hat ein install-
# oder postinstall-Script (nachgesehen).
RUN npm ci --ignore-scripts && npm rebuild esbuild

# Dann die Quellen. `npm run build` braucht keine einzige Umgebungsvariable:
# die Pflichtprüfungen sitzen im init-Hook (src/hooks.server.ts), und den ruft
# der Analyseschritt von vite build nicht auf. Ein ARG dafür wäre falsch.
COPY . .
RUN npm run build


FROM node:24-alpine AS laufzeit

# sqlite für scripts/backup.sh. Die Alternative wäre sqlite3 auf dem Host, der
# dann den internen Volume-Pfad kennen müsste — eine Kopplung an Docker-Interna,
# die bei jedem Umzug bricht. Kostet rund 1,5 MB und lässt die Sicherung
# dieselbe SQLite-Familie benutzen, die auch schreibt.
RUN apk add --no-cache sqlite

WORKDIR /app

ENV NODE_ENV=production

# Die Wurzel-package.json MUSS ins Laufzeit-Image: build/ bringt keine eigene
# mit, und ohne "type": "module" lädt Node build/index.js als CommonJS und
# stürzt ab.
COPY package.json package-lock.json .npmrc ./
# --ignore-scripts aus demselben Grund wie oben: sonst liefe node-gyp für
# better-sqlite3 an. Hier ist danach auch kein `npm rebuild esbuild` nötig —
# esbuild ist eine devDependency und fällt mit --omit=dev ohnehin weg. Der
# Schalter erspart zugleich das prepare-Script `svelte-kit sync`, dessen
# Werkzeug in dieser Stufe gerade fehlt.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=bauer /app/build ./build

# drizzle/ neben build/: migrate() in src/lib/server/db/index.ts liest
# migrationsFolder: 'drizzle' arbeitsverzeichnisrelativ, und WORKDIR ist der
# Elternordner. Beide .sql-Dateien und meta/ gehören dazu. Kein separater
# Migrationsschritt, kein Init-Container.
COPY --from=bauer /app/drizzle ./drizzle

# HIER WIRD /data BEWUSST NICHT ANGELEGT, und /data/db erst recht nicht.
#
# Das ist die Stelle, an der ein Volume-Verlust laut wird statt still. Docker
# befüllt ein frisches Named Volume aus dem gleichnamigen Verzeichnis des
# Images: läge /data hier, existierte es nach jedem Volume-Verlust sofort
# wieder, die Anwendung startete mit einer leeren Datenbank, und die
# Gemeinschaft sähe `Nichts offen.` ohne jeden Hinweis auf den Datenverlust —
# und schriebe in die frische Datei hinein, was die Wiederherstellung aus der
# Sicherung nachträglich verkompliziert. Gemessen: mit einem angelegten /data
# stand der Container nach acht Sekunden gesund da.
#
# Darum liegt die Datenbank eine Ebene tiefer, unter /data/db/db.sqlite. Ein
# frisches Volume ist ein root-eigener, leerer Mountpunkt: /data/db fehlt, und
# db/index.ts endet mit genau seiner benannten Meldung "Das Verzeichnis für die
# Datenbank fehlt". Angelegt wird /data/db genau einmal je Maschine, von Hand,
# als ausdrücklicher Schritt des Runbooks — er ist die einzige Stelle, an der
# ein leerer Datenbestand bewusst entsteht. Ein Automatismus dafür wäre
# derselbe stille Datenverlust in bequem.

# Das mitgelieferte node-Konto (UID 1000) statt eines eigenen.
USER node

# Kein EXPOSE: dieser Dienst veröffentlicht nichts. nginx erreicht ihn über das
# interne Bridge-Netz auf app:3000.
CMD ["node", "build/index.js"]
