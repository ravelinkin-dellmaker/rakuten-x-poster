# rakuten-x-poster

楽天アフィリエイトの人気ランキング商品を、週1回まとめて「投稿案プール」として用意する専用Webアプリ。
**Xへの投稿自体は手動**(Webアプリでコピーして自分でポストする)。

## 使い方(完成後のイメージ)

`https://<あなたのアカウント>.github.io/rakuten-x-poster/` をスマホのホーム画面に追加しておく。

1. 週1回、自動でおすすめ商品カードが5件補充される
2. カードの「📋 コピー」を押す → Xを開いて貼り付けて投稿
3. 投稿し終わったら「✅ 投稿済みにする」を押す(自分の端末だけに記録される)

---

## なぜ完全自動投稿にしないのか

楽天アフィリエイトの[公式ガイドライン](https://affiliate.rakuten.co.jp/guideline/rule/)には、
「スクリプトや外部プログラムを使い、機械的に投稿やコメントを行う行為」を禁止する規定があり、
実際に警告を受けた事例も報告されている([参考記事](https://note.com/etc_999/n/n64862c4ad6de))。
違反するとアカウント停止・報酬没収のリスクがある。

そのため、このツールは**投稿文の作成まで**を自動化し、実際にXへ投稿するボタンを押すのは人間(あなた)にしている。
これにより:
- 楽天の禁止事項(機械的な自動投稿)に抵触しない
- X Developer Portalでのアプリ申請・APIキー取得が不要になる(投稿用APIを使わないため)

---

## 1. 必要なもの

### 楽天API
1. [楽天ウェブサービス](https://webservice.rakuten.co.jp/) にアプリ登録し、**アプリケーションID**と**アクセスキー(`pk_`から始まる文字列)**を取得する(アプリケーションタイプは「WEB」、許可されたWebサイトは投稿先のXアカウントのドメイン`x.com`など)。
   - 2026年のAPI移行により、この2つがセットで必須になった。
   - APIリクエストには、登録した許可サイトと同じ`Referer`・`Origin`ヘッダーの両方が必要(`src/rakuten.js`で対応済み)。
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

`DRY_RUN=false` で実行すると `docs/pool.json` が生成される。`npx http-server docs` などでローカル確認できる。

---

## 3. GitHubにpush・Pages公開・Actions自動化

1. GitHubリポジトリを作りpush、Secretsに `RAKUTEN_APP_ID` / `RAKUTEN_ACCESS_KEY` / `RAKUTEN_AFFILIATE_ID` を登録する。
2. **Settings > Pages** で、Source を「Deploy from a branch」、Branch を `main` / `docs` に設定して保存する。
   - 数分で `https://<あなたのアカウント>.github.io/rakuten-x-poster/` が公開される。
3. **Actions** タブ → `Rakuten Affiliate Pool Refill` → **Run workflow** で手動実行して動作確認する。
   - `dry_run` を `true` にすれば `pool.json` を更新せずログだけ確認できる。
4. 成功すると `docs/pool.json` が更新・commitされ、Webアプリに反映される。
5. 問題なければ毎日 `.github/workflows/daily-post.yml` の cron (`0 0 * * *` = 毎日9時JST) で自動的にプールが補充される。

---

## 4. カスタマイズ

`config.json` を編集する:

```json
{
  "genreId": "0",
  "genreLabel": "総合",
  "period": "realtime",
  "historySize": 60,
  "poolSize": 2,
  "referer": "https://x.com/",
  "maxPoolDisplay": 20
}
```

- `genreId`: 楽天ジャンルID。`0` は総合(全ジャンル)。特定ジャンルに絞りたい場合は
  [楽天ジャンル検索](https://webservice.rakuten.co.jp/explorer/api/IchibaGenre/Search/) や、
  楽天市場のカテゴリページURL末尾の数字から調べて差し替える(例: 家電=100804、コスメ=100939 など。時期により変わるため要確認)。
- `genreLabel`: 投稿文とハッシュタグに使う日本語ラベル。
- `period`: `realtime` / `daily` / `weekly` / `monthly` から選択。
- `historySize`: 直近何件を「提案済み」として重複を避けるか(ランキング取得時の重複防止用)。
- `poolSize`: 1回の実行で何件の投稿案を新規追加するか。
- `referer` / `Origin`: 楽天アプリ登録時の「許可されたWebサイト」と一致させること。
- `maxPoolDisplay`: Webアプリに表示するプールの最大件数(古いものから溢れて消える)。

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
│   ├── rakuten.js           # 楽天ランキングAPI呼び出し(Referer/Origin対応)
│   ├── formatTweet.js       # 投稿文の組み立て
│   ├── pool.js              # pool.jsonのマージ・整形
│   └── history.json         # 提案済み商品コードの履歴(自動更新)
├── docs/
│   ├── index.html           # 専用Webアプリ本体(GitHub Pagesで公開)
│   └── pool.json            # 投稿案プールのデータ(自動更新)
└── .github/workflows/
    └── daily-post.yml       # 週1回プールを補充するGitHub Actions定義
```
