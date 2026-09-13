import type { Metadata } from 'next';
import AydinlatmaMetniPage from '../aydinlatma-metni/page';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası | BorsaBi Trader',
  description: 'BorsaBi Trader kişisel verilerin işlenmesi, korunması ve hesap silme bilgileri.',
};

// Keep the Play Console URL public and render the same policy as the in-app link.
export default function PrivacyPolicyPage() {
  return <AydinlatmaMetniPage />;
}
