# Asset activity

Stock and crypto detail pages show “Bu varlıktaki işlemlerim” immediately below the chart. Open positions, completed positions and executions have separate views. The section refreshes after a manual trade, on returning to the page and every minute while visible. It loads independently of chart requests.

`GET /api/stock/[symbol]/activity` is session-owner scoped, private/no-store and read-only. A RepeatableRead snapshot combines manual positions/transactions and auto-v2 paper-bot holdings/events for this symbol and market. BIST symbols accept canonical and legacy suffixless aliases. Index pages do not render this section. Recent history is capped at 20 combined records per view, with links to the portfolio, journal and bot management.

Manual partial sales appear in history; a manual position is completed only after its remaining quantity reaches zero. Closed positions display stored cumulative net P/L, without reconstructing original quantity from the zero remaining balance. Auto-v2 sells the full holding, so its SELL events represent completed positions. WAIT/HALT signals are not executions.

Crypto manual unit prices retain USD; bot unit prices and all aggregate totals use TRY. Entry costs include entry fees. Open P/L excludes hypothetical exit costs; realized P/L uses the recorded result. Missing historical FX costs are not inferred. If valuation fails, execution history remains available and unavailable values are explicit.

Pre-migration isolated bot events remain labeled “Eski sanal bot”; funded bot records use “Bot”. Transfer events are explicitly labeled as a transfer, not a fresh market buy. The read path does not move positions or change capital, orders or bot execution. No schema migration is needed for this feature.
