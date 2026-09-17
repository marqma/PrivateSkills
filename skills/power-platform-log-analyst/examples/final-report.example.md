# Auftragsaktualisierung: Timeout beim externen Preisdienst

*Case ID:* `example-case-2024-01`  
*Generated:* 2024-01-20T09:00:00Z  
*Full dataset coverage claimed:* **True**

## Scope and Caveats
- Zeitstempel der CSV-Quelle enthalten keine Zeitzoneninformation (tz_known=false); Uhrzeiten sind unbestaetigt.
- Datensatz umfasst nur den bereitgestellten Exportausschnitt vom 20.01.2024, 08:00-09:00 Uhr.

## Executive Summary
Eine von zwei analysierten Auftragsaktualisierungen schlug wegen eines Timeouts beim externen Preisdienst fehl. Die Dataverse Plugin Trace Logs belegen eindeutig eine Ueberschreitung des 3000ms-Zeitlimits.

## Performance Summary
- Baseline comparison: Keine historische Baseline verfuegbar; Faustwert verwendet (Faustregel: Plugin-Ausfuehrung > wenige Sekunden gilt als auffaellig).
- Methodology: Keine Baseline vorhanden, Faustregel verwendet.
- Percentiles (ms): {'p50': 1765, 'p95': 3120}

## Findings
### [HIGH] Timeout beim externen Preisdienst (`pricing-service-timeout`)
- **Category:** error
- **Observation:** OrderPlugin (Update) wirft System.TimeoutException beim Aufruf des externen Preisdienstes; PerformanceExecutionDuration=3120ms bei einem von zwei beobachteten Auftraegen.
- **Confirmed cause:** ExceptionDetails belegt explizit die Ueberschreitung des 3000ms-Zeitlimits beim externen Preisdienst-Aufruf (OrderPlugin.CallPricingService).
- **Impact:** Auftragsaktualisierung schlaegt fehl; betroffene Nutzer erhalten eine Fehlermeldung im Formular.
- **Occurrences:** 1
- **Evidence:**
  - event_id=1 file=plugintrace.csv correlation_id=c1111111-1111-1111-1111-111111111111 time=2024-01-20T08:12:04.000000Z
- **Recommendations:**
  - **[P1]** (Plugin-Entwickler/in) Zeitlimit fuer den Preisdienst-Aufruf erhoehen und eine Retry-Logik mit Backoff implementieren; alternativ Aufruf asynchron auslagern.
    - Expected effect: Weniger TimeoutExceptions; Auftragsaktualisierungen schlagen seltener fehl.
    - Validation: Betroffene Correlation-IDs erneut ausfuehren und PerformanceExecutionDuration sowie ExceptionDetails pruefen.
    - Risk: Laengere Ausfuehrungszeit des Plugins bei generell langsamem Preisdienst.
    - Rollback: Zeitlimit-/Retry-Konfiguration auf vorherigen Wert zuruecksetzen.

