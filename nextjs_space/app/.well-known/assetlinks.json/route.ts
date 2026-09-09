import { NextResponse } from 'next/server';
import { androidAssetLinks } from '@/lib/android-asset-links';

export const dynamic = 'force-dynamic';

export async function GET() {
  const links = androidAssetLinks(process.env.ANDROID_APPLICATION_ID, process.env.ANDROID_SHA256_CERT_FINGERPRINTS);
  if (!links) return NextResponse.json([], { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(links, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
}
