// Google Gemini APIを使って、商品情報から短い紹介コメントを生成するモジュール
// 無料枠のあるモデルを使用。キーが無い/エラー時は null を返し、呼び出し側は
// コメント無しの従来テンプレートにフォールバックする(機能を壊さない)

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent";

function buildPrompt(item) {
  return [
    "以下の商品情報から、Xに投稿する紹介文に添える一言コメントを日本語で書いてください。",
    "条件: 30〜50文字程度、誇張表現や断定的な効果効能は書かない、絵文字は使わない、本文のみを出力する(前置き・引用符は不要)。",
    "",
    `商品名: ${item.itemName}`,
    `キャッチコピー: ${item.catchcopy || "なし"}`,
    `商品説明の抜粋: ${(item.itemCaption || "").slice(0, 300)}`,
    item.reviewAverage ? `レビュー評価: ${item.reviewAverage} (${item.reviewCount}件)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateComment({ apiKey, item }) {
  if (!apiKey) return null;

  try {
    const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(item) }] }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`コメント生成エラー(${item.itemCode}): ${res.status} ${body}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error(`コメント生成エラー(${item.itemCode}):`, err);
    return null;
  }
}
