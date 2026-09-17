import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().trim().max(254, 'E-posta adresi çok uzun.').email('Geçerli bir e-posta adresi girin.'),
  // bcrypt uses at most 72 UTF-8 bytes; never silently accept a truncated secret.
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı.').max(72, 'Şifre çok uzun.')
    .refine(value => new TextEncoder().encode(value).length <= 72, 'Şifre çok uzun; daha kısa bir şifre seçin.'),
  name: z.string().trim().max(80, 'İsim en fazla 80 karakter olabilir.').optional()
    .transform(value => value || 'Trader'),
});
