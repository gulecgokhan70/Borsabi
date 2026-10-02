# BorsaBi Trader — closed test guide

Audience: Testers Community. Prepared for the upcoming Android closed test; no test release or invitation has been published by this work. The app UI is currently **Turkish**. Please confirm whether your testers can follow these labels and meaningfully report language-related problems. This guide is not a full translation of the app.

BorsaBi is an educational trading simulator. Balances, positions and trades are virtual. No deposit, bank connection or real-money trade is required. Please use a dedicated test account and do not enter sensitive information in AI messages or trade notes.

## Joining the correct test

The owner will provide the Google Play opt-in link and feedback channel once the signed release is available. Join with the Google account included in the assigned tester list/Google Group, opt in, and install the app **from that Play link**. A website shortcut or a side-loaded APK alone does not test the Play release.

For a newly created personal developer account, Google currently requires at least **12 testers continuously opted in for 14 days** before the owner can apply for production access. This is not automatic publication approval. Test genuinely, remain opted in, and record actual observations. Do not manufacture activity reports or post incentivized public reviews. [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

## Turkish labels

| Label in the app | English meaning |
|---|---|
| Kayıt ol / Hesap oluştur | Sign up / Create account |
| Giriş yap | Sign in |
| Çıkış yap | Sign out |
| Hisse ara | Search a stock or asset |
| Ana Sayfa | Home |
| Piyasalar | Markets |
| Portföyüm / Portföy | My portfolio / Portfolio |
| Al / Sat | Buy / Sell (simulation) |
| Adet / Tutar | Quantity / Amount |
| Bakiye / Nakit Bakiye | Balance / Cash balance |
| Komisyon | Commission |
| Kâr / Zarar (K/Z) | Profit / Loss (P/L) |
| Zarar Kes (SL) / Kâr Al (TP) | Stop loss / Take profit |
| İşlem Günlüğü | Trade log |
| Geçmiş piyasada pratik | Historical market practice |
| Yeni pratik başlat / Sonraki mum | Start practice / Next candle |
| AI Asistan / AI Analiz | AI assistant / AI analysis |
| Yanıtı bildir | Report response |
| Profil / Kaydet | Profile / Save |
| Bildirimler | Notifications |
| Hesabımı sil / Hesap silme | Delete my account / Account deletion |
| Yeniden dene | Retry |

Turkish number notation: **1.000,50 = 1,000.50** in English notation. `₺` is Turkish lira (TRY); `$` here represents USD. A crypto unit price in USD and the account's total in TRY are different units. Inspect the displayed exchange rate/time before comparing them. Price changes between preview and execution are possible; compare the saved trade receipt and its exchange rate.

## Test scenarios

Record app version/version code, Android version, phone model, browser version, network type, date/time and actual result. Run these scenarios across the test period; each tester need not perform all destructive scenarios every day.

| ID | Action | Expected observation |
|---|---|---|
| 01 | Install from Play and open; return from background; use Android back navigation. | App opens without a crash, login loop or unexpected browser bar. Report if the URL bar is always visible. |
| 02 | Create a test account, sign out and sign back in. | Form labels, validation and keyboard are usable. Never share the password in a report. |
| 03 | Type THYAO, then BTC in header search; quickly change or clear the query. | Results appear during typing; an older search must not overwrite the latest one. Tapping opens the intended asset. |
| 04 | Open BIST and crypto details; rotate the screen and enlarge system text. | Currency labels remain correct; controls and charts remain reachable, especially with keyboard/gestures visible. |
| 05 | Change the profile commission; preview a small virtual buy, then a sell. | Displayed commission uses the saved preference, including a zero value when allowed. The saved receipt explains the amount charged. |
| 06 | Make one small BIST and one small BTC test trade; check portfolio and history. | One intended action creates one trade. USD price, TRY cash and recorded FX rate reconcile within stated rounding and price movement. |
| 07 | Exercise stop loss / take profit on a test position when practical. | Currency units are clear. If a trigger actually occurs, the position/history/notification agree. Do not mark an untriggered scenario passed. |
| 08 | Open the existing backtest and historical practice tools. | Practice balances stay separate from the main portfolio; selected data dates and commissions are understandable. |
| 09 | Open the learning summary and browse transaction history pages. | Totals, period selection and pagination are coherent; no missing or repeated rows from navigation. |
| 10 | Ask the AI to explain a basic market term; report a response using the report control. | Loading/error states work and the report receives a saved confirmation. Do not ask for or evaluate guaranteed investment returns. |
| 11 | Deny notifications, then enable them deliberately in settings; trigger a test alert if possible. | Permission handling is understandable; denial does not break trading. Record whether an actual notification arrives. |
| 12 | After opening online once, enable airplane mode and reopen/navigate. Restore connectivity and retry. | Generic offline screen; no stale portfolio presented as current. Offline trade requests are never queued for replay. If a trade was in flight, inspect history before resubmitting. |
| 13 | Open support, privacy and account deletion from the app. | Pages are accessible. Support opens an email application; it does not pretend an email was sent. |
| 14 | On a separate disposable account, cancel deletion once; then confirm with its password. | Cancellation preserves the account; confirmation signs out and old credentials cannot access its data. Do not delete the owner's or reviewer's account. |

## Bug report format

- Scenario ID and short title:
- Device / Android / browser / app version:
- Date, time and time zone:
- Exact steps (include Turkish label visible):
- Expected result:
- Actual result:
- Repeatable? Network state?
- Screenshot/video with email, password and tokens hidden:
- Impact: blocked task / wrong result / visual or language issue:

Please also report untranslated or ambiguous text, confusing USD/TRY labels, inaccessible buttons, clipped modal bottoms, repeated notifications and slow screen transitions. A language issue should be marked as such rather than guessed to be a functional pass.
