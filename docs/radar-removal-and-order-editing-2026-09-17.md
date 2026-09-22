# Radar removal and position exit editing

The development radar is retired: its UI, API routes, analysis modules and scheduled worker cycle are removed. Existing radar notifications are excluded from the notification feed and push queue. The price-alert and automatic simulation-sale worker remains active. Old radar cache records are inert; account deletion still cleans up legacy per-user settings.

Portfolio positions now offer **Emri düzenle**. Users can change or clear stop-loss, take-profit and trailing-stop thresholds, and enable or disable automatic sale. This application has immediate simulated trades, not a pending limit-order book: execution quantities, purchase prices, balances and historical transactions are not edited.

The editor retains the version present when it was opened. The authenticated PATCH route checks ownership, OPEN state and that version before an optimistic atomic update. A concurrent sale, worker update or second edit returns 409 and requires refreshing/reopening. Only exit settings and trailing high can be written. Existing trailing highs are retained; newly enabled trailing starts from the last recorded price. Clearing trailing clears its high. Automatic sale requires at least one threshold and a healthy worker. If a threshold is already crossed, the next valid worker quote may execute the full remaining position; the form explains this before saving.

Verification covers owner scoping, unauthorized access, invalid inputs, stale edits, failed optimistic updates, clearing settings, worker availability, UI snapshot preservation and retired push suppression. No schema migration is needed. Device visual review remains a deployment follow-up.
