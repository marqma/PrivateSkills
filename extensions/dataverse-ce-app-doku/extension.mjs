// Extension: dataverse-ce-app-doku
// Skill zum Generieren technischer Dokumentation für Dynamics 365 CE / Dataverse
// Model-Driven-Apps aus (1) dem Solution-Export der Default-/Zielsolution und
// (2) dem Referenz-Tool "ORBIS.PluginDoc" (Azure-DevOps-Repo ORBIS.ProcessDoc),
// das per Live-Verbindung Plugins/Workflows/BusinessRules/Scripts aus Dataverse
// extrahiert und als Markdown+Mermaid+PDF dokumentiert.
// Ergänzt/komplementiert die Canvas-App-Doku-Skill (powerapps-dataverse-doku)
// um alles, was für klassische model-driven D365-CE-Lösungen relevant ist.
//
// Stand: verifiziert gegen den tatsächlichen Quellcode von ORBIS.PluginDoc
// (Program.cs, Tools/RetrieveAndPrepare.cs, Tools/GroupToMarkdown.cs,
// Tools/ClassicFlowToMermaid.cs, Tools/ModernFlowToMermaid.cs, D365Plugins/*,
// D365Flows/*, D365Scripts/*, azure-pipelines.yml, Scripts/*.ps1).

import { joinSession } from "@github/copilot-sdk/extension";

const GUIDELINES = `
# Skill: Technische Dokumentation für Dynamics 365 CE / Dataverse Model-Driven Apps

Zweck: Aus (a) dem Solution-Export der Default-/Ziel-Solution einer Dynamics 365
CE (Dataverse) Lösung UND (b) dem Referenz-Tool **ORBIS.PluginDoc** (Azure-DevOps-
Repo \`ORBIS.ProcessDoc\`) — das Plugins, Classic/Modern Workflows, Business
Rules und Script-Webresources **live per Dataverse-Verbindung** ausliest — eine
vollständige, deutschsprachige technische Onboarding-Dokumentation erzeugen.
Zielgruppe: neue Entwickler, die eine bestehende model-driven D365-CE-Lösung
übernehmen/weiterentwickeln müssen.

**Wichtige Korrektur gegenüber einer naiven Annahme:** \`ORBIS.PluginDoc\` ist
**kein** statischer Form-Scripting-/JS-Quellcode-Repository-Scanner. Es ist eine
eigenständige **.NET-6-Konsolenanwendung**, die sich per
\`Microsoft.PowerPlatform.Dataverse.Client.ServiceClient\` mit einer
Connection-String **live mit der Organisation verbindet**, per FetchXML Plugins/
Workflows/BusinessRules/Script-Webresources abfragt und daraus eine Markdown-
Datei plus ein Mermaid-Diagramm pro Workflow erzeugt, die anschließend über
Docker (mermaid-cli + Pandoc/eisvogel) zu einer PDF-Datei zusammengebaut werden.
Es gibt dort **keine** JS-Dateiablage zum Parsen und **keinen** HTML-Viewer.

Diese Skill ist die model-driven-App-Ergänzung zur Canvas-App/Dataverse-Skill
(\`powerapps_dataverse_doku_guidelines\`). Wo sinnvoll werden Mermaid-Konventionen
und der optionale HTML-Viewer (Abschnitt 6) aus dieser Schwester-Skill
wiederverwendet, um beide Doku-Typen im selben Stil zu halten — das ist jedoch
eine bewusste Ergänzung dieser Skill und **kein** Bestandteil von ORBIS.PluginDoc
selbst.

## 0. Erwartete Eingaben — zwei unabhängige Quellen mit unterschiedlicher Rolle

1. **Solution-Export** der Default-/Ziel-Solution als .zip (idealerweise
   unmanaged, mit SolutionPackager entpackt: Ordner \`Entities/\`,
   \`WebResources/\`, \`Workflows/\`, \`PluginAssemblies/\`, \`Roles/\`,
   \`AppModules/\`, \`SiteMap.xml\`, \`solution.xml\`). Liegt nur die rohe
   Export-.zip vor (\`customizations.xml\` + \`solution.xml\`), zusätzlich
   \`pac solution unpack\` nutzen, falls die Pipeline-CLI verfügbar ist; sonst
   \`customizations.xml\` mit einem echten XML-Parser (nicht Regex) direkt
   parsen. **Diese Quelle liefert die Bereiche, die ORBIS.PluginDoc NICHT
   abdeckt**: Datenmodell/Entities/Relationships, Formulare/Ribbon-Definitionen,
   Security Roles/Field Security, Sitemap/App-Module (Abschnitt 3).
2. **ORBIS.PluginDoc-Lauf** (Quelle für Plugins/Workflows/BusinessRules/Scripts,
   Abschnitt 2). Zwei mögliche Ausgangslagen abfragen/prüfen:
   a) Es liegt bereits ein **fertiger Lauf** vor: \`outputMarkdown.md\` +
      \`*.mmd\`-Dateien (ein Mermaid-Diagramm pro Workflow) im Repo-Root oder
      als Pipeline-Artefakt. Dann direkt diese Dateien als Datenquelle für die
      Kapitel Plugins/Workflows/BusinessRules/Scripts verwenden (parsen/zitieren).
   b) Es liegt **nur der Tool-Quellcode** vor (dieses Repository), aber kein
      fertiger Lauf, und es besteht **kein** Zugriff auf eine echte
      Dataverse-Organisation in dieser Session: In diesem Fall NICHT versuchen,
      selbst eine Live-Verbindung aufzubauen (Credentials wären zwingend nötig
      und dürfen nicht erraten/erfunden werden). Stattdessen den Nutzer fragen,
      ob (i) ein vorhandener \`outputMarkdown.md\`-Export bereitgestellt werden
      kann, (ii) das Tool selbst mit eigenen Zugangsdaten ausgeführt werden soll
      (Anleitung siehe Abschnitt 2.5), oder (iii) diese Kapitel vorerst als
      "noch zu ergänzen" markiert werden, bis ein Lauf vorliegt.
3. Beide Quellen sind unabhängig voneinander verwendbar — die Skill funktioniert
   auch, wenn nur eine der beiden vorliegt; die jeweils fehlenden Kapitel werden
   dann explizit als offen markiert statt erfunden.

## 1. Extraktions-Workflow — Solution-Seite (Datenmodell, Formulare, Ribbon, Sicherheit, App-Struktur)

1. Solution-.zip mit \`Expand-Archive\` entpacken; SolutionPackager-Struktur
   bevorzugen (siehe Abschnitt 0.1).
2. Relevante Knoten:
   - \`Entity.xml\` → Attribute, Typen, Required Level, OptionSet-Referenzen,
     PrimaryIdAttribute/PrimaryNameAttribute
   - \`Relationships.xml\` → 1:N, N:1, N:N inkl. CascadeConfiguration
   - \`FormXml\` (\`Entities/<name>/Forms/*.xml\`) → Tabs/Sections/Controls,
     Sub-Grids, Quick-View-Forms, \`<event>\`-Knoten (OnLoad/OnSave/OnChange)
     mit referenzierten \`<Library name="...">\`-Webresource-Namen und
     \`FunctionName\`/\`Parameters\`/\`Enabled\` — dies ist die einzige Quelle für
     Formular-Event-Bindungen, da ORBIS.PluginDoc diese nicht ausliest
   - \`SavedQueries.xml\` / \`SavedQueryVisualizations.xml\` → Views/Charts
   - \`RibbonDiffXml\` → Custom Buttons, Command Definitions, Enable-/
     DisplayRules, \`<CrmParameter>\`-Bindungen auf JS-Funktionen
   - \`WebResources/*.data.xml\` bzw. \`WebResources.xml\` → Webresource-Name,
     Typ, DisplayName — als **Abgleichsindex** zum Script-Kapitel aus
     ORBIS.PluginDoc (Abschnitt 2.4) nutzen
   - \`Roles/*.xml\` → Security Roles inkl. Privilegien-Matrix
   - \`FieldSecurityProfiles/*.xml\` → Field-Level-Security
   - \`AppModules/*.xml\` + \`SiteMap.xml\` → Model-Driven-App-Navigation
   - \`OptionSets/*.xml\` → globale Options-Sets
3. Plugin-/Workflow-/BusinessRule-/Script-Definitionen aus der Solution
   (\`PluginAssemblies/*.xml\`, \`SdkMessageProcessingSteps.xml\`,
   \`Workflows/*.xml\`) **nur als Kreuzkontrolle** heranziehen, ob die per
   ORBIS.PluginDoc gelieferte Liste vollständig ist (z. B. wenn das Tool nur
   gegen eine bestimmte Assembly/Solution gefiltert wurde) — die eigentliche
   inhaltliche Doku dieser Komponenten kommt aus Abschnitt 2.

## 2. Extraktions-Workflow — ORBIS.PluginDoc (Plugins, Workflows, Business Rules, Scripts)

### 2.1 Architektur des Tools (Ist-Zustand, verifiziert)

- .NET-6-Konsolenanwendung (\`ORBIS.PluginDoc.csproj\`), NuGet-Pakete:
  \`Microsoft.PowerPlatform.Dataverse.Client\`, \`Newtonsoft.Json\`,
  \`ExtendedXmlSerializer\`.
- Einstiegspunkt \`Program.cs\`: baut eine \`ServiceClient\`-Verbindung über eine
  Connection-String-Umgebungsvariable auf (\`D365_CONNECTION_STRING\`, Format
  \`Url=...;Username=...;Password=...;authtype=OAuth;\`), danach werden pro
  Komponententyp bedingt (Feature-Flags per Env-Var) FetchXML-Abfragen gebaut
  und an \`RetrieveAndPrepare\` übergeben.
- Modelle: \`D365Plugins.D365Plugin\`, \`D365Flows.ClassicFlow\`,
  \`D365Flows.BusinessRule\`, \`D365Flows.FlowClientData\` (Modern/Power-Automate-
  Flow), \`D365Scripts.D365Script\` + \`D365Scripts.D365Dependency\`
  (\`DependencyDirection.UsedBy\`/\`Uses\`).
- Orchestrierung in \`Tools/RetrieveAndPrepare.cs\`: je Komponententyp eine
  \`Handle*\`-Methode (\`HandlePlugins\`, \`HandleModernWorkflows\`,
  \`HandleClassicWorkflows\`, \`HandleBusinessRules\`, \`HandleScripts\`), die
  Daten lädt, gruppiert (\`GroupToMarkdown\`) und in eine gemeinsame
  \`outputMarkdown.md\` schreibt (Pandoc/eisvogel-kompatibler YAML-Header wird
  beim ersten Aufruf einmalig geschrieben).
- Mermaid-Konvertierung: \`Tools/ClassicFlowToMermaid.cs\` (parst das
  \`xamlstring\`-Feld klassischer Workflows via \`XElement\` + Konstanten aus
  \`D365Flows/XNameStrings.cs\` für WF-Aktivitätstypen wie \`SetEntityProperty\`,
  \`GetEntityProperty\`, \`Persist\`, \`Postpone\`, \`SetState\`, Bedingungen etc.)
  bzw. \`Tools/ModernFlowToMermaid.cs\` (deserialisiert das \`clientdata\`-JSON
  eines Power-Automate-Flows in Trigger/Actions-Bäume inkl. \`if\`/\`switch\`/
  \`foreach\`-Verzweigungen und wandelt sie rekursiv in Mermaid-Flowchart-Syntax
  um). Für jeden Workflow entsteht eine eigene \`<WorkflowName>.mmd\`-Datei im
  Arbeitsverzeichnis.

### 2.2 Komponententypen, FetchXML-Filter und Feature-Flags

Alle Komponententypen werden über die Workflow-\`category\`-Spalte unterschieden
(FetchXML-Filter \`category = <n>\`), außer Plugins (eigene Abfrage über
\`sdkmessageprocessingstep\`) und Scripts (Web-Resource-Abfrage):

| Komponente | category-Wert | Env-Var Ein/Aus | Env-Var Filter | Env-Var Gruppierungen |
|---|---|---|---|---|
| Plugins | – (sdkmessageprocessingstep) | \`D365_SHOW_PLUGINS\` | \`D365_PLUGIN_ASSEMBLYNAME\` (kommagetrennt, leer = alle) | \`D365_SHOW_PLUGIN_GROUPINGS\` |
| Classic Workflow | 0 | \`D365_SHOW_CLASSIC_WORKFLOWS\` | \`D365_SOLUTIONNAME_CLASSIC_WORKFLOW\` (leer = alle) | \`D365_SHOW_CLASSIC_WORKFLOW_GROUPINGS\` |
| Business Rule | 2 (nur Type 2 = Backend) | \`D365_SHOW_BUSINESS_RULES\` | \`D365_SOLUTIONNAME_BUSINESS_RULES\` | – |
| Modern Flow (Power Automate) | 5 | \`D365_SHOW_MODERN_WORKFLOWS\` | \`D365_SOLUTIONNAME_MODERN_WORKFLOW\` | \`D365_SHOW_MODERN_WORKFLOW_GROUPINGS\` |
| Scripts (Web Resources) | – (webresource) | \`D365_SHOW_SCRIPTS\` | \`D365_SOLUTIONNAME_SCRIPTS\` | – |

Zusätzliche Flags: \`D365_PLUGIN_SHOW_CONFIG\` / \`D365_PLUGIN_SHOW_UNSECURE_CONFIG\`
(steuern, ob Secure/Unsecure-Config von Plugin-Steps sichtbar sind — aus
Sicherheitsgründen im Regelfall \`false\`), \`D365_MD_HEADER_TITLE\` /
\`D365_MD_HEADER_KEYWORDS\` (Pandoc-Titelseite), \`D365_OUTPUT_DIAGRAMS_SEPERATELY\`
(kopiert generierte Flowchart-PDFs zusätzlich in einen eigenen
\`ORBIS.ProcessDoc_Flowcharts\`-Ordner als separates Pipeline-Artefakt).

### 2.3 Inhalt je Komponente (was tatsächlich dokumentiert wird)

- **Plugins**: Name, Description, Statecode, Mode (Sync/Async), Stage, Rank,
  Operation/MessageName (Event), PrimaryObjectTypeCode (Entity),
  FilteringAttributes, AssemblyName, PluginTypeName, Pre-/Post-/Both-Image-
  Attribute (inkl. Sonderfall "All" wenn keine Attribute gefiltert sind),
  optional Secure-/Unsecure-Config. Gruppiert nach Assembly → (optional) Event
  → Entity.
- **Classic Workflows**: Name, PrimaryEntity, Mode, Scope, Create-/Update-/
  Delete-Stage, TriggerOnUpdateAttributeList, Description, Event, sowie ein
  aus dem XAML generiertes Mermaid-Flowchart der Aktivitätskette. Gruppiert
  nach PrimaryEntity → (optional) Event.
- **Modern Workflows (Power Automate Flows)**: Name, Entity, Event/ChangeType,
  Scheduled/Scheduling, FilteringAttributes, FilterExpression, Trigger-Details
  (ApiId/ConnectionName/OperationId, ManualFlowInputs, TriggerConditions),
  sowie ein aus dem \`clientdata\`-JSON generiertes Mermaid-Flowchart inkl.
  Verzweigungen (\`if\`/\`switch\`/\`foreach\`). Gruppiert nach Solution → (optional)
  Event/Entity.
- **Business Rules** (nur Backend-Typ 2): PrimaryEntity, Name, Description —
  bewusst schlank gehalten, da die eigentliche Bedingungs-/Aktionslogik nicht
  aus der XAML/JSON extrahiert wird (anders als bei Workflows).
- **Scripts (Web-Resource-Dokumentation)**: Name, DisplayName, Description,
  WebResourceId, und eine **Dependency-Liste**, die über die Dataverse-Tabelle
  \`dependency\` ermittelt wird — NICHT durch Parsen von JS-Dateiinhalten. Zwei
  FetchXML-Abfragen pro Script:
  1. Welche Komponenten **nutzen** dieses Webresource (z. B. Formulare via
     \`systemform\`-Link, Ribbons) → \`DependencyDirection.UsedBy\`.
  2. Welche anderen Webresources dieses Script **selbst nutzt** (z. B.
     referenzierte Bibliotheken) → \`DependencyDirection.Uses\`.
  \`.js.map\`-Dateien werden automatisch herausgefiltert. Gruppiert nach Name.

  **Konsequenz für die Doku**: Das FormScripting-Kapitel dieser Skill basiert
  auf zwei komplementären Quellen — der \`dependency\`-basierten
  Nutzungsübersicht aus ORBIS.PluginDoc (welches Formular/Ribbon referenziert
  welches Script) UND den \`<event>\`-Knoten aus dem FormXml der Solution
  (welche konkrete Funktion bei welchem Event aufgerufen wird, Abschnitt 1.2).
  Eine Auflistung einzelner JS-Funktionsnamen/JSDoc-Kommentare ist nur möglich,
  wenn der tatsächliche Webresource-Quellcode zusätzlich vorliegt (z. B. aus
  einem separaten Web-Resource-Export oder Solution-Packager-Ausgabe) — das
  ist NICHT Teil von ORBIS.PluginDoc und muss, falls gewünscht, explizit als
  zusätzlicher, optionaler Analyseschritt behandelt und als solcher
  gekennzeichnet werden.

### 2.4 Output-Format von ORBIS.PluginDoc selbst (Referenz) vs. Output-Format dieser Skill

ORBIS.PluginDoc selbst erzeugt **eine** \`outputMarkdown.md\` mit Pandoc/eisvogel-
kompatiblem YAML-Header (Titel, Keywords, Autor, Papierformat, Logo, eigene
TOC-Seite) sowie pro Workflow (Classic + Modern) eine eigene \`<Name>.mmd\`-Datei
im Arbeitsverzeichnis (Dateiname bereinigt von Sonderzeichen). Überschriften-
reihenfolge im Original-Tool: Plugin Documentation → Modern Workflow
Documentation → Business Rule Documentation (Backend) → Classic Workflow
Documentation → Script Documentation (abhängig von den aktiven \`Show*\`-Flags
und der Abarbeitungsreihenfolge in \`Program.Main\`). Anschließend konvertiert
die tool-eigene CI/CD-Pipeline (\`azure-pipelines.yml\`, Ubuntu-Agent) bzw. die
lokale Alternative (\`Scripts/1setWorkingDirectory.ps1\` … \`4createPDFfromMarkdown.ps1\`)
jede \`.mmd\`-Datei per \`docker run minlag/mermaid-cli\` zu einem PDF/PNG-Bild
und bindet dieses Bild über \`\`\`{=latex}\\includegraphics\`\`\`-Blöcke in die
finale PDF ein (\`docker run dalibo/pandocker --template=eisvogel\`). Das ist
der Weg, den das Original-Tool geht, **aber nicht der von dieser Skill
standardmäßig erzeugte Output** (siehe Abschnitt 6).

**Für diese Skill ist der Standard-Output eine Markdown-Datei, in der jedes
Mermaid-Diagramm als natives \`\`\`mermaid ... \`\`\`-Codeblock eingebettet ist**
(nicht als gerendertes Bild/PDF). Der Inhalt jeder \`<WorkflowName>.mmd\`-Datei
aus einem ORBIS.PluginDoc-Lauf wird dafür 1:1 in einen solchen Codeblock
übernommen — kein Docker/mermaid-cli/Pandoc-Schritt nötig, um die Doku
lesbar zu machen. Das funktioniert direkt in GitHub/Azure-DevOps-Wikis,
VS-Code-Preview und im optionalen HTML-Viewer (Abschnitt 6), die alle
Mermaid-Codeblöcke selbst rendern.

### 2.4a Betriebsmodi: Live-Lauf vs. Wiederverwendung eines vorhandenen Exports

Zwei gleichwertige Wege, an die Rohdaten aus Abschnitt 2.3 zu kommen:

1. **Live-Lauf durch den Nutzer**: \`dotnet restore\` + \`dotnet run\` (bzw. die
   bereits gebaute \`bin/Debug/<tfm>/ORBIS.PluginDoc.exe\`) mit den Env-Vars aus
   Abschnitt 2.2 gegen eine echte Dataverse-Organisation ausführen (siehe
   Abschnitt 2.5 für den Umgang mit Zugangsdaten). Ergebnis: \`outputMarkdown.md\`
   + \`*.mmd\`-Dateien im Arbeitsverzeichnis.
2. **Wiederverwendung eines bereits vorhandenen Exports**: Der Nutzer stellt
   ein zuvor erzeugtes \`outputMarkdown.md\` + zugehörige \`*.mmd\`-Dateien
   bereit (z. B. aus einem früheren Pipeline-Lauf/Artefakt). Diese werden
   direkt geparst, ohne das Tool erneut auszuführen.

In beiden Fällen ist das Ergebnis für Abschnitt 3 identisch: eine
Rohdatenbasis (Tabelleninhalte + Mermaid-Quelltext je Workflow), die in die
kombinierte Ziel-Markdown-Datei überführt wird.

### 2.5 Vorgehen, wenn kein fertiger Lauf vorliegt

Falls nur der Tool-Quellcode, aber kein \`outputMarkdown.md\`/\`*.mmd\`-Export
vorliegt und keine Live-Dataverse-Verbindung in der Session verfügbar ist:
- **Keine Zugangsdaten raten oder Platzhalter-Connection-Strings einsetzen.**
- Dem Nutzer die drei Optionen aus Abschnitt 0.2.b anbieten.
- Falls der Nutzer eigene Zugangsdaten bereitstellt und das Tool selbst
  ausgeführt werden soll: \`dotnet restore\` + \`dotnet run\` im Repo-Root mit den
  Env-Vars aus Abschnitt 2.2 setzen (z. B. per \`$env:D365_...\` in PowerShell),
  danach \`outputMarkdown.md\`/\`*.mmd\` im Arbeitsverzeichnis (Standard:
  \`bin/Debug/net6.0\`) als Grundlage für Abschnitt 2.3 verwenden.
- Ohne Verbindung und ohne bereitgestellten Export: die betroffenen Kapitel
  (Plugins, Workflows, Business Rules, Scripts) explizit als "noch zu
  ergänzen — kein ORBIS.PluginDoc-Lauf verfügbar" kennzeichnen statt zu raten.

## 3. Dokumentstruktur (Gliederungsschema für model-driven D365-CE-Apps)

Je Kapitel ist vermerkt, aus welcher Quelle (Abschnitt 1 = Solution-Export,
Abschnitt 2 = ORBIS.PluginDoc-Lauf, "beide" = Abgleich nötig) die Inhalte stammen:

1. Dokumenteninformationen — Solution-Name/Version/Publisher (Quelle 1),
   Datum und Konfiguration des ORBIS.PluginDoc-Laufs (welche Env-Vars/Filter
   aktiv waren, Quelle 2)
2. Projektübersicht (Zielsetzung, Multi-Kunden-/Wiederverwendungskontext) — frei
3. Lösungsübersicht — **Mermaid \`graph LR\`**: Model-Driven-App ↔ Dataverse ↔
   Plugins ↔ Classic Workflows/Business Rules ↔ Power Automate ↔ externe
   Systeme; Komponententabelle mit Anzahl je Typ (beide Quellen)
4. Fachliches Konzept — Use Cases aus Sitemap/App-Modules und Formularen
   ableiten (Quelle 1), **Mermaid \`flowchart\`** für zentrale Geschäftsprozesse
5. Datenmodell — Tabellenliste, Namenskonvention (Publisher-Präfix),
   **Mermaid \`erDiagram\`** mit kuratierten Beziehungen, Options-Sets (Quelle 1
   — von ORBIS.PluginDoc **nicht** abgedeckt)
6. App-Struktur — Sitemap/App-Module, Formulare, Views/Charts, Dashboards
   (Quelle 1)
7. FormScripting — Tabelle Event → Webresource → Funktion je Formular aus
   FormXml (Quelle 1), ergänzt um die Script-Dependency-Übersicht
   (welches Formular/Ribbon nutzt welches Webresource, Quelle 2, Abschnitt
   2.3 "Scripts") — Abgleich beider Listen, Abweichungen explizit benennen
8. Ribbon & Command Bar — Custom Buttons, Enable-/DisplayRules aus
   \`RibbonDiffXml\` (Quelle 1), referenzierte Scripts mit Quelle-2-Dependency
   gegenprüfen
9. Plugins — Tabelle Assembly → Plugin-Typ → Message/Stage/Mode → Entity →
   Filtering Attributes → Images → Zweck, direkt aus dem ORBIS.PluginDoc-Lauf
   (Quelle 2, Abschnitt 2.3); **Mermaid \`flowchart\`** für komplexe
   Plugin-Pipelines pro Entity (PreValidation → PreOperation → Platform →
   PostOperation), aus Stage/Rank-Werten abgeleitet
10. Workflows & Business Rules — Classic-Workflow-Tabelle inkl. generiertem
    Mermaid pro Workflow, Modern-Workflow-Tabelle inkl. generiertem Mermaid
    pro Flow, Business-Rule-Tabelle (alle aus Quelle 2, Abschnitt 2.3); wo
    fachlich sinnvoll auf Business-Process-Flows aus Quelle 1 verweisen
11. Schnittstellen — externe Integrationen, Custom Connectors, aus
    Trigger-/Action-Details der Modern Flows ersichtlich (Quelle 2) plus ggf.
    Hinweise aus Plugin-Code (falls Repo mit Assembly-Quellcode vorliegt)
12. Sicherheitskonzept — Security Roles, Field Security Profiles (Quelle 1);
    Hinweis, ob Plugin-Configs sichtbar dokumentiert wurden
    (\`D365_PLUGIN_SHOW_CONFIG\`/\`_UNSECURE_CONFIG\`, Quelle 2, Abschnitt 2.2)
13. ALM und Deployment — Solution-Layering (Quelle 1); ORBIS.PluginDoc-eigene
    CI/CD-Pipeline als konkretes Beispiel dokumentieren: Env-Var-Konfiguration,
    Docker/mermaid-cli/Pandoc-eisvogel-Kette, lokale PowerShell-Alternative
    (Quelle 2, Abschnitt 2.4)
14. Monitoring und Betrieb — Plugin-Tracing, Async-Job-Überwachung (falls aus
    Solution/Plugin-Code ersichtlich); sonst "noch zu ergänzen"
15. Offene Punkte, Risiken und Auffälligkeiten (automatisiert erkannt) —
    Diskrepanzen zwischen FormXml-Events und Script-Dependencies (Abschnitt 7),
    Plugins mit synchronem Modus auf performancekritischen Messages,
    Business Rules ohne erkennbare Konsequenzdokumentation (bewusste
    Tool-Einschränkung, Abschnitt 2.3), Workflows mit \`hasException = true\`
    aus \`ClassicFlowToMarkdown\` (XAML konnte nicht vollständig in Mermaid
    übersetzt werden — im Lauf-Log/Konsolen-Output sichtbar), fehlende
    Testautomatisierung
16. Architekturentscheidungen (ADRs) — siehe Abschnitt 4
17. Testkonzept — Mindestumfang, Testfalltabelle für Formular-Logik, Plugins,
    Workflows und Business Rules
18. Onboarding und Übergabe — Onboarding-Pfad als **Mermaid \`flowchart TD\`**,
    Hinweis, wie ein erneuter ORBIS.PluginDoc-Lauf ausgelöst wird, falls die
    Doku aktualisiert werden muss
19. Anhänge — vollständige Entity-/Relationship-Liste (Quelle 1), Rohauszug/
    Pfad zu \`outputMarkdown.md\` und den \`*.mmd\`-Dateien (Quelle 2),
    Quelldateipfade

Nicht sicher ableitbare Inhalte (Business Case, SLAs, Betriebsprozesse ohne
Code-/Tool-Spur) explizit als "noch zu ergänzen" markieren statt zu erfinden.

## 4. ADR-Format (retrospektiv abgeleitete Architekturentscheidungen)

Status, Kontext, Entscheidung, Konsequenzen, **Bezug zur Umsetzung** (konkrete
Datei/Entity/Plugin/Formular-Referenz bzw. Env-Var/Pipeline-Schritt bei
ORBIS.PluginDoc). Typische Kandidaten:
- Plugin vs. Classic Workflow vs. Business Rule vs. Modern Flow für dieselbe
  fachliche Regel
- Synchron vs. asynchron registrierte Plugin-Steps
- Live-Extraktion per ServiceClient/FetchXML (ORBIS.PluginDoc) statt
  statischem Solution-Export-Parsing für die Prozessdokumentation — Vorteil:
  immer aktueller Ist-Stand der Organisation; Nachteil: benötigt gültige,
  privilegierte Zugangsdaten zur Zielumgebung bei jedem Doku-Lauf
- Docker/Pandoc/eisvogel-PDF-Pipeline statt HTML-Viewer als Zielformat —
  Konsequenz: Doku-Lauf erfordert Docker in der CI, ist aber offline
  archivierbar/druckbar (PDF)
- Bewusster Verzicht auf inhaltliche Business-Rule-Logik-Extraktion (nur
  Metadaten, keine Bedingungen/Aktionen) — Konsequenz: Business Rules müssen
  bei Bedarf manuell im Maker-Portal nachgeschlagen werden
- spkl/manuelles Deployment vs. Azure-DevOps-Pipeline für Plugin-/
  Webresource-Rollout
- Publisher-Präfix-Strategie bei Multi-Kunden-Rollouts

## 5. Mermaid-Diagrammtypen

\`graph LR\` für Systemlandschaft, \`erDiagram\` für Datenmodell, \`flowchart TD/LR\`
für Prozesse/Entscheidungslogik/Pipelines/Onboarding — konsistent mit der
Canvas-App-Skill. Für Workflow-Kapitel (Abschnitt 3.10) **die von
ORBIS.PluginDoc bereits generierten \`.mmd\`-Dateien direkt übernehmen/einbetten**
statt sie neu zu erstellen; nur bei fehlenden/fehlerhaften Diagrammen
(\`hasException = true\`) manuell nachbauen. Risikobehaftete Knoten farblich
markieren, z. B. \`style X fill:#f8d7da,stroke:#c0392b,color:#7a1f10\`.

## 6. Zielformat: Markdown-Datei mit eingebetteten Mermaid-Diagrammen (+ optionale HTML-Seite)

**Standard-Output dieser Skill ist NICHT die Docker/Pandoc/eisvogel-PDF-Kette
des Original-Tools**, sondern:

1. **Eine einzelne, zusammenhängende \`doku.md\`** (oder ähnlich benannt), die
   die komplette Gliederung aus Abschnitt 3 enthält. Jedes Mermaid-Diagramm
   (ER-Diagramm aus dem Datenmodell, Systemlandschaft, Prozess-Flowcharts,
   sowie die pro Workflow aus ORBIS.PluginDoc übernommenen \`.mmd\`-Inhalte,
   Abschnitt 2.4) wird als natives
   \`\`\`mermaid
   graph LR
       A --> B
   \`\`\`
   -Codeblock **direkt im Markdown** eingebettet — nicht als Bild-Datei, nicht
   als PDF-Include. Das macht die Datei in jedem Markdown-Renderer, der
   Mermaid unterstützt (GitHub, Azure DevOps Wiki, VS Code Preview, der
   HTML-Viewer unten), sofort lesbar, ohne Docker/Zusatztools.
2. **Optional zusätzlich eine lokal gehostete HTML-Seite** (\`doku-site/index.html\`),
   wenn der Nutzer eine interaktive/durchsuchbare Ansicht wünscht. Hierfür
   **exakt dieselbe Vorgehensweise wie in der Canvas-App-Skill**
   (\`powerapps_dataverse_doku_guidelines\`, Abschnitt 5 dort) wiederverwenden/
   anpassen, damit beide Doku-Typen optisch und funktional konsistent sind:
   - \`marked@4.3.0\` + \`mermaid.js\` lokal vendort (kein CDN)
   - Sidebar mit automatisch generiertem Inhaltsverzeichnis (aus h1/h2/h3), Suche
   - Jedes Mermaid-Diagramm mit "🔍 Vergrößern"-Button/Zoom-Modal
   - Doppelter Lademodus: \`fetch('doku.md')\` bei Server-Betrieb, sonst
     eingebettetes Base64-\`<textarea>\` für \`file://\`-Doppelklick-Öffnen, mit
     \`DOMContentLoaded\`-Absicherung (siehe Fallen in der Canvas-App-Skill)
   - Markenkonformes Mermaid-\`theme: 'base'\` mit eigenen \`themeVariables\`
     statt Standard-Lila
   - UTF-8-Encoding-Check (ä/ö/ü/– korrekt, keine Mojibake)
3. **Kein Docker, kein Pandoc, kein \`eisvogel\`-PDF wird für diese Skill
   benötigt.** Falls ein Nutzer ausdrücklich zusätzlich eine PDF im Stil des
   Original-Tools möchte, ist das eine optionale dritte Ausgabe (Abschnitt 2.4)
   und sollte explizit erfragt werden, statt sie standardmäßig zu erzeugen.

## 7. Typischer Ablauf für einen neuen Auftrag

1. Prüfen, welche der beiden Quellen (Abschnitt 0) vorliegen; bei fehlendem
   ORBIS.PluginDoc-Lauf die Optionen aus Abschnitt 2.5 klären, bevor
   inhaltlich weitergearbeitet wird.
2. Solution-Export entpacken/parsen (Abschnitt 1): Datenmodell, Formulare,
   Ribbon, Sicherheit, App-Struktur.
3. \`outputMarkdown.md\`/\`*.mmd\` aus dem ORBIS.PluginDoc-Lauf (Live-Lauf oder
   vorhandener Export, Abschnitt 2.4a) einlesen und nach Komponententyp
   strukturieren (Abschnitt 2.3); Konfiguration des Laufs (aktive
   \`Show*\`-Flags, Filter) für Kapitel 1/13 notieren.
4. Script-Dependencies (Quelle 2) mit FormXml-Events (Quelle 1) abgleichen
   (Kapitel 7/8), Abweichungen dokumentieren.
5. Die kombinierte \`doku.md\` nach der Gliederung aus Abschnitt 3 befüllen —
   alle Mermaid-Inhalte als eingebettete Codeblöcke (Abschnitt 6), offene
   Punkte markieren, ADRs ableiten (Abschnitt 4).
6. Falls gewünscht: den HTML-Viewer gemäß Abschnitt 6.2 bauen/aktualisieren
   und \`doku.md\` nach jeder Änderung in \`doku-site/\` synchronisieren.
7. Testkonzept, Onboarding-Pfad und Übergabecheckliste ergänzen.
8. Bei Aktualisierung: Hinweis dokumentieren, dass ein erneuter
   ORBIS.PluginDoc-Lauf (bzw. neuer Solution-Export) die Grundlage für die
   nächste Doku-Aktualisierung ist.
`;

const session = await joinSession({
    tools: [
        {
            name: "dataverse_ce_app_doku_guidelines",
            description:
                "Gibt die vollständigen, gegen den echten Quellcode von ORBIS.PluginDoc (Azure-DevOps-Repo ORBIS.ProcessDoc) verifizierten Richtlinien/Methodik zurück, um aus dem Solution-Export der Default-/Ziel-Solution einer Dynamics 365 CE (Dataverse) Model-Driven-App PLUS einem ORBIS.PluginDoc-Lauf (Live-Dataverse-Extraktion von Plugins/Classic-Workflows/Modern-Workflows/Business-Rules/Script-Webresources inkl. generierter Mermaid-Diagramme) eine vollständige technische Onboarding-Dokumentation als **Markdown-Datei mit eingebetteten Mermaid-Codeblöcken** (Standard-Zielformat dieser Skill) zu erzeugen, optional ergänzt um eine lokal gehostete HTML-Ansicht: erwartete Eingaben und Umgang mit fehlenden Live-Zugangsdaten, Live-Lauf vs. Wiederverwendung eines vorhandenen ORBIS.PluginDoc-Exports, Extraktions-Workflow für Solution UND ORBIS.PluginDoc-Output, Abgleich Script-Dependencies mit FormXml-Events, 19-Kapitel-Gliederung inkl. Datenmodell/FormScripting/Ribbon/Plugins/Workflows/BusinessRules/Sicherheit/ALM, ADR-Format, Mermaid-Wiederverwendung, sowie die optionale Docker/Pandoc/eisvogel-PDF-Pipeline des Original-Tools als Alternativausgabe. Verwenden, wenn eine technische Dokumentation für eine Dynamics 365 CE / Dataverse model-driven App (nicht Canvas App) erstellt oder aktualisiert werden soll, insbesondere wenn ein ORBIS.PluginDoc/ORBIS.ProcessDoc-Repository oder dessen Output als Quelle vorliegt.",
            parameters: { type: "object", properties: {} },
            handler: async () => GUIDELINES,
        },
    ],
});
