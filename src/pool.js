// 投稿案プールを docs/pool.json に書き出すモジュール
// docs/ は GitHub Pages で公開され、docs/index.html (専用Webアプリ) がこのJSONを読む

// 楽天APIの日時は "YYYY-MM-DD HH:MM" 形式・JSTなので、明示的にJSTとして解釈する
function parseJstDate(str) {
  if (!str) return null;
  const d = new Date(str.replace(" ", "T") + "+09:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 商品がセール中(期間限定セール or ポイントアップキャンペーン中)かどうかを判定する。
 */
export function detectSale(item, now = new Date()) {
  const labels = [];

  const start = parseJstDate(item.startTime);
  const end = parseJstDate(item.endTime);
  if (start && end && now >= start && now <= end) {
    labels.push("期間限定セール");
  }

  const pointRate = Number(item.pointRate);
  if (pointRate > 1) {
    const pStart = parseJstDate(item.pointRateStartTime);
    const pEnd = parseJstDate(item.pointRateEndTime);
    const active = !pStart || !pEnd || (now >= pStart && now <= pEnd);
    if (active) {
      labels.push(`ポイント${pointRate}倍`);
    }
  }

  return { onSale: labels.length > 0, saleLabel: labels.join(" / ") || null };
}

export function buildPoolEntry(item, tweetText, source = "ranking") {
  const price = Number(item.itemPrice);
  const { onSale, saleLabel } = detectSale(item);
  return {
    itemCode: item.itemCode,
    name: item.itemName,
    price: Number.isFinite(price) ? price : null,
    url: item.affiliateUrl || item.itemUrl,
    image: item.mediumImageUrls?.[0]?.imageUrl || null,
    reviewAverage: item.reviewAverage ? Number(item.reviewAverage) : null,
    reviewCount: item.reviewCount ?? null,
    rank: item.rank ?? null,
    source, // "ranking" | "trending"
    onSale,
    saleLabel,
    tweetText,
    addedAt: new Date().toISOString(),
  };
}

/**
 * 既存プールに新しいエントリをマージし、maxSize件まで(新しい順)に切り詰める。
 * 同じ itemCode が既にあれば新しい方で上書きしない(先に追加された方の addedAt を保持)。
 */
export function mergePool(existingPool, newEntries, maxSize) {
  const existingCodes = new Set(existingPool.map((e) => e.itemCode));
  const merged = [
    ...existingPool,
    ...newEntries.filter((e) => !existingCodes.has(e.itemCode)),
  ];
  return merged.slice(-maxSize);
}
