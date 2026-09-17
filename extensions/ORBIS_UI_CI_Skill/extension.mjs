// Extension: ORBIS_UI_CI_Skill
// Erstellt und prüft ORBIS-konforme Dokumente, Webseiten, Landingpages,
// Präsentationskonzepte und UI-Mockups nach dem ORBIS Corporate Identity Guide.

import { joinSession } from "@github/copilot-sdk/extension";

// ── Referenz-Inhalte ──────────────────────────────────────────────────────────

const SKILL_INSTRUCTIONS = `
# ORBIS UI/CI Skill

## Ziel
Erzeuge direkt nutzbare, klare und moderne Ergebnisse im ORBIS Look and Feel.
Nutze aktuelle offizielle ORBIS Quellen als verbindliche Grundlage.
Erfinde keine Logos, Icons, Bildmotive, Freigaben oder Markenregeln.

## Arbeitsablauf
1. Bestimme Zielgruppe, Kommunikationsziel, Kernbotschaft und Artefakttyp.
2. Prüfe die verfügbaren offiziellen ORBIS Quellen und wende die Quellenhierarchie an.
3. Wähle die passende offizielle Vorlage oder den Master.
4. Erstelle zuerst Informationsarchitektur und Hierarchie, dann Gestaltung.
5. Wende Design Tokens und Component Rules an.
6. Verwende nur freigegebene Assets. Fehlt ein Asset, nutze einen klar beschrifteten Platzhalter.
7. Prüfe das Ergebnis mit der QA-Checkliste.
8. Nenne am Ende verwendete Quelle, Vorlage, Assets, Annahmen und offene Punkte.

## Quellenhierarchie
1. Aktueller ORBIS CI Styleguide und Kurzversion
2. Offizielle Vorlagen, Master und Templates
3. Offizielle Logo-, Icon-, Bild- und Asset-Bibliotheken
4. Aktuelle ORBIS Unternehmenspräsentation
5. Aktuelle Beispielassets desselben Formats
6. Ältere Beispiele nur als Orientierung

## Design Tokens

### Farben
- Corporate Blue: #00488A
- Petrol: #00A3A3
- Highlight Pink: #DB3360
- Night Blue: #16203B
- Night Blue Logo: #1B3054 — ausschließlich im offiziellen Logo
- Mittelgrau: #555555
- Hellgrau: #A7A8AA
- Weiß: #FFFFFF

### Erlaubte Verläufe
- Night Blue → Petrol
- Night Blue → Highlight Pink
- Highlight Pink → Petrol
- Corporate Blue → Petrol

### Typografie
- Online/Druck: Be Vietnam Pro (Regular / Italic / SemiBold)
- Office: Calibri (Regular / Light / Bold / Italic / Bold Italic)

### Abstände (8-Pixel-System)
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96

### Typografische Skala (digitale Empfehlung)
- Display: 48/56 SemiBold
- H1: 40/48 SemiBold · H2: 32/40 SemiBold · H3: 24/32 SemiBold
- Body Large: 18/28 · Body: 16/24 · Small: 14/20

## Verbindliche Markenregeln
- ORBIS und ORBIS SE immer in Versalien schreiben.
- Nur das offizielle ORBIS SE Logo oder Signet verwenden.
- Logo nur proportional skalieren; kein Strecken, Stauchen, Drehen, Umfärben, Nachbauen oder Effekte.
- Mindest-Weißraum um das Logo respektieren.
- #1B3054 ausschließlich für die offizielle Logo-Variante.
- Ausschließlich definierte ORBIS Farben; Transparenzen und markenkonforme Verläufe erlaubt.
- Icons als klare Outline-Icons aus der offiziellen ORBIS Icon-Bibliothek.
- Keine überladenen Effekte, fremden Markenfarben oder frei erfundenen Designelemente.

## Component Rules

### Dokumente
- Whitepaper: DIN A4 Hochformat; sachlich; grafisch reduziert; zweispaltige Inhaltsseiten.
- Broschüre: DIN A4 Hochformat; werblicher; ein-/zweispaltig; helle oder dunkle Hintergründe.
- Checkliste: DIN A4 Hochformat; scanbar; ein-/zweispaltig; klare Statusfelder.
- Booklet: 21×21 cm; kompakt; große Bildansprache; einspaltige Inhaltsseiten.
- Onepager/Multipager: DIN A4 Querformat; starkes Keyvisual; ein-/zweispaltig; klarer Footer.
- Agenda: DIN A4 Hochformat; Datum, Uhrzeit, Thema und Referierende klar.

### Webseiten und Landingpages
- Mobile-first, responsiv und semantisch.
- Klare Hero-Zone mit H1, Nutzenversprechen und primärem CTA.
- Primärer CTA bevorzugt Petrol oder Corporate Blue; Pink nur als bewusstes Highlight.
- Reduzierter Header; sichtbare Hover-, Aktiv- und Fokuszustände.
- Formulare mit sichtbaren Labels, Hilfetexten und verständlichen Fehlermeldungen.
- Karten und Panels flach und klar getrennt; kein beliebiger Glassmorphism.
- CSS Custom Properties aus orbis-theme.css verwenden.

### UI-Mockups
- User Journey, Persona und Kernaktionen zuerst definieren.
- Desktop und Mobile berücksichtigen.
- Relevante Zustände zeigen: leer, geladen, Fehler, Erfolg, deaktiviert, fokussiert.
- Beispieldaten klar kennzeichnen.
- Keine produktive Funktion oder technische Implementierung vortäuschen.
- Für native Microsoft-Produktoberflächen Microsoft UI-Muster beibehalten.

## QA-Checkliste
**Marke**: Offizielles Logo / Platzhalter · Logo proportional · ORBIS SE in Versalien · #1B3054 nur im Logo
**Gestaltung**: Nur definierte Farben · Petrol als Hauptakzent, Pink sparsam · Richtige Hausschrift · Klare Hierarchie · Petrol-Linien gezielt · Offizielle Outline-Icons · Markenkonforme Bildwelt
**Format**: Passende Vorlage · Gesperrte Masterelemente unverändert · Header/Footer konsistent · Diagramme in ORBIS Palette
**Web/UI**: Responsive und semantisch · Tastaturfokus sichtbar · Labels und Fehlerhinweise · Kein reines Farbcodierung · States und CTA-Hierarchie konsistent
**Quellen**: Aktuellste Quelle · Beispiel nicht mit verbindlicher Vorlage verwechselt · Freigaben für Assets · Quellenstand und Annahmen dokumentiert

## Ausgabe-Konventionen
- Benennung: ORBIS_<Artefakt>_<Thema>_v1
- HTML: offline lauffähig, selbst enthalten, oder sauber getrennte HTML/CSS/JS-Dateien.
- Abschließend kurz: Quelle, Vorlage, Assets, Annahmen, Abweichungen und offene Punkte.
`;

// ── Orbis Theme CSS (für HTML-Ausgaben einbettbar) ────────────────────────────

const ORBIS_THEME_CSS = `
:root {
  --orbis-corporate-blue: #00488a;
  --orbis-petrol: #00a3a3;
  --orbis-highlight-pink: #db3360;
  --orbis-night-blue: #16203b;
  --orbis-gray-700: #555555;
  --orbis-gray-400: #a7a8aa;
  --orbis-white: #ffffff;
  --orbis-black: #000000;
  --orbis-gradient-primary: linear-gradient(135deg, #16203b 0%, #00a3a3 100%);
  --orbis-gradient-highlight: linear-gradient(135deg, #16203b 0%, #db3360 100%);
  --orbis-font-digital: "Be Vietnam Pro", Arial, sans-serif;
  --orbis-radius-sm: 6px;
  --orbis-radius-md: 12px;
  --orbis-focus: 0 0 0 3px rgba(0, 163, 163, .35);
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; color: var(--orbis-night-blue); background: var(--orbis-white); font-family: var(--orbis-font-digital); line-height: 1.5; }
a { color: var(--orbis-corporate-blue); }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: none; box-shadow: var(--orbis-focus); }
.orbis-button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 18px; border: 2px solid transparent; border-radius: var(--orbis-radius-sm); font: inherit; font-weight: 600; cursor: pointer; }
.orbis-button--primary { color: #fff; background: var(--orbis-petrol); }
.orbis-button--secondary { color: var(--orbis-corporate-blue); background: transparent; border-color: var(--orbis-corporate-blue); }
.orbis-button--highlight { color: #fff; background: var(--orbis-highlight-pink); }
.orbis-hero { color: #fff; background: var(--orbis-gradient-primary); padding: clamp(48px, 8vw, 96px) 24px; }
.orbis-card { border: 1px solid rgba(167,168,170,.55); border-radius: var(--orbis-radius-md); padding: 24px; background: #fff; }
.orbis-badge { display: inline-block; background: var(--orbis-petrol); color: #fff; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
`.trim();

// ── Tools ─────────────────────────────────────────────────────────────────────

const session = await joinSession({
    hooks: {
        onSessionStart: async () => {
            await session.log("ORBIS UI/CI Skill geladen – bereit für CI-konforme Dokumente, Web und Mockups.");
        },
    },
    tools: [
        {
            name: "orbis_ci_guidelines",
            description:
                "Gibt die vollständigen ORBIS CI/UI-Richtlinien zurück: Design Tokens, Markenregeln, Component Rules und QA-Checkliste. Verwenden wenn ORBIS-konforme Dokumente, Webseiten, Landingpages, Präsentationen oder UI-Mockups erstellt werden sollen.",
            parameters: { type: "object", properties: {} },
            skipPermission: true,
            handler: async () => SKILL_INSTRUCTIONS,
        },
        {
            name: "orbis_theme_css",
            description:
                "Gibt das offizielle ORBIS Theme CSS zurück (Custom Properties, Basis-Klassen für Buttons, Hero, Cards). Zum Einbetten in selbst enthaltene HTML-Artefakte.",
            parameters: { type: "object", properties: {} },
            skipPermission: true,
            handler: async () => ORBIS_THEME_CSS,
        },
        {
            name: "orbis_html_scaffold",
            description:
                "Generiert ein ORBIS-konformes HTML-Scaffold. Parameter: artifact_type (landingpage | onepager | checklist | ui-mockup), title (Seitentitel/Dokumenttitel), language (de | en).",
            parameters: {
                type: "object",
                properties: {
                    artifact_type: {
                        type: "string",
                        enum: ["landingpage", "onepager", "checklist", "ui-mockup"],
                        description: "Art des zu erzeugenden Artefakts",
                    },
                    title: { type: "string", description: "Titel, z.B. 'ORBIS Sales Accelerator – Ihre Lösung'" },
                    language: { type: "string", enum: ["de", "en"], description: "Sprache des Inhalts" },
                },
                required: ["artifact_type", "title"],
            },
            skipPermission: true,
            handler: async ({ artifact_type, title, language = "de" }) => {
                const lang = language ?? "de";
                const labels = lang === "en"
                    ? { hero_sub: "Your benefit in one sentence.", cta: "Learn more", nav_home: "Home", nav_solutions: "Solutions", nav_contact: "Contact", footer_note: "Concept – not a released ORBIS asset.", disclaimer: "⚠ Concept mockup – not a released ORBIS asset" }
                    : { hero_sub: "Ihr Nutzen in einem Satz.", cta: "Mehr erfahren", nav_home: "Start", nav_solutions: "Lösungen", nav_contact: "Kontakt", footer_note: "Konzept – kein freigegebenes ORBIS-Asset.", disclaimer: "⚠ Konzept-Mockup – kein freigegebenes ORBIS-Asset" };

                const typeHint = {
                    landingpage: "Hero · Nutzenversprechen · 3 Features · CTA-Section · Footer",
                    onepager: "Hero · Kernbotschaft · 2-Spalten-Inhalt · CTA · Footer",
                    checklist: "Header · Einleitung · Checklisten-Blöcke · CTA · Footer",
                    "ui-mockup": "App-Header · Navigation · Hauptcontent · Status-Zustände · Footer",
                };

                return `<!-- ORBIS ${artifact_type.toUpperCase()} Scaffold ──────────────────────────────
   ARTEFAKT : ${artifact_type}
   STRUKTUR : ${typeHint[artifact_type] ?? ""}
   HINWEIS  : ${labels.footer_note}
   BENENNUNG: ORBIS_${artifact_type}_${title.replace(/\s+/g, "_").substring(0, 30)}_v1
─────────────────────────────────────────────────────────────────── -->
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
${ORBIS_THEME_CSS.split("\n").map(l => "    " + l).join("\n")}

    /* ── Layout ───────────────────────────── */
    .orbis-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

    /* ── Header / Nav ─────────────────────── */
    .orbis-header {
      position: sticky; top: 0; z-index: 100;
      background: var(--orbis-night-blue); color: #fff;
      padding: 0 24px; height: 64px; display: flex; align-items: center; gap: 32px;
    }
    .orbis-header__logo { font-weight: 700; font-size: 18px; letter-spacing: .02em; }
    .orbis-header__logo span { color: var(--orbis-petrol); }
    .orbis-header__nav { display: flex; gap: 24px; margin-left: auto; }
    .orbis-header__nav a { color: rgba(255,255,255,.85); text-decoration: none; font-size: 14px; }
    .orbis-header__nav a:hover { color: #fff; }

    /* ── Features Grid ────────────────────── */
    .orbis-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; padding: 48px 0; }

    /* ── CTA Section ──────────────────────── */
    .orbis-cta-section { background: var(--orbis-gradient-primary); color: #fff; padding: clamp(32px, 6vw, 64px) 24px; text-align: center; }
    .orbis-cta-section h2 { margin: 0 0 16px; font-size: clamp(24px, 4vw, 36px); }

    /* ── Footer ───────────────────────────── */
    .orbis-footer {
      background: var(--orbis-night-blue); color: rgba(255,255,255,.7);
      padding: 32px 24px; font-size: 13px; text-align: center;
    }

    /* ── Disclaimer ───────────────────────── */
    .orbis-disclaimer {
      background: #fff4ce; border-bottom: 1px solid #fce100;
      padding: 6px 16px; font-size: 12px; color: #7a5d00; text-align: center;
    }

    /* ── Checklist (checklist type) ───────── */
    .orbis-checklist { list-style: none; padding: 0; margin: 0; }
    .orbis-checklist li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--orbis-gray-400); }
    .orbis-checklist li::before { content: "☐"; color: var(--orbis-petrol); font-size: 18px; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="orbis-disclaimer">${labels.disclaimer}</div>

  <!-- Header -->
  <header class="orbis-header">
    <div class="orbis-header__logo">ORBIS<span>.</span></div>
    <!-- TODO: Offizielles Logo-Asset einsetzen -->
    <nav class="orbis-header__nav" aria-label="Hauptnavigation">
      <a href="#">${labels.nav_home}</a>
      <a href="#">${labels.nav_solutions}</a>
      <a href="#">${labels.nav_contact}</a>
    </nav>
  </header>

  <!-- Hero -->
  <section class="orbis-hero" aria-label="Hero">
    <div class="orbis-container">
      <h1 style="margin:0 0 16px;font-size:clamp(32px,5vw,52px)">${title}</h1>
      <p style="font-size:clamp(16px,2vw,20px);max-width:600px;margin:0 0 32px;opacity:.9">${labels.hero_sub}</p>
      <a href="#" class="orbis-button orbis-button--primary">${labels.cta}</a>
    </div>
  </section>

  <!-- Main Content -->
  <main>
    <div class="orbis-container">
      ${artifact_type === "checklist" ? `
      <!-- Checkliste -->
      <section style="padding:48px 0">
        <h2>TODO: Checklisten-Titel</h2>
        <ul class="orbis-checklist">
          <li>TODO: Punkt 1</li>
          <li>TODO: Punkt 2</li>
          <li>TODO: Punkt 3</li>
        </ul>
      </section>` : `
      <!-- Features / Inhaltsblöcke -->
      <div class="orbis-features">
        <div class="orbis-card">
          <h3 style="margin-top:0">TODO: Feature 1</h3>
          <p>Kurze Beschreibung des Nutzens.</p>
        </div>
        <div class="orbis-card">
          <h3 style="margin-top:0">TODO: Feature 2</h3>
          <p>Kurze Beschreibung des Nutzens.</p>
        </div>
        <div class="orbis-card">
          <h3 style="margin-top:0">TODO: Feature 3</h3>
          <p>Kurze Beschreibung des Nutzens.</p>
        </div>
      </div>`}
    </div>
  </main>

  <!-- CTA Section -->
  <section class="orbis-cta-section">
    <div class="orbis-container">
      <h2>TODO: CTA-Überschrift</h2>
      <p style="margin:0 0 24px;opacity:.9">TODO: Kurzer Begleittext.</p>
      <a href="#" class="orbis-button orbis-button--primary">${labels.cta}</a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="orbis-footer">
    <div class="orbis-container">
      <p style="margin:0">© ORBIS SE · ${labels.footer_note}</p>
    </div>
  </footer>
</body>
</html>`;
            },
        },
        {
            name: "orbis_design_tokens",
            description:
                "Gibt alle ORBIS Design Tokens als JSON zurück: Farben, Verläufe, Typografie, Abstände und Radien.",
            parameters: { type: "object", properties: {} },
            skipPermission: true,
            handler: async () =>
                JSON.stringify(
                    {
                        colors: {
                            corporateBlue: "#00488A",
                            petrol: "#00A3A3",
                            highlightPink: "#DB3360",
                            nightBlue: "#16203B",
                            nightBlueLogo: "#1B3054",
                            gray700: "#555555",
                            gray400: "#A7A8AA",
                            white: "#FFFFFF",
                            black: "#000000",
                        },
                        gradients: {
                            primary: "linear-gradient(135deg, #16203B 0%, #00A3A3 100%)",
                            highlight: "linear-gradient(135deg, #16203B 0%, #DB3360 100%)",
                            blueToTeal: "linear-gradient(135deg, #00488A 0%, #00A3A3 100%)",
                        },
                        typography: {
                            digital: '"Be Vietnam Pro", Arial, sans-serif',
                            office: "Calibri, sans-serif",
                            scale: {
                                display: { size: 48, lineHeight: 56, weight: 600 },
                                h1: { size: 40, lineHeight: 48, weight: 600 },
                                h2: { size: 32, lineHeight: 40, weight: 600 },
                                h3: { size: 24, lineHeight: 32, weight: 600 },
                                bodyLarge: { size: 18, lineHeight: 28, weight: 400 },
                                body: { size: 16, lineHeight: 24, weight: 400 },
                                small: { size: 14, lineHeight: 20, weight: 400 },
                            },
                        },
                        spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96],
                        borderRadius: { sm: 6, md: 12 },
                        focus: "0 0 0 3px rgba(0, 163, 163, .35)",
                    },
                    null,
                    2
                ),
        },
    ],
});
