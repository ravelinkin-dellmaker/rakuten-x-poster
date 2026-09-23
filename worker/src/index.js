// 「投稿済み」状態をデバイス間で共有するための最小API。
// KV(DONE_STORE)に itemCode の配列を1つのJSONとして保存するだけのシンプルな仕組み。
// 認証は無し(1人での運用前提。実害があっても「投稿済み表示のON/OFF」程度に留まるため)。

const ALLOWED_ORIGIN = "https://ravelinkin-dellmaker.github.io";
const KV_KEY = "done-set";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function readDoneSet(env) {
  const raw = await env.DONE_STORE.get(KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/done") {
      return new Response("Not Found", { status: 404, headers: corsHeaders() });
    }

    if (request.method === "GET") {
      const doneList = await readDoneSet(env);
      return json(doneList);
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON" }, 400);
      }
      const { itemCode, action } = body || {};
      if (typeof itemCode !== "string" || !itemCode || (action !== "done" && action !== "undo")) {
        return json({ error: "itemCode(string) と action('done'|'undo') が必要です" }, 400);
      }

      const current = new Set(await readDoneSet(env));
      if (action === "done") current.add(itemCode);
      else current.delete(itemCode);

      const updated = [...current];
      await env.DONE_STORE.put(KV_KEY, JSON.stringify(updated));
      return json(updated);
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
  },
};
