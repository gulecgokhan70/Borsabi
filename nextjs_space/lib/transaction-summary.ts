import { Prisma } from '@prisma/client';

export interface TransactionSummary {
  total: number; buyCount: number; sellCount: number; totalTrades: number;
  winCount: number; lossCount: number; totalPnl: number; avgWin: number; avgLoss: number;
  totalCommission: number; withNote: number; buysWithStop: number;
  attributedSales: number; pricePnl: number; fxPnl: number;
}

// Aggregate in PostgreSQL rather than transferring the entire ledger to Node.
export async function transactionSummary(db: Pick<Prisma.TransactionClient, '$queryRaw'>, userId: string, period?: { start: Date; end: Date }) {
  const range = period ? Prisma.sql`AND "createdAt" >= ${period.start} AND "createdAt" < ${period.end}` : Prisma.empty;
  const [row] = await db.$queryRaw<TransactionSummary[]>(Prisma.sql`
    SELECT COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "type" = 'BUY')::int AS "buyCount",
      COUNT(*) FILTER (WHERE "type" = 'SELL')::int AS "sellCount",
      COUNT(*) FILTER (WHERE "type" = 'SELL' AND "pnl" IS NOT NULL)::int AS "totalTrades",
      COUNT(*) FILTER (WHERE "type" = 'SELL' AND "pnl" > 0)::int AS "winCount",
      COUNT(*) FILTER (WHERE "type" = 'SELL' AND "pnl" < 0)::int AS "lossCount",
      COALESCE(SUM("pnl") FILTER (WHERE "type" = 'SELL'), 0)::float8 AS "totalPnl",
      COALESCE(AVG("pnl") FILTER (WHERE "type" = 'SELL' AND "pnl" > 0), 0)::float8 AS "avgWin",
      COALESCE(AVG("pnl") FILTER (WHERE "type" = 'SELL' AND "pnl" < 0), 0)::float8 AS "avgLoss",
      COALESCE(SUM("commission"), 0)::float8 AS "totalCommission",
      COUNT(*) FILTER (WHERE BTRIM(COALESCE("note", '')) <> '')::int AS "withNote",
      COUNT(*) FILTER (WHERE "type" = 'BUY' AND "stopLoss" IS NOT NULL)::int AS "buysWithStop",
      COUNT(*) FILTER (WHERE "type" = 'SELL' AND "pnl" IS NOT NULL AND "pricePnlTry" IS NOT NULL AND "fxPnlTry" IS NOT NULL)::int AS "attributedSales",
      COALESCE(SUM("pricePnlTry") FILTER (WHERE "type" = 'SELL' AND "pnl" IS NOT NULL AND "pricePnlTry" IS NOT NULL AND "fxPnlTry" IS NOT NULL), 0)::float8 AS "pricePnl",
      COALESCE(SUM("fxPnlTry") FILTER (WHERE "type" = 'SELL' AND "pnl" IS NOT NULL AND "pricePnlTry" IS NOT NULL AND "fxPnlTry" IS NOT NULL), 0)::float8 AS "fxPnl"
    FROM "Transaction" WHERE "userId" = ${userId} ${range}
  `);
  return { ...row, winRate: row.totalTrades ? row.winCount / row.totalTrades * 100 : 0 };
}

export function learningSuggestions(summary: TransactionSummary) {
  const suggestions: { text: string; href: string; action: string }[] = [];
  if (!summary.total) return [{ text: 'Bu dönemde kayıtlı işlem yok. Geçmiş bir günde pratik yaparak başlayabilirsiniz.', href: '/backtest?mode=practice', action: 'Pratik yap' }];
  if (summary.withNote < summary.total) suggestions.push({ text: `${summary.total - summary.withNote} işleminizde karar notu yok. Sonraki işlemde gerekçenizi kaydedip sonuçla karşılaştırın.`, href: '/trade-log', action: 'İşlemleri incele' });
  if (summary.buysWithStop < summary.buyCount) suggestions.push({ text: `${summary.buyCount - summary.buysWithStop} alış kaydında zarar kes seviyesi yok. Pratikte farklı seviyelerin sonuçlarını karşılaştırabilirsiniz.`, href: '/backtest?mode=practice', action: 'Zarar kes pratiği' });
  if (summary.totalCommission > 0) suggestions.push({ text: 'Komisyonun etkisini görmek için aynı stratejiyi farklı komisyon varsayımlarıyla karşılaştırın. Yeni testler profilinizdeki oranı kullanır.', href: '/backtest', action: 'Strateji testi' });
  if (!suggestions.length) suggestions.push({ text: 'Karar notlarınızı ve sonuçlarınızı birlikte inceleyerek tekrar eden davranışlarınızı değerlendirin.', href: '/trade-log', action: 'İşlem günlüğü' });
  return suggestions;
}
