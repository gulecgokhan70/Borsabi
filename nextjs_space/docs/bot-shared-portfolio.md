# Shared virtual portfolio funding

New automatic bots require a PortfolioBotBudget. A user configures the main portfolio's total contributed capital, the combined BIST/crypto allocation percentage, and a per-buy percentage of that allocation. Allocation is a cost-basis spending ceiling, not reserved cash or a separate account. Manual orders and bots debit the same User.balance.

Activation is owner-authenticated from Bot Laboratory or Portfolio. On first save, existing auto-v2 holdings are transferred at entry cost plus their recorded entry commission. Their quantities, marks, quote times and entry prices are unchanged. Old isolated cash and realized closed-trade results are not transferred; the historical event log remains intact. Import events are explicitly labeled transfers, not market executions. Legacy single-asset bots require a separate conversion and block activation instead of silently losing holdings.

The settings screen previews the debit and limits. Insufficient main cash or a cap smaller than existing bot costs rejects the whole transaction. All bots are updated together, pending BUYs are cleared, pending SELLs survive, and versions advance to invalidate in-flight worker snapshots. Existing bots continue in isolated mode until their owner activates the shared budget. Deployment alone never migrates every user's money.

Capital changes adjust both main cash and User.initialBalance by the same delta, preserving net profit. Dated capital flows are retained for the value curve; capital contributions are not classified as returns. The BIST return comparison is hidden for accounts with capital flows because it is not flow-adjusted.

Workers derive available cash from the current main balance and unused combined cap. Per-order and total exposure limits are rechecked inside Serializable transactions. Cash, state, and bot event writes commit together; a duplicate/stale worker cannot debit or credit twice. Existing manual trading also uses Serializable transactions, so competing manual/bot orders cannot overdraw the common cash. Per-bot daily risk baselines are adjusted for external cash availability changes so another bot's purchase is not mistaken for a loss.

Portfolio aggregates combine manual positions/transactions with portfolio-tagged bot holdings/events. Bot holdings stay managed by the bot, with their own exit controls; manual orders do not merge or sell those lots. Values and the equity curve include both. Bot entries are denominated in TRY; absent historical native-price/FX breakdowns are explicitly marked incomplete, never invented. Capital flows and bot/manual lots of the same symbol are handled separately in the cost-basis curve.

Schema: an additive PortfolioBotBudget table with a cascading user FK, created idempotently by the existing bot migration script. No existing position, transaction or event is deleted. Once a user activates shared funding, do not roll back to a worker version that lacks shared funding support; pause bots first and use a reviewed accounting migration if reverting.

Validation covers owner checks, input limits, cross-origin protection, zero cash, external-cash rebasing, capital-flow accounting, migration idempotency, preserved holdings, insufficient-funds rollback, simultaneous BIST/crypto and manual/bot purchases, per-order caps, and idempotent sales.
