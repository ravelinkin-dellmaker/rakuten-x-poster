// 楽天の商品情報からX投稿本文を組み立てるモジュール
// ステマ規制(景品表示法)対応のため「#PR」を必ず含める
// 方針: 商品名をそのまま貼るのではなく「おすすめ理由(AIコメント)+リンク」のシンプルな構成にする

const TWEET_MAX = 280;
// Xは投稿時にURLを自動でt.co形式に短縮して数えるため、実際の文字数ではなくこの重みで計算する
const URL_WEIGHT = 23;

// Xの文字数カウントでは、全角・CJK文字(日本語含む)は2文字分として数えられる
const WIDE_RANGES = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x20000, 0x3fffd],
];

function isWide(codePoint) {
  // BMP外(サロゲートペアになる)の文字はほぼ全て絵文字で、Xでは2文字分として数えられる。
  // 以前はこれを見落としていて、ヘッダーの🏆・💰などが1文字扱いになり
  // 末尾のハッシュタグ部分が数文字オーバーする原因になっていた。
  if (codePoint >= 0x10000) return true;
  return WIDE_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}

function weightedLength(text) {
  let total = 0;
  for (const ch of text) {
    total += isWide(ch.codePointAt(0)) ? 2 : 1;
  }
  return total;
}

function truncateToWeight(text, maxWeight) {
  const chars = [...text];
  if (weightedLength(text) <= maxWeight) return text;

  let acc = 0;
  let cutIndex = chars.length;
  for (let i = 0; i < chars.length; i++) {
    const w = isWide(chars[i].codePointAt(0)) ? 2 : 1;
    if (acc + w > maxWeight - 1) {
      cutIndex = i;
      break;
    }
    acc += w;
  }
  return chars.slice(0, cutIndex).join("") + "…";
}

// AIコメント(おすすめ理由)が無い場合の最低限のフォールバック文言。
// 商品名は使わない方針のため、ジャンル名ベースの簡潔な一言にする。
function fallbackBody(genreLabel) {
  return genreLabel
    ? `楽天の${genreLabel}ランキングで人気の一品を見つけたよ。気になる人はチェックしてみて。`
    : "楽天で人気の商品を見つけたよ。気になる人はチェックしてみて。";
}

export function formatTweet(item, genreLabel, comment) {
  const url = item.affiliateUrl || item.itemUrl;
  const genreHashtag = genreLabel ? ` #${genreLabel.replace(/\s/g, "")}` : "";
  let tagLine = `\n\n#PR #楽天 #楽天ランキング${genreHashtag}`;

  const body = comment || fallbackBody(genreLabel);

  let reserved = URL_WEIGHT + weightedLength(tagLine) + weightedLength("\n\n");
  // genreLabelが極端に長い場合の保険。#PRはステマ規制対応で必須なので、
  // 削るならジャンルのハッシュタグ側から落として本文が最低限の長さを確保できるようにする。
  if (TWEET_MAX - reserved < 10) {
    tagLine = `\n\n#PR #楽天 #楽天ランキング`;
    reserved = URL_WEIGHT + weightedLength(tagLine) + weightedLength("\n\n");
  }
  const bodyBudget = Math.max(TWEET_MAX - reserved, 10);
  const truncatedBody = truncateToWeight(body, bodyBudget);

  return `${truncatedBody}\n\n${url}${tagLine}`;
}
