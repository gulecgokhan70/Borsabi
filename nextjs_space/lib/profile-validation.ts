import { z } from 'zod';

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Ad boş bırakılamaz.').max(80, 'Ad en fazla 80 karakter olabilir.').optional(),
  avatar: z.string().regex(/^[a-z-]{1,24}$/, 'Geçersiz avatar.').nullable().optional(),
  commissionRate: z.preprocess(value => typeof value === 'string' && value.trim() ? Number(value.replace(',', '.')) : value,
    z.number().finite().min(0).max(.01)).optional(),
}).strict('Yalnızca ad, avatar ve komisyon oranı değiştirilebilir.')
  .refine(value => Object.keys(value).length > 0, 'Değiştirilecek bilgi bulunamadı.');
