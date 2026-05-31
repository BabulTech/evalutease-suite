/**
 * Single source of truth for the app version, kept in sync by scripts/release.mjs
 * (which also bumps android/app/build.gradle and public/update.json).
 *
 * VERSION_CODE is the integer used for update comparisons (monotonic, +1 per
 * release). VERSION_NAME is the human-readable label shown in Settings.
 *
 * Do NOT edit these by hand — run `npm run release -- <x.y.z>`.
 */
export const VERSION_CODE = 5;
export const VERSION_NAME = "1.2.1";
