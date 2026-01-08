# cc-notify-app

[English](./README.md)

Claude Code の Permission Request を Discord に通知し、リモートから承認/却下できるツール。

## 概要

Claude Code の `PreToolUse` hook と連携し、ツール実行前にインターセプト。
パーミッション設定をチェックし、承認が必要なツールのみ Discord に通知します。

```
Claude Code  →  PreToolUse Hook  →  パーミッションチェック  →  Discord Bot  →  Discord
                                          ↓                                      ↓
                                    自動 allow/deny                         ボタンクリック
                                    (設定に基づく)                                ↓
Claude Code  ←  Hook レスポンス   ←  WebSocket Server   ←  Discord Bot
```

## 機能

- **スマートパーミッションチェック**: Claude Code の `settings.json` から allow/deny/ask ルールを読み込み
- **デフォルト許可ツール**: 読み取り専用ツール（Read, Glob, Grep 等）は自動承認
- **Discord 承認**: allow リストにないツールは Discord で承認を要求
- **リッチ表示**: Edit は diff、Bash はコマンド、Write はファイルパスを表示
- **承認/却下ボタン**: ワンクリックで承認または理由付き拒否
- **タイムアウト**: 10分間応答がなければ Claude Code 側で確認

## セットアップ

### 1. Discord Bot の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」でアプリ作成
3. 「Bot」タブで「Reset Token」をクリックしてトークンをコピー
4. 「OAuth2」→「URL Generator」で以下を選択:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`
5. 生成された URL で Bot をサーバーに招待

### 2. インストール

```bash
git clone https://github.com/tanabe1478/cc-notify-app.git
cd cc-notify-app
pnpm install
pnpm build
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集:

```
DISCORD_BOT_TOKEN=<Botトークン>
DISCORD_CHANNEL_ID=<通知先チャンネルID>
```

チャンネル ID の取得方法:
1. Discord の設定 → 詳細設定 → 開発者モードを有効化
2. チャンネルを右クリック → 「IDをコピー」

### 4. Claude Code の Hook 設定

以下の JSON を Claude Code の設定に追加:

#### グローバル設定（全プロジェクト共通）

`~/.claude/settings.json` に保存:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/cc-notify-app/scripts/hook-wrapper.sh",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

#### リポジトリごとの設定

プロジェクトルートに `.claude/settings.json` または `.claude/settings.local.json` を作成:

| ファイル | 用途 |
|----------|------|
| `.claude/settings.json` | チームで共有（Git 管理） |
| `.claude/settings.local.json` | 個人用（.gitignore 推奨） |

## パーミッションチェックの仕組み

Hook は Claude Code の設定ファイルからパーミッションルールを読み込みます（優先順）:
1. `~/.claude/settings.json` (グローバル)
2. `~/.claude/settings.local.json` (グローバルローカル)
3. `.claude/settings.json` (プロジェクト)
4. `.claude/settings.local.json` (プロジェクトローカル)

### 判定ロジック

1. **deny リストにマッチ** → 自動拒否（Discord 通知なし）
2. **allow リストにマッチ** → 自動許可（Discord 通知なし）
3. **ask リストにマッチ** → Discord で承認を要求
4. **デフォルト許可ツール** → 自動許可（Discord 通知なし）
5. **それ以外** → Discord で承認を要求

### デフォルト許可ツール

以下の読み取り専用ツールは Discord 通知なしで自動承認:
- `Read` - ファイル読み込み
- `Glob` - ファイルパターンマッチング
- `Grep` - コンテンツ検索
- `Task` - サブエージェント起動
- `WebSearch` - Web 検索
- `TodoRead` / `TodoWrite` - Todo 管理
- `AskUserQuestion` - ユーザープロンプト

### パーミッション設定例

```json
{
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(git status:*)"
    ],
    "deny": [
      "Bash(sudo:*)",
      "Bash(rm -rf:*)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Bash(curl:*)"
    ]
  }
}
```

## 使い方

### 1. サーバーを起動

#### macOS アプリ（推奨）

メニューバー常駐アプリでサーバーを管理:

```bash
# ビルド
cd macos/CCNotify
xcodegen generate
xcodebuild -scheme CCNotify -configuration Release build

# アプリを Applications にコピー
cp -r ~/Library/Developer/Xcode/DerivedData/CCNotify-*/Build/Products/Release/CC\ Notify.app /Applications/
```

メニューバーのベルアイコンから「Start Server」をクリック。

#### コマンドライン

```bash
cd /path/to/cc-notify-app

# 開発モード
pnpm dev:server

# 本番モード
pnpm start:server
```

### 2. Claude Code を使う

通常通り Claude Code を使用。権限要求が発生すると Discord に通知が届く。

### 3. Discord で承認/却下

- **Approve**: 緑ボタン - 許可
- **Deny**: 赤ボタン - 拒否（理由入力モーダルが表示される）

## バックグラウンド実行（コマンドライン版）

### macOS (launchd)

`~/Library/LaunchAgents/com.cc-notify-app.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cc-notify-app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/node</string>
        <string>/path/to/cc-notify-app/dist/server/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/cc-notify-app</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>DISCORD_BOT_TOKEN</key>
        <string>your_token</string>
        <key>DISCORD_CHANNEL_ID</key>
        <string>your_channel_id</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/cc-notify-app.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cc-notify-app.error.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.cc-notify-app.plist
```

### Linux (systemd)

`~/.config/systemd/user/cc-notify-app.service`:

```ini
[Unit]
Description=Claude Code Discord Notification Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/cc-notify-app
ExecStart=/path/to/node /path/to/cc-notify-app/dist/server/index.js
Environment=DISCORD_BOT_TOKEN=your_token
Environment=DISCORD_CHANNEL_ID=your_channel_id
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable cc-notify-app
systemctl --user start cc-notify-app
```

## 環境変数

| 変数 | 必須 | デフォルト | 説明 |
|------|------|------------|------|
| `DISCORD_BOT_TOKEN` | Yes | - | Discord Bot トークン |
| `DISCORD_CHANNEL_ID` | Yes | - | 通知先チャンネル ID |
| `WEBSOCKET_PORT` | No | `3847` | WebSocket サーバーポート |
| `CC_NOTIFY_WS_URL` | No | `ws://localhost:3847` | Hook が接続する WebSocket URL |
| `CC_NOTIFY_TIMEOUT` | No | `600000` | タイムアウト (ミリ秒) |

## 開発

```bash
# テスト実行
pnpm test

# ビルド
pnpm build

# 開発モードでサーバー起動
pnpm dev:server

# Hook を手動テスト
echo '{"session_id":"test","cwd":"/tmp","permission_mode":"default","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' | ./scripts/hook-wrapper.sh
```

## ライセンス

MIT
