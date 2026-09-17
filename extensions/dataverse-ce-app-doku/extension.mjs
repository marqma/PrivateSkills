// Extension: dataverse-ce-app-doku
// Skill zum Generieren technischer Dokumentation für Dynamics 365 CE / Dataverse
// Model-Driven-Apps aus (1) einem Solution-Export der Default-/Zielsolution und
// (2) einem Code-Repository (z. B. "D365Scripts"-artige Repos wie
// ORBIS.ProcessDoc/D365Scripts) mit FormScripting, Ribbon, Plugins, Workflows.
// Ergänzt/komplementiert die Canvas-App-Doku-Skill (powerapps-dataverse-doku)
// um alles, was für klassische model-driven D365-CE-Lösungen relevant ist.

import { joinSession } from "@github/copilot-sdk/extension";

const GUIDELINES = `
# Skill: Technische Dokumentation für Dynamics 365 CE / Dataverse Model-Driven Apps

Zweck: Aus (a) dem Solution-Export der Default-/Ziel-Solution einer Dynamics 365
CE (Dataverse) Lösung UND (b) einem zugehörigen Code-Repository (Form-Scripting,
Ribbon, Plugins, Workflows, Build-/ALM-Skripte — z. B. Repos vom Typ
"D365Scripts") eine vollständige, deutschsprachige technische Onboarding-
Dokumentation als Markdown-Datei generieren, inkl. ER-Diagramm, FormScripting-
Analyse, Ribbon-/Command-Bar-Doku, Plugin-/Workflow-Übersicht, Sicherheitsmodell,
ADRs und einem lokal gehosteten HTML-Viewer. Zielgruppe: neue Entwickler, die
eine bestehende model-driven D365-CE-Lösung übernehmen/weiterentwickeln müssen.

Diese Skill ist die model-driven-App-Ergänzung zur Canvas-App/Dataverse-Skill
(\`powerapps_dataverse_doku_guidelines\`). Extraktions-Workflow (Abschnitt 1),
Mermaid-Konventionen (Abschnitt 5) und HTML-Viewer (Abschnitt 6) sind bewusst
kompatibel gehalten, damit beide Doku-Typen im selben Viewer/Stil laufen.

## 0. Erwartete Eingaben

1. **Solution-Export** der Default-Solution (oder der relevanten Ziel-Solution)
   als .zip, idealerweise **unmanaged** und **mit SolutionPackager entpackt**
   (dann liegen Entities/Forms/Ribbon/Workflows/Plugins bereits als einzelne
   XML-Dateien vor statt in einer monolithischen customizations.xml). Liegt nur
   die rohe Export-.zip vor (customizations.xml + solution.xml), zusätzlich
   \`pac solution unpack\` bzw. \`pac solution pack/unpack\` nutzen, falls die
   Pipeline-CLI verfügbar ist; sonst customizations.xml direkt parsen (Abschnitt 2).
2. **Code-Repository** (lokal geklont oder als Pfad übergeben), typischerweise
   mit einer Struktur wie \`D365Scripts/<Bereich>/<Entity>/*.js|*.ts\`,
   \`Ribbon/\`, \`Plugins/*.cs\`, \`Workflows/*.cs\`, ggf. \`WebResources/\`,
   Build-Definitionen (\`azure-pipelines.yml\`, \`*.cdsproj\`, \`spkl.json\`,
   \`package.json\`/\`webpack.config.js\` für TS→JS-Bundling). Falls das Repo aus
   Azure DevOps stammt und kein lokaler Klon vorliegt: Nutzer nach einem
   lokalen Checkout-Pfad fragen (Azure-DevOps-Web-UI ist ohne Auth nicht
   automatisiert abrufbar) oder \`git clone\` mit den Azure-DevOps-Credentials
   des Nutzers ausführen lassen.

## 1. Extraktions-Workflow — Solution-Seite

1. Solution-.zip mit \`Expand-Archive\` entpacken.
2. Falls bereits SolutionPackager-Struktur (Ordner \`Entities/\`, \`WebResources/\`,
   \`Workflows/\`, \`PluginAssemblies/\`, \`Roles/\`, \`AppModules/\`, \`SiteMap.xml\`,
   \`solution.xml\`) vorhanden ist: direkt weiterverarbeiten.
3. Falls nur \`customizations.xml\` + \`solution.xml\` vorliegen (Raw-Export): mit
   einem echten XML-Parser (Node \`fast-xml-parser\`/\`xml2js\`, NICHT Regex)
   parsen — die Datei ist groß (oft mehrstellige MB) und stark verschachtelt.
   \`solution.xml\` liefert die RootComponent-Liste (welche Entities/Workflows/
   Roles/WebResources überhaupt Teil der Solution sind); \`customizations.xml\`
   enthält die eigentlichen Definitionen.
4. Relevante Knoten in \`customizations.xml\` bzw. \`Entities/<name>/*.xml\`:
   - \`Entity.xml\` / \`<EntityInfo>\` → Attribute, Typen, Required Level,
     OptionSet-Referenzen, PrimaryIdAttribute/PrimaryNameAttribute
   - \`Relationships.xml\` → 1:N, N:1, N:N inkl. CascadeConfiguration
   - \`FormXml\` (\`Entities/<name>/Forms/*.xml\`) → Tabs/Sections/Controls,
     Sub-Grids, Quick-View-Forms, \`<event>\`-Knoten (OnLoad/OnSave/TabStateChange/
     OnChange) mit referenzierten \`<Library name="...">\` Webresource-Namen und
     \`FunctionName\`/\`Parameters\`/\`Enabled\`
   - \`SavedQueries.xml\` / \`SavedQueryVisualizations.xml\` → Views/Charts
   - \`RibbonDiffXml\` (pro Entity oder global) → Custom Buttons, Command
     Definitions, Enable-/DisplayRules, \`<CrmParameter>\`-Bindings auf
     JS-Funktionen in Webresources
   - \`WebResources/*.data.xml\` bzw. \`WebResources.xml\` → Webresource-Name,
     Typ (JScript/HTML/CSS/PNG/RESX), \`DisplayName\`, referenzierter Inhalt
     (Base64 in Raw-Export, eigene Datei bei SolutionPackager-Struktur)
   - \`Workflows/*.xml\` → Category unterscheiden: 0=Workflow (klassisch),
     1=Dialog, 2=**Business Rule**, 3=Action, 4=Business Process Flow,
     5=Modern Flow/Power Automate (bei Cloud-Flow-Export als eigener
     Component-Typ, JSON-Definition in \`clientdata\`)
   - \`PluginAssemblies/*.xml\`, \`PluginTypes.xml\`,
     \`SdkMessageProcessingSteps.xml\` → Assembly-Name, Plugin-Typ (Klasse),
     Message (Create/Update/Delete/...), Primary Entity, Stage
     (10=PreValidation/20=PreOperation/40=PostOperation), Mode (Sync/Async),
     Filtering Attributes, Step-Konfiguration (unsecure/secure config)
   - \`Roles/*.xml\` → Security Roles inkl. Privilegien-Matrix pro Entity
   - \`FieldSecurityProfiles/*.xml\` → Field-Level-Security
   - \`AppModules/*.xml\` + \`SiteMap.xml\` → Model-Driven-App-Navigation
     (Areas/Groups/SubAreas), welche Entities/Dashboards/Custom-Pages sichtbar sind
   - \`OptionSets/*.xml\` → globale Options-Sets (Werte, Labels je Sprache)
5. Für jede referenzierte Assembly/jeden Webresource-Namen einen Lookup-Index
   (Name → Datei/Zweck) aufbauen; dieser Index wird in Abschnitt 3 mit dem
   Repository gemappt.

## 2. Extraktions-Workflow — Repository-Seite (z. B. "D365Scripts")

1. Repo-Struktur scannen (Ordner-/Dateiliste), typische Muster erkennen:
   - JS/TS-Dateien pro Entity/Formular (Form-Scripting) — oft benannt nach der
     Webresource-Logical-Name-Konvention (z. B. \`<publisherprefix>_<entity>_form.js\`)
   - Ribbon-bezogene JS-Dateien (Command-Handler, Enable-Rules)
   - Plugin-/Workflow-Assembly-Quellcode (C#, meist ein eigenes .csproj/.cdsproj
     pro Assembly, Klassen implementieren \`IPlugin\`/\`CodeActivity\`)
   - Build-/ALM-Artefakte: \`azure-pipelines.yml\`, \`spkl.json\` (spkl-basiertes
     Plugin-/Webresource-Deployment), \`package.json\`/\`webpack.config.js\`
     (TS→JS-Bundling für Webresources), \`.pa.json\`/\`solution.xml\` im Repo selbst
     (falls Source-of-Truth der Solution im Repo als unpacked Solution liegt)
   - Tests (\`*.Tests\`-Projekte für Plugins, Jest/Mocha für JS)
2. Für jede JS/TS-Datei: Funktionsnamen extrahieren (Regex auf
   \`function <name>(\`, \`export function\`, \`const <name> = (\`), Kommentare am
   Dateianfang (JSDoc-Header) als Kurzbeschreibung übernehmen, referenzierte
   Xrm-APIs zählen (\`Xrm.Page\`/\`formContext\`/\`Xrm.WebApi\`/\`Xrm.Utility\`/
   \`executionContext\`) um Alt- vs. Neu-API-Nutzung sichtbar zu machen
   (formContext ist der moderne, Xrm.Page der veraltete Zugriffspfad).
3. Für jede C#-Plugin-/Workflow-Klasse: Klassenname, implementiertes Interface,
   registrierte Message/Stage (falls per Attribut/CrmPluginRegistration-Tooling
   im Code annotiert) extrahieren; sonst auf den Solution-seitigen
   SdkMessageProcessingSteps-Index (Abschnitt 1.4) verweisen.
4. **Mapping Repo ↔ Solution**: Webresource-Logical-Name (aus Solution) auf
   Datei im Repo matchen — bevorzugt über exakten Namen/Pfad-Suffix, sonst
   über Dateinamen ohne Präfix/Extension als Fuzzy-Match. Nicht zuordenbare
   Solution-Webresources bzw. Repo-Dateien ohne Solution-Referenz jeweils
   explizit als "nicht gemappt" auflisten (wichtiges Onboarding-Risiko:
   toter Code vs. fehlender Source).
5. Falls das Repo eine CI/CD-Pipeline enthält: Deployment-Reihenfolge
   (Solution-Import → Plugin-Registrierung → Webresource-Upload → Daten-
   Migration) aus der Pipeline-Definition ableiten und im ALM-Kapitel
   dokumentieren.

## 3. Dokumentstruktur (Gliederungsschema für model-driven D365-CE-Apps)

Basierend auf dem 16-Kapitel-Schema der Canvas-App-Skill, aber für model-driven
Apps angepasst/erweitert:

1. Dokumenteninformationen (Quelle Solution + Quelle Repository mit Commit/
   Branch, Solution-Name, Version, Publisher/Prefix, Managed/Unmanaged)
2. Projektübersicht (Zielsetzung, Multi-Kunden-/Wiederverwendungskontext)
3. Lösungsübersicht — **Mermaid \`graph LR\`**: Model-Driven-App ↔ Dataverse ↔
   Plugins ↔ Classic Workflows/Business Rules ↔ Power Automate ↔ externe
   Systeme; Komponententabelle (Entity/Form/Webresource/Plugin/Workflow-Anzahl)
4. Fachliches Konzept — Use Cases aus Sitemap/App-Modules und Formularen
   ableiten, **Mermaid \`flowchart\`** für zentrale Geschäftsprozesse (z. B.
   Business Process Flow als Sequenz)
5. Datenmodell — Tabellenliste mit Namenskonvention (Publisher-Präfix),
   **Mermaid \`erDiagram\`** mit kuratierten 1:N/N:N-Beziehungen (Systemfelder
   wie createdby/modifiedby/ownerid herausfiltern), Options-Sets-Übersicht,
   Custom vs. customized Standard-Entitäten kennzeichnen
6. App-Struktur — Sitemap/App-Module (Areas/Groups/SubAreas), Formulare je
   Entity (Main/Quick Create/Quick View), Views/Charts, Dashboards
7. FormScripting — **je Formular**: Tabelle Event → Webresource → Funktion →
   Kurzbeschreibung (aus JSDoc, falls vorhanden); globale Skript-Utilities;
   Alt-API- (Xrm.Page) vs. Standard-API- (formContext) Nutzung als
   Qualitäts-/Risiko-Indikator; **Mermaid \`flowchart\`** für 1–2 komplexe
   Formular-Interaktionen (z. B. abhängige Pflichtfelder, dynamisches
   Ein-/Ausblenden von Sections)
8. Ribbon & Command Bar — Custom Buttons je Entity, Enable-/DisplayRules,
   referenzierte JS-Funktionen, Icon-/Label-Übersicht
9. Server-seitige Logik (Plugins & Classic Workflows) — Tabelle Assembly →
   Plugin-Typ → Message/Stage/Mode → Primary Entity → Filtering Attributes →
   Zweck; Business Rules separat als eigene Tabelle (Entity → Bedingung →
   Aktion); **Mermaid \`flowchart\`** für komplexe Plugin-Pipelines pro Entity
   (Reihenfolge PreValidation → PreOperation → Platform → PostOperation)
10. Schnittstellen — Power-Automate-/Cloud-Flows (falls Teil der Solution),
    externe Integrationen (Custom Connectors, Webhooks, Azure Functions aus
    Plugin-Code ersichtlich), **Mermaid \`flowchart\`**-Übersicht
11. Sicherheitskonzept — Security Roles (Privilegien-Matrix, mind. für Custom
    Entities), Field Security Profiles, Business-Unit-/Team-Struktur falls
    aus Solution ableitbar
12. ALM und Deployment — Solution-Layering (Base/Patch/Extension-Solutions
    falls erkennbar), Pipeline-Ablauf aus dem Repo (Abschnitt 2.5), spkl/
    Build-Tooling, Umgebungsstrategie (Dev/Test/Prod) falls aus
    Pipeline-Variablen ableitbar
13. Monitoring und Betrieb — Plugin-Tracing, Async-Job-Überwachung, ggf.
    Application Insights-Anbindung aus Plugin-/Flow-Code
14. Offene Punkte, Risiken und Auffälligkeiten (automatisiert erkannt) —
    konkrete Funde: nicht gemappte Webresources/Dateien (Abschnitt 2.4),
    Xrm.Page-Nutzung (veraltet), hartcodierte GUIDs/Options-Set-Werte in JS
    oder Plugins, synchrone Plugins auf performancekritischen Messages,
    fehlende Unregister-/Fehlerbehandlung, Test-/Demo-Formulare, fehlende
    Testautomatisierung
15. Architekturentscheidungen (ADRs) — siehe Abschnitt 4
16. Testkonzept — Mindestumfang, Testfalltabelle (ID/Testfall/Erwartung) für
    Formular-Logik, Plugins und Business Rules; **Mermaid \`flowchart\`** als
    Testablauf
17. Onboarding und Übergabe — Onboarding-Pfad als **Mermaid \`flowchart TD\`**,
    kritische Anpassungspunkte für Kundenrollouts, Übergabecheckliste
18. Anhänge — vollständige Entity-/Relationship-Liste, vollständige
    Webresource↔Repo-Mapping-Tabelle, Quelldateipfade (Solution + Repo)

Nicht sicher ableitbare Inhalte (Business Case, SLAs, Betriebsprozesse ohne
Code-Spur) explizit als "noch zu ergänzen" markieren statt zu erfinden.

## 4. ADR-Format (retrospektiv abgeleitete Architekturentscheidungen)

Wie in der Canvas-App-Skill: Status, Kontext, Entscheidung, Konsequenzen,
**Bezug zur Umsetzung** (konkrete Datei/Entity/Plugin/Formular-Referenz).
Typische Kandidaten bei model-driven D365-CE-Lösungen zusätzlich zu den
Canvas-App-Kandidaten:
- Plugin vs. Classic Workflow vs. Business Rule vs. Power Automate für
  dieselbe fachliche Regel (warum diese Wahl je Fall?)
- Synchron vs. asynchron registrierte Plugin-Steps
- formContext- vs. Xrm.Page-Nutzung (Migrationsstand)
- spkl/manuelles Deployment vs. Azure-DevOps-Pipeline für Plugin-/
  Webresource-Rollout
- Solution-Layering-Strategie (eine große Solution vs. Base+Patch+Extension)
- Publisher-Präfix-Strategie bei Multi-Kunden-Rollouts

## 5. Mermaid-Diagrammtypen

Gleiche Konventionen wie in der Canvas-App-Skill (Abschnitt 4 dort):
\`graph LR\` für Systemlandschaft, \`erDiagram\` für Datenmodell, \`flowchart TD/LR\`
für Prozesse/Entscheidungslogik/Pipelines/Onboarding. Risikobehaftete Knoten
farblich markieren, z. B.
\`style X fill:#f8d7da,stroke:#c0392b,color:#7a1f10\`.

## 6. Lokaler HTML-Viewer

**Identische Vorgehensweise wie in der Canvas-App-Skill** (\`marked@4.3.0\` +
\`mermaid.js\` lokal vendort, Sidebar-TOC, Doppel-Lademodus für \`file://\` via
Base64-Textarea, DOMContentLoaded-Absicherung, markenkonformes Mermaid-Theme,
UTF-8-Encoding-Check). Es gibt keinen Grund, hierfür eine zweite Implementierung
zu bauen — dieselbe \`doku-site/index.html\`-Vorlage wiederverwenden/anpassen,
sodass Canvas-App- und model-driven-App-Dokus optisch und funktional identisch
sind. Bei Bedarf die \`powerapps_dataverse_doku_guidelines\`-Skill für die
Detail-Implementierungshinweise des Viewers heranziehen.

## 7. Typischer Ablauf für einen neuen Auftrag

1. Solution-Export entpacken/parsen (Abschnitt 1) und Repository scannen
   (Abschnitt 2); Mapping Webresource ↔ Repo-Datei aufbauen.
2. MD-Datei nach obiger Gliederung (Abschnitt 3) befüllen, offene Punkte markieren.
3. ER-Diagramm aus Entities/Relationships extrahieren und kuratieren.
4. FormScripting-Tabellen je Formular aus FormXml-Events + gemappten
   JS-Funktionen befüllen.
5. Ribbon-, Plugin-, Workflow-/Business-Rule- und Sicherheits-Tabellen befüllen.
6. ADRs aus erkennbaren Architekturentscheidungen ableiten (Abschnitt 4).
7. Testkonzept, Onboarding-Pfad und Übergabecheckliste ergänzen.
8. HTML-Viewer bauen/aktualisieren (Abschnitt 6), Verifikation wie in der
   Canvas-App-Skill beschrieben.
9. \`doku.md\` in \`doku-site/\` nach jeder Änderung an der Haupt-MD-Datei erneut
   synchronisieren (Copy-Item).
`;

const session = await joinSession({
    tools: [
        {
            name: "dataverse_ce_app_doku_guidelines",
            description:
                "Gibt die vollständigen Richtlinien/Methodik zurück, um aus dem Solution-Export der Default-/Ziel-Solution einer Dynamics 365 CE (Dataverse) Model-Driven-App PLUS einem zugehörigen Code-Repository (FormScripting/Ribbon/Plugins/Workflows, z. B. D365Scripts-artige Repos) eine vollständige technische Onboarding-Dokumentation zu erzeugen: Extraktions-Workflow für Solution UND Repository, Mapping Webresource↔Repo-Datei, 18-Kapitel-Gliederung inkl. Datenmodell/FormScripting/Ribbon/Plugins/Workflows/Sicherheit/ALM, ADR-Format, Mermaid-Diagrammtypen und Aufbau des lokal gehosteten HTML-Viewers. Verwenden, wenn eine technische Dokumentation für eine Dynamics 365 CE / Dataverse model-driven App (nicht Canvas App) erstellt oder aktualisiert werden soll.",
            parameters: { type: "object", properties: {} },
            handler: async () => GUIDELINES,
        },
    ],
});
