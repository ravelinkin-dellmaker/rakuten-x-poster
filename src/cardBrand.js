// トレカジャンル("トレーディングカード"などの広いジャンルID)の中から、
// 商品名に含まれるキーワードでポケモンカード/ワンピースカードを判別し、
// 投稿文・Webアプリのバッジをより具体的なラベルに差し替えるためのモジュール。
// (楽天のランキングAPIはキーワード検索ができずジャンル単位でしか取得できないため、
//  取得後に商品名で簡易判定している)

const BRAND_PATTERNS = [
  { label: "ポケカ", pattern: /ポケモンカード|ポケカ|ポケモン.{0,4}カードゲーム/i },
  { label: "ワンピカード", pattern: /ワンピース.{0,4}カード|ワンピカード|one\s*piece.{0,4}card/i },
];

/**
 * 商品名からブランド(ポケカ/ワンピカード)を判定する。
 * どれにも一致しなければ fallbackLabel(ジャンルの既定ラベル)を返す。
 */
export function detectCardBrandLabel(itemName, fallbackLabel) {
  const name = itemName || "";
  for (const { label, pattern } of BRAND_PATTERNS) {
    if (pattern.test(name)) return label;
  }
  return fallbackLabel;
}
