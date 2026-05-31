#!/usr/bin/env node
/**
 * One-command Android release for the in-app updater.
 *
 *   npm run release -- 1.1.0
 *   npm run release -- 1.1.0 --notes "Fixed splash, faster launch"
 *   npm run release -- 1.2.0 --min 3 --mandatory
 *   npm run release -- 1.1.0 --dry          # bump files only, no build/upload/push
 *
 * Full pipeline (each step skips gracefully if its prerequisite is missing):
 *   1. Bump  package.json · android build.gradle · src/lib/app-version.ts · public/update.json
 *   2. npx cap sync android
 *   3. Build a SIGNED release APK via gradlew  (needs android/keystore.properties)
 *   4. Upload jancho-<x.y.z>.apk to the Supabase "app-releases" bucket
 *      (needs SUPABASE_SERVICE_ROLE_KEY in .env)
 *   5. git commit + push  (ships the new public/update.json → forces the update)
 *
 * Steps 3-5 are skipped automatically when their secrets/tools are unavailable,
 * so the bump-only flow still works on any machine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

// --- Supabase target ----------------------------------------------------------
const SUPABASE_PROJECT = "jfwnyktkzhnblpmtamke";
const SUPABASE_URL = `https://${SUPABASE_PROJECT}.supabase.co`;
const BUCKET = "app-releases";
const apkObjectName = (name) => `jancho-${name}.apk`;
const apkPublicUrl = (name) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${apkObjectName(name)}`;

// --- helpers ------------------------------------------------------------------
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const write = (rel, txt) => fs.writeFileSync(path.join(root, rel), txt);
const exists = (rel) => fs.existsSync(path.join(root, rel));
const log = (m) => console.log(m);
const step = (m) => console.log(`\n▶ ${m}`);

/** Minimal .env reader (we only need SUPABASE_SERVICE_ROLE_KEY). */
function readEnv() {
  const out = {};
  for (const file of [".env", ".env.local"]) {
    if (!exists(file)) continue;
    for (const line of read(file).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

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
const dryRun = args.includes("--dry");
const notes = flag("notes") ?? "";
const minOverride = flag("min");

// ─── 1. Bump every version source ─────────────────────────────────────────────
step(`Bumping version → ${versionName}`);

const pkgPath = "package.json";
const pkg = JSON.parse(read(pkgPath));
pkg.version = versionName;
write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

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

const verTsPath = "src/lib/app-version.ts";
write(
  verTsPath,
  read(verTsPath)
    .replace(/export const VERSION_CODE = \d+;/, `export const VERSION_CODE = ${newCode};`)
    .replace(/export const VERSION_NAME = "[^"]*";/, `export const VERSION_NAME = "${versionName}";`),
);

const manifestPath = "public/update.json";
const prev = JSON.parse(read(manifestPath));
const manifest = {
  latestVersionCode: newCode,
  latestVersionName: versionName,
  minSupportedVersionCode: minOverride
    ? Number.parseInt(minOverride, 10)
    : prev.minSupportedVersionCode,
  apkUrl: apkPublicUrl(versionName),
  releaseNotes: notes || prev.releaseNotes || `Version ${versionName}`,
  mandatory,
  publishedAt: new Date().toISOString().slice(0, 10),
};
write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
log(`  versionCode ${newCode} · min ${manifest.minSupportedVersionCode}${mandatory ? " · MANDATORY" : ""}`);

if (dryRun) {
  log("\n✔ Dry run — files bumped, nothing built/uploaded/pushed.");
  process.exit(0);
}

// ─── 2. cap sync ──────────────────────────────────────────────────────────────
step("npx cap sync android");
try {
  execSync("npx cap sync android", { cwd: root, stdio: "inherit" });
} catch {
  console.error("✖ cap sync failed — fix the above, then re-run.");
  process.exit(1);
}

// ─── 3. Build a signed release APK ────────────────────────────────────────────
let apkPath = null;
if (!exists("android/keystore.properties")) {
  log("\n⚠ android/keystore.properties not found — skipping APK build.");
  log("  Create it (see README) to enable automatic signing.");
} else {
  step("Building signed release APK (gradlew assembleRelease)");
  const androidDir = path.join(root, "android");
  const gradlew = path.join(androidDir, isWin ? "gradlew.bat" : "gradlew");
  // Gradle needs a JDK. Prefer an existing JAVA_HOME; else fall back to the JBR
  // that ships with Android Studio (its keytool we already use).
  const env = { ...process.env };
  if (!env.JAVA_HOME) {
    const jbr = "C:/Program Files/Android/Android Studio/jbr";
    if (isWin && fs.existsSync(jbr)) env.JAVA_HOME = jbr;
  }
  try {
    execFileSync(`"${gradlew}"`, ["assembleRelease"], {
      cwd: androidDir,
      stdio: "inherit",
      shell: true, // run through the shell so .bat resolves on Windows
      env,
    });
  } catch {
    console.error("✖ Gradle build failed.");
    process.exit(1);
  }
  const built = path.join(root, "android/app/build/outputs/apk/release/app-release.apk");
  if (!fs.existsSync(built)) {
    console.error(`✖ APK not found at ${built}`);
    process.exit(1);
  }
  apkPath = path.join(root, `dist-apk/${apkObjectName(versionName)}`);
  fs.mkdirSync(path.dirname(apkPath), { recursive: true });
  fs.copyFileSync(built, apkPath);
  log(`  → ${path.relative(root, apkPath)}`);
}

// ─── 4. Upload to Supabase Storage ────────────────────────────────────────────
if (apkPath) {
  const env = readEnv();
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    log("\n⚠ SUPABASE_SERVICE_ROLE_KEY missing in .env — skipping upload.");
    log(`  Upload ${path.relative(root, apkPath)} to the "${BUCKET}" bucket manually.`);
  } else {
    step(`Uploading ${apkObjectName(versionName)} to Supabase bucket "${BUCKET}"`);
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${apkObjectName(versionName)}`;
    const body = fs.readFileSync(apkPath);
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/vnd.android.package-archive",
        "x-upsert": "true", // overwrite if re-releasing the same version
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`✖ Upload failed (${res.status}): ${text}`);
      console.error(`  Is the "${BUCKET}" bucket created and public?`);
      process.exit(1);
    }
    log(`  ✔ ${apkPublicUrl(versionName)}`);
  }
}

// ─── 5. git commit + push ─────────────────────────────────────────────────────
step("Committing & pushing");
try {
  execSync("git add -A", { cwd: root, stdio: "inherit" });
  execSync(`git commit -m "release ${versionName} (build ${newCode})"`, {
    cwd: root,
    stdio: "inherit",
  });
  execSync("git push", { cwd: root, stdio: "inherit" });
} catch {
  console.error("✖ git step failed (nothing to commit, or push rejected). Check above.");
  process.exit(1);
}

log(`\n✅ Released ${versionName} (build ${newCode}). update.json will ship on the next deploy.`);
