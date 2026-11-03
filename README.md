# sample-cf-workers-d1

方式②（標準・アプリ + DB）のサンプル。Cloudflare Workers + Hono + D1 + Drizzle で作ったメモ帳の API と、Terraform で管理する Access（`/admin` にログインを付ける）。

- 公開先：https://sample-cf-workers-d1.alphajinsei.com
- 全体の方針と、どの方式でも共通の決まりごと：[サービス開発ガイド](https://github.com/alphajinsei/cf-infra-playbook/blob/main/docs/service-guide.md)（手元では `~/claude-sandbox/infra/docs/service-guide.md`）

## 1. この方式の用途

向いているもの：データを保存・検索するアプリ全般（フォーム、メモ、小さな管理画面、JSON の API、HTTP で呼ばれる Bot の Webhook）。既定の選択肢。

向いていないもの：常駐プロセス、WebSocket の常時接続、重い計算（1リクエストの CPU 時間に上限がある）、Node.js 専用のライブラリが必須なもの、PostgreSQL が必須なもの。これらは方式③（汎用VM）。

## 2. 構成と主なファイル

```
 Browser --> edge --+-- /admin/*  --> Access (login) --+
                    |                                  |
                    +-- file in public/? --> return it  |
                    |                                  v
                    +-- otherwise ---------------> Worker (src/index.ts, Hono)
                                                       |  binding "DB"
                                                       v
                                                     D1: sample-cf-workers-d1-db
```

| ファイル | 役割 |
| --- | --- |
| `wrangler.jsonc` | Worker の定義。名前、入口（`main`）、静的ファイル（`assets`）、カスタムドメイン、`workers_dev: false`、D1 のバインディング |
| `src/index.ts` | アプリ本体（Hono）。`GET /api/health`、`GET/POST /api/memos`、`DELETE /api/memos/:id` |
| `src/db/schema.ts` | テーブル定義の唯一の正（Drizzle）。アプリの型もここから決まる |
| `drizzle.config.ts` | drizzle-kit の設定（SQLite、出力先 `migrations/`） |
| `migrations/` | drizzle-kit が作ったマイグレーションの SQL と、比較用のスナップショット（`meta/`）。手で書かない |
| `public/` | そのまま返す静的ファイル（画面） |
| `worker-configuration.d.ts` | `npx wrangler types` が作る型（`Env` に `DB` が入る）。`wrangler.jsonc` を変えたら作り直す |
| `infra/terraform/` | Access（wrangler で扱えないもの）。`tf.sh` が `~/claude-sandbox/infra/.secrets/` の鍵を読んで terraform を実行する。state は R2 の `tfstate` バケット |

## 3. 手元での開発

```bash
npm install
npx wrangler d1 migrations apply DB --local   # 手元の D1 にテーブルを作る（初回と、マイグレーションを足したとき）
npm run dev                                   # http://localhost:8787
```

- `npm run dev`（`wrangler dev`）は本番と同じ workerd で動き、D1 は手元の SQLite ファイル（`.wrangler/state/`）を使う。本番の DB には触れない。
- 手元の DB の中身を見る：`npx wrangler d1 execute DB --local --command "SELECT * FROM memos"`

```bash
curl http://localhost:8787/api/memos
curl -X POST http://localhost:8787/api/memos -H "Content-Type: application/json" -d '{"text":"はじめてのメモ"}'
curl -X DELETE http://localhost:8787/api/memos/1 -i
```

### テーブルを変える

1. `src/db/schema.ts` を直す
2. `npx drizzle-kit generate` で `migrations/` に SQL ができる。中身を読む（列名の変更を「削除して追加」と解釈していないかなど）
3. `npx wrangler d1 migrations apply DB --local` → `npm run dev` で確かめる
4. `npm run deploy`（本番へのマイグレーションも一緒に流れる）

## 4. ビルドとデプロイ

```bash
npm run deploy
```

中身は `wrangler d1 migrations apply DB --remote && wrangler deploy`。

1. 本番の D1 に、まだ流していないマイグレーションを流す（流したものは D1 の中の `d1_migrations` テーブルに記録される）
2. TypeScript をまとめて、`public/` と一緒に Worker としてアップロードする。カスタムドメイン（DNS レコードと証明書）も、このとき作られる・更新される

マイグレーションが失敗したら、デプロイはされない。認証は `wrangler login`。

Access（Terraform）は別の操作：

```bash
cd infra/terraform
./tf.sh init      # 初回だけ
./tf.sh plan
./tf.sh apply     # 効くまで数分かかる
```

## 5. このサンプルから新しいサービスを始める

GitHub の Template repository にしてあるので、履歴なしでコピーできる。`<name>` は新しいサービスの名前（＝フォルダ名 ＝ リポジトリ名 ＝ Worker の名前 ＝ サブドメイン）。

```bash
cd ~/claude-sandbox
gh repo create <name> --template alphajinsei/sample-cf-workers-d1 --public --clone
cd <name>
npm install
npx wrangler d1 create <name>-db --location apac    # 出力された database_id を wrangler.jsonc に書く
```

書き換える場所：

| ファイル | 書き換えるところ |
| --- | --- |
| `package.json` | `name` |
| `wrangler.jsonc` | `name`、`routes[0].pattern`（`<name>.alphajinsei.com`）、`d1_databases[0].database_name`（`<name>-db`）と `database_id`。`compatibility_date` は今日の日付にする |
| `src/db/schema.ts` | メモのテーブルを、新しいサービスのテーブルに置き換える |
| `migrations/` | フォルダごと消してから `npx drizzle-kit generate` で作り直す（メモのテーブルの履歴を持ち込まない） |
| `src/index.ts` | メモの API を置き換える。`/api/health` は残してよい |
| `public/index.html` | 画面 |
| `infra/terraform/main.tf` | `locals` の `hostname`、リソースの `name`（`sample-cf-workers-d1: ...`）。Access が要らなければ `infra/` ごと消す |
| `infra/terraform/versions.tf` | backend の `key`（`<name>/terraform.tfstate`）。ここを変え忘れると、サンプルの state を上書きする |
| `README.md` | このファイルを新しいサービスの説明に書き直す（見出しはそのまま） |

書き換えたあと：

```bash
npx wrangler types                  # Env の型を作り直す
npx drizzle-kit generate
npx wrangler d1 migrations apply DB --local
npm run dev                         # 確かめる
npm run deploy                      # https://<name>.alphajinsei.com で公開
cd infra/terraform && ./tf.sh init && ./tf.sh apply   # Access を使うときだけ
```

- infra で Claude Code を開いて作業するなら、`~/claude-sandbox/infra/.claude/settings.json` の `additionalDirectories` に `~/claude-sandbox/<name>` を足す。
- コミットの作者のメールアドレスを隠すなら、最初のコミットの前に `git config user.email <ID>+alphajinsei@users.noreply.github.com`。

## 6. この方式の注意点

- **状態は D1 に置く。**グローバル変数やメモリ上の配列は、リクエストごとに別の isolate に当たると見えない。
- **スキーマは `schema.ts` からだけ変える。**本番に直接 DDL を流すと、Drizzle のスナップショットと実物がずれる（drizzle-kit は実物を見ないので気づけない）。
- **SQLite の制約。**`ALTER TABLE` でできることが少ない。既存のテーブルに `datetime('now')` のような既定値を持つ列は足せない（このサンプルの `updatedAt` が null 許容なのはそのため）。
- **トランザクションは `batch`。**`BEGIN`〜`COMMIT` を何往復かに分けて使えない。まとめて成功させたい SQL は `c.env.DB.batch([...])` で送る。
- **`npx wrangler rollback` で戻るのはコードだけ。**マイグレーションは戻らないので、列の削除などは、コードがその列を使わなくなってから別のデプロイで行う。
- **カスタムドメインは wrangler の管理。**同じ DNS レコードを Terraform に書かない。
- **Access は `workers_dev: false` とセットで。**workers.dev の URL が開いていると、Access を通らない迂回路になる。
- **ターミナルに `CLOUDFLARE_API_TOKEN` を残さない。**残すと `npm run deploy` が `wrangler login` ではなくそのトークンを使い、権限不足で失敗する。Terraform の鍵は `tf.sh` の中だけで読む。
