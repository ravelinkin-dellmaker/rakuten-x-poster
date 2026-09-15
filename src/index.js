import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fetchRanking, pickFreshItems } from "./rakuten.js";
import { formatTweet } from "./formatTweet.js";
import { buildPoolEntry, mergePool } from "./pool.js";
import { detectRisers, buildSnapshot } from "./trending.js";
import { detectPopular } from "./popular.js";
import { detectCardBrandLabel } from "./cardBrand.js";
import { generateComment } from "./comment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "config.json");
const historyPath = path.join(__dirname, "history.json");
const snapshotPath = path.join(__dirname, "rankSnapshot.json");
const poolPath = path.join(__dirname, "..", "docs", "pool.json");

async function loadJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

const DEFAULT_CONFIG = {
  genres: [
    { key: "general", genreId: "0", genreLabel: "総合", poolSize: 2, trendingPoolSize: 2 },
  ],
  period: "realtime",
  historySize: 60,
  referer: "https://x.com/",
  maxPoolDisplay: 20,
  trendingEnabled: true,
  trendingRankJump: 5,
  popularEnabled: true,
  popularMinReviewCount: 50,
  popularMinReviewAverage: 4.0,
};

async function main() {
  const config = await loadJson(configPath, DEFAULT_CONFIG);
  const history = await loadJson(historyPath, []);
  const existingPool = await loadJson(poolPath, []);
  const previousSnapshots = await loadJson(snapshotPath, {});

  const genres = config.genres?.length ? config.genres : DEFAULT_CONFIG.genres;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const dryRun = process.env.DRY_RUN === "true";

  // AIコメント生成はレート制限に配慮して1件ずつ順番に呼ぶ
  async function buildEntry(item, source, genre) {
    const comment = await generateComment({ apiKey: geminiApiKey, item });
    // トレカジャンルなど detectBrand: true な場合、商品名からポケカ/ワンピカードを判別し、
    // ジャンルラベル(投稿文・バッジ)をより具体的なものに差し替える
    const genreLabel = genre.detectBrand
      ? detectCardBrandLabel(item.itemName, genre.genreLabel)
      : genre.genreLabel;
    const effectiveGenre = { ...genre, genreLabel };
    return buildPoolEntry(
      item,
      formatTweet(item, genreLabel, comment, source),
      source,
      comment,
      effectiveGenre
    );
  }

  const newEntries = [];
  const updatedSnapshots = { ...previousSnapshots };
  // 複数ジャンルにまたがって同じ商品を二重提案しないよう、ジャンルをまたいで履歴を共有する
  const pickedCodes = new Set();

  for (const genre of genres) {
    let rankingItems;
    try {
      rankingItems = await fetchRanking({
        appId: process.env.RAKUTEN_APP_ID,
        accessKey: process.env.RAKUTEN_ACCESS_KEY,
        affiliateId: process.env.RAKUTEN_AFFILIATE_ID,
        genreId: genre.genreId,
        period: config.period,
        referer: config.referer,
      });
    } catch (err) {
      // 1ジャンルの取得に失敗しても他のジャンルの処理は続行する
      console.error(`[${genre.genreLabel}] ランキング取得に失敗しました:`, err.message || err);
      continue;
    }

    const excludeCodes = [...history, ...pickedCodes];

    // ① ランキング上位から、まだ提案していない商品をピック
    const rankingPicks = pickFreshItems(rankingItems, excludeCodes, genre.poolSize ?? 2);
    rankingPicks.forEach((item) => pickedCodes.add(item.itemCode));

    // ② 前回スナップショットと比較して、順位が急上昇した商品をピック(履歴で重複除外)
    let trendingPicks = [];
    if (config.trendingEnabled) {
      const previousSnapshot = previousSnapshots[genre.key] || {};
      const risers = detectRisers(rankingItems, previousSnapshot, {
        minJump: config.trendingRankJump ?? 5,
        maxResults: (genre.trendingPoolSize ?? 2) + rankingPicks.length,
      });
      trendingPicks = risers
        .filter((i) => !history.includes(i.itemCode) && !pickedCodes.has(i.itemCode))
        .slice(0, genre.trendingPoolSize ?? 2);
      trendingPicks.forEach((item) => pickedCodes.add(item.itemCode));
    }

    // ③ 順位に関わらず、口コミ(レビュー)件数が多く評価も高い=購入頻度が高いと
    //    推測できる商品をピック(①②で選んだものは除外)
    let popularPicks = [];
    if (config.popularEnabled ?? true) {
      const candidates = rankingItems.filter(
        (i) => !history.includes(i.itemCode) && !pickedCodes.has(i.itemCode)
      );
      popularPicks = detectPopular(candidates, {
        minReviewCount: config.popularMinReviewCount ?? 50,
        minReviewAverage: config.popularMinReviewAverage ?? 4.0,
        maxResults: genre.popularPoolSize ?? 1,
      });
      popularPicks.forEach((item) => pickedCodes.add(item.itemCode));
    }

    for (const item of rankingPicks) {
      newEntries.push(await buildEntry(item, "ranking", genre));
    }
    for (const item of trendingPicks) {
      newEntries.push(await buildEntry(item, "trending", genre));
    }
    for (const item of popularPicks) {
      newEntries.push(await buildEntry(item, "popular", genre));
    }

    updatedSnapshots[genre.key] = buildSnapshot(rankingItems);

    const rankingCount = rankingPicks.length;
    const trendingCount = trendingPicks.length;
    const popularCount = popularPicks.length;
    console.log(`----- [${genre.genreLabel}] ${rankingCount + trendingCount + popularCount}件の投稿案(ランキング${rankingCount}・急上昇${trendingCount}・口コミ人気${popularCount}) -----`);
  }

  const sourceTag = { trending: "📈急上昇", popular: "💬口コミ人気" };
  for (const entry of newEntries) {
    const tags = [sourceTag[entry.source] || "🏆ランキング", entry.onSale ? `🔥${entry.saleLabel}` : null]
      .filter(Boolean)
      .join(" ");
    console.log(`- [${entry.genreLabel}/${entry.price}円] ${tags} ${entry.name.slice(0, 30)}...`);
  }

  if (dryRun) {
    console.log("(DRY_RUN=true のためpool.json・スナップショットの更新はスキップしました)");
    return;
  }

  await writeFile(snapshotPath, JSON.stringify(updatedSnapshots, null, 2) + "\n", "utf-8");

  const updatedPool = mergePool(existingPool, newEntries, config.maxPoolDisplay ?? 20);
  await mkdir(path.dirname(poolPath), { recursive: true });
  await writeFile(poolPath, JSON.stringify(updatedPool, null, 2) + "\n", "utf-8");
  console.log(`pool.json を更新しました(${updatedPool.length}件)`);

  const historySize = config.historySize ?? 60;
  const newCodes = newEntries.map((entry) => entry.itemCode);
  const updatedHistory = [...newCodes, ...history]
    .filter((code, idx, arr) => arr.indexOf(code) === idx)
    .slice(0, historySize);

  await writeFile(historyPath, JSON.stringify(updatedHistory, null, 2) + "\n", "utf-8");
}

main().catch((err) => {
  console.error("エラーが発生しました:", err);
  process.exitCode = 1;
});
