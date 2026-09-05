// 投稿案をGitHub Issueとして登録するモジュール
// (Xへの自動投稿はせず、人間が最後にコピー&ペーストで投稿する運用にするための下書き置き場)

export async function createDraftIssue({ token, repo, title, body }) {
  if (!token || !repo) {
    return null; // ローカル実行などトークンが無い環境では作成をスキップ
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "rakuten-x-poster",
    },
    body: JSON.stringify({ title, body, labels: ["投稿案"] }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`GitHub Issue作成エラー: ${res.status} ${errBody}`);
  }

  return res.json();
}
