import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fetchRanking, pickFreshItems } from "./rakuten.js";
import { formatTweet } from "./formatTweet.js";
import { buildPoolEntry, mergePool } from "./pool.js";
import { detectRisers, buildSnapshot } from "./trending.js";
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
  genreId: "0",
  genreLabel: "総合",
  period: "realtime",
  historySize: 60,
  poolSize: 2,
  referer: "https://x.com/",
  maxPoolDisplay: 20,
  trendingEnabled: true,
  trendingPoolSize: 2,
  trendingRankJump: 5,
};

async function main() {
  const config = await loadJson(configPath, DEFAULT_CONFIG);
  const history = await loadJson(historyPath, []);
  const existingPool = await loadJson(poolPath, []);
  const previousSnapshot = await loadJson(snapshotPath, {});

  const rankingItems = await fetchRanking({
    appId: process.env.RAKUTEN_APP_ID,
    accessKey: process.env.RAKUTEN_ACCESS_KEY,
    affiliateId: process.env.RAKUTEN_AFFILIATE_ID,
    genreId: config.genreId,
    period: config.period,
    referer: config.referer,
  });

  // ① ランキング上位から、まだ提案していない商品をピック
  const rankingPicks = pickFreshItems(rankingItems, history, config.poolSize ?? 2);

  // ② 前回スナップショットと比較して、順位が急上昇した商品をピック(履歴で重複除外)
  let trendingPicks = [];
  if (config.trendingEnabled) {
    const risers = detectRisers(rankingItems, previousSnapshot, {
      minJump: config.trendingRankJump ?? 5,
      maxResults: (config.trendingPoolSize ?? 2) + rankingPicks.length,
    });
    const alreadyPicked = new Set(rankingPicks.map((i) => i.itemCode));
    trendingPicks = risers
      .filter((i) => !history.includes(i.itemCode) && !alreadyPicked.has(i.itemCode))
      .slice(0, config.trendingPoolSize ?? 2);
  }

  const dryRun = process.env.DRY_RUN === "true";
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // AIコメント生成はレート制限に配慮して1件ずつ順番に呼ぶ
  async function buildEntry(item, source) {
    const comment = await generateComment({ apiKey: geminiApiKey, item });
    return buildPoolEntry(item, formatTweet(item, config.genreLabel, comment), source, comment);
  }

  const rankingEntries = [];
  for (const item of rankingPicks) {
    rankingEntries.push(await buildEntry(item, "ranking"));
  }
  const trendingEntries = [];
  for (const item of trendingPicks) {
    trendingEntries.push(await buildEntry(item, "trending"));
  }
  const newEntries = [...rankingEntries, ...trendingEntries];

  console.log(`----- ${newEntries.length}件の投稿案(ランキング${rankingEntries.length}・急上昇${trendingEntries.length}) -----`);
  for (const entry of newEntries) {
    const tags = [entry.source === "trending" ? "📈急上昇" : "🏆ランキング", entry.onSale ? `🔥${entry.saleLabel}` : null]
      .filter(Boolean)
      .join(" ");
    console.log(`- [${entry.price}円] ${tags} ${entry.name.slice(0, 30)}...`);
  }

  if (dryRun) {
    console.log("(DRY_RUN=true のためpool.json・スナップショットの更新はスキップしました)");
    return;
  }

  await writeFile(snapshotPath, JSON.stringify(buildSnapshot(rankingItems), null, 2) + "\n", "utf-8");

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
