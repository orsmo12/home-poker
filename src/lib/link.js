/** A stable colour per shared wallet, so linked seats are easy to spot on the table. */
export const linkColor = (id) => {
  const cols = ['#f472b6', '#22d3ee', '#a78bfa', '#facc15', '#fb923c', '#4ade80'];
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return cols[h % cols.length];
};
