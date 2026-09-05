# rakuten-x-poster

楽天アフィリエイトの人気ランキング商品を、週1回まとめて「投稿案プール」として用意するツール。
**Xへの投稿自体は手動**(GitHub Issueに溜まった下書きから好きなものを選んでコピー&自分でポストする)。

## なぜ完全自動投稿にしないのか

楽天アフィリエイトの[公式ガイドライン](https://affiliate.rakuten.co.jp/guideline/rule/)には、
「スクリプトや外部プログラムを使い、機械的に投稿やコメントを行う行為」を禁止する規定があり、
実際に警告を受けた事例も報告されている([参考記事](https://note.com/etc_999/n/n64862c4ad6de))。
違反するとアカウント停止・報酬没収のリスクがある。

そのため、このツールは**投稿文の作成まで**を自動化し、実際にXへ投稿するボタンを押すのは人間(あなた)にしている。
これにより:
- 楽天の禁止事項(機械的な自動投稿)に抵触しない
- 毎日の作業は「Issueを開いてコピペしてポスト」の数十秒だけで済む
- X Developer Portalでのアプリ申請・APIキー取得が不要になる(投稿用APIを使わないため)

---

## 1. 必要なもの

### 楽天API
1. [楽天ウェブサービス](https://webservice.rakuten.co.jp/) にアプリ登録し、**アプリケーションID**と**アクセスキー(`pk_`から始まる文字列)**を取得する(アプリケーションタイプは「WEB」を選択)。
   - 2026年のAPI移行により、この2つがセットで必須になった。
2. [楽天アフィリエイト](https://affiliate.rakuten.co.jp/) に登録し、**アフィリエイトID**を取得する。
   - これが無くても動くが、無いと成果報酬が発生しないリンクになるので必ず取得すること。

### X (Twitter) アカウント
- 通常のXアカウントがあればよい。API申請は不要。

---

## 2. ローカルで試す(任意)

```bash
npm install
cp .env.example .env
# .env に RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY / RAKUTEN_AFFILIATE_ID を書き込む(DRY_RUN=true のままなら投稿案はコンソール表示のみ)
npm start
```

---

## 3. GitHubにpushしてActionsで自動化する

1. このフォルダでGitHubリポジトリを作る。
   ```bash
   git init
   git add .
   git commit -m "init: rakuten-x-poster"
   git branch -M main
   git remote add origin https://github.com/<あなたのアカウント>/rakuten-x-poster.git
   git push -u origin main
   ```
2. GitHubリポジトリの **Settings > Secrets and variables > Actions > New repository secret** で以下を登録する:
   - `RAKUTEN_APP_ID`
   - `RAKUTEN_ACCESS_KEY`(`pk_`から始まる文字列。2026年のAPI移行で必須になった)
   - `RAKUTEN_AFFILIATE_ID`
   - (`GITHUB_TOKEN` はGitHub Actionsが自動で用意するので登録不要)
3. **Actions** タブ → `Rakuten Affiliate Pool Refill` → **Run workflow** で手動実行して動作確認する。
   - `dry_run` を `true` にすればIssueを作らずログだけ確認できる。
4. 成功すると、リポジトリの **Issues** タブに「📝 投稿案 (日付) #1」〜「#5」が作成される(件数は`poolSize`で調整可)。
   - 好きなタイミングでIssueを開き、中身をコピーしてXアプリ/サイトから**自分で手動投稿**する。
   - 投稿し終わったIssueはCloseしてプールから消す。
5. 問題なければ毎週月曜 `.github/workflows/daily-post.yml` の cron (`0 0 * * 1` = 毎週月曜9時JST) で自動的にプールが補充される。
   - Issueが作成されるとGitHubの通知(デフォルトはメール/Web通知)が届く。

---

## 4. カスタマイズ

`config.json` を編集する:

```json
{
  "genreId": "0",
  "genreLabel": "総合",
  "period": "realtime",
  "historySize": 60,
  "poolSize": 5
}
```

- `genreId`: 楽天ジャンルID。`0` は総合(全ジャンル)。特定ジャンルに絞りたい場合は
  [楽天ジャンル検索](https://webservice.rakuten.co.jp/explorer/api/IchibaGenre/Search/) や、
  楽天市場のカテゴリページURL末尾の数字から調べて差し替える(例: 家電=100804、コスメ=100939 など。時期により変わるため要確認)。
- `genreLabel`: 投稿文とハッシュタグに使う日本語ラベル。
- `period`: `realtime` / `daily` / `weekly` / `monthly` から選択。
- `historySize`: 直近何件を「提案済み」として重複を避けるか。
- `poolSize`: 1回の実行で何件の投稿案プールを作るか。

補充頻度・時刻を変えたい場合は `.github/workflows/daily-post.yml` の `cron` を編集する(UTC指定なのでJSTから9時間引いた時刻)。

---

## 5. 法律・規約まわりの注意

- 2023年10月施行のステマ規制(景品表示法)により、アフィリエイト投稿だと分かるよう **#PR** を必ず入れている(`src/formatTweet.js`)。消さないこと。
- **投稿ボタンは必ず自分の手で押すこと。** 完全自動投稿は楽天アフィリエイト規約違反のリスクがある(上記参照)。
- 楽天アフィリエイトの規約で禁止されている行為(自己購入、他人の投稿へのリプライでのリンク掲載など)がないか、運用しながら適宜 [ガイドライン](https://affiliate.rakuten.co.jp/guideline/rule/) を確認すること。

---

## ファイル構成

```
rakuten-x-poster/
├── config.json              # ジャンル・件数・プールサイズなどの設定
├── src/
│   ├── index.js             # エントリーポイント
│   ├── rakuten.js           # 楽天ランキングAPI呼び出し(複数件プール取得)
│   ├── formatTweet.js       # 投稿文の組み立て
│   ├── github.js            # 投稿案をGitHub Issueとして登録
│   └── history.json         # 提案済み商品コードの履歴(自動更新)
└── .github/workflows/
    └── daily-post.yml       # 週1回プールを補充するGitHub Actions定義
```
