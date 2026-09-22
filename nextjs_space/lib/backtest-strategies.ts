export const STRATEGIES = [
  { id: 'ema-crossover', name: 'EMA Kesişim', desc: 'EMA20 EMA50\'yi yukarı kestiğinde al, aşağı kestiğinde sat' },
  { id: 'rsi-reversal', name: 'RSI Dönüş', desc: 'RSI 30 altından yukarı çıkınca al, 70 üzerinde sat' },
  { id: 'macd-crossover', name: 'MACD Kesişim', desc: 'MACD sinyal çizgisini yukarı kestiğinde al, aşağı kestiğinde sat' },
  { id: 'trend-following', name: 'Trend Takip', desc: 'Güçlü yükseliş trendinde EMA dizilimi uygunsa al' },
  { id: 'breakout', name: 'Kırılım', desc: '20 günlük zirveyi geçince al, EMA20 altına düşünce sat' },
  { id: 'bollinger-bounce', name: 'Bollinger Sıçraması', desc: 'Fiyat alt banttan dönüş yaptığında al, üst bantta sat' },
  { id: 'stochastic-cross', name: 'Stochastic Kesişim', desc: 'Stochastic K çizgisi D\'yi aşağıdan keserse al, aşırı alımda sat' },
  { id: 'adx-trend', name: 'ADX Trend Gücü', desc: 'ADX 25 üzerinde ve +DI > -DI olduğunda al, trend zayıflayınca sat' },
  { id: 'mean-reversion', name: 'Ortalamaya Dönüş', desc: 'Bollinger sıkışması sonrası genişleme yönünde al' },
  { id: 'double-bottom', name: 'Çift Dip', desc: 'Çift dip formasyonu oluştuğunda ve EMA20 üzerinde kapandığında al' },
];
