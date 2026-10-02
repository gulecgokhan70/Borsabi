# Trading Engine v2 — foundation

This first increment provides daily-bar analysis for BIST and CRYPTO:
validated closed candles → shared indicators → explainable market regime →
eligible strategy families. It is a pure module with no network, database or
execution side effects. Existing routes and screens do not import it yet.

## Entry point

```ts
import { analyzeMarket } from '@/lib/trading-engine';

const analysis = analyzeMarket({
  marketType: 'CRYPTO',
  timeframe: '1d',
  candles, // CandleData[], in chronological order
  asOf: evaluationTimeMs,
});
```

`timestamp` is candle opening time and `closedAt` is its actual closing time,
both UTC epoch milliseconds. The provider adapter must establish the real
closing time using the market/session calendar. Do not rename a provider's
opening timestamp to `closedAt`, or mark a live candle as closed. Only bars
with `closedAt <= asOf` are evaluated. A bar becomes available at its exact
closing time; an eventual backtest must execute a close-generated decision on
a later eligible tick/bar, not retroactively at that bar's open.

Daily profiles must receive daily bars. The module does not infer intervals,
check corporate actions, fill gaps, detect stale quotes, or implement exchange
holiday calendars; these remain adapter/execution responsibilities. Historical
analysis is allowed outside market hours and is not order authorization.

At least 200 valid closed bars are required for EMA200. Invalid, duplicate,
overlapping or out-of-order closed bars block analysis instead of being silently
removed. Future bar price/volume values do not affect an earlier analysis.
The caller supplies the evaluation clock explicitly, making replay deterministic.

## Interpretation

- `READY` means indicators could be calculated; inspect the regime and selection.
- `INSUFFICIENT_DATA` and `INVALID_DATA` return `UNCERTAIN`, no indicators and
  a blocked strategy selection.
- Confidence is heuristic rule agreement on a 0–1 scale, not a calibrated
  success probability or signal score.
- `ACTIVE` selects strategy families for later signal evaluation. The four
  families are trend following, momentum, mean reversion and breakout. Their
  entry/exit signal implementations are a later increment.
- High/low volatility retains the EMA trend separately. A downward EMA trend
  cannot bypass the long-only guard through a volatility classification.
- Breakout regimes are monitoring only until a later signal engine confirms
  direction. Short is disabled in both default profiles.

All thresholds are uncalibrated **daily-bar research defaults**. BIST and crypto
have different volatility thresholds and planned ATR stop/risk multipliers.
The existing `MAX_RISK_PER_TRADE` and `DAILY_LOSS_LIMIT` remain the source of
risk ceilings. Profile risk fields describe future policy; this increment does
not calculate stops, size positions, enforce portfolio limits or route orders.

The snapshot reuses `lib/technical-indicators.ts`. Its existing RSI and ATR use
recent-window averages; its ADX averages recent DX values rather than adding a
new Wilder ADX implementation. Existing EMA seeding is retained. The adapter
reports neutral RSI 50 for an entirely flat 15-close window, and `null` volume
ratio when the prior 20-bar volume average is zero. It rejects non-finite derived
values. Reuse does not establish numerical equivalence to third-party platforms.

## Integration findings and next increment

The current `app/api/algo-scan/route.ts` requests 90 calendar days of daily data,
which cannot supply 200 bars for either profile. It also uses live quotes for
legacy filters/scoring. Integrating this module requires a longer cached history
request, reliable close-time normalization and an explicit separation of live
quote fields from closed-bar indicators. Do not fabricate EMA200 from 90 days or
make additional per-asset requests for the same bars. Share the computed snapshot
where the legacy indicators use the same closed-bar inputs.

The existing Prisma `Position`/`Transaction` models and user-specific commission
setting remain suitable integration points. No schema change is required here.
The shared trade route risk checks remain untouched. BTC/ETH context is not yet
computed; crypto analysis explicitly reports this limitation. Signal scoring,
risk sizing, session-aware execution, backtesting, day/swing integration and the
open/closed position UI remain later increments. Live execution is not exposed.

## Validation

From `nextjs_space`:

```sh
npm run test:trading-engine
npm run typecheck:trading-engine
npm run lint:trading-engine
```

The tests cover all six regimes, default short blocking, volatility precedence,
200-bar warmup, invalid OHLCV/timestamps/order, exact close-time eligibility,
future-data independence at multiple cutoffs, shared indicator compatibility,
volume baselines, constant prices, overflow and profile differences.

The focused lint config uses the project's existing TypeScript ESLint packages;
no dependency upgrades are included. Tests run through Node's test runner with
the existing `tsx` import hook (Node 18.19+ or 20.6+).
