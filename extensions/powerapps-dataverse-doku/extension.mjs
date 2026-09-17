// Extension: powerapps-dataverse-doku
// Skill zum Generieren technischer Dokumentation aus Power Apps Canvas App / Dataverse Solution-Paketen (Struktur, Mermaid-Diagramme, ADRs, HTML-Viewer)

import { joinSession } from "@github/copilot-sdk/extension";

const GUIDELINES = `
# Skill: Technische Dokumentation für Power Apps Canvas App / Dataverse Solutions

Zweck: Aus einem Dataverse-Solution-Export (.zip mit .msapp + Power-Automate-Flows)
eine vollständige, deutschsprachige technische Onboarding-Dokumentation als
Markdown-Datei generieren, inkl. ER-Diagramm, Flow-Analyse, ADRs und einem
lokal gehosteten HTML-Viewer. Zielgruppe: neue Entwickler, die eine bereits
mehrfach an Kunden verkaufte App übernehmen/anpassen müssen.

## 1. Extraktions-Workflow

1. Solution-.zip mit \`Expand-Archive\` entpacken (enthält solution.xml,
   customizations.xml, CanvasApps/*.msapp, Workflows/*.json).
2. Die .msapp-Datei ist selbst ein ZIP: temporär auf \`.zip\` umbenennen/kopieren,
   dann erneut entpacken.
3. Im .msapp-Paket relevante Quellen:
   - \`Src/*.pa.yaml\` – Screens (Power-Fx-Klartext)
   - \`Src/Components/*.pa.yaml\` – Custom Components
   - \`References/DataSources.json\` – alle Datenquellen/Tabellen; ACHTUNG: sehr
     groß (oft 50–100 MB), \`TableDefinition\` und darin \`EntityMetadata\` sind
     JEWEILS als JSON-STRING eingebettet → doppeltes \`JSON.parse(JSON.parse(...))\`
     nötig, um Beziehungen (ManyToOneRelationships etc.) zu extrahieren.
   - \`Workflows/*.json\` – Power-Automate-Flow-Definitionen (Trigger, Actions,
     FetchXML-Filter, Switch/Conditions)
4. Bevorzugt Node.js für die Analyse (Parsen großer JSON-Dateien), nicht Python
   (auf vielen Windows-Umgebungen nicht vorinstalliert; \`python\` kann als
   Windows-Store-Stub fehlschlagen).
5. Navigation zwischen Screens per Regex auf \`Navigate(...)\`-Aufrufe rekonstruieren.
6. Nach der Analyse: extrahierte Temp-Ordner (\`extracted\`, \`msapp_extracted\`)
   wieder löschen.

## 2. Dokumentstruktur (bewährtes Gliederungsschema, 16 Kapitel)

1. Dokumenteninformationen (Quelle, Version, Solution-Name, Publisher, Managed/Unmanaged)
2. Projektübersicht (Zielsetzung, Wiederverwendbarkeit/Multi-Kunden-Kontext)
3. Lösungsübersicht — **Mermaid \`graph LR\`** Systemlandschaft (App ↔ Dataverse ↔
   Flows ↔ Offline-Profil ↔ Maps/PowerBI), Komponententabelle
4. Fachliches Konzept — Use Cases aus Screens ableiten, **Mermaid \`flowchart\`**
   für die technische Geschäftsprozesskette, Hinweis auf Rollen/UserOwned-Modell
5. Datenmodell — Tabellenliste, Namenskonventionen (Produkt- vs. Kundenpräfix,
   z. B. \`orb_*\` vs. \`eck_*\`), **Mermaid \`erDiagram\`** mit kuratierten
   Beziehungen (Systemfelder wie createdby/modifiedby herausfiltern)
6. App-Struktur — Screens, Navigation, Custom Components
7. Funktionsbeschreibung — globale Variablen, Namenskonventionen (var*/loc*/
   col*/tmp*/gbl*/fun*), Formula Columns, **Nutzungshäufigkeits-Tabellen**
   (welche Operationen/Variablen/Collections dominieren den Code – priorisiert
   das Onboarding), **Mermaid \`flowchart\`** für 1–2 zentrale Geschäftsvorfälle
   (z. B. Auftragsanlage, Terminanlage)
8. Schnittstellen — eingehend/ausgehend, **Mermaid \`flowchart\`**-Übersicht aller
   Power-Automate-Flows (Trigger → Aktion → Dataverse, mit rot markierten
   Problemstellen), je komplexem Flow ein Detail-Flowchart (z. B. Switch-Case)
9. Sicherheitskonzept
10. ALM und Deployment — Solution-Typ, Multi-Kunden-Rolloutstrategie
11. Monitoring und Betrieb
12. Offene Punkte, Risiken und Auffälligkeiten (automatisiert erkannt) — konkrete
    Funde: hartcodierte IDs/Options-Set-Werte, unimplementierte Switch-Cases,
    Test-/Demo-Screens, App-Checker-Befunde, fehlende Testautomatisierung
13. Architekturentscheidungen (ADRs) — siehe Abschnitt 3 unten
14. Testkonzept — Mindestumfang, Testfalltabelle (ID/Testfall/Erwartung),
    **Mermaid \`flowchart\`** als Testablauf
15. Onboarding und Übergabe — Onboarding-Pfad als **Mermaid \`flowchart TD\`**
    (Schritt-für-Schritt), kritische Anpassungspunkte für Kundenrollouts,
    Übergabecheckliste (Checkbox-Liste)
16. Anhänge — Referenzen auf Rohdaten (z. B. vollständige Beziehungsliste als
    JSON), Quelldateipfade

Nicht sicher ableitbare Inhalte (Business Case, Security Roles, SLAs) explizit
als "noch zu ergänzen" markieren statt zu erfinden.

## 3. ADR-Format (retrospektiv abgeleitete Architekturentscheidungen)

Pro ADR: Status, Kontext, Entscheidung, Konsequenzen, **Bezug zur Umsetzung**
(konkrete Datei/Screen/Flow-Referenz). Typische Kandidaten in Power Apps/
Dataverse-Solutions:
- Wahl der zentralen Datenplattform (Dataverse vs. SharePoint/SQL)
- Produkt- vs. Kundenpräfix-Trennung bei Custom-Feldern/Tabellen
- Power Automate für Integrationslogik statt In-App-Formeln
- Zentrale Theme-/Variablen-Strategie
- Debug-Modus-Flags
- Hartcodierte Konfigurationswerte als technische Schuld (explizit benennen!)
- Unmanaged- vs. Managed-Solution-Exportstrategie für Weiterverkauf

## 4. Mermaid-Diagrammtypen — wann welche verwenden

| Zweck | Mermaid-Typ | Beispiel |
|---|---|---|
| Systemlandschaft/Architektur | \`graph LR\` | App → Dataverse → Flows |
| Datenmodell/Beziehungen | \`erDiagram\` | Tabellen + Kardinalitäten |
| Prozess-/Ablauflogik | \`flowchart TD\`/\`LR\` | Auftragsanlage, Onboarding-Pfad |
| Entscheidungslogik mit Verzweigung | \`flowchart TD\` mit \`{"Bedingung?"}\` | Terminüberschneidung, Switch-Cases |
| Reihenfolge/Sequenz | \`flowchart LR\` mit Nummerierung | Testablauf, Deployment-Schritte |

Style-Tipp: Problematische/risikobehaftete Knoten farblich markieren, z. B.
\`style X fill:#f8d7da,stroke:#c0392b,color:#7a1f10\`.

## 5. Lokaler HTML-Viewer

Für die Anzeige der MD-Datei einen self-contained \`doku-site/index.html\` bauen:
- \`marked.js\` (MD→HTML) + \`mermaid.js\` (Diagramm-Rendering) **lokal vendoren**
  (in \`vendor/\`), NICHT per CDN laden — Firmennetze blockieren oft externe CDNs,
  und ungepinnte "latest"-Versionen von marked.js haben brechende API-Änderungen
  (Renderer.code-Signatur). \`marked@4.3.0\` ist eine stabile, kompatible Version.
- Sidebar mit automatisch generiertem Inhaltsverzeichnis (aus h1/h2/h3), Suche,
  Scroll-Highlighting.
- Jedes Mermaid-Diagramm bekommt einen "🔍 Vergrößern"-Button, der ein
  Vollbild-Modal mit Mausrad-Zoom und Drag-Pan öffnet (SVG klonen, \`transform:
  scale()/translate()\` anwenden).
- Fetch-basiertes Laden (\`fetch('doku.md')\`) erfordert einen lokalen HTTP-Server
  (CORS blockiert \`file://\`); ein simpler Node-\`http\`-Server reicht, MUSS aber
  korrekte MIME-Types für \`.js\`/\`.css\` setzen (sonst verweigern Browser die
  Skriptausführung im Strict-Mode).
- **Doppelter Lademodus für echtes "kein Server nötig"-Öffnen per Doppelklick**:
  \`fetch()\` schlägt unter \`file://\` immer fehl (CORS). Daher zusätzlich die
  komplette \`doku.md\` als Base64-UTF8 in ein \`<textarea id="embedded-markdown-data"
  hidden>\` am Ende von \`<body>\` einbetten. Das Lade-Script prüft
  \`window.location.protocol === 'file:'\` und liest in diesem Fall aus dem
  Textarea (\`atob\` + \`TextDecoder('utf-8')\`), sonst per \`fetch('doku.md')\`.
  So funktioniert die Seite sowohl per Doppelklick als auch über einen Server.
- **KRITISCHE FALLE (Lade-Reihenfolge)**: Wenn das Lade-Script als letztes
  \`<script>\`-Tag im \`<body>\` steht und der Aufruf \`loadDoc()\` direkt (nicht
  event-gebunden) am Skriptende erfolgt, funktioniert es meist zufällig, weil
  das \`<textarea>\` vorher im Markup steht. Steht das \`<textarea>\` dagegen NACH
  dem \`<script>\`-Block (z. B. weil es ans Dateiende angehängt wurde), ist es zum
  Ausführungszeitpunkt noch nicht geparst → \`getElementById\` liefert \`null\` →
  Fehler "Eingebettete Dokumentation nicht gefunden" beim Öffnen per \`file://\`.
  **Immer** den Aufruf absichern: \`if (document.readyState === 'loading')
  { document.addEventListener('DOMContentLoaded', loadDoc); } else { loadDoc(); }\`
  — niemals \`loadDoc()\` ungeschützt aufrufen, unabhängig von der Position des
  \`<textarea>\` im Dokument.
- \`try/catch\` um den Ladevorgang legen und Fehler sichtbar auf der Seite
  anzeigen statt bei "Lade Dokumentation…" hängen zu bleiben.
- **Mermaid-Theme markenkonform statt Standard-Lila**: \`mermaid.initialize\`
  mit \`theme: 'base'\` und eigenen \`themeVariables\` (primaryColor,
  primaryBorderColor, primaryTextColor, lineColor etc. passend zu den
  CSS-Custom-Properties \`--brand\`/\`--brand-dark\` der Seite) konfigurieren.
  Ohne diese Anpassung wirken alle Diagramme lila/generisch und brechen mit
  dem sonstigen Farbschema des Dokuments.
- **Encoding-Falle**: \`<title>\` und andere direkt in die HTML-Vorlage
  geschriebene Sonderzeichen (ä/ö/ü/–) IMMER als UTF-8 ohne Mojibake prüfen
  (typisches Symptom: \`â€“\` statt \`–\`). Datei grundsätzlich als UTF-8
  (mit oder ohne BOM, konsistent) speichern/lesen.

## 6. Typischer Ablauf für einen neuen Auftrag

1. Solution-Paket entpacken und analysieren (Abschnitt 1).
2. MD-Datei nach obiger Gliederung (Abschnitt 2) befüllen, offene Punkte markieren.
3. ER-Diagramm aus \`DataSources.json\` extrahieren und kuratieren.
4. Flows im Detail lesen und als Text + Mermaid-Flowchart dokumentieren.
5. ADRs aus erkennbaren Architekturentscheidungen ableiten (Abschnitt 3).
6. Testkonzept, Onboarding-Pfad und Übergabecheckliste ergänzen.
7. HTML-Viewer bauen/aktualisieren (Abschnitt 5), sowohl per Doppelklick
   (\`file://\`, embedded Base64-Textarea) als auch optional über einen lokalen
   Server verifizieren (\`Invoke-WebRequest\`/curl für HTTP 200 bei Server-Modus;
   für \`file://\` z. B. mit Puppeteer/Headless-Browser auf Konsolenfehler und
   \`.mermaid svg\`-Anzahl == Anzahl \`\`\`mermaid-Blöcke prüfen).
8. \`doku.md\` in \`doku-site/\` nach jeder Änderung an der Haupt-MD-Datei erneut
   synchronisieren (Copy-Item).
`;

const HTML_TEMPLATE_NOTE = `
Der vollständige HTML-Viewer-Code (index.html) ist zu umfangreich für eine
Konstante, aber die Kernbausteine sind in den GUIDELINES (Abschnitt 5)
beschrieben. Nutze als Referenzimplementierung die zuletzt in dieser Session
gebaute Datei (marked@4.3.0 + mermaid.js lokal vendort, Sidebar-TOC, Diagramm-
Zoom-Modal) als Vorlage und kopiere/passe sie für neue Projekte an, statt sie
komplett neu zu schreiben.
`;

const session = await joinSession({
    tools: [
        {
            name: "powerapps_dataverse_doku_guidelines",
            description:
                "Gibt die vollständigen Richtlinien/Methodik zurück, um aus einem Power Apps Canvas App / Dataverse Solution-Export (.zip mit .msapp + Power-Automate-Flows) eine technische Onboarding-Dokumentation zu erzeugen: Extraktions-Workflow, 16-Kapitel-Gliederung, ADR-Format, Mermaid-Diagrammtypen und Aufbau eines lokal gehosteten HTML-Viewers. Verwenden, wenn eine technische Dokumentation für eine Power Apps/Dataverse-Solution erstellt oder aktualisiert werden soll.",
            parameters: { type: "object", properties: {} },
            handler: async () => GUIDELINES + "\n---\n" + HTML_TEMPLATE_NOTE,
        },
    ],
});
