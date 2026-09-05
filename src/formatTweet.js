// 楽天の商品情報からX投稿本文を組み立てるモジュール
// ステマ規制(景品表示法)対応のため「#PR」を必ず含める

const TWEET_MAX = 280;

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(maxLen - 1, 0)) + "…";
}

export function formatTweet(item, genreLabel, comment) {
  const price = Number(item.itemPrice).toLocaleString("ja-JP");
  const url = item.affiliateUrl || item.itemUrl;
  const genrePrefix = genreLabel ? `${genreLabel}の` : "";
  const genreHashtag = genreLabel ? ` #${genreLabel.replace(/\s/g, "")}` : "";

  const header = `🏆 ${genrePrefix}楽天人気ランキング\n\n`;
  const commentBlock = comment ? `\n\n${comment}` : "";
  const footer = `${commentBlock}\n\n💰 ${price}円\n${url}\n\n#PR #楽天 #楽天ランキング${genreHashtag}`;

  const nameBudget = TWEET_MAX - header.length - footer.length;
  const name = truncate(item.itemName, Math.max(nameBudget, 10));

  return `${header}${name}${footer}`;
}
