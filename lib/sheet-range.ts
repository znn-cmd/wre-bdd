/** 1-based column count → end column letter (1→A, 26→Z, 27→AA). */
export function columnEndLetterFromCount(nCols: number): string {
  let c = nCols;
  let s = "";
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}
