// 投稿案プールを docs/pool.json に書き出すモジュール
// docs/ は GitHub Pages で公開され、docs/index.html (専用Webアプリ) がこのJSONを読む

export function buildPoolEntry(item, tweetText) {
  const price = Number(item.itemPrice);
  return {
    itemCode: item.itemCode,
    name: item.itemName,
    price: Number.isFinite(price) ? price : null,
    url: item.affiliateUrl || item.itemUrl,
    image: item.mediumImageUrls?.[0]?.imageUrl || null,
    reviewAverage: item.reviewAverage ? Number(item.reviewAverage) : null,
    reviewCount: item.reviewCount ?? null,
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
