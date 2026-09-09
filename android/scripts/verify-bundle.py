"""Check the Gradle release output; does not sign or upload it."""
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

root = Path(sys.argv[1]).resolve()
config = json.loads((root / "PREPARATION.json").read_text())
manifests = list((root / "app/build/intermediates/merged_manifests/release").rglob("AndroidManifest.xml"))
if len(manifests) != 1:
    raise SystemExit("Expected exactly one merged release manifest from the Android build.")
manifest = ElementTree.parse(manifests[0]).getroot()
android = "{http://schemas.android.com/apk/res/android}"
sdk = manifest.find("uses-sdk")
if manifest.get("package") != config["packageId"] or manifest.get(android + "versionCode") != str(config["versionCode"]):
    raise SystemExit("Built identity/version does not match the preparation inputs.")
if sdk is None or sdk.get(android + "targetSdkVersion") != "36" or sdk.get(android + "minSdkVersion") != "23":
    raise SystemExit("Unexpected Android API target/minimum in merged release manifest.")
with zipfile.ZipFile(root / "app/build/outputs/bundle/release/app-release.aab") as bundle:
    names = bundle.namelist()
    if "base/manifest/AndroidManifest.xml" not in names or "BundleConfig.pb" not in names:
        raise SystemExit("Missing Android App Bundle contents.")
    if any(name.endswith(".so") for name in names):
        raise SystemExit("Native library introduced: verify Android 16 KB page-size compatibility before release.")
    if any(name.upper().startswith("META-INF/") and name.upper().endswith((".RSA", ".DSA", ".EC")) for name in names):
        raise SystemExit("Preparation build must remain unsigned.")
print(f"Verified unsigned AAB structure, merged identity {config['packageId']}, version {config['versionCode']}, API 36/23; no native libraries.")
