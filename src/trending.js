// 前回取得時のランキング順位と比較して、急上昇している商品を検知するモジュール
// 「話題になっているか」は楽天APIでは分からないため、あくまで順位変動による近似

/**
 * 現在のランキング一覧と前回のスナップショット(itemCode -> {rank}) を比較し、
 * 順位が minJump 以上上がった商品(新規ランクインも含む)を上昇幅の大きい順に返す。
 */
export function detectRisers(currentItems, previousSnapshot, { minJump = 5, maxResults = 2 } = {}) {
  const risers = [];

  for (const item of currentItems) {
    const prev = previousSnapshot[item.itemCode];
    if (!prev) {
      // 前回のスナップショットに無い = 新規ランクイン。急上昇として扱う
      risers.push({ item, jump: Infinity });
      continue;
    }
    const jump = prev.rank - item.rank;
    if (jump >= minJump) {
      risers.push({ item, jump });
    }
  }

  risers.sort((a, b) => b.jump - a.jump);
  return risers.slice(0, maxResults).map((r) => r.item);
}

/**
 * 次回比較用のスナップショットを作る({ itemCode: { rank } } の形)。
 */
export function buildSnapshot(items) {
  const snapshot = {};
  for (const item of items) {
    snapshot[item.itemCode] = { rank: item.rank };
  }
  return snapshot;
}
