// ===== 兩個控制台共用的區塊：連線狀態、環節切換、投票、精選留言、說明條、預覽 =====
(function () {
  const D = window.SHOW_DATA;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const roomQ = '?room=' + encodeURIComponent(Sync.room);

  const SCENES = ['opening', 'event', 'story', 'act1', 'intermission', 'court', 'verdict', 'ending'];

  window.CC = { $, esc, D };

  window.buildCommon = function (rootId, opts = {}) {
    const root = $(rootId);
    root.innerHTML = `
    <section class="box">
      <div class="row between">
        <h2>環節</h2>
        <span id="cStatus" class="pill"></span>
      </div>
      <div class="grid scenes" id="cScenes">${SCENES.map(s => `<button data-scene="${s}">${D.sceneNames[s]}</button>`).join('')}</div>
    </section>

    <section class="box">
      <h2>預覽（overlay 實際畫面）</h2>
      <div class="pv"><iframe src="overlay.html${roomQ}&preview=1"></iframe></div>
      <div class="row small">
        <span>OBS 網址：</span><input id="cUrl" readonly><button id="cCopy">複製</button>
      </div>
    </section>

    <section class="box">
      <div class="row between"><h2>陪審團票數</h2><span id="hubSt" class="pill"></span></div>
      <div class="votes">
        <div class="vside s">
          <div class="vlabel">1 正方（蘇格拉底）<b id="vS">0</b><small id="vSa"></small></div>
          <div class="row">${[-5, -1, 1, 5].map(n => `<button data-v="S" data-n="${n}">${n > 0 ? '+' : ''}${n}</button>`).join('')}</div>
        </div>
        <div class="vside p">
          <div class="vlabel">2 反方（快樂的豬）<b id="vP">0</b><small id="vPa"></small></div>
          <div class="row">${[-5, -1, 1, 5].map(n => `<button data-v="P" data-n="${n}">${n > 0 ? '+' : ''}${n}</button>`).join('')}</div>
        </div>
      </div>
      <div class="row">
        <span>倒戈 <b id="vTurn" class="num" style="font-size:20px">0</b></span>
        <button data-t="-1">−1</button><button data-t="1">+1</button>
        <span class="sp"></span><label class="chk"><input type="checkbox" id="vShow"> 顯示投票區</label>
      </div>
      <div class="row">
        <button id="vClear">換題：清空</button>
        <button id="vBase" class="accent">記為入席表態</button>
        <button id="vRestore">法庭開庭：從入席起算</button>
      </div>
      <div class="muted" id="vBaseInfo"></div>
      <div class="muted">票數由「聊天統計中心」自動計算（Twitch 即時，YouTube 約 15 秒更新一次，請大家表態後等約 20 秒再看結果）；± 按鈕是手動修正，會加在自動票數上。</div>
    </section>

    <section class="box">
      <div class="row between"><h2>精選留言</h2><span id="fState" class="pill"></span></div>
      <div class="row">
        <select id="fKind"><option>精選留言</option><option>陪審團提問</option><option>倒戈證詞</option></select>
        <input id="fUser" placeholder="觀眾暱稱" style="flex:1">
      </div>
      <textarea id="fText" rows="2" placeholder="貼上留言內容"></textarea>
      <div class="row"><button id="fShow" class="accent">顯示</button><button id="fHide">收起</button></div>
    </section>

    <section class="box">
      <h2>說明條自訂文字</h2>
      <div class="row"><input id="bCustom" placeholder="留空 = 依環節自動顯示" style="flex:1"><button id="bSet">套用</button><button id="bClr">清除</button></div>
    </section>

    <section class="box danger">
      <div class="row between"><span class="muted">模式：${Sync.mode === 'cloud' ? '雲端同步' : '本機測試（僅同瀏覽器）'}　房間：${esc(Sync.room)}</span>
      <button id="cReset">全部重置</button></div>
    </section>`;

    const url = new URL('overlay.html' + roomQ, location.href).href;
    $('cUrl').value = url;
    $('cCopy').onclick = () => { navigator.clipboard?.writeText(url); $('cCopy').textContent = '已複製'; setTimeout(() => $('cCopy').textContent = '複製', 1200); };

    $('cScenes').onclick = e => {
      const s = e.target.dataset.scene; if (!s) return;
      const patch = { scene: s };
      if (opts.onScene) Object.assign(patch, opts.onScene(s) || {});
      Sync.update(patch);
    };

    root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      const k = 'adj' + b.dataset.v, v = Sync.get().votes;
      const autoN = b.dataset.v === 'S' ? v.s : v.p;
      Sync.update({ ['votes/' + k]: Math.max(-autoN, v[k] + Number(b.dataset.n)) });
    });
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const v = Sync.get().votes;
      Sync.update({ 'votes/adjTurn': Math.max(-v.turn, v.adjTurn + Number(b.dataset.t)) });
    });
    $('vClear').onclick = () => Sync.voteCmd('clear');
    $('vBase').onclick = () => Sync.voteCmd('base');
    $('vRestore').onclick = () => Sync.voteCmd('restore');
    $('vShow').onchange = e => Sync.update({ 'votes/show': e.target.checked });

    $('fShow').onclick = () => {
      if (!$('fText').value.trim()) { $('fText').focus(); return; }
      Sync.update({ featured: { kind: $('fKind').value, user: $('fUser').value.trim(), text: $('fText').value.trim(), show: true, t: Sync.now() } });
    };
    $('fHide').onclick = () => Sync.update({ 'featured/show': false });

    $('bSet').onclick = () => Sync.update({ 'bar/custom': $('bCustom').value.trim() });
    $('bClr').onclick = () => { $('bCustom').value = ''; Sync.update({ 'bar/custom': '' }); };

    $('cReset').onclick = () => { if (confirm('確定把所有狀態（票數、印章、已抽題）重置？')) Sync.reset(); };

    Sync.onStatus(s => {
      const m = { local: ['本機模式', 'warn'], online: ['已連線', 'ok'], offline: ['離線', 'bad'], connecting: ['連線中', 'warn'], error: ['載入失敗', 'bad'] }[s] || [s, 'warn'];
      $('cStatus').textContent = m[0]; $('cStatus').className = 'pill ' + m[1];
    });
    Sync.onChange(st => {
      root.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('on', b.dataset.scene === st.scene));
      const tot = Sync.totals(st), v = st.votes;
      $('vS').textContent = tot.s; $('vP').textContent = tot.p; $('vTurn').textContent = tot.turn;
      $('vSa').textContent = v.adjS ? `自動 ${v.s}｜修正 ${v.adjS > 0 ? '+' : ''}${v.adjS}` : '';
      $('vPa').textContent = v.adjP ? `自動 ${v.p}｜修正 ${v.adjP > 0 ? '+' : ''}${v.adjP}` : '';
      $('vShow').checked = v.show;
      $('vBaseInfo').textContent = v.hasBase ? `入席表態：正方 ${v.baseS}／反方 ${v.baseP}` : '尚未記錄入席表態';
      const on = Sync.hubOnline(st);
      const srcs = Object.entries(st.votes.src || {}).filter(([k, x]) => x && Sync.now() - (x.alive || 0) < 15000).map(([k]) => k);
      $('hubSt').textContent = on ? `自動統計運作中｜${Sync.srcSum(st).voters + (st.hub.voters || 0)} 人投票${srcs.length ? '｜' + srcs.join('、') : ''}` : '自動統計未開啟（僅手動）';
      $('hubSt').className = 'pill ' + (on ? 'ok' : 'warn');
      $('fState').textContent = st.featured.show ? '顯示中' : '未顯示';
      $('fState').className = 'pill ' + (st.featured.show ? 'ok' : '');
    });
  };
})();
