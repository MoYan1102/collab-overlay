# 墨衍 × 星菓 聯動｜覆蓋層系統 v2

## 誰開哪一頁
| 檔案 | 用途 | 誰開 |
|---|---|---|
| `overlay.html` | 覆蓋層，加進 OBS「瀏覽器」來源 | 墨衍、星菓（OBS） |
| `player.html?side=p` | 星菓的出卡台（只有她的手牌＋臨時卡） | 星菓 |
| `control-act1.html` | 開場～辯題小故事～第一部情境題～中場 | 墨衍 |
| `control-court.html` | 法庭三輪、印章、最終裁決、收尾（也能代出雙方的卡） | 墨衍 |
| `chat-hub.html` | 聊天統計中心：抓 Twitch＋YouTube 聊天、自動計票、點留言上精選 | 墨衍（全程只開一個） |
| `data.js` | 題目、卡片、圖卡、賽事資訊文字 | 改內容時編輯 |
| `config.js` | 房間代號、Firebase 設定 | 設定一次 |

所有連結都要帶同一個 `?room=房間代號`（控制台上的「複製」按鈕會自動帶）。

## 自動計票規則
- 訊息開頭是 `1` 或 `2`（全形也算，後面可以接字，例如「1 痛苦但清醒」）才算票；「我選1」不算。
- 每位觀眾只算一票，以「最後一次」打的為準 → 改票就是倒戈。
- 三個按鈕（控制台、統計中心都有）：
  - **換題：清空** — 第一部每抽一題會自動按
  - **記為入席表態** — 辯題小故事結束時按
  - **法庭開庭：從入席起算** — 法庭第一輪開始前按；之後沒再打字的人維持入席立場，改票的人計入「倒戈」
- 控制台的 ± 是手動修正，加在自動票數上（例如有人在 Discord 投票）。

## 聊天室設定（在 chat-hub.html 填）
- **Twitch**：填頻道名稱即可，匿名唯讀，不需帳號。
- **YouTube**：需要 YouTube Data API 金鑰（Google Cloud Console → 啟用 YouTube Data API v3 → 建立 API 金鑰）＋直播網址。
  - 直播開始後才連得上（要有進行中的聊天室）。
  - 每 6 秒以上輪詢一次，每次耗 5 點；每日上限 10,000 點，2 小時約用 6,000 點。**彩排和正式不要同一天**（配額按太平洋時間午夜重置＝台灣下午 3 或 4 點）。
  - 金鑰只存在你這台電腦的瀏覽器，不會上傳。建議在 Google Cloud 把金鑰限制為只能用 YouTube Data API。

## 雲端同步（Firebase，免費）
1. Firebase Console 建立專案 → 建立 **Realtime Database**（地區選新加坡）
2. 專案設定 → 新增「網頁應用程式」→ 把設定貼進 `config.js` 的 `firebase`（要包含 `databaseURL`）
3. `room` 改成一串別人猜不到的字
4. Realtime Database → 規則：
```json
{ "rules": { ".read": false, ".write": false,
  "rooms": { "$room": { ".read": true, ".write": true } } } }
```

## 本機測試
1. 資料夾內執行 `python -m http.server 8000`
2. 開 `http://localhost:8000/chat-hub.html?demo=1`（會產生假留言）
3. 再開 `control-act1.html`、`control-court.html`、`player.html?side=p`，同一個瀏覽器的分頁會互相同步

## 給星菓
- OBS：新增「瀏覽器」來源，貼 overlay 網址，寬 1920、高 1080，放在角色圖層上方
- 出卡：開墨衍給的 `player.html` 連結。點卡＝出牌、再點＝收回；可以臨時寫一張新卡

## 版面位置
`overlay.html` 最上方的 `--main-x / --vote-x / --feat-y` 等變數控制各區塊位置，拿到雙方直播截圖後調整。
