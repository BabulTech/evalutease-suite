#!/usr/bin/env node
/**
 * Release helper — keeps every version source in sync for the in-app updater.
 *
 * Usage:
 *   npm run release -- 1.1.0
 *   npm run release -- 1.1.0 --notes "Fixed splash, faster launch"
 *   npm run release -- 1.2.0 --min 3 --mandatory
 *
 * What it does (no APK building — that's Android Studio's job):
 *   1. package.json            "version" → <x.y.z>
 *   2. android build.gradle    versionName → <x.y.z>, versionCode → +1
 *   3. src/lib/app-version.ts  VERSION_NAME / VERSION_CODE → matched
 *   4. public/update.json      latest* fields + apkUrl (Supabase bucket)
 *
 * Then: build the signed APK named jancho-<x.y.z>.apk, upload it to the
 * "app-releases" public bucket, and deploy the web app (so update.json ships).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- Supabase public bucket holding the APKs ----------------------------------
const SUPABASE_PROJECT = "jfwnyktkzhnblpmtamke";
const BUCKET = "app-releases";
const apkUrlFor = (name) =>
  `https://${SUPABASE_PROJECT}.supabase.co/storage/v1/object/public/${BUCKET}/jancho-${name}.apk`;

// --- args ---------------------------------------------------------------------
const args = process.argv.slice(2);
const versionName = args.find((a) => /^\d+\.\d+(\.\d+)?$/.test(a));
if (!versionName) {
  console.error("✖ Provide a version, e.g.  npm run release -- 1.1.0");
  process.exit(1);
}
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? "") : null;
};
const mandatory = args.includes("--mandatory");
const notes = flag("notes") ?? "";
const minOverride = flag("min");

const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const write = (rel, txt) => fs.writeFileSync(path.join(root, rel), txt);

// --- 1. package.json ----------------------------------------------------------
const pkgPath = "package.json";
const pkg = JSON.parse(read(pkgPath));
pkg.version = versionName;
write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// --- 2. android build.gradle (bump versionCode, set versionName) --------------
const gradlePath = "android/app/build.gradle";
let gradle = read(gradlePath);
const codeMatch = gradle.match(/versionCode\s+(\d+)/);
if (!codeMatch) {
  console.error("✖ Could not find versionCode in build.gradle");
  process.exit(1);
}
const newCode = Number.parseInt(codeMatch[1], 10) + 1;
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${newCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
write(gradlePath, gradle);

// --- 3. src/lib/app-version.ts ------------------------------------------------
const verTsPath = "src/lib/app-version.ts";
let verTs = read(verTsPath);
verTs = verTs
  .replace(/export const VERSION_CODE = \d+;/, `export const VERSION_CODE = ${newCode};`)
  .replace(/export const VERSION_NAME = "[^"]*";/, `export const VERSION_NAME = "${versionName}";`);
write(verTsPath, verTs);

// --- 4. public/update.json ----------------------------------------------------
const manifestPath = "public/update.json";
const prev = JSON.parse(read(manifestPath));
const manifest = {
  latestVersionCode: newCode,
  latestVersionName: versionName,
  minSupportedVersionCode: minOverride ? Number.parseInt(minOverride, 10) : prev.minSupportedVersionCode,
  apkUrl: apkUrlFor(versionName),
  releaseNotes: notes || prev.releaseNotes || `Version ${versionName}`,
  mandatory,
  publishedAt: new Date().toISOString().slice(0, 10),
};
write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

// --- summary ------------------------------------------------------------------
console.log(`✔ Released ${versionName} (versionCode ${newCode})`);
console.log(`  apkUrl: ${manifest.apkUrl}`);
console.log(`  minSupportedVersionCode: ${manifest.minSupportedVersionCode}${mandatory ? "  [MANDATORY]" : ""}`);
console.log("\nNext steps:");
console.log("  1. npx cap sync android");
console.log(`  2. Build a signed APK and rename it  jancho-${versionName}.apk`);
console.log(`  3. Upload it to the "${BUCKET}" Supabase bucket`);
console.log("  4. Commit & deploy (ships the new public/update.json)");
