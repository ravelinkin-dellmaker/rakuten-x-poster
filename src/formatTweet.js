// 楽天の商品情報からX投稿本文を組み立てるモジュール
// ステマ規制(景品表示法)対応のため「#PR」を必ず含める

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

export function formatTweet(item, genreLabel, comment) {
  const price = Number(item.itemPrice).toLocaleString("ja-JP");
  const url = item.affiliateUrl || item.itemUrl;
  const genrePrefix = genreLabel ? `${genreLabel}の` : "";
  const genreHashtag = genreLabel ? ` #${genreLabel.replace(/\s/g, "")}` : "";

  const header = `🏆 ${genrePrefix}楽天人気ランキング\n\n`;
  const priceLine = `\n\n💰 ${price}円\n`;
  const tagLine = `\n\n#PR #楽天 #楽天ランキング${genreHashtag}`;

  const reserved =
    weightedLength(header) + weightedLength(priceLine) + URL_WEIGHT + weightedLength(tagLine);
  const bodyBudget = Math.max(TWEET_MAX - reserved, 10);

  // AIコメントがある場合は、SEOタイトル(楽天の長い商品名)より
  // コメントを優先して表示する(両方入れると文字数を圧迫して共倒れになるため)
  const body = comment
    ? truncateToWeight(comment, bodyBudget)
    : truncateToWeight(item.itemName, bodyBudget);

  return `${header}${body}${priceLine}${url}${tagLine}`;
}
