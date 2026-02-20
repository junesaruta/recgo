import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

function toCsv(member_code, selected) {
  const header = ["member_code", "seq", "item_id"];
  const rows = selected.map(x => [member_code, x.seq, x.item_id]);

  return [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { member_code, selected } = req.body || {};
  if (!member_code || !Array.isArray(selected)) {
    return res.status(400).json({ error: "Missing member_code or selected" });
  }

  const csv = toCsv(member_code, selected);

  // ✅ โฟลเดอร์ใน bucket
  const filePath = `recgo/${member_code}.csv`;

  // ✅ ใช้ Buffer ใน Node (ชัวร์กว่า Blob)
  const fileBody = Buffer.from(csv, "utf8");

  const { error } = await supabase.storage
    .from("csv")
    .upload(filePath, fileBody, {
      upsert: true,
      contentType: "text/csv;charset=utf-8",
    });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Upload failed", detail: error.message });
  }

  // ถ้า bucket เป็น private → สร้าง signed url ให้โหลดได้
  const { data: signed, error: signErr } = await supabase.storage
    .from("csv")
    .createSignedUrl(filePath, 60 * 10); // 10 นาที

  if (signErr) {
    console.error(signErr);
    return res.json({ ok: true, saved_to: filePath, download_url: null });
  }

  return res.json({ ok: true, saved_to: filePath, download_url: signed.signedUrl });
}