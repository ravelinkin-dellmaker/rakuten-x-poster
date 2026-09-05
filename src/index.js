import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fetchRankingItems } from "./rakuten.js";
import { formatTweet } from "./formatTweet.js";
import { createDraftIssue } from "./github.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "config.json");
const historyPath = path.join(__dirname, "history.json");

async function loadJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function todayJst() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const config = await loadJson(configPath, {
    genreId: "0",
    genreLabel: "総合",
    period: "realtime",
    historySize: 60,
    poolSize: 5,
    referer: "https://x.com/",
  });
  const history = await loadJson(historyPath, []);

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
  const date = todayJst();

  for (const [i, item] of items.entries()) {
    const tweetText = formatTweet(item, config.genreLabel);
    console.log(`----- 投稿案 ${i + 1}/${items.length} -----`);
    console.log(tweetText);
    console.log("------------------");

    if (dryRun) {
      continue;
    }

    const issueBody = [
      "## おすすめ商品",
      "",
      "以下の文章をコピーして、ご自身の手でXに投稿してください。",
      "`#PR` は消さないこと(ステマ規制対応のため必須)。",
      "",
      "投稿し終わったら、このIssueをCloseしてプールから消してください。",
      "",
      "```",
      tweetText,
      "```",
    ].join("\n");

    const issue = await createDraftIssue({
      token: process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPOSITORY,
      title: `📝 投稿案 (${date}) #${i + 1}`,
      body: issueBody,
    });

    if (issue) {
      console.log("Issueを作成しました:", issue.html_url);
    } else {
      console.log(
        "(GITHUB_TOKEN / GITHUB_REPOSITORY が無いためIssue作成はスキップしました)"
      );
    }
  }

  if (dryRun) {
    console.log("(DRY_RUN=true のため下書きIssueの作成はスキップしました)");
    return;
  }

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
