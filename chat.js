// ===== 聊天室連線：Twitch（匿名唯讀 IRC）＋ YouTube（Data API 輪詢）=====
// 每則訊息統一格式：{ platform: 'tw'|'yt', source, uid, name, text, ts }

window.ChatSources = (function () {

  // ---------- Twitch ----------
  // 匿名登入（justinfan）只能讀，不需要任何帳號或金鑰。
  function twitch(channel, onMsg, onStatus) {
    channel = channel.replace(/^#/, '').trim().toLowerCase();
    let ws = null, closed = false, retry = 1000;
    function parseTags(raw) {
      const o = {};
      raw.slice(1).split(';').forEach(kv => { const i = kv.indexOf('='); o[kv.slice(0, i)] = kv.slice(i + 1); });
      return o;
    }
    function open() {
      onStatus('connecting');
      ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags');
        ws.send('PASS SCHMOOPIIE');
        ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
        ws.send('JOIN #' + channel);
      };
      ws.onmessage = e => {
        for (const line of e.data.split('\r\n')) {
          if (!line) continue;
          if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); continue; }
          if (line.includes(' JOIN #' + channel)) { onStatus('online'); retry = 1000; continue; }
          const m = line.match(/^(@\S+) :(\w+)!\S+ PRIVMSG #\S+ :(.*)$/);
          if (!m) continue;
          const tags = parseTags(m[1]);
          onMsg({
            platform: 'tw', source: channel,
            uid: 'tw:' + (tags['user-id'] || m[2]),
            name: tags['display-name'] || m[2],
            text: m[3], ts: Date.now(),
          });
        }
      };
      ws.onclose = () => {
        if (closed) { onStatus('off'); return; }
        onStatus('retrying');
        setTimeout(open, retry); retry = Math.min(retry * 2, 15000);
      };
      ws.onerror = () => {};
    }
    open();
    return { stop() { closed = true; ws && ws.close(); } };
  }

  // ---------- YouTube ----------
  // 需要 YouTube Data API 金鑰；每次輪詢耗 5 點配額（每日預設 10,000 點，太平洋時間午夜重置）。
  // 最短 6 秒輪詢一次：2 小時約 1,200 次 ＝ 6,000 點，保留彩排的空間。
  function youtube(apiKey, videoId, onMsg, onStatus, onQuota, minInterval = 6000) {
    const API = 'https://www.googleapis.com/youtube/v3/';
    let stopped = false, timer = null, chatId = '', pageToken = '';
    const startedAt = Date.now();
    videoId = parseVideoId(videoId);

    async function get(url) {
      const r = await fetch(url);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || r.status);
      return j;
    }
    async function init() {
      onStatus('connecting');
      try {
        const v = await get(`${API}videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`);
        onQuota(1);
        chatId = v.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
        if (!chatId) { onStatus('error', '找不到進行中的聊天室（直播還沒開始，或影片 ID 錯誤）'); return; }
        poll();
      } catch (e) { onStatus('error', e.message); }
    }
    async function poll() {
      if (stopped) return;
      let wait = minInterval;
      try {
        const j = await get(`${API}liveChat/messages?liveChatId=${chatId}&part=snippet,authorDetails&maxResults=2000&key=${apiKey}` + (pageToken ? `&pageToken=${pageToken}` : ''));
        onQuota(5);
        onStatus('online');
        pageToken = j.nextPageToken || pageToken;
        wait = Math.max(minInterval, j.pollingIntervalMillis || 0);
        for (const it of j.items || []) {
          const t = Date.parse(it.snippet.publishedAt);
          if (t < startedAt - 5000) continue;   // 略過連線前的舊訊息
          if (it.snippet.type !== 'textMessageEvent' && it.snippet.type !== 'superChatEvent') continue;
          onMsg({
            platform: 'yt', source: videoId,
            uid: 'yt:' + it.authorDetails.channelId,
            name: it.authorDetails.displayName,
            text: it.snippet.displayMessage || '', ts: t,
          });
        }
      } catch (e) {
        onStatus('error', e.message);
        if (/quota/i.test(e.message)) return;   // 配額用完就停
        wait = 15000;
      }
      timer = setTimeout(poll, wait);
    }
    init();
    return { stop() { stopped = true; clearTimeout(timer); onStatus('off'); } };
  }

  function parseVideoId(s) {
    s = s.trim();
    const m = s.match(/(?:v=|youtu\.be\/|live\/)([\w-]{11})/);
    return m ? m[1] : s;
  }

  // 投票判定：訊息開頭是 1 或 2（含全形），後面可接空白與其他字，例如「1 痛苦但清醒」
  function parseVote(text) {
    const m = String(text).trim().match(/^([12１２])(?:\s|$)/);
    if (!m) return '';
    return (m[1] === '1' || m[1] === '１') ? 's' : 'p';
  }

  return { twitch, youtube, parseVote };
})();
