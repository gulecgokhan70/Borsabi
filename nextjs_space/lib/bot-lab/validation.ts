import { z } from 'zod';
import { symbols } from './engine';
export const createBot = z.object({
  market: z.enum(['BIST', 'CRYPTO']), symbol: z.string(),
  commission: z.number().min(0).max(0.01),
  friction: z.number().min(0).max(0.01),
  maxOrder: z.number().min(100).max(100000),
  dailyLoss: z.number().min(0.001).max(0.2),
}).strict().refine(v => symbols[v.market].includes(v.symbol), 'Desteklenmeyen sembol');
export const controlBot = z.object({ id: z.string().min(1), action: z.enum(['start', 'stop', 'close']) }).strict();

import { universe } from './auto-engine';
export const createAutoBot = z.object({
  mode: z.literal('auto-v2'), market: z.enum(['BIST', 'CRYPTO']),
  symbols: z.array(z.string()).min(1).max(8),
  commission: z.number().finite().min(0).max(0.01), friction: z.number().finite().min(0).max(0.01),
  orderFraction: z.number().finite().min(0.01).max(0.1), dailyLoss: z.number().finite().min(0.005).max(0.05),
  stopLoss: z.number().finite().min(0.005).max(0.1), takeProfit: z.number().finite().min(0.01).max(0.2),
  maxPositions: z.number().int().min(1).max(3),
}).strict().refine(c => new Set(c.symbols).size === c.symbols.length && c.symbols.every(s => universe[c.market].some(v => v.symbol === s)), 'Desteklenmeyen veya tekrarlanan sembol');
