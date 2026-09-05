import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fetchRankingItems } from "./rakuten.js";
import { formatTweet } from "./formatTweet.js";
import { buildPoolEntry, mergePool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "config.json");
const historyPath = path.join(__dirname, "history.json");
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

async function main() {
  const config = await loadJson(configPath, {
    genreId: "0",
    genreLabel: "総合",
    period: "realtime",
    historySize: 60,
    poolSize: 5,
    referer: "https://x.com/",
    maxPoolDisplay: 20,
  });
  const history = await loadJson(historyPath, []);
  const existingPool = await loadJson(poolPath, []);

  const items = await fetchRankingItems({
    appId: process.env.RAKUTEN_APP_ID,
    accessKey: process.env.RAKUTEN_ACCESS_KEY,
    affiliateId: process.env.RAKUTEN_AFFILIATE_ID,
    genreId: config.genreId,
    period: config.period,
    excludeCodes: history,
    poolSize: config.poolSize ?? 5,
    referer: config.referer,
  });

  const dryRun = process.env.DRY_RUN === "true";
  const newEntries = items.map((item) =>
    buildPoolEntry(item, formatTweet(item, config.genreLabel))
  );

  console.log(`----- ${newEntries.length}件の投稿案 -----`);
  for (const entry of newEntries) {
    console.log(`- [${entry.price}円] ${entry.name.slice(0, 40)}...`);
  }

  if (dryRun) {
    console.log("(DRY_RUN=true のためpool.jsonの更新はスキップしました)");
    return;
  }

  const updatedPool = mergePool(existingPool, newEntries, config.maxPoolDisplay ?? 20);
  await mkdir(path.dirname(poolPath), { recursive: true });
  await writeFile(poolPath, JSON.stringify(updatedPool, null, 2) + "\n", "utf-8");
  console.log(`pool.json を更新しました(${updatedPool.length}件)`);

  const historySize = config.historySize ?? 60;
  const newCodes = items.map((item) => item.itemCode);
  const updatedHistory = [...newCodes, ...history]
    .filter((code, idx, arr) => arr.indexOf(code) === idx)
    .slice(0, historySize);

  await writeFile(historyPath, JSON.stringify(updatedHistory, null, 2) + "\n", "utf-8");
}

main().catch((err) => {
  console.error("エラーが発生しました:", err);
  process.exitCode = 1;
});
