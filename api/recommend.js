// POST /api/recommend — stores a visitor's suggestion for a new domain/category.
// Zero-dependency: talks straight to Supabase's PostgREST endpoint with the
// secret key (RLS is on with no public policies, so only this function writes).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const { suggestion, note } = req.body ?? {};
  const s = String(suggestion ?? '').trim();
  const n = String(note ?? '').trim();
  if (s.length < 2 || s.length > 200) {
    return res.status(400).json({ error: 'suggestion must be 2-200 characters' });
  }
  if (n.length > 500) {
    return res.status(400).json({ error: 'note too long (max 500 characters)' });
  }
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/category_recommendations`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({ suggestion: s, note: n || null }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('supabase insert failed', r.status, detail);
    return res.status(502).json({ error: 'could not store the suggestion' });
  }
  return res.status(201).json({ ok: true });
}
