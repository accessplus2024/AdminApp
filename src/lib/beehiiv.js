// lib/beehiiv.js
const BEEHIIV_API_KEY = import.meta.env.VITE_BEEHIIV_API_KEY;
const PUBLICATION_ID = import.meta.env.VITE_BEEHIIV_PUBLICATION_ID;

export async function fetchBeehiivPosts(limit = 10) {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/posts?limit=${limit}&expand[]=stats`,
    { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } }
  );
  if (!res.ok) throw new Error(`Beehiiv error: ${res.status}`);
  return res.json();
}