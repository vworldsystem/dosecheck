// app.js
const $ = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

const store = {
  key: "dosecheck-v1",
  read(){ try { return JSON.parse(localStorage.getItem(this.key)) || { items:[], settings:{reminders:true}, history:{} }; } catch(e){ return { items:[], settings:{reminders:true}, history:{} }; } },
  write(data){ localStorage.setItem(this.key, JSON.stringify(data)); }
};

const state = store.read();

function todayKey(d = new Date()){
  const tz = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  return tz;
}

function render(){
  const list = $("#items");
  list.innerHTML = "";
  const day = todayKey();
  const history = state.history[day] || {};
  state.items.forEach((it, idx)=>{
    const times = it.times || [];
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="pill"><strong>${it.name}</strong> <span class="small">(${times.length}회)</span></span>
        </div>
        <div class="small">목표 ${times.length}회 · <span id="p-${idx}" class="badge">0%</span></div>
      </div>
      <div class="list" id="list-${idx}"></div>
      <div class="row">
        <button class="ghost" data-edit="${idx}">시간 수정</button>
        <button class="ghost" data-reset="${idx}">오늘 기록 초기화</button>
        <button class="primary" data-done-all="${idx}">오늘 모두 복용 처리</button>
      </div>
    `;
    list.appendChild(row);
    const slot = $("#list-"+idx, row);
    times.forEach((t, j)=>{
      const k = `${idx}-${j}`;
      const checked = history[k] ? "done" : "";
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <div class="checkbox ${checked}" role="checkbox" data-check="${k}" aria-checked="${checked?'true':'false'}">${checked?'✓':''}</div>
          <div>
            <div><strong>${t}</strong> <span class="small">알림</span></div>
            <div class="small">체크시 오늘 ${it.name} ${j+1}회차 기록</div>
          </div>
        </div>
        <input type="time" value="${t}" data-time="${idx}:${j}" />
      `;
      slot.appendChild(item);
    });
    updateProgress(idx);
  });
  $("#empty").classList.toggle("hidden", state.items.length !== 0);
}

function updateProgress(idx){
  const day = todayKey();
  const it = state.items[idx];
  const times = it.times || [];
  const history = state.history[day] || {};
  const done = times.filter((_, j)=> history[`${idx}-${j}`]).length;
  const pct = times.length ? Math.round(done / times.length * 100) : 0;
  $("#p-"+idx).textContent = `${pct}%`;
}

function addDefault(name, count){
  // evenly distribute times from 08:00-22:00
  const start = 8, end = 22;
  const gap = (end - start) / (count-1 || 1);
  const times = Array.from({length:count}, (_,i)=>{
    const h = Math.round(start + i*gap);
    return `${String(h).padStart(2,'0')}:00`;
  });
  state.items.push({name, times});
  store.write(state);
  render();
}

function scheduleTick(){
  // check every minute for upcoming reminders within 0-1 minute window
  if (!state.settings.reminders) return;
  if (!("Notification" in window)) return;

  const now = new Date();
  const curHHMM = now.toTimeString().slice(0,5);
  const day = todayKey(now);
  const history = state.history[day] || {};
  state.items.forEach((it, idx)=>{
    (it.times||[]).forEach((t, j)=>{
      const key = `${idx}-${j}`;
      // Only notify once per time slot per day
      const notifiedKey = `notified-${day}-${key}`;
      const already = sessionStorage.getItem(notifiedKey);
      if (t === curHHMM && !already && !history[key]){
        sessionStorage.setItem(notifiedKey, "1");
        notify(`${it.name} 복용 시간`, `${j+1}회차 ${t} 입니다. 체크를 눌러 기록하세요.`);
      }
    });
  });
}

function notify(title, body){
  if (Notification.permission === "granted"){
    navigator.serviceWorker.getRegistration().then(reg=>{
      if (reg){
        reg.showNotification(title, {
          body,
          icon:"/dosecheck/icons/icon-192.png",
          badge:"/dosecheck/icons/icon-192.png",
          vibrate:[100,50,100]
        });
      } else {
        new Notification(title, {body});
      }
    });
  }
}

function ensureSW(){
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("/dosecheck/sw.js");
  }
}

function requestNotif(){
  if (!("Notification" in window)) return;
  if (Notification.permission === "default"){
    Notification.requestPermission();
  }
}

function bind(){
  document.body.addEventListener("click", (e)=>{
    const t = e.target;
    if (t.matches("[data-add]")){
      const name = $("#newName").value.trim() || "비타민C";
      const mode = $("#mode").value;
      const count = mode === "3" ? 3 : (mode === "6" ? 6 : Number($("#customCount").value || 3));
      addDefault(name, count);
      $("#newName").value = "";
    }
    if (t.matches("[data-check]")){
      const key = t.getAttribute("data-check");
      const day = todayKey();
      state.history[day] = state.history[day] || {};
      state.history[day][key] = !state.history[day][key];
      store.write(state);
      t.classList.toggle("done");
      t.textContent = t.classList.contains("done") ? "✓" : "";
      updateProgress(Number(key.split("-")[0]));
    }
    if (t.matches("[data-reset]")){
      const idx = Number(t.getAttribute("data-reset"));
      const day = todayKey();
      Object.keys(state.history[day]||{}).forEach(k=>{
        if (k.startsWith(idx+"-")) delete state.history[day][k];
      });
      store.write(state);
      render();
    }
    if (t.matches("[data-done-all]")){
      const idx = Number(t.getAttribute("data-done-all"));
      const day = todayKey();
      state.history[day] = state.history[day] || {};
      (state.items[idx].times||[]).forEach((_, j)=> state.history[day][`${idx}-${j}`] = true);
      store.write(state);
      render();
    }
    if (t.matches("[data-edit]")){
      const idx = Number(t.getAttribute("data-edit"));
      const name = prompt("이 항목의 이름을 수정할까요?", state.items[idx].name);
      if (name !== null){
        state.items[idx].name = name.trim() || state.items[idx].name;
        store.write(state);
        render();
      }
    }
    if (t.matches("#export")){
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "dosecheck-backup.json";
      a.click();
      URL.revokeObjectURL(url);
    }
    if (t.matches("#import")){
      $("#importFile").click();
    }
  });

  $("#importFile").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const data = JSON.parse(reader.result);
        Object.assign(state, data);
        store.write(state);
        render();
        alert("복구 완료!");
      }catch(err){ alert("가져오기 실패: 올바른 파일이 아닙니다."); }
    };
    reader.readAsText(file);
  });

  document.body.addEventListener("change", (e)=>{
    const t = e.target;
    if (t.matches("input[type='time'][data-time]")){
      const [idx, j] = t.getAttribute("data-time").split(":").map(Number);
      state.items[idx].times[j] = t.value;
      store.write(state);
      render();
    }
    if (t.matches("#mode")){
      $("#customWrap").classList.toggle("hidden", t.value !== "custom");
    }
    if (t.matches("#toggleRemind")){
      state.settings.reminders = t.checked;
      store.write(state);
    }
  });
}

function init(){
  ensureSW();
  requestNotif();
  // Seed example if empty
  if (state.items.length === 0){
    state.items.push({name:"비타민C", times:["08:00","14:00","20:00"]});
    store.write(state);
  }
  $("#toggleRemind").checked = !!state.settings.reminders;
  render();
  setInterval(scheduleTick, 30*1000);
}

window.addEventListener("load", init);