export type ActionResult =
  | { ok: true; id?: string; slug?: string }
  | { ok: false; error: string };
