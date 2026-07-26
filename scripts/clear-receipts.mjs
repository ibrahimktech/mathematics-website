/**
 * Clears ALL files from the private `receipts` storage bucket via the Storage
 * API (SQL can't delete storage objects). Pair with supabase/reset-exams.sql
 * when doing a full exam/sales reset. Service-role only — never in the browser.
 *
 * Run: node scripts/clear-receipts.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SR) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(URL_, SR, { auth: { persistSession: false } });
const BUCKET = "receipts";

async function main() {
  // Receipts are stored as `<user_id>/<file>`, so list folders, then their files.
  const { data: folders, error } = await admin.storage
    .from(BUCKET)
    .list("", { limit: 10000 });
  if (error) {
    console.error("List failed:", error.message);
    process.exitCode = 1;
    return;
  }

  const paths = [];
  for (const entry of folders ?? []) {
    // A "folder" has no id; a file at the root would have one.
    if (entry.id === null || entry.id === undefined) {
      const { data: files } = await admin.storage
        .from(BUCKET)
        .list(entry.name, { limit: 10000 });
      for (const f of files ?? []) paths.push(`${entry.name}/${f.name}`);
    } else {
      paths.push(entry.name);
    }
  }

  if (paths.length === 0) {
    console.log("No receipt files to remove.");
    return;
  }

  // Remove in batches of 100.
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(batch);
    if (rmErr) {
      console.error("Remove failed:", rmErr.message);
      process.exitCode = 1;
      return;
    }
    removed += batch.length;
  }
  console.log(`Removed ${removed} receipt file(s) from '${BUCKET}'.`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
});
