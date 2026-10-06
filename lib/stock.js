// Stock is a map { size: count }. A size missing from the map is not tracked (unlimited).
export const sizesOf = p => (p.sizes && p.sizes.length) ? p.sizes : ["OS"];

export function left(p, size){
  const n = p.stock && typeof p.stock === "object" ? p.stock[size] : undefined;
  return Number.isInteger(n) ? n : Infinity;
}

// Sold out when marked by hand, or when every size has run out.
export const soldOut = p => p.sold || sizesOf(p).every(s => left(p, s) <= 0);
