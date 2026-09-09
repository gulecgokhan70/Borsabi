import { z } from 'zod';
export const reportReasons = {
  inaccurate: 'Hatalı veya yanıltıcı bilgi',
  unsafe: 'Zararlı veya uygunsuz içerik',
  privacy: 'Kişisel bilgi / gizlilik',
  other: 'Diğer',
} as const;
export const aiReportSchema = z.object({
  source: z.enum(['ai-assistant', 'trade-coach', 'stock-analysis', 'news-analysis']),
  content: z.string().trim().min(1).max(12_000),
  reason: z.enum(['inaccurate', 'unsafe', 'privacy', 'other']),
  comment: z.string().trim().max(1000).optional(),
}).strict();
export type ReportSource = z.infer<typeof aiReportSchema>['source'];
