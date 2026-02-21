import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  console.log("API HIT ✅", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("body =", req.body);

    const { member_code, selected } = req.body || {};
    if (!member_code || !Array.isArray(selected)) {
      console.log("❌ Missing data:", { member_code, selectedType: typeof selected });
      return res.status(400).json({ error: "Missing data" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("SUPABASE_URL exists:", !!SUPABASE_URL);
    console.log("SERVICE_ROLE exists:", !!SERVICE_ROLE);

    if (!SUPABASE_URL) return res.status(500).json({ error: "SUPABASE_URL is missing" });
    if (!SERVICE_ROLE) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY is missing" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // ---- CSV ----
    const header = ["member_code", "seq", "item_id"];
    const rows = selected.map((x) => [member_code, x.seq, x.item_id]);

    const csv = [header, ...rows].map((r) => r.join(",")).join("\r\n"); // Excel-friendly
    const filePath = `recgo/${member_code}.csv`;

    console.log("filePath =", filePath);
    console.log("selected length =", selected.length);
    console.log("csv preview =", csv.slice(0, 120));

    const uploadRes = await supabase.storage
      .from("csv")
      .upload(filePath, Buffer.from(csv, "utf8"), {
        upsert: true,
        contentType: "text/csv; charset=utf-8",
        cacheControl: "3600",
      });

    console.log("UPLOAD RESULT =", uploadRes);

    if (uploadRes.error) {
      console.error("UPLOAD ERROR =", uploadRes.error);
      return res.status(500).json({ error: uploadRes.error.message, detail: uploadRes.error });
    }

    const signedRes = await supabase.storage
      .from("csv")
      .createSignedUrl(filePath, 60 * 60);

    console.log("SIGNED RESULT =", signedRes);

    if (signedRes.error) {
      console.error("SIGNED ERROR =", signedRes.error);
      return res.status(500).json({ error: signedRes.error.message, detail: signedRes.error });
    }

    return res.json({
      ok: true,
      saved_to: filePath,
      download_url: signedRes.data?.signedUrl,
    });
  } catch (err) {
    console.error("CATCH ERROR =", err);
    return res.status(500).json({ error: String(err?.message || err), detail: err });
  }
}