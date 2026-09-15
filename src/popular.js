// ランキング順位だけでなく、「口コミ(レビュー)件数が多い」= 購入頻度が高いと推測できる商品を
// 拾うためのモジュール。ランキングAPIのレスポンスに含まれるreviewCount/reviewAverageのみを使うため、
// 追加のAPI呼び出しは発生しない。
// 例: 30位以下で順位的には目立たないが、実は購入者からのレビューが非常に多い(=よく売れている)
//     商品をランナップに混ぜたい場合に使う。

/**
 * レビュー件数が多く、かつ評価が一定以上の商品を「口コミ人気」として抽出する。
 * (件数だけで選ぶと低評価品が紛れ込みうるため、評価の下限も設ける)
 */
export function detectPopular(
  items,
  { minReviewCount = 50, minReviewAverage = 4.0, maxResults = 1 } = {}
) {
  const candidates = items.filter(
    (item) =>
      Number(item.reviewCount) >= minReviewCount &&
      Number(item.reviewAverage) >= minReviewAverage
  );

  // レビュー件数の多い順(同数ならレビュー評価の高い順)
  candidates.sort((a, b) => {
    const countDiff = Number(b.reviewCount) - Number(a.reviewCount);
    if (countDiff !== 0) return countDiff;
    return Number(b.reviewAverage) - Number(a.reviewAverage);
  });

  return candidates.slice(0, maxResults);
}
