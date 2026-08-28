---
name: Gemeinschaftsgarten
description: Aufgabenliste für einen Gemeinschaftsgarten. Neutral, übersichtlich, anmächelig — Beetgrün auf warmem Off-White, keine Zählungen, keine Dekoration.
status: final
created: '2026-08-26'
updated: '2026-08-26'
experience: './EXPERIENCE.md'
colors:
  surface-base: '#F5F4EF'
  surface-raised: '#FFFFFF'
  ink-primary: '#1C221B'
  ink-secondary: '#66705F'
  hairline: '#DCDCD2'
  accent: '#2F6B3F'
  accent-ink: '#FFFFFF'
  overdue: '#9A5A12'
  surface-base-dark: '#12160F'
  surface-raised-dark: '#1A2018'
  ink-primary-dark: '#E9EDE4'
  ink-secondary-dark: '#98A292'
  hairline-dark: '#2C3529'
  accent-dark: '#7FBB8C'
  accent-ink-dark: '#0E1410'
  overdue-dark: '#D99B4E'
typography:
  display:
    fontFamily: "'Figtree', system-ui, sans-serif"
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: '-0.02em'
  section:
    fontFamily: "'Figtree', system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.015em'
  task:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '0.09em'
  action:
    fontFamily: "'Figtree', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1
rounded:
  sm: 5px
  md: 8px
  lg: 12px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  gutter: 16px
  measure: 600px
  touch: 44px
components:
  title-bar:
    background: '{colors.accent}'
    color: '{colors.accent-ink}'
    font: '{typography.section}'
    padding: '{spacing.3} {spacing.4}'
  nav-bar:
    background: '{colors.surface-raised}'
    borderTop: '1px solid {colors.hairline}'
    itemMinHeight: '{spacing.touch}'
    activeColor: '{colors.accent}'
    inactiveColor: '{colors.ink-secondary}'
    font: '{typography.meta}'
  task-row:
    background: '{colors.surface-raised}'
    borderTop: '1px solid {colors.hairline}'
    padding: '{spacing.3}'
    minHeight: '{spacing.touch}'
    font: '{typography.task}'
  task-box:
    size: 22px
    hitArea: '{spacing.touch}'
    border: '2px solid {colors.accent}'
    radius: '{rounded.sm}'
    checkedBackground: '{colors.accent}'
    checkedColor: '{colors.accent-ink}'
  button-primary:
    background: '{colors.accent}'
    color: '{colors.accent-ink}'
    minHeight: '{spacing.touch}'
    radius: '{rounded.md}'
    font: '{typography.action}'
    padding: '0 {spacing.4}'
  button-quiet:
    background: transparent
    color: '{colors.accent}'
    border: '1px solid {colors.hairline}'
    minHeight: '{spacing.touch}'
    radius: '{rounded.md}'
    font: '{typography.action}'
  card:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.hairline}'
    radius: '{rounded.md}'
    padding: '{spacing.3}'
  duty-banner:
    background: '{colors.surface-raised}'
    borderLeft: '3px solid {colors.accent}'
    border: '1px solid {colors.hairline}'
    radius: '{rounded.sm}'
    padding: '{spacing.3}'
  textarea-bulk:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.hairline}'
    radius: '{rounded.md}'
    font: '{typography.task}'
    minHeight: 16em
    padding: '{spacing.3}'
---

# Design Spine — Gemeinschaftsgarten

Diese Datei und `EXPERIENCE.md` sind gleichrangige Verträge. Bei Widerspruch zu einem Mockup, Wireframe oder Import gewinnen die Spines.

## Brand & Style

Der Gemeinschaftsgarten ist eine Aufgabenliste, die zwanzig Freiwillige benutzen sollen, von denen die meisten kein Interesse an einer App haben. Die drei Anforderungen des Auftraggebers lauteten **neutral, übersichtlich und trotzdem anmächelig** — und die stehen in Spannung. Die Auflösung: alles Neutrale und Übersichtliche kommt aus der Struktur, das Anmächelige kommt allein aus Farbe und Schriftgrösse. Es gibt keine Illustration, kein Maskottchen, kein Bild, keinen Farbverlauf.

Die Haltung ist bewusst **unfeierlich**. Es gibt keine Fortschrittsbalken, keine Serien, keine Abzeichen und keine Rangliste — nicht aus Geschmack, sondern weil das gesamte Produkt darauf beruht, dass Abhaken sozial nichts kostet. Jede Zählung würde daraus eine Leistung machen und den Zweck zerstören.

Das Vorbild ist ein **gepflegter Garten im Halbschatten**: ruhig, geordnet, grün, mit einem warmen Untergrund. Nicht die Postkarte vom Bauerngarten in der Mittagssonne.

**Verwandtschaft zu beehiveJournal:** Aufbau, Grosszügigkeit und Sachlichkeit werden übernommen, die Farbwelt nicht. Die beiden Anwendungen sind Cousins, keine Zwillinge.

Die gewählte Richtung im Vergleich mit den vier verworfenen: [`mockups/farbvarianten.html`](./mockups/farbvarianten.html). Angewandt zu sehen in [`mockups/startseite.html`](./mockups/startseite.html) und [`mockups/monatsplan.html`](./mockups/monatsplan.html).

## Colors

Ein einziger chromatischer Ton für alles Handlungsfähige, ein einziger für Überfälligkeit. Sonst Neutrale mit leichter Grünneigung — kein reines Grau, damit der Grund gewählt und nicht geerbt wirkt.

- **Beetgrün (`#2F6B3F` hell / `#7FBB8C` dunkel)** ist der einzige Akzent. Titelleiste, Umriss des Kästchens, Hauptaktion, aktives Navigationsziel, linke Kante des Diensthinweises. Er signalisiert *hier kann gehandelt werden* — nie Dekoration, nie ein Zustandsabzeichen.
- **Off-White (`#F5F4EF`)** ist der Grund im Hellen, minim warm und grünlich abgetönt. Weisse Flächen (`#FFFFFF`) liegen darauf als Karten und Listen, sodass Struktur ohne Schatten entsteht.
- **Waldschwarz (`#1C221B`)** ist Fliesstext und Überschrift. Kein reines Schwarz — der Grünstich hält es mit dem Akzent zusammen.
- **Gedämpftes Blattgrau (`#66705F`)** trägt Nebeninformation: Termine, `(optional)`, inaktive Navigationsziele, erledigte Zeilen. Bei 4.71:1 auf dem Grund, also noch über dem Textboden.
- **Lehmbraun (`#9A5A12` hell / `#D99B4E` dunkel)** ist ausschliesslich Überfälligkeit. Es ist absichtlich **kein Rot**: eine Aufgabe, die vier Wochen liegt, ist kein Fehler und keine Gefahr. Rot bleibt für Zerstörendes reserviert — im MVP nur das Widerrufen einer Einladung.
- **Haarlinie (`#DCDCD2` hell / `#2C3529` dunkel)** trennt Listenzeilen auf der niedrigsten brauchbaren Stufe.

**Der dunkle Modus ist gleichrangig gestaltet, keine Invertierung.** Der Akzent wird aufgehellt (`#7FBB8C`), damit er auf dunklem Grund trägt, und die Titelleistenschrift wird zu einem sehr dunklen Grün statt Weiss.

### Kontrast, geprüft statt behauptet

| Paarung | Hell | Dunkel | Ziel |
| --- | --- | --- | --- |
| Fliesstext auf Grund | 14.74:1 | 15.43:1 | 4.5 |
| Nebentext auf Grund | 4.71:1 | 6.90:1 | 4.5 |
| Akzent als Text auf Weiss | 6.37:1 | 7.43:1 | 4.5 |
| Titelleistenschrift auf Akzent | 6.37:1 | 8.34:1 | 4.5 |
| Überfällig auf Karte | 5.46:1 | 6.92:1 | 4.5 |
| Kästchen-Umriss auf Karte | 6.37:1 | 7.43:1 | 3.0 |

Die Haarlinie liegt bei 1.38:1 (hell) bzw. 1.30:1 (dunkel) und erfüllt 3:1 **nicht** — bewusst. Trennlinien sind dekorativ und identifizieren kein Bedienelement; die Zeile bleibt ohne sie eindeutig lesbar. Jeder Umriss, der zu einem Bedienelement gehört, nutzt `{colors.accent}` und liegt weit über der Schwelle. Wird die Haarlinie je zum einzigen Träger einer Bedeutung, muss sie auf 3:1 angehoben werden.

**Nicht verwenden:** Farbverläufe · Schattenfarben · gesättigte Varianten des Akzents · Rot für irgendetwas ausser Zerstörendem · Farbe als einziger Träger eines Zustands.

## Typography

Zwei Familien, **selbst gehostet als woff2 in `static/fonts/`** — nicht von Googles CDN geladen. Begründung ist nicht Geschwindigkeit, sondern Datenschutz: die Anwendung verspricht der Gemeinschaft, keine Daten an Dritte zu geben, und ein Font-CDN überträgt bei jedem Aufruf die IP-Adresse.

- **Figtree** für Überschriften und Aktionen. Eine warme humanistische Grotesk — freundlich, ohne verspielt zu sein. Hier sitzt das Anmächelige.
- **Inter** für alles Gelesene und alle Daten. Grosse x-Höhe und offene Formen, in praller Sonne auf einem Handy noch lesbar. Dieselbe Familie wie im Referenzprojekt.

`[ASSUMPTION]` Beide Familien sind gesetzt, aber nicht bestätigt. Wenn eine Familie genügen soll, fällt Figtree weg und Inter übernimmt die Überschriften in 800.

### Rampe

| Rolle | Grösse | Gewicht | Einsatz |
| --- | --- | --- | --- |
| `display` | 30px | 700 | Seitentitel, einer pro Seite |
| `section` | 20px | 700 | Titelleiste, Abschnittstitel, Titel einer Einzelaufgabe |
| `task` | 16px | 400 | Aufgabentext, Sheet-Inhalt, Textfelder |
| `body` | 16px | 400 | Fliesstext |
| `meta` | 13px | 500 | Termine, `seit N Wochen überfällig`, Navigationsbeschriftung |
| `label` | 12px | 600, +0.09em, Grossbuchstaben | Abschnittsmarken wie `OFFEN` |
| `action` | 16px | 700 | Knopftext |

**Regeln:** nie unter 12px, und 12px nur für `label`. Gelesener Text nie unter 16px — kleiner ist im Freien nicht mehr zumutbar. Alle Grössen in `rem`, damit die systemweite Vergrösserung greift. Nur eine `display`-Grösse pro Seite. Keine Kursive irgendwo. Ziffern in Tabellen und im Dienstplan mit `font-variant-numeric: tabular-nums`.

## Layout & Spacing

Eine Spalte, `{spacing.measure}` = 600px maximal, zentriert. Aussenabstand `{spacing.gutter}` = 16px, auf schmalen Geräten nie kleiner.

Die Skala ist eine 4px-Basis: 4 · 8 · 12 · 16 · 24 · 32. Nichts dazwischen, nichts darüber. Abstände zwischen Geschwistern entstehen über `gap` in Flex oder Grid, nie über Aussenabstände an einzelnen Elementen.

**Rhythmus einer Seite:** Titelleiste · 24px · Seitentitel · 16px · Inhalt in Karten mit 12px Abstand · 32px · Navigationsleiste. Zwischen Abschnitten 24px, innerhalb einer Karte 12px.

Ab 600px Fensterbreite wandert die Navigationsleiste von unten nach oben (siehe `EXPERIENCE.md`); Abstände und Masse ändern sich nicht. Es gibt genau diesen einen Umbruchpunkt.

Die Navigationsleiste trägt zusätzlich `padding-bottom: env(safe-area-inset-bottom)`.

## Elevation & Depth

**Keine Schatten.** Tiefe entsteht ausschliesslich tonal: weisse Karten auf dem Off-White-Grund, getrennt durch die Haarlinie. Im Dunkeln liegt `surface-raised` eine Stufe heller als `surface-base` — dasselbe Prinzip, umgekehrte Richtung.

Es gibt genau zwei Ebenen: Grund und Karte. Keine dritte. Kein `box-shadow`, kein `filter: drop-shadow`, keine Umrisse zur Vortäuschung von Höhe. Ein Garten hat keine Schlagschatten in der Bedienoberfläche.

## Shapes

Drei Radien, jeder mit einer Aufgabe:

- `{rounded.sm}` 5px — Kästchen und der Diensthinweis. Fast eckig, weil ein Kästchen als Kästchen erkennbar bleiben soll.
- `{rounded.md}` 8px — Karten, Knöpfe, Textfelder. Der Standardwert; wenn unklar, dieser.
- `{rounded.lg}` 12px — nur der äussere Rahmen einer ganzen Liste.

Keine Kreise, keine Pillen, kein `9999px`. Eine vollständig gerundete Pille signalisiert Abzeichen oder Status-Chip, und beides gibt es hier nicht.

## Components

### `title-bar`

Volle Breite, `{colors.accent}` gefüllt, Text `Gemeinschaftsgarten` in `{typography.section}` und `{colors.accent-ink}`. Klebt nicht, scrollt mit weg. Trägt keine Knöpfe, keine Navigation, kein Konto-Menü — nur den Namen, damit man weiss, wo man ist.

### `nav-bar`

Fest am unteren Rand, `{colors.surface-raised}` mit Haarlinie oben. Vier Ziele mit gleicher Breite, jedes mindestens 44px hoch, Beschriftung in `{typography.meta}`. Das aktive Ziel ist `{colors.accent}`, die übrigen `{colors.ink-secondary}`. **Keine Symbole ohne Text** — bei zwanzig Leuten mit sehr unterschiedlicher Vertrautheit ist ein Wort verlässlicher als ein Piktogramm. Das aktive Ziel wird zusätzlich mit einer 2px-Kante in `{colors.accent}` markiert, damit es nicht nur an der Farbe hängt.

### `task-row`

Kästchen links, Text rechts, 12px Abstand. Zeilenhöhe mindestens 44px. Trennung zur nächsten Zeile durch Haarlinie oben; die erste Zeile hat keine.

- **Offen:** Text in `{typography.task}` und `{colors.ink-primary}`.
- **Überfällig:** darunter eine zweite Zeile in `{typography.meta}` und `{colors.overdue}` mit `seit N Wochen überfällig`. Der Text ist Pflicht, die Farbe allein trägt nie.
- **Erledigt (in dieser Sitzung):** Text `{colors.ink-secondary}` mit Durchstreichung, Kästchen gefüllt `{colors.accent}` mit weissem Haken. Der Übergang dauert 140ms und entfällt bei `prefers-reduced-motion`.

### `task-box`

22px sichtbar, Trefferfeld 44px durch Innenabstand — die sichtbare Grösse und das Trefferfeld sind zwei verschiedene Dinge, und nur letzteres muss 44 sein. 2px Umriss in `{colors.accent}`, Radius `{rounded.sm}`. Gefüllt zeigt es einen Haken in `{colors.accent-ink}`. Es ist ein echtes Bedienelement in einem Formular, kein `<div>` mit Klick-Handler.

### `button-primary`

Über die volle Spaltenbreite, `{colors.accent}` gefüllt, Text `{typography.action}` in `{colors.accent-ink}`, Radius `{rounded.md}`, mindestens 44px hoch. Höchstens einer pro Seite. Er trägt immer ein Verb und, wo eine Menge im Spiel ist, die Zahl: `25 Aufgaben ablegen`.

### `button-quiet`

Für Nebenaktionen: durchsichtig, Text `{colors.accent}`, Umriss `{colors.hairline}`. Gleiche Höhe wie der primäre Knopf. Zerstörende Aktionen — im MVP nur `Einladung widerrufen` — nehmen dieselbe Form, aber Text und Umriss in Rot; das ist die einzige Stelle, an der Rot vorkommt.

### `duty-banner`

Nur vorhanden, wenn die betrachtende Person in dieser Woche Dienst hat. Karte mit 3px linker Kante in `{colors.accent}`. Das Wort `Diese Woche` in `{colors.accent}` und 600, der Rest normal. Kein Kästchen, kein Schliessen-Kreuz — ein Dienst ist keine Aufgabe und lässt sich nicht wegtippen.

### `textarea-bulk`

Das Textfeld der Massen-Eingabe. Mindestens 16em hoch, damit man beim Schreiben einer Monatsliste nicht in einem Schlitz tippt. `{typography.task}`, also dieselbe Grösse wie die späteren Aufgabenzeilen — was man schreibt, sieht aus wie das, was entsteht. Darunter die Zählung in `{typography.meta}` und `{colors.ink-secondary}`.

## Do's and Don'ts

**Do**

- Den Akzent für Handlungsfähigkeit reservieren; wo nichts zu tun ist, ist kein Grün.
- Struktur über Fläche und Haarlinie bauen, nicht über Schatten.
- Zahlen in Knopftexte schreiben, wenn eine Menge betroffen ist.
- Jede Farbaussage mit Text doppeln.
- Jede neue Grösse aus der Rampe nehmen, jeden neuen Abstand aus der 4px-Skala.
- Beide Modi gleichzeitig prüfen, nicht den dunklen nachträglich.

**Don't**

- Keine Fortschrittsbalken, Serien, Abzeichen, Ranglisten oder Zählungen erledigter Aufgaben.
- Kein Name neben einer erledigten Aufgabe, in keiner Ansicht, auch nicht als Tooltip.
- Keine Symbole ohne Beschriftung in der Navigation.
- Kein Rot ausser für Zerstörendes.
- Keine Schatten, keine Farbverläufe, keine Pillen-Radien.
- Keine Illustrationen, Fotos oder Maskottchen.
- Keine Schrift von einem fremden CDN laden.
- Keine zweite `display`-Grösse auf einer Seite.
