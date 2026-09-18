// アフィリエイトとは無関係な「楽天のお得情報」を発信するためのモジュール。
// インプレッション稼ぎ・閲覧数アップが目的で、特定商品や成果報酬に紐づかない投稿案を作る。
//
// 「5と0のつく日はポイントアップ」のような楽天の恒常キャンペーンは実在するが、
// 倍率・上限額・対象条件は楽天側の都合で時期によって変わるため、このツールでは
// 具体的な数値を断定的に書かず、「詳細は公式ページで確認」に留めている
// (誤った数値を投稿し続けるリスクを避けるため)。
// config.json の infoPosts.campaigns はユーザー自身が追加・編集する想定
// (例: 開催期間が決まったら「お買い物マラソン」を dateRange 付きで追加する、等)。

import { weightedLength, truncateToWeight, TWEET_MAX, URL_WEIGHT } from "./formatTweet.js";

function todayJstParts(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  return {
    dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    day: d,
    weekday: jst.getUTCDay(), // 0=日曜
  };
}

/**
 * config.jsonのinfoPosts.campaignsの中から、今日(JST)が対象の条件に
 * 一致するものを返す。条件は dateRange(期間指定) / daysOfMonth(毎月の特定日) /
 * daysOfWeek(毎週の特定曜日) のいずれかを持つキャンペーン定義を想定している。
 */
export function detectTodayCampaigns(campaigns = [], now = new Date()) {
  const { dateStr, day, weekday } = todayJstParts(now);
  return campaigns.filter((c) => {
    if (c.dateRange?.start && c.dateRange?.end) {
      return dateStr >= c.dateRange.start && dateStr <= c.dateRange.end;
    }
    if (Array.isArray(c.daysOfMonth) && c.daysOfMonth.length > 0) {
      return c.daysOfMonth.includes(day);
    }
    if (Array.isArray(c.daysOfWeek) && c.daysOfWeek.length > 0) {
      return c.daysOfWeek.includes(weekday);
    }
    return false; // 条件が何も設定されていなければ誤発火を避けるため対象外
  });
}

/**
 * 同じキャンペーンでも日付が変わればまた投稿できるよう、日付をitemCodeに含める
 * (history/pool.jsonの重複排除の仕組みにそのまま乗せるため)。
 */
export function buildInfoItemCode(campaign, now = new Date()) {
  const { dateStr } = todayJstParts(now);
  return `info:${campaign.key}:${dateStr}`;
}

/**
 * アフィリエイトリンクを含まない情報発信用の投稿文を組み立てる。
 * 成果報酬が発生しないため、他の投稿と異なり#PRは付けない。
 */
export function formatInfoTweet(campaign) {
  const header = `${campaign.emoji || "🛍️"} ${campaign.text}`;
  const urlLine = campaign.url ? `\n\n${campaign.url}` : "";
  const hashtags = ["#楽天市場", "#楽天お得情報", ...(campaign.hashtags || [])]
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const tagLine = `\n\n${hashtags}`;

  const reserved = (campaign.url ? URL_WEIGHT : 0) + weightedLength(tagLine);
  const bodyBudget = Math.max(TWEET_MAX - reserved, 10);

  return `${truncateToWeight(header, bodyBudget)}${urlLine}${tagLine}`;
}
