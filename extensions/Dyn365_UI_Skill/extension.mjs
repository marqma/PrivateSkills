// Extension: Dyn365_UI_Skill
// Erstellt authentische UI-Konzepte, Spezifikationen und HTML-Mockups für
// Microsoft Dynamics 365 CE und Power Apps model-driven apps mit ORBIS CI.

import { joinSession } from "@github/copilot-sdk/extension";

// ── Referenz-Inhalte ──────────────────────────────────────────────────────────

const SKILL_INSTRUCTIONS = `
# Dynamics 365 UI Skill

## Ziel
Erzeuge fachlich plausible und visuell authentische Dynamics-365-CE-Artefakte.
Microsoft-Produktmuster sind für Shell und Standardkomponenten führend.
ORBIS CI wird nur innerhalb offiziell vorgesehener oder eigener Branding-Flächen angewendet.

## Priorität
1. Native Dynamics-365- und Power-Apps-Verhaltensmuster
2. Microsoft Fluent/Modern UI und Accessibility
3. ORBIS Corporate Identity
4. Projektspezifische Wünsche

Wenn Regeln kollidieren, darf ORBIS CI die erkennbare Dynamics-Oberfläche nicht verfälschen.
Keine frei gestaltete Marketing-Webseite als CRM-Mockup ausgeben.

## Arbeitsablauf
1. Bestimme Persona, Rolle, Business-Ziel und häufigste Aufgaben.
2. Bestimme Artefakt: UX-Konzept, Wireframe, HTML-Mockup, Screen-Spezifikation oder UX-Review.
3. Wähle ein passendes Screen-Pattern (siehe unten).
4. Wende die Design Rules an.
5. Ergänze ORBIS CI gemäß Integrations-Regeln.
6. Verwende realistische DACH-Beispieldaten; keine Contoso- oder Fabrikam-Daten, sofern nicht ausdrücklich verlangt.
7. Zeige nur fachlich begründbare Funktionen und Navigationseinträge.
8. Prüfe mit der QA-Checkliste.
9. Kennzeichne statische Mockups als Kommunikationsartefakt, nicht als importierbare Solution.

## Screen-Patterns
- **Record Main Form**: App Header; Sitemap; Record Header; Command Bar; optional BPF; Tabs und Sections; optional Timeline, Subgrids oder Side Pane.
- **List View**: App Header; Sitemap; Page Header mit Tabellenname und View Selector; Command Bar; Suche/Filter; Power Apps Grid mit relevanten Spalten.
- **Dashboard**: Rollenbezogener Titel; wenige KPIs; ergänzende Charts und Listen; Filter und Drill-down; keine redundanten Kennzahlen.
- **Sales Workspace**: Priorisierte Arbeitsliste; Kontext- und Aktivitätsbereich; nächste Aktion klar; keine erfundenen Sales-Accelerator-Funktionen.
- **Business Process Flow**: Klare Stufen; aktive Stufe sichtbar; kritische Felder pro Stufe; klarer Abschluss.
- **Copilot / Side Pane**: Ergänzend, nicht dominierend; datensatzbezogener Kontext; KI-Unterstützung klar markieren.
- **Custom Page / PCF**: Fluent-nahe Controls; ORBIS Tokens kontrolliert; alle States; responsive und tastaturbedienbar.

## Design Rules
### Navigation
- Häufig genutzte Module priorisieren; Navigation einfach halten.
- Rollenbasierte Sitemap; klare, kurze Labels.

### Forms
- Wichtigste Informationen oben; nur notwendige Felder.
- Verwandte Informationen in Tabs und Sections.
- Aussagekräftige Validierung und Fehlertexte.

### Views und Grids
- Wichtige, anklickbare Information in der ersten Spalte.
- Nur notwendige Spalten; sinnvolle Standardsortierung.

### Command Bar
- Häufige und kontextrelevante Aktionen priorisieren; klare Verben.

### Accessibility
- Ausreichende Kontraste, sichtbarer Fokus, keine reine Farbcodierung.
- Labels und Beschreibungen für Screenreader.

### Visuelle Modern UI
- Fluent-basierte Controls; Floating Command Bar; abgerundete Ecken.
- Custom Icons als SVG.

## ORBIS CI Integration
- ORBIS Farben: Corporate Blue #00488A · Petrol #00A3A3 · Highlight Pink #DB3360 · Night Blue #16203B
- App Header: ORBIS Farbe nur, wenn Modern Theme dies unterstützt.
- Custom Pages und PCF: ORBIS Farben als kontrollierte Tokens.
- Pink nur als seltener Akzent, nicht für Standard-Primary-Actions.
- Petrol nicht als flächiger Ersatz für Microsoft-Standardcontrols.
- Offizielles ORBIS Logo nicht nachbauen oder in die Shell zwingen.
- Be Vietnam Pro nicht in Standardcontrols erzwingen.
- Leitregel: Das Mockup muss zuerst als Dynamics 365 erkennbar sein.

## HTML-Mockup Regeln
- Eine offline lauffähige, selbst enthaltene HTML-Datei bevorzugen.
- Keine Build-Pipeline voraussetzen; nur leichtgewichtige Demo-Interaktionen.
- Sichtbarer Hinweis: "Konzept-Mockup, keine produktive Dynamics-365-Oberfläche".
- Segoe UI als systemnahe Schrift verwenden.

## UX-Spezifikation Struktur
Persona und Hauptaufgaben · Navigationsstruktur · Screen-Inventar · Form-/View-/Grid-Regeln · Befehle/Validierung/Zustände · Responsive und Accessibility · Annahmen zu Produkt/Lizenz/Daten

## UX-Review Struktur
Befunde: Blocker / Hoch / Mittel / Niedrig — je Befund: Problem, Nutzerwirkung, Empfehlung, Prüfkriterium

## QA-Checkliste
**Plattformtreue**: Pattern entspricht model-driven apps · Shell und Command Bar wirken wie Dynamics 365 · Keine erfundenen Navigationseinträge · Preview-Funktionen als Preview markiert · Statisches Mockup klar gekennzeichnet
**UX**: Persona und Hauptaufgabe klar · Navigation rollenbasiert · Forms enthalten nur erforderliche Felder · Views und Grids nicht überladen · Alle States berücksichtigt
**Accessibility**: Tastatur und Fokus · Verständliche Labels · Kein reines Farbcodierung · Ausreichend Kontrast
**ORBIS**: ORBIS ergänzt, überformt nicht die Shell · Nur freigegebene Farben · Pink sparsam · Offizielles Logo · #1B3054 nur im Logo
`;

// ── Tools ─────────────────────────────────────────────────────────────────────

const session = await joinSession({
    hooks: {
        onSessionStart: async () => {
            await session.log("Dyn365 UI Skill geladen – bereit für D365 CE Mockups und Spezifikationen.");
        },
    },
    tools: [
        {
            name: "dyn365_ui_guidelines",
            description:
                "Gibt die vollständigen Dynamics-365-UI-Richtlinien zurück: Screen-Patterns, Design Rules, ORBIS-Integration, HTML-Mockup-Regeln und QA-Checkliste. Verwenden wenn Dynamics 365 CE oder Power Apps model-driven app UI-Konzepte, Spezifikationen oder HTML-Mockups erstellt werden sollen.",
            parameters: { type: "object", properties: {} },
            skipPermission: true,
            handler: async () => SKILL_INSTRUCTIONS,
        },
        {
            name: "dyn365_html_mockup_scaffold",
            description:
                "Generiert ein Basis-HTML-Scaffold für ein Dynamics-365-Offline-Mockup. Parameter: title (Seitentitel), pattern (record-form | list-view | dashboard | custom-page), orbis_branding (true/false – ORBIS Farben in erlaubten Bereichen aktivieren).",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Titel der Mockup-Seite, z.B. 'Lead – Müller GmbH'" },
                    pattern: {
                        type: "string",
                        enum: ["record-form", "list-view", "dashboard", "custom-page"],
                        description: "Dynamics-365-Screen-Pattern",
                    },
                    orbis_branding: {
                        type: "boolean",
                        description: "ORBIS Farben in erlaubten Header-/Custom-Flächen aktivieren",
                    },
                },
                required: ["title", "pattern"],
            },
            skipPermission: true,
            handler: async ({ title, pattern, orbis_branding }) => {
                const accentColor = orbis_branding ? "#00488A" : "#0078d4";
                const petrol = "#00A3A3";
                const fontStack = '"Segoe UI", system-ui, sans-serif';

                const patternHints = {
                    "record-form": "App Header · Sitemap · Record Header · Command Bar · BPF (optional) · Tabs/Sections · Timeline/Subgrid (optional)",
                    "list-view": "App Header · Sitemap · Page Header + View Selector · Command Bar · Suche/Filter · Power Apps Grid",
                    "dashboard": "App Header · Sitemap · Dashboard-Titel · KPI-Kacheln · Charts · Listen-Widgets",
                    "custom-page": "App Header · Sitemap · Custom Page Container · ORBIS-Komponenten mit Fluent-States",
                };

                return `<!-- Dynamics 365 CE · ${pattern.toUpperCase()} Scaffold ──────────────────────────
   PATTERN : ${pattern}
   STRUKTUR: ${patternHints[pattern] ?? ""}
   ORBIS   : ${orbis_branding ? "Aktiviert (nur Header und erlaubte Flächen)" : "Deaktiviert"}
   HINWEIS : Konzept-Mockup, keine produktive Dynamics-365-Oberfläche.
─────────────────────────────────────────────────────────────────── -->
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – Konzept-Mockup</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: ${fontStack}; font-size: 14px; color: #201f1e; background: #f3f2f1; }

    /* ── App Header ─────────────────────────── */
    .d365-app-header {
      display: flex; align-items: center; height: 48px;
      background: ${accentColor}; color: #fff; padding: 0 16px; gap: 12px;
    }
    .d365-app-header__logo { font-size: 18px; font-weight: 600; }
    .d365-app-header__nav { margin-left: auto; display: flex; gap: 8px; font-size: 13px; }

    /* ── Sitemap ────────────────────────────── */
    .d365-sitemap {
      width: 220px; min-height: calc(100vh - 48px); background: #fff;
      border-right: 1px solid #edebe9; padding: 8px 0; flex-shrink: 0;
    }
    .d365-sitemap__item {
      padding: 10px 16px; cursor: pointer; color: #323130; border-radius: 4px; margin: 2px 4px;
    }
    .d365-sitemap__item:hover { background: #f3f2f1; }
    .d365-sitemap__item--active { background: #deecf9; color: ${accentColor}; font-weight: 600; }

    /* ── Command Bar ────────────────────────── */
    .d365-command-bar {
      display: flex; align-items: center; height: 40px;
      background: #fff; border-bottom: 1px solid #edebe9; padding: 0 8px; gap: 4px;
    }
    .d365-cmd-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
      border: none; background: transparent; cursor: pointer; border-radius: 4px;
      font-size: 13px; color: #323130;
    }
    .d365-cmd-btn:hover { background: #f3f2f1; }
    .d365-cmd-btn--primary { color: ${accentColor}; font-weight: 600; }

    /* ── Content Area ───────────────────────── */
    .d365-layout { display: flex; height: calc(100vh - 48px); }
    .d365-main { flex: 1; overflow-y: auto; }
    .d365-page-header {
      background: #fff; padding: 12px 16px 0;
      border-bottom: 1px solid #edebe9;
    }
    .d365-page-header h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }

    /* ── Form / Section ─────────────────────── */
    .d365-section {
      background: #fff; margin: 12px 16px; border-radius: 6px;
      border: 1px solid #edebe9; padding: 16px;
    }
    .d365-section__title { font-weight: 600; margin-bottom: 12px; color: #323130; }
    .d365-field { margin-bottom: 12px; }
    .d365-field label { display: block; font-size: 12px; color: #605e5c; margin-bottom: 2px; }
    .d365-field input, .d365-field select {
      width: 100%; padding: 6px 8px; border: 1px solid #8a8886; border-radius: 4px; font: inherit;
    }
    .d365-field input:focus, .d365-field select:focus {
      outline: none; border-color: ${accentColor}; box-shadow: 0 0 0 2px rgba(0,72,138,.2);
    }

    /* ── ORBIS Akzent (nur wenn aktiviert) ──── */
    ${orbis_branding ? `.orbis-accent { color: ${petrol}; } .orbis-badge { background: ${petrol}; color: #fff; border-radius: 4px; padding: 2px 8px; font-size: 12px; }` : ""}

    /* ── Mockup-Banner ──────────────────────── */
    .d365-mockup-banner {
      background: #fff4ce; border-bottom: 1px solid #fce100;
      padding: 6px 16px; font-size: 12px; color: #7a5d00; text-align: center;
    }
  </style>
</head>
<body>
  <div class="d365-mockup-banner">
    ⚠ Konzept-Mockup – keine produktive Dynamics-365-Oberfläche
  </div>

  <!-- App Header -->
  <header class="d365-app-header">
    <span class="d365-app-header__logo">▦ ${title}</span>
    <nav class="d365-app-header__nav">
      <span>Einstellungen</span>
      <span>Hilfe</span>
      <span>MA</span>
    </nav>
  </header>

  <div class="d365-layout">
    <!-- Sitemap -->
    <nav class="d365-sitemap" aria-label="Navigation">
      <div class="d365-sitemap__item">Dashboard</div>
      <div class="d365-sitemap__item d365-sitemap__item--active"><!-- aktive Seite --></div>
      <div class="d365-sitemap__item">Aktivitäten</div>
      <div class="d365-sitemap__item">Berichte</div>
    </nav>

    <!-- Main Content -->
    <main class="d365-main">
      <!-- Command Bar -->
      <div class="d365-command-bar" role="toolbar" aria-label="Befehle">
        <button class="d365-cmd-btn d365-cmd-btn--primary">+ Neu</button>
        <button class="d365-cmd-btn">Speichern</button>
        <button class="d365-cmd-btn">Aktualisieren</button>
        <button class="d365-cmd-btn">Löschen</button>
      </div>

      <!-- Page Header -->
      <div class="d365-page-header">
        <h1>${title}</h1>
        <!-- TODO: BPF / Tabs ergänzen wenn Pattern = record-form -->
      </div>

      <!-- TODO: Abschnitte je nach Pattern befüllen -->
      <section class="d365-section">
        <div class="d365-section__title">Zusammenfassung</div>
        <div class="d365-field">
          <label for="field-name">Name</label>
          <input id="field-name" type="text" value="Mustermann GmbH">
        </div>
        <div class="d365-field">
          <label for="field-status">Status</label>
          <select id="field-status">
            <option>Aktiv</option>
            <option>Inaktiv</option>
          </select>
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;
            },
        },
    ],
});
