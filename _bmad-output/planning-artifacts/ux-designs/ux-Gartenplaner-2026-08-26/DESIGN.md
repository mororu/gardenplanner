---
name: Gemeinschaftsgarten
description: Aufgabenliste für einen Gemeinschaftsgarten. Neutral, übersichtlich, anmächelig — Salbei auf warmem Leinen, ein einziges Erscheinungsbild, keine Zählungen, keine Dekoration.
status: final
created: '2026-08-26'
updated: '2026-09-13'
experience: './EXPERIENCE.md'
colors:
  surface-base: '#F6F2EA'
  surface-raised: '#FFFDF8'
  ink-primary: '#241F18'
  ink-secondary: '#6B6153'
  hairline: '#E5DCCC'
  surface-open: '#EDF0E4'
  surface-griff: '#EDE7DB'
  accent: '#3F6B4A'
  accent-ink: '#FFFDF8'
  overdue: '#98481D'
  warn: '#856500'
  danger: '#A33427'
  reif-sofort: '#C0392B'
  reif-stehen: '#FFC400'
  reif-wachsen: '#2F7D46'
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
    border: '1px solid {colors.ink-secondary}'
    minHeight: '{spacing.touch}'
    radius: '{rounded.md}'
    font: '{typography.action}'
  card:
    background: '{colors.surface-raised}'
    openBackground: '{colors.surface-open}'
    border: '1px solid {colors.hairline}'
    radius: '{rounded.md}'
    padding: '{spacing.3}'
  duty-banner:
    background: '{colors.accent}'
    color: '{colors.accent-ink}'
    border: '1px solid {colors.accent}'
    radius: '{rounded.md}'
    padding: '{spacing.3} {spacing.4}'
    font: '{typography.section}'
    labelFont: '{typography.label}'
  section:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.ink-secondary}'
    radius: '{rounded.md}'
    headBackground: '{colors.surface-griff}'
    headMinHeight: '{spacing.touch}'
    headPadding: '{spacing.2} {spacing.3}'
    bodyPadding: '{spacing.3}'
  harvest-marker:
    borderLeft: '3px solid {colors.reif-sofort}'
    borderLeftStanding: '3px solid {colors.reif-stehen}'
    borderLeftGrowing: '3px solid {colors.reif-wachsen}'
  textarea-bulk:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.ink-secondary}'
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

Ein einziger chromatischer Ton für alles Handlungsfähige, einer für Überfälligkeit, einer für eine Lücke, die jemand schliessen muss, und drei für die Reifestufen der Ernte. Sonst Neutrale mit warmer Leinenneigung — kein reines Grau, damit der Grund gewählt und nicht geerbt wirkt.

> **Neu gesetzt am 2026-09-13, Palette „Leinen & Salbei".** Zugleich ist der dunkle Modus ersatzlos weggefallen: jedes Token hat genau einen Wert, und die Tabelle unten hat nur noch eine Spalte. Die Werte sind gerechnet und nicht gegriffen; `npm run kontrast:selftest` hält diese Tabelle gegen die Rechnung.

- **Salbei (`#3F6B4A`)** ist der einzige Akzent. Titelleiste, Umriss des Kästchens, Hauptaktion, aktives Navigationsziel, Fläche des Diensthinweises. Er signalisiert *hier kann gehandelt werden* — nie Dekoration, nie ein Zustandsabzeichen. Entsättigter als das Beetgrün davor, weil er auf Leinen und nicht auf Off-White steht.
- **Leinen (`#F6F2EA`)** ist der Grund, deutlich wärmer als das frühere Off-White. Die Karten darauf sind **nicht reinweiss** (`#FFFDF8`): ein reines Weiss schnitt gegen diesen Grund zu hart, und Struktur ohne Schatten braucht die Stufe, nicht den Sprung.
- **Rindenschwarz (`#241F18`)** ist Fliesstext und Überschrift. Kein reines Schwarz — der warme Stich hält es mit dem Grund zusammen.
- **Gedämpftes Rindengrau (`#6B6153`)** trägt Nebeninformation: Termine, `(optional)`, inaktive Navigationsziele, erledigte Zeilen. Bei 5.44:1 auf dem Grund, also mit Reserve über dem Textboden.
- **Rostlehm (`#98481D`)** ist ausschliesslich Überfälligkeit. Es ist absichtlich **kein Rot**: eine Aufgabe, die vier Wochen liegt, ist kein Fehler und keine Gefahr. Rot bleibt für Zerstörendes reserviert — im MVP nur das Widerrufen einer Einladung.
- **Gold (`#856500`)** ist ausschliesslich die unbesetzte Dienstwoche — eine Lücke, die jemand schliessen muss, nicht ein Fehler und nicht eine Gefahr. **Bis zum 2026-09-13 war es ein zweites dunkles Orange und von Rostlehm nahezu ununterscheidbar** (1.07:1 zueinander), und die Dokumentation nannte das ausdrücklich hingenommen. Jetzt trennt die zwei der Farbton: Rostlehm gegen Gold, 1.18:1 zueinander. Getragen wird die Aussage weiterhin vom Wort, nie von der Farbe.
- **Die Ampel der Ernte (`#C0392B` / `#FFC400` / `#2F7D46`)** steht für *sofort ernten*, *langsam anfangen zu ernten* und *noch wachsen lassen*. **Sie hat seit dem 2026-09-13 eigene Token**, und der Grund ist eine Rechnung: die drei Stufen erscheinen ausschliesslich als 3px-Kante, und eine Kante hält 3:1 statt der 4.5:1 für Text. Solange sie sich `{colors.danger}`, `{colors.warn}` und `{colors.accent}` liehen, waren sie an die strengere Schwelle gebunden und entsprechend gedämpft — *kann noch stehen* war auf drei Pixeln praktisch nicht zu sehen. Nebenbei hört damit auf, dass eine reife Zucchini sich die Farbe des Zerstörenden lieh.
- **Abschnittskopf (`#EDE7DB`)** ist die Fläche unter dem Griff eines aufklappbaren Abschnitts — der dunklere Leinenton. Er kam am 2026-09-13 dazu, weil der Griff vorher aussah wie die Karten, die er überschreibt.
- **Haarlinie (`#E5DCCC`)** trennt Listenzeilen auf der niedrigsten brauchbaren Stufe.

**Es gibt nur ein Erscheinungsbild.** `color-scheme: light` sagt das auch dem Browser, damit Formularelemente und Scrollbalken nicht dem System folgen und einer hell gestalteten Seite dunkel gegenübertreten.

### Kontrast, geprüft statt behauptet

| Paarung | Gemessen | Ziel |
| --- | --- | --- |
| Fliesstext auf Grund | 14.65:1 | 4.5 |
| Nebentext auf Grund | 5.44:1 | 4.5 |
| Akzent als Text auf Karte | 6.05:1 | 4.5 |
| Titelleistenschrift auf Akzent | 6.05:1 | 4.5 |
| Überfällig auf Karte | 6.30:1 | 4.5 |
| Unbesetzt auf Karte | 5.35:1 | 4.5 |
| Unbesetzt auf Grund | 4.87:1 | 4.5 |
| Zerstörend auf Karte | 6.71:1 | 4.5 |
| Zerstörend auf Grund | 6.11:1 | 4.5 |
| Bedienelement-Umriss auf Grund | 5.44:1 | 3.0 |
| Nebentext auf offener Karte | 5.26:1 | 4.5 |
| Nebentext auf Abschnittskopf | 4.93:1 | 4.5 |
| Ampel sofort an Karte | 5.35:1 | — |
| Ampel sofort an Grund | 4.87:1 | — |
| Ampel kann stehen an Karte | 1.57:1 | — |
| Ampel kann stehen an Grund | 1.43:1 | — |
| Ampel wachsen an Karte | 4.99:1 | — |
| Ampel wachsen an Grund | 4.54:1 | — |
| Haarlinie auf Karte | 1.34:1 | — |

Die Ampel steht in **zwei** Zeilen je Stufe, weil ihre Kante zwischen zwei Flächen liegt: aussen der Grund der Seite, innen die Karte.

**Sie hat seit dem 2026-09-13 keinen Boden mehr, und das ist entschieden.** Die mittlere Stufe sollte kräftig gelb werden; ein Gelb, das 3:1 gegen diese Karte hält, ist bei `#B87A00` zu Ende und liest sich als Braun — `#C08400` fällt bereits durch. Kräftiges Gelb und die Schwelle sind auf diesem Grund nicht zusammen zu haben.

Getragen wird das davon, dass WCAG 1.4.11 Kontrast für das verlangt, was zum Erkennen **nötig** ist. Was eine Zeile ist, sagt ihr Wort; dass sie ein Bedienelement ist, sagt ihr eigener Umriss in `{colors.ink-secondary}` bei 5.97:1. Der Streifen ist die dritte Auskunft über dieselbe Sache. Zwei Wachen halten die Ausnahme eng: `smoke:sicht` kennt die Art `zustandsmarke`, misst sie weiter und lässt nur die drei `--reif-*` hinein, und `smoke` prüft, dass jede Stufe ihr Wort neben dem Streifen behält. Fällt das Wort, fällt die Begründung.

Die Haarlinie erfüllt 3:1 **nicht** — bewusst. Sie trägt ausschliesslich Trennlinien und Behälterkanten: Karten, den Dialog und die Linie über der Navigationsleiste. Die sind dekorativ und identifizieren kein Bedienelement; die Zeile bleibt ohne sie eindeutig lesbar. Aus genau diesem Grund trägt der Griff eines Abschnitts **keine** Linie zu seinem Inhalt: er ist ein `<summary>`, also ein Bedienelement, und jede seiner Kanten hinge an der 3:1. Die Trennung leistet dort die Fläche (1.21:1 gegen die Karte).

**Jeder Umriss, der zu einem Bedienelement gehört, liegt über 3:1** — in `{colors.accent}` beim Kästchen der Aufgabenzeile und beim Fokusring (6.05:1), sonst in `{colors.ink-secondary}` (5.44:1 auf dem Grund, 5.97:1 auf der Karte): Textfeld, Auswahlfeld, mehrzeiliges Feld, `button-quiet`, der Eintrag auf `/mehr`, der Sprunglink und der Behälter jedes Abschnitts. Der Diensthinweis fällt seit dem 2026-09-13 nicht mehr darunter: er ist eine gefüllte Akzentfläche, und was ihn identifiziert, ist die Fläche und nicht der Umriss.

> **Richtiggestellt am 2026-09-11.** Bis dahin schrieb die Komponentenliste oben die Haarlinie für `button-quiet`, `duty-banner` und `textarea-bulk` vor, während dieser Absatz behauptete, jeder Bedienelement-Umriss nutze den Akzent. Beides zugleich ging nicht — ein R1-Widerspruch, gefunden nicht beim Lesen, sondern beim Rechnen im Kontrast-Sweep vom 2026-09-02. Aufgelöst mit Entscheid (a): die Kanten sind gehoben, dieser Absatz sagt jetzt, was der Baum tut. Die Wache in `scripts/smoke-sicht.ts` führt seither keine Ausnahme mehr.

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

**Keine Schatten.** Tiefe entsteht ausschliesslich tonal: helle Karten auf dem Leinengrund, getrennt durch die Haarlinie.

Es gibt zwei Ebenen — Grund und Karte — und seit dem 2026-09-13 **eine halbe dritte**: der Kopf eines Abschnitts liegt auf `surface-griff` und damit tonal zwischen den beiden. Er ist kein eigener Stapelplatz, sondern die Kopfzeile eines Behälters, der auf der Kartenebene steht. Keine weitere. Kein `box-shadow`, kein `filter: drop-shadow`, keine Umrisse zur Vortäuschung von Höhe. Ein Garten hat keine Schlagschatten in der Bedienoberfläche.

## Shapes

Drei Radien, jeder mit einer Aufgabe:

- `{rounded.sm}` 5px — das Kästchen. Fast eckig, weil ein Kästchen als Kästchen erkennbar bleiben soll. Der Diensthinweis trug diesen Radius bis zum 2026-09-13; seit er eine gefüllte Fläche ist und keine 3px-Kante mehr trägt, nimmt er `{rounded.md}` wie jede andere Fläche.
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

Über die volle Spaltenbreite, `{colors.accent}` gefüllt, Text `{typography.action}` in `{colors.accent-ink}`, Radius `{rounded.md}`, mindestens 44px hoch. **Höchstens einer je Abschnitt** — bis zum 2026-09-11 hiess die Regel „höchstens einer pro Seite“, und das stimmte, solange die Startseite eine einzige Handlung trug. Seit ihre zwei Blöcke eigene Aufklapper mit eigener Hauptaktion sind (`+ Einzelaufgabe`, `+ Aufgabe`), stehen zwei auf der Seite — nie nebeneinander, und darum ohne die Konkurrenz, gegen die die Regel geschrieben war. Er trägt immer ein Verb und, wo eine Menge im Spiel ist, die Zahl: `25 Aufgaben ablegen`.

### `button-quiet`

Für Nebenaktionen: durchsichtig, Text `{colors.accent}`, Umriss `{colors.ink-secondary}`. Gleiche Höhe wie der primäre Knopf. Zerstörende Aktionen — im MVP nur `Einladung widerrufen` — nehmen dieselbe Form, aber Text und Umriss in Rot; das ist die einzige Stelle, an der Rot vorkommt.

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
- Jede neue Farbe rechnen, bevor sie gesetzt wird — und die Zeile in der Kontrasttabelle gleich mitschreiben.

**Don't**

- Keine Fortschrittsbalken, Serien, Abzeichen, Ranglisten oder Zählungen erledigter Aufgaben.
- Kein Name neben einer erledigten Aufgabe, in keiner Ansicht, auch nicht als Tooltip.
- Keine Symbole ohne Beschriftung in der Navigation.
- Kein Rot ausser für Zerstörendes.
- Keine Schatten, keine Farbverläufe, keine Pillen-Radien.
- Keine Illustrationen, Fotos oder Maskottchen.
- Keine Schrift von einem fremden CDN laden.
- Keine zweite `display`-Grösse auf einer Seite.
