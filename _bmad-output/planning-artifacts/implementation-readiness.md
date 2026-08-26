# Implementation Readiness — Gartenplaner

**Datum:** 2026-08-26
**Verdikt beim ersten Durchgang:** CONCERNS — zwei Lücken.
**Verdikt beim zweiten Durchgang (2026-08-26, nach Behebung):** PASS. `sprint-status.yaml` erzeugt.

## Bestand

| Artefakt | Ort | Zustand |
| --- | --- | --- |
| Brainstorming-Intent | `_bmad-output/brainstorming/brainstorm-gartengemeinschaft-koordination-2026-08-26/` | vollständig, 47 Memlog-Einträge |
| SPEC | `_bmad-output/specs/spec-gartengemeinschaft-koordination/SPEC.md` | 8 Capabilities, 11 Constraints, 7 Non-goals |
| Prioritäten | `.../scope-priorities.md` | MoSCoW, CAP-8 als MUST |
| Story-Aufteilung | `.../stories.yaml` | 7 Stories, schema-validiert |
| Architektur-Spine | `_bmad-output/planning-artifacts/architecture/architecture-Gartenplaner-2026-08-26/ARCHITECTURE-SPINE.md` | `status: final`, 14 ADs, Lint sauber |

Rückwärts- und Vorwärtsverfolgbarkeit geprüft: jede Capability hat eine Story, jede Story eine Capability oder einen Constraint. Keine Waisen, keine Widersprüche zwischen SPEC und Spine.

## Finding 1 — Kein Epics-Dokument (blockierend für den deterministischen Pfad)

`sprint_plan.py` parst ausschliesslich Markdown-Überschriften `## Epic N:` / `### Story N.M:`. Gegen `stories.yaml` geprüft, Ergebnis:

```
{"ok": false, "error": "no epics or stories parsed from the given epic files"}
```

**Ursache:** In der BMad-Kette steht `bmad-create-epics-and-stories` (required) zwischen Architektur und Sprint-Planung. Die Story-Aufteilung wurde stattdessen direkt in `bmad-spec` gemacht. Inhaltlich richtig, aber im falschen Format für dieses Skript.

**Beschluss:** `bmad-create-epics-and-stories` leitet die Epics aus SPEC.md, der Spine und den bereits abgesegneten sieben Stories ab — ohne Neuverhandlung des Schnitts. Danach läuft die Sprint-Planung deterministisch, auch bei späteren Aktualisierungen.

## Finding 2 — Keine UX-Artefakte, zwei Erfindungslücken

Die Spine regelt Layout-Konventionen (mobile-first, 44px Touch-Ziele, Runes, deutsche Oberfläche, `max-width: 600px`). Offen bleiben:

1. **Keine Farbpalette.** Die Konvention verlangt „ausschliesslich CSS Custom Properties", benennt aber keine. Betrifft bereits Story 2.
2. **CAP-3 Massen-Eingabe ist nicht entworfen.** 20–40 Aufgaben in einer Sitzung, ohne mehr Aufwand als Papier — die anspruchsvollste Interaktion im MVP, nirgends beschrieben. Betrifft Story 3.

**Beschluss:** `bmad-ux` läuft **vor** der Epics-Ableitung, damit beide Lücken als `UX-DR`-Anforderungen in Stories übersetzt werden.

## Ausdrücklich kein Finding

**Kein Testframework.** Unter *Deferred* in der Spine dokumentiert, mit Bedingung für die Wiederaufnahme. Qualitätstore sind `npm run build` und `npm run lint` plus manuelles Testen am 375px-Viewport — geerbt von beehiveJournal. Eine bewusste Entscheidung, keine Lücke.

## Reihenfolge

Abgearbeitet:

1. ✅ `bmad-ux` — Palette und Massen-Eingabe. **Musste vor den Epics laufen:**
   `bmad-create-epics-and-stories` behandelt die UX-Spezifikation als gleichrangige
   Eingabe und leitet daraus eigene Anforderungen (`UX-DR*`) und Stories ab. Läuft UX
   danach, entstehen für Palette und Massen-Eingabe keine Stories.
2. ✅ `bmad-create-epics-and-stories` — 4 Epics, 11 Stories, Parser liest sie
3. ✅ `bmad-sprint-planning` — Gate PASS, `sprint-status.yaml` mit 19 Einträgen
4. ⬜ `bmad-build` — Story 1.1 (Gerüst und Gestaltungsrahmen)
