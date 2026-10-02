import { NextResponse } from 'next/server';
import { androidAssetLinks } from '@/lib/android-asset-links';

export const dynamic = 'force-dynamic';

export async function GET() {
  const packageId = process.env.ANDROID_APPLICATION_ID?.trim();
  const fingerprints = process.env.ANDROID_SHA256_CERT_FINGERPRINTS?.trim();
  // Public Play app-signing identity supplied by the owner from Play Console.
  // Preserve explicit overrides; incomplete overrides still fail validation.
  const links = !packageId && !fingerprints
    ? androidAssetLinks('com.borsabi.twa', 'DE:CC:C4:7A:95:E1:A7:F3:35:02:0E:54:C5:10:41:88:F6:62:8C:59:B4:FB:21:C7:A8:23:E6:F1:B3:90:E6:CA')
    : androidAssetLinks(packageId, fingerprints);
  if (!links) return NextResponse.json([], { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(links, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
}
