// ===== 同步層 =====
// 雲端模式（Firebase）：控制台寫入 → 所有覆蓋層即時更新。
// 本機模式：同一瀏覽器的分頁之間同步（BroadcastChannel + localStorage），僅供測試。

(function () {
  const cfg = window.APP_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const ROOM = params.get('room') || cfg.room || 'default';

  const DEFAULT_STATE = {
    scene: 'opening',
    story: { idx: 0 },
    evt: { idx: 0 },
    inter: { idx: 0 },
    act1: { q: -1, twist: false, drawT: 0, used: {} },
    court: {
      round: 1,
      phase: '',
      card: { side: '', id: '', t: 0, custom: { type: 'arg', title: '', body: '' } },
      used: {},
      timer: { start: 0, dur: 120, running: false, label: '' },
      stamps: { r1: '', r2: '', r3: '' },
      stampEvt: { side: '', round: 0, t: 0 },
    },
    // s/p/turn 由聊天統計頁（chat-hub）自動寫入；adj* 為手動修正，畫面顯示 = 自動 + 手動
    votes: {
      s: 0, p: 0, turn: 0,
      adjS: 0, adjP: 0, adjTurn: 0,
      baseS: 0, baseP: 0, baseAdjS: 0, baseAdjP: 0, hasBase: false,
      show: true,
      cmd: { type: '', t: 0 },
    },
    hub: { alive: 0, voters: 0 },
    featured: { kind: '精選留言', user: '', text: '', show: false, t: 0 },
    bar: { custom: '' },
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(def, src) {
    if (src === undefined || src === null) return clone(def);
    if (typeof def !== 'object' || def === null) return src;
    const out = {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], src[k]);
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out;
  }
  function setPath(obj, path, val) {
    const keys = path.split('/');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof o[keys[i]] !== 'object' || o[keys[i]] === null) o[keys[i]] = {};
      o = o[keys[i]];
    }
    if (val === null) delete o[keys[keys.length - 1]];
    else o[keys[keys.length - 1]] = val;
  }

  let state = clone(DEFAULT_STATE);
  let offset = 0;
  const listeners = [];
  const statusListeners = [];
  let status = 'connecting';
  const emit = () => listeners.forEach(fn => fn(state));
  const setStatus = s => { status = s; statusListeners.forEach(fn => fn(s)); };

  const Sync = {
    room: ROOM,
    mode: cfg.firebase ? 'cloud' : 'local',
    defaults: DEFAULT_STATE,
    get: () => state,
    now: () => Date.now() + offset,
    onChange(fn) { listeners.push(fn); fn(state); },
    onStatus(fn) { statusListeners.push(fn); fn(status); },
    update(patch) {},
    reset() { this.set(clone(DEFAULT_STATE)); },
    set(full) {},
  };

  if (!cfg.firebase) {
    // ---- 本機模式 ----
    const KEY = 'collab-state-' + ROOM;
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel(KEY) : null;
    try { state = merge(DEFAULT_STATE, JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) {}
    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      if (bc) bc.postMessage(state);
      emit();
    };
    // 先讀回其他分頁的最新狀態再套用，避免分頁之間互相覆蓋
    const reload = () => { try { const s = localStorage.getItem(KEY); if (s) state = merge(DEFAULT_STATE, JSON.parse(s)); } catch (e) {} };
    Sync.update = patch => { reload(); for (const [p, v] of Object.entries(patch)) setPath(state, p, v); save(); };
    Sync.set = full => { state = merge(DEFAULT_STATE, full); save(); };
    if (bc) bc.onmessage = e => { state = merge(DEFAULT_STATE, e.data); emit(); };
    window.addEventListener('storage', e => {
      if (e.key === KEY && e.newValue) { state = merge(DEFAULT_STATE, JSON.parse(e.newValue)); emit(); }
    });
    setTimeout(() => setStatus('local'), 0);
  } else {
    // ---- 雲端模式 ----
    const V = '10.12.2';
    const load = src => new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
    });
    let ref = null;
    const queue = [];
    Sync.update = patch => { if (ref) ref.update(patch); else queue.push(patch); };
    Sync.set = full => { if (ref) ref.set(full); };
    load(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`)
      .then(() => load(`https://www.gstatic.com/firebasejs/${V}/firebase-database-compat.js`))
      .then(() => {
        firebase.initializeApp(cfg.firebase);
        const db = firebase.database();
        ref = db.ref('rooms/' + ROOM);
        db.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
        db.ref('.info/connected').on('value', s => setStatus(s.val() ? 'online' : 'offline'));
        ref.on('value', s => { state = merge(DEFAULT_STATE, s.val() || {}); emit(); });
        queue.splice(0).forEach(p => ref.update(p));
      })
      .catch(() => setStatus('error'));
  }

  // 畫面上的票數 = 聊天自動統計 + 手動修正
  Sync.totals = (st = state) => {
    const v = st.votes;
    return {
      s: Math.max(0, v.s + v.adjS),
      p: Math.max(0, v.p + v.adjP),
      turn: Math.max(0, v.turn + v.adjTurn),
    };
  };
  Sync.hubOnline = (st = state) => Sync.now() - (st.hub.alive || 0) < 15000;

  // 共用投票指令：控制台送出，聊天統計頁同步處理自己的選票紀錄
  Sync.voteCmd = type => {
    const st = state, v = st.votes, tot = Sync.totals(st);
    const patch = { 'votes/cmd': { type, t: Sync.now() } };
    if (type === 'clear') {
      Object.assign(patch, { 'votes/s': 0, 'votes/p': 0, 'votes/adjS': 0, 'votes/adjP': 0, 'votes/turn': 0, 'votes/adjTurn': 0 });
    } else if (type === 'base') {
      Object.assign(patch, { 'votes/baseS': tot.s, 'votes/baseP': tot.p, 'votes/baseAdjS': v.adjS, 'votes/baseAdjP': v.adjP, 'votes/hasBase': true, 'votes/turn': 0, 'votes/adjTurn': 0 });
    } else if (type === 'restore') {
      Object.assign(patch, {
        'votes/s': Math.max(0, v.baseS - v.baseAdjS), 'votes/p': Math.max(0, v.baseP - v.baseAdjP),
        'votes/adjS': v.baseAdjS, 'votes/adjP': v.baseAdjP, 'votes/turn': 0, 'votes/adjTurn': 0,
      });
    }
    Sync.update(patch);
  };

  window.Sync = Sync;
})();
