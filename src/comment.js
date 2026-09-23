// Google Gemini APIを使って、商品情報から短い紹介コメントを生成するモジュール
// 無料枠のあるモデルを使用。キーが無い/エラー時は null を返し、呼び出し側は
// コメント無しの従来テンプレートにフォールバックする(機能を壊さない)

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent";

// 生成される文章が毎回似た切り口(「〜な一品」ばかり等)に偏らないよう、
// 商品ごとに切り口をランダムに変える(itemCodeでハッシュ化して決定的に選ぶ)。
const ANGLES = [
  "使いどころ・シーンが伝わるように",
  "コスパの良さが伝わるように",
  "レビュー評価の高さが伝わるように",
  "季節感やタイミングの良さが伝わるように",
  "贈り物にも良さそうな魅力が伝わるように",
  "手軽さ・時短になる魅力が伝わるように",
];

function pickAngle(itemCode) {
  let hash = 0;
  for (const ch of String(itemCode || "")) hash = (hash + ch.codePointAt(0)) % 997;
  return ANGLES[hash % ANGLES.length];
}

function buildPrompt(item) {
  const angle = pickAngle(item.itemCode);
  return [
    "以下の商品情報から、Xに投稿する「おすすめ理由」を日本語で書いてください。",
    `商品名をそのまま繰り返すのではなく、${angle}一言にしてください。`,
    "表現は毎回変えて、他の投稿と同じような言い回し(「〜な一品」等の紋切り型)の繰り返しにならないようにしてください。",
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
        // temperatureを上げて、毎回似たような言い回しになりにくくする
        generationConfig: { temperature: 0.9 },
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
