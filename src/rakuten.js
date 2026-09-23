// 楽天商品ランキングAPIから商品を取得するモジュール
// API仕様: https://webservice.rakuten.co.jp/documentation/ichiba-item-ranking
// 2026年のAPI移行により、ドメインが openapi.rakuten.co.jp に変更、accessKeyが必須になった

const RANKING_ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601";
const SEARCH_ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";

/**
 * 楽天ランキングAPIを叩いて、ランキング順の商品一覧をそのまま返す(生データ)。
 * ページネーションはせず、1回のリクエストで返ってくる範囲(概ね上位30件)のみ。
 */
export async function fetchRanking({
  appId,
  accessKey,
  affiliateId,
  genreId,
  period,
  referer,
}) {
  if (!appId) {
    throw new Error("RAKUTEN_APP_ID が設定されていません");
  }
  if (!accessKey) {
    throw new Error("RAKUTEN_ACCESS_KEY が設定されていません(2026年API移行で必須)");
  }

  const url = new URL(RANKING_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("applicationId", appId);
  url.searchParams.set("accessKey", accessKey);
  if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
  if (genreId) url.searchParams.set("genreId", genreId);
  url.searchParams.set("period", period || "realtime");

  // 2026年のAPI移行で、アプリ登録時の「許可されたWebサイト」と一致するReferer・Origin
  // ヘッダーの両方が必須になった(片方だけだと REFERRER_MISSING で弾かれる)
  const headers = {};
  if (referer) {
    headers.Referer = referer;
    headers.Origin = new URL(referer).origin;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`楽天API エラー: ${res.status} ${body}`);
  }

  const data = await res.json();
  const items = (data.Items || []).map((wrapper) => wrapper.Item);

  if (items.length === 0) {
    throw new Error(
      "楽天ランキングAPIから商品が0件でした(genreIdが不正な可能性があります)"
    );
  }

  return items;
}

/**
 * 楽天商品検索APIをキーワードで叩く(ポケモンカード等の予約・新着情報の発掘用)。
 * ランキングAPIと違い「発売日順」ソートは存在しないため、更新時刻の新しい順(-updateTimestamp)を
 * デフォルトにして「それっぽい新着商品」を拾う近似的な仕組み。100%の精度は保証しない。
 */
export async function searchItems({
  appId,
  accessKey,
  affiliateId,
  keyword,
  sort = "-updateTimestamp",
  hits = 10,
  referer,
}) {
  if (!appId) {
    throw new Error("RAKUTEN_APP_ID が設定されていません");
  }
  if (!accessKey) {
    throw new Error("RAKUTEN_ACCESS_KEY が設定されていません");
  }
  if (!keyword) {
    throw new Error("keyword が指定されていません");
  }

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("applicationId", appId);
  url.searchParams.set("accessKey", accessKey);
  if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("sort", sort);
  url.searchParams.set("hits", String(hits));

  // Search APIはReferer/Origin必須の明記は無いが、ランキングAPIと同じアプリ登録を
  // 使い回すため念のため付与しておく(付けても害はない)。
  const headers = {};
  if (referer) {
    headers.Referer = referer;
    headers.Origin = new URL(referer).origin;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`楽天商品検索APIエラー: ${res.status} ${body}`);
  }

  const data = await res.json();
  return (data.Items || []).map((wrapper) => wrapper.Item);
}

/**
 * ランキングの中から、まだ提案していない商品を最大 poolSize 件返す(プール用)。
 * 未提案の商品が足りない場合は、そのまま件数が少ないまま返す(無理に重複させない)。
 */
export function pickFreshItems(items, excludeCodes = [], poolSize = 1) {
  const fresh = items.filter((item) => !excludeCodes.includes(item.itemCode));
  const pool = fresh.length > 0 ? fresh : items; // 全件提案済みなら1位から出し直す
  return pool.slice(0, poolSize);
}
