/* ===========================================================
   Cadence — local-only routine + to-do tracker
   All data lives in this device's localStorage. No network, no cloud.
   =========================================================== */
(function () {
  'use strict';

  const STORE = 'cadence.v1';
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const COLORS = {
    teal:   {dot:'var(--c-360)', bg:'var(--c-360-bg)'},
    indigo: {dot:'var(--c-321)', bg:'var(--c-321-bg)'},
    amber:  {dot:'var(--c-421)', bg:'var(--c-421-bg)'},
    rose:   {dot:'var(--c-304)', bg:'var(--c-304-bg)'},
    slate:  {dot:'var(--c-custom)', bg:'var(--c-custom-bg)'}
  };

  /* ---------- date / time helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const todayStr = () => dateStrOf(new Date());
  const dateStrOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate = ds => { const [y,m,d]=ds.split('-').map(Number); return new Date(y,m-1,d); };
  const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  const nowMin = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const isSameDay = (a,b) => dateStrOf(a)===dateStrOf(b);
  // pretty 12-hour time: "11 AM", "12:30 PM" (drops :00 on round hours)
  function fmtNice(t){ let [h,m]=t.split(':').map(Number); const ap=h>=12?'PM':'AM'; h=h%12||12; return m===0?`${h} ${ap}`:`${h}:${pad(m)} ${ap}`; }
  function prettyDate(ds){
    const t=todayStr();
    if(ds===t) return 'Today';
    const yd=new Date(); yd.setDate(yd.getDate()-1);
    if(ds===dateStrOf(yd)) return 'Yesterday';
    const tm=new Date(); tm.setDate(tm.getDate()+1);
    if(ds===dateStrOf(tm)) return 'Tomorrow';
    return parseDate(ds).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
  }
  function relLabel(d){
    if(isSameDay(d,new Date())) return 'Today';
    const r=relDays(dateStrOf(d));
    if(r===-1) return 'Tomorrow';
    if(r===1) return 'Yesterday';
    return DAYS[d.getDay()];
  }
  function relDays(ds){ const a=new Date(todayStr()), b=parseDate(ds); return Math.round((a-b)/86400000); }

  /* ---------- seed routine (from uploaded timetable) ---------- */
  function seedEvents(){
    const C = {
      CSE360:{color:'teal',  section:'08', faculty:'UJT'},
      CSE321:{color:'indigo',section:'14', faculty:'SHBK'},
      CSE421:{color:'amber', section:'01', faculty:'ARF'},
      CST304:{color:'rose',  section:'01', faculty:'MFC'}
    };
    const R = [
      ['CSE360',2,'08:00','09:20','10G','33L'],
      ['CSE360',2,'09:30','10:50','10G','33L'],
      ['CSE321',4,'09:30','10:50','09A','01C'],
      ['CSE321',6,'09:30','10:50','09A','01C'],
      ['CSE321',0,'11:00','12:20','10G','34L'],
      ['CSE360',1,'11:00','12:20','10B','15C'],
      ['CSE360',3,'11:00','12:20','10B','15C'],
      ['CSE321',0,'12:30','13:50','10G','34L'],
      ['CSE421',1,'12:30','13:50','10B','16C'],
      ['CSE421',3,'12:30','13:50','10B','16C'],
      ['CSE421',6,'14:00','15:20','12D','26C'],
      ['CSE421',6,'15:30','16:50','12D','26L'],
      ['CST304',1,'17:00','18:20','09G','29C'],
      ['CST304',3,'17:00','18:20','09G','29C']
    ];
    return R.map(([course,day,start,end,block,room]) => ({
      id:uid(), type:'class', title:course,
      course, section:C[course].section, faculty:C[course].faculty,
      block, room, day, start, end, color:C[course].color
    }));
  }

  /* ---------- persistence ---------- */
  let db;
  function load(){
    try{ db = JSON.parse(localStorage.getItem(STORE)); }catch(e){ db = null; }
    if(!db || !db.events){
      db = { events: seedEvents(), todos: [], meta:{ theme:'auto', lastRollover:'' } };
      save();
    }
    if(!db.meta) db.meta = { theme:'auto', lastRollover:'' };
  }
  function save(){ try{ localStorage.setItem(STORE, JSON.stringify(db)); }catch(e){ toast('Storage full — could not save'); } }

  /* ---------- rollover: unfinished tasks move to today ---------- */
  function rollover(){
    const t = todayStr();
    if(db.meta.lastRollover === t) return;
    let moved = 0;
    db.todos.forEach(td => {
      if(!td.done && td.date < t){
        td.carried = (td.carried||0) + relDays(td.date);
        td.date = t;
        moved++;
      }
    });
    db.meta.lastRollover = t;
    save();
    if(moved) setTimeout(()=>toast(`${moved} task${moved>1?'s':''} carried over to today`),600);
  }

  /* ---------- theme ---------- */
  function applyTheme(){
    const m = db.meta.theme;
    const dark = m==='dark' || (m==='auto' && matchMedia('(prefers-color-scheme:dark)').matches);
    document.documentElement.setAttribute('data-theme', dark?'dark':'light');
    document.querySelector('meta[name=theme-color]').setAttribute('content', dark?'#121317':'#0F766E');
    const ic = document.getElementById('theme-icon');
    ic.innerHTML = dark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
  }
  function cycleTheme(){
    const order = ['auto','light','dark'];
    db.meta.theme = order[(order.indexOf(db.meta.theme)+1)%3];
    save(); applyTheme();
    toast(`Theme: ${db.meta.theme}`);
  }

  /* ===========================================================
     RENDERING
     =========================================================== */
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; };

  function eventSubtitle(e){
    if(e.type==='class'){
      const loc = [e.block, e.room].filter(Boolean).join(' · ');
      return `Sec ${e.section} · ${e.faculty}${loc?' · '+loc:''}`;
    }
    return [e.section,e.faculty,e.block,e.room].filter(Boolean).join(' · ') || e.location || '';
  }
  function eventName(e){ return e.type==='class' ? e.course : e.title; }

  // events occurring on a given date: recurring (match weekday, no date) + one-off (exact date)
  function eventsForDate(d){
    const ws=d.getDay(), ds=dateStrOf(d);
    return db.events.filter(e => e.date ? e.date===ds : e.day===ws)
                    .sort((a,b)=>toMin(a.start)-toMin(b.start));
  }

  /* ----- TODAY (date-browsable day view) ----- */
  let viewDate = new Date();
  function renderToday(){
    const d = viewDate;
    const isTod = isSameDay(d, new Date());
    $('#today-eyebrow').textContent = relLabel(d);
    $('#today-date').textContent = d.toLocaleDateString(undefined,{month:'long',day:'numeric'});
    const events = eventsForDate(d);
    if(isTod){
      const hr=new Date().getHours();
      const greet = hr<5?'Late night':hr<12?'Good morning':hr<17?'Good afternoon':hr<21?'Good evening':'Winding down';
      $('#today-greeting').textContent = `${greet} · ${events.length} class${events.length!==1?'es':''} scheduled`;
    } else {
      $('#today-greeting').textContent = d.toLocaleDateString(undefined,{weekday:'long',year:'numeric'});
    }
    const bt=$('#back-today'); if(bt) bt.hidden=isTod;
    $('#today-task-h').textContent = isTod ? 'To-do today' : 'To-do';
    renderFocus(events, isTod);
    renderTimeline(events, isTod);
    renderDayTasks(d, isTod);
  }

  function renderFocus(events, isTod){
    const card = $('#focus-card');
    if(!isTod){
      const cls=events.filter(e=>e.type==='class').length, other=events.length-cls;
      const parts=[]; if(cls)parts.push(`${cls} class${cls>1?'es':''}`); if(other)parts.push(`${other} event${other>1?'s':''}`);
      card.className='card focus rest';
      card.innerHTML = `
        <div class="tag"><span class="dot"></span>${relLabel(viewDate)}</div>
        <h3>${events.length? esc(parts.join(' · ')) : 'A clear day'}</h3>
        <p class="meta"><span>${events.length? fmtNice(events[0].start)+' – '+fmtNice(events[events.length-1].end) : 'No classes or events scheduled'}</span></p>`;
      return;
    }
    const nm = nowMin();
    const current = events.find(e=>nm>=toMin(e.start) && nm<toMin(e.end));
    const next = events.find(e=>toMin(e.start)>nm);
    if(current){
      const left = toMin(current.end)-nm;
      card.className='card focus';
      card.innerHTML = `
        <div class="tag live"><span class="dot"></span>Happening now</div>
        <div class="count-pill"><div class="big tnum">${left}</div><div class="lbl">min left</div></div>
        <h3>${esc(eventName(current))}</h3>
        <p class="meta"><span>${fmtNice(current.start)} – ${fmtNice(current.end)}</span><b>${esc(eventSubtitle(current))}</b></p>`;
    } else if(next){
      const inMin = toMin(next.start)-nm;
      const cd = inMin>=60 ? `${Math.floor(inMin/60)}h ${inMin%60}m` : `${inMin}m`;
      card.className='card focus';
      card.innerHTML = `
        <div class="tag"><span class="dot"></span>Up next</div>
        <div class="count-pill"><div class="big tnum">${cd}</div><div class="lbl">to go</div></div>
        <h3>${esc(eventName(next))}</h3>
        <p class="meta"><span>${fmtNice(next.start)} – ${fmtNice(next.end)}</span><b>${esc(eventSubtitle(next))}</b></p>`;
    } else {
      const tdy = todayTodos();
      const done = tdy.filter(t=>t.done).length;
      const pct = tdy.length ? Math.round(done/tdy.length*100) : 0;
      const r=22, c=2*Math.PI*r, off=c*(1-pct/100);
      const msg = events.length===0 ? 'No classes today' : 'Classes done for today';
      const sub = tdy.length===0 ? 'Add a task below to get going' :
                  done===tdy.length ? 'All tasks complete. Nice work.' :
                  `${tdy.length-done} task${tdy.length-done>1?'s':''} still to do`;
      card.className='card focus rest';
      card.innerHTML = `
        <div class="ring-row">
          <svg class="ring" viewBox="0 0 58 58">
            <circle class="track" cx="29" cy="29" r="${r}"/>
            <circle class="bar" cx="29" cy="29" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 29 29)"/>
            <text class="ring-label" x="29" y="33" text-anchor="middle">${pct}%</text>
          </svg>
          <div><h3>${msg}</h3><p class="meta"><span>${esc(sub)}</span></p></div>
        </div>`;
    }
  }

  function tlItem(e, state){
    const col = COLORS[e.color]||COLORS.slate;
    const item = el('div','tl-item '+(state==='past'?'past':state==='now'?'now':''));
    item.innerHTML = `
      <div class="tl-rail"><div class="tl-node" style="border-color:${col.dot}"></div></div>
      <div class="tl-card" data-edit-event="${e.id}">
        <div class="tl-chip" style="background:${col.dot}"></div>
        <div class="tl-time"><span class="s tnum">${fmtNice(e.start)}</span><span class="e tnum">${fmtNice(e.end)}</span></div>
        <div class="tl-body"><div class="t">${esc(eventName(e))}${state==='now'?' · now':''}</div><div class="d">${esc(eventSubtitle(e))}</div></div>
      </div>`;
    return item;
  }

  function renderTimeline(events, isTod){
    const wrap = $('#timeline');
    $('#day-count').textContent = events.length ? `${events.length} event${events.length>1?'s':''}` : '';
    wrap.innerHTML='';
    if(events.length===0){
      const msg = isTod ? 'Nothing scheduled today.' : 'Nothing scheduled for this day.';
      const hint = isTod ? 'Enjoy the open day, or add an event in Routine.' : 'Pick another date, or add an event in Routine.';
      wrap.appendChild(el('div','empty',`<div class="em">○</div><p>${msg}</p><p class="hint">${hint}</p>`));
      return;
    }
    if(!isTod){ events.forEach(e=>wrap.appendChild(tlItem(e,'plain'))); return; }
    const nm = nowMin();
    let nowInserted = false;
    events.forEach(e=>{
      const s=toMin(e.start), en=toMin(e.end);
      if(!nowInserted && nm < s){ wrap.appendChild(nowLine(nm)); nowInserted=true; }
      const state = nm>=en ? 'past' : (nm>=s&&nm<en ? 'now' : 'future');
      wrap.appendChild(tlItem(e,state));
    });
    if(!nowInserted){ wrap.appendChild(nowLine(nm)); }
  }
  function nowLine(nm){
    const h=Math.floor(nm/60), m=nm%60;
    const line=el('div','now-line');
    line.innerHTML=`<div class="nl-rail"><div class="nl-pin"></div></div><div class="nl-bar"></div><div class="nl-time tnum">Now ${fmtNice(pad(h)+':'+pad(m))}</div>`;
    return line;
  }

  function todayTodos(){ const t=todayStr(); return db.todos.filter(td=>td.date===t); }
  function renderDayTasks(d, isTod){
    const ds=dateStrOf(d);
    const qa=$('#today-quickadd'); if(qa) qa.style.display = isTod ? '' : 'none';
    const list = (isTod
      ? db.todos.filter(t=>t.date===ds)
      : db.todos.filter(t=> (!t.done && t.date===ds) || (t.done && t.doneDate===ds))
    ).sort(sortTodos);
    const done=list.filter(t=>t.done).length;
    $('#today-task-count').textContent = list.length ? `${done}/${list.length} done` : '';
    const wrap=$('#today-tasks'); wrap.innerHTML='';
    if(list.length===0){
      const msg = isTod ? 'No tasks yet for today.' : 'No tasks recorded for this day.';
      const hint = isTod ? 'Anything left from earlier days lands here automatically.' : 'Switch back to today to add tasks.';
      wrap.appendChild(el('div','empty',`<div class="em">✓</div><p>${msg}</p><p class="hint">${hint}</p>`));
      return;
    }
    list.filter(t=>!t.done).forEach(t=>wrap.appendChild(taskRow(t)));
    list.filter(t=>t.done).forEach(t=>wrap.appendChild(taskRow(t)));
  }

  function sortTodos(a,b){
    if(a.done!==b.done) return a.done?1:-1;
    if((b.prio?1:0)!==(a.prio?1:0)) return (b.prio?1:0)-(a.prio?1:0);
    return (a.createdAt||0)-(b.createdAt||0);
  }

  function taskRow(t){
    const row=el('div','task'+(t.done?' done':''));
    let sub='';
    if(t.carried>0) sub+=`<span class="badge carry">carried ×${t.carried}</span>`;
    if(t.prio && !t.done) sub+=`<span class="badge prio">priority</span>`;
    row.innerHTML=`
      <button class="check" data-toggle="${t.id}" aria-label="Toggle done"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-11"/></svg></button>
      <div class="task-body">
        <div class="task-text">${esc(t.text)}</div>
        ${t.note?`<div class="task-note">${esc(t.note)}</div>`:''}
        ${sub?`<div class="task-sub">${sub}</div>`:''}
      </div>
      <div class="task-act">
        <button class="mini" data-edit-task="${t.id}" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
      </div>`;
    return row;
  }

  /* ----- ROUTINE ----- */
  let routineDay = new Date().getDay();
  function renderRoutine(){
    renderUpcoming();
    const chips=$('#daychips'); chips.innerHTML='';
    const today=new Date().getDay();
    DAYS_SHORT.forEach((dn,i)=>{
      const cnt=db.events.filter(e=>!e.date && e.day===i).length;
      const c=el('button','chip'+(i===routineDay?' on':'')+(i===today?' today':''));
      c.innerHTML=`<div class="dn">${dn}</div><div class="dc">${cnt||'–'}</div>`;
      c.onclick=()=>{ routineDay=i; renderRoutine(); };
      chips.appendChild(c);
    });
    $('#routine-day-label').textContent=DAYS[routineDay];
    const list=db.events.filter(e=>!e.date && e.day===routineDay).sort((a,b)=>toMin(a.start)-toMin(b.start));
    $('#routine-count').textContent=list.length?`${list.length} event${list.length>1?'s':''}`:'';
    const wrap=$('#routine-list'); wrap.innerHTML='';
    if(list.length===0){
      wrap.appendChild(el('div','empty',`<div class="em">◇</div><p>No weekly events on ${DAYS[routineDay]}.</p><p class="hint">Tap + to add one.</p>`));
      return;
    }
    list.forEach(e=>{
      const col=COLORS[e.color]||COLORS.slate;
      const row=el('div','rev'); row.dataset.editEvent=e.id;
      row.innerHTML=`
        <div class="rev-bar" style="background:${col.dot}"></div>
        <div class="rev-time"><span class="s tnum">${fmtNice(e.start)}</span><span class="e tnum">${fmtNice(e.end)}</span></div>
        <div class="rev-body"><div class="t">${esc(eventName(e))}</div><div class="d">${esc(eventSubtitle(e))}</div></div>`;
      wrap.appendChild(row);
    });
  }

  function renderUpcoming(){
    const wrap=$('#upcoming-wrap'); if(!wrap) return;
    const t=todayStr();
    const up=db.events.filter(e=>e.date && e.showUpcoming && e.date>=t)
                      .sort((a,b)=> a.date===b.date ? toMin(a.start)-toMin(b.start) : a.date.localeCompare(b.date));
    if(up.length===0){ wrap.innerHTML=''; wrap.style.display='none'; return; }
    wrap.style.display='';
    let html=`<div class="section-label"><h2>Upcoming events</h2><span class="count">${up.length}</span></div>`;
    up.forEach(e=>{
      const col=COLORS[e.color]||COLORS.slate;
      const detail=eventSubtitle(e);
      html+=`<div class="rev rev-up" data-edit-event="${e.id}">
        <div class="rev-bar" style="background:${col.dot}"></div>
        <div class="rev-time"><span class="s tnum">${fmtNice(e.start)}</span><span class="e tnum">${fmtNice(e.end)}</span></div>
        <div class="rev-body"><div class="t">${esc(eventName(e))}</div><div class="d"><span class="up-date">${esc(prettyDate(e.date))}</span>${detail?' · '+esc(detail):''}</div></div>
      </div>`;
    });
    wrap.innerHTML=html;
  }

  /* ----- TASKS ----- */
  let taskSeg='active';
  function renderTasks(){
    const aWrap=$('#tasks-active-wrap'), dWrap=$('#tasks-done');
    document.querySelectorAll('#task-seg button').forEach(b=>b.classList.toggle('on',b.dataset.seg===taskSeg));
    if(taskSeg==='active'){
      aWrap.style.display=''; dWrap.style.display='none';
      const list=db.todos.filter(t=>!t.done).sort(sortTodos);
      const wrap=$('#tasks-active'); wrap.innerHTML='';
      if(list.length===0){ wrap.appendChild(el('div','empty','<div class="em">✓</div><p>All clear.</p><p class="hint">No active tasks right now.</p>')); }
      else list.forEach(t=>wrap.appendChild(taskRow(t)));
    } else {
      aWrap.style.display='none'; dWrap.style.display='';
      const done=db.todos.filter(t=>t.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
      dWrap.innerHTML='';
      if(done.length===0){ dWrap.appendChild(el('div','empty','<div class="em">◷</div><p>No completed tasks yet.</p><p class="hint">Finished tasks show up here, newest first.</p>')); return; }
      const groups={};
      done.forEach(t=>{ const k=t.doneDate||todayStr(); (groups[k]=groups[k]||[]).push(t); });
      Object.keys(groups).sort((a,b)=>b.localeCompare(a)).forEach(k=>{
        const lab=el('div','section-label',`<h2>${prettyDate(k)}</h2><span class="count">${groups[k].length}</span>`);
        lab.style.margin='18px 2px 10px';
        dWrap.appendChild(lab);
        groups[k].forEach(t=>dWrap.appendChild(taskRow(t)));
      });
    }
  }

  /* ----- INSIGHTS ----- */
  function renderInsights(){
    const done=db.todos.filter(t=>t.done);
    const total=done.length;
    const compDays=new Set(done.map(t=>t.doneDate).filter(Boolean));
    let streak=0; let cur=new Date(todayStr());
    if(!compDays.has(dateStrOf(cur))) cur.setDate(cur.getDate()-1);
    while(compDays.has(dateStrOf(cur))){ streak++; cur.setDate(cur.getDate()-1); }
    const perDay=DAYS.map((_,i)=>db.events.filter(e=>!e.date && e.day===i).length);
    const weekly=perDay.reduce((a,b)=>a+b,0);
    const busiest=perDay.indexOf(Math.max(...perDay));

    $('#stat-grid').innerHTML=`
      ${stat('🔥', streak, streak===1?'day':'days', 'Completion streak')}
      ${stat('✓', total, total===1?'task':'tasks', 'Completed all-time')}
      ${stat('◷', weekly, 'classes', 'Per week')}
      ${stat('★', DAYS_SHORT[busiest], '', 'Busiest day')}`;

    const days=[]; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(dateStrOf(d)); }
    const counts=days.map(ds=>done.filter(t=>t.doneDate===ds).length);
    drawBars('#barchart', days.map((ds,i)=>({ label:DAYS_SHORT[parseDate(ds).getDay()][0], value:counts[i], today:ds===todayStr() })));
    drawBars('#loadchart', DAYS_SHORT.map((dn,i)=>({ label:dn[0], value:perDay[i], today:i===new Date().getDay() })));
  }
  function stat(ic,v,u,l){ return `<div class="card stat"><span class="ic">${ic}</span><div class="v tnum">${v}${u?`<span class="u">${u}</span>`:''}</div><div class="l">${l}</div></div>`; }
  function drawBars(sel,data){
    const max=Math.max(1,...data.map(d=>d.value));
    const html=`<div class="bars">${data.map(d=>{
      const h=d.value? Math.max(8, d.value/max*100) : 0;
      return `<div class="barcol${d.value?'':' empty'}${d.today?' today':''}">
        <span class="vlab">${d.value||''}</span>
        <div class="bar" style="height:${d.value?h:6}%">${d.value?'<div class="fill"></div>':''}</div>
        <span class="dlab">${d.label}</span></div>`;
    }).join('')}</div>`;
    $(sel).innerHTML=html;
  }

  /* ===========================================================
     ACTIONS
     =========================================================== */
  function addTodo(text, ds){
    text=text.trim(); if(!text) return;
    db.todos.push({ id:uid(), text, date:ds||todayStr(), done:false, prio:false, note:'', createdAt:Date.now(), carried:0 });
    save(); refresh();
  }
  function toggleTodo(id){
    const t=db.todos.find(x=>x.id===id); if(!t) return;
    t.done=!t.done;
    if(t.done){ t.doneAt=Date.now(); t.doneDate=todayStr(); }
    else { t.doneAt=null; t.doneDate=null; t.date=todayStr(); }
    save(); refresh();
  }
  function deleteTodo(id){ db.todos=db.todos.filter(x=>x.id!==id); save(); refresh(); }
  function deleteEvent(id){ db.events=db.events.filter(x=>x.id!==id); save(); refresh(); }

  function deleteWithUndo(kind,obj){
    if(kind==='todo') deleteTodo(obj.id); else deleteEvent(obj.id);
    closeSheet();
    toast('Deleted', ()=>{
      if(kind==='todo') db.todos.push(obj); else db.events.push(obj);
      save(); refresh();
    });
  }

  /* ===========================================================
     SHEETS (add / edit)
     =========================================================== */
  function openSheet(html){ $('#sheet').innerHTML='<div class="grab"></div>'+html; $('#scrim').classList.add('show'); $('#sheet').classList.add('show'); }
  function closeSheet(){ $('#scrim').classList.remove('show'); $('#sheet').classList.remove('show'); }

  function taskSheet(id){
    const t = id ? db.todos.find(x=>x.id===id) : null;
    openSheet(`
      <h2>${t?'Edit task':'New task'}</h2>
      <div class="field"><label>Task</label><input id="f-text" value="${t?escAttr(t.text):''}" placeholder="What needs doing?" maxlength="160"></div>
      <div class="field"><label>Note (optional)</label><textarea id="f-note" placeholder="Details, link, context…" maxlength="280">${t?escAttr(t.note||''):''}</textarea></div>
      <div class="field"><label>Priority</label>
        <div class="daypick" style="max-width:220px">
          <button id="f-prio-no" class="${t&&t.prio?'':'on'}">Normal</button>
          <button id="f-prio-yes" class="${t&&t.prio?'on':''}">Priority</button>
        </div>
      </div>
      <div class="sheet-actions">
        ${t?`<button class="btn btn-danger" id="f-del" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>`:''}
        <button class="btn btn-ghost" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">${t?'Save':'Add task'}</button>
      </div>`);
    let prio = t?!!t.prio:false;
    $('#f-prio-yes').onclick=()=>{prio=true;$('#f-prio-yes').classList.add('on');$('#f-prio-no').classList.remove('on');};
    $('#f-prio-no').onclick=()=>{prio=false;$('#f-prio-no').classList.add('on');$('#f-prio-yes').classList.remove('on');};
    $('#f-cancel').onclick=closeSheet;
    if(t)$('#f-del').onclick=()=>deleteWithUndo('todo',t);
    $('#f-save').onclick=()=>{
      const text=$('#f-text').value.trim(); if(!text){ $('#f-text').focus(); return; }
      const note=$('#f-note').value.trim();
      if(t){ t.text=text; t.note=note; t.prio=prio; }
      else { db.todos.push({id:uid(),text,note,prio,date:dateStrOf(viewDate),done:false,createdAt:Date.now(),carried:0}); }
      save(); refresh(); closeSheet();
    };
    setTimeout(()=>{ if(!t)$('#f-text').focus(); },280);
  }

  function eventSheet(id){
    const e = id ? db.events.find(x=>x.id===id) : null;
    const sel = e ? (e.date ? [] : [e.day]) : [routineDay];
    openSheet(`
      <h2>${e?'Edit event':'New event'}</h2>
      <div class="field"><label>Title</label><input id="e-title" value="${e?escAttr(e.type==='class'?e.course:e.title):''}" placeholder="e.g. CSE499 or Gym" maxlength="40"></div>
      <div class="field-row">
        <div class="field"><label>Detail / Section</label><input id="e-section" value="${e?escAttr(e.section||''):''}" placeholder="Sec 01" maxlength="20"></div>
        <div class="field"><label>Faculty / Who</label><input id="e-faculty" value="${e?escAttr(e.faculty||''):''}" placeholder="ABC" maxlength="20"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Block</label><input id="e-block" value="${e?escAttr(e.block||''):''}" placeholder="10B" maxlength="12"></div>
        <div class="field"><label>Room</label><input id="e-room" value="${e?escAttr(e.room||''):''}" placeholder="15C" maxlength="12"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Start</label><input id="e-start" type="time" value="${e?e.start:'09:00'}"></div>
        <div class="field"><label>End</label><input id="e-end" type="time" value="${e?e.end:'10:00'}"></div>
      </div>
      <div class="field"><label>Repeats on <span class="opt">optional</span></label>
        <div class="daypick" id="e-days">${DAYS_SHORT.map((d,i)=>`<button data-d="${i}" class="${sel.includes(i)?'on':''}">${d}</button>`).join('')}</div>
      </div>
      <div class="or-sep">or once on a date</div>
      <div class="field"><label>Specific date</label><input type="date" id="e-date" value="${e&&e.date?e.date:''}"></div>
      <div class="field"><label>Colour</label>
        <div class="colorpick" id="e-colors">${Object.keys(COLORS).map(k=>`<button data-c="${k}" class="${(e?e.color:'teal')===k?'on':''}" style="background:${COLORS[k].dot}"></button>`).join('')}</div>
      </div>
      <div class="toggle-row">
        <div><div class="toggle-label">Show on upcoming events</div><div class="toggle-sub">List a dated event early on the Routine tab until its day passes</div></div>
        <button class="toggle ${e&&e.showUpcoming?'on':''}" id="e-upcoming" role="switch" aria-checked="${e&&e.showUpcoming?'true':'false'}"><span class="knob"></span></button>
      </div>
      <div class="sheet-actions">
        ${e?`<button class="btn btn-danger" id="e-del" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>`:''}
        <button class="btn btn-ghost" id="e-cancel">Cancel</button>
        <button class="btn btn-primary" id="e-save">${e?'Save':'Add'}</button>
      </div>`);
    let days=new Set(sel), color=e?e.color:'teal', showUpcoming = e?!!e.showUpcoming:false;
    const daysEl=$('#e-days'), dateEl=$('#e-date');
    daysEl.querySelectorAll('button').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.d;
      if(e){
        if(days.has(i)){ days.delete(i); b.classList.remove('on'); }
        else { days=new Set([i]); daysEl.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); }
      } else {
        if(days.has(i)){ days.delete(i); b.classList.remove('on'); }
        else { days.add(i); b.classList.add('on'); }
      }
      if(days.size>0) dateEl.value='';
    });
    dateEl.addEventListener('change',()=>{ if(dateEl.value){ days.clear(); daysEl.querySelectorAll('button').forEach(x=>x.classList.remove('on')); } });
    $('#e-colors').querySelectorAll('button').forEach(b=>b.onclick=()=>{
      color=b.dataset.c; $('#e-colors').querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    });
    $('#e-upcoming').onclick=()=>{ showUpcoming=!showUpcoming; $('#e-upcoming').classList.toggle('on',showUpcoming); $('#e-upcoming').setAttribute('aria-checked',showUpcoming); };
    $('#e-cancel').onclick=closeSheet;
    if(e)$('#e-del').onclick=()=>deleteWithUndo('event',e);
    $('#e-save').onclick=()=>{
      const title=$('#e-title').value.trim(); if(!title){ $('#e-title').focus(); return; }
      const start=$('#e-start').value, end=$('#e-end').value;
      if(!start||!end){ toast('Set a start and end time'); return; }
      if(toMin(end)<=toMin(start)){ toast('End time must be after start'); return; }
      const dateVal=dateEl.value;
      const repeat = days.size>=1;
      if(!repeat && !dateVal){ toast('Pick repeat days, or choose a date'); return; }
      const type = e? e.type : (/^[A-Z]{2,4}\d{3}/.test(title)?'class':'custom');
      const base={ title, course:title, section:$('#e-section').value.trim(), faculty:$('#e-faculty').value.trim(),
                   block:$('#e-block').value.trim(), room:$('#e-room').value.trim(), start, end, color, type, showUpcoming };
      if(e){
        if(repeat){ delete e.date; Object.assign(e, base, {day:[...days][0]}); routineDay=e.day; }
        else { delete e.day; Object.assign(e, base, {date:dateVal}); viewDate=parseDate(dateVal); }
      } else {
        if(repeat){ [...days].forEach(d=> db.events.push(Object.assign({id:uid(),day:d},base))); routineDay=[...days][0]; }
        else { db.events.push(Object.assign({id:uid(),date:dateVal},base)); }
      }
      save();
      if(!repeat) toast('Added for '+prettyDate(dateVal));
      refresh(); closeSheet();
    };
  }

  /* ===========================================================
     CALENDAR (date picker for the Today view)
     =========================================================== */
  let calCursor;
  function openCalendar(){ calCursor=new Date(viewDate.getFullYear(), viewDate.getMonth(), 1); renderCalendar(); }
  function renderCalendar(){
    const y=calCursor.getFullYear(), mo=calCursor.getMonth();
    const monthName=calCursor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const first=new Date(y,mo,1).getDay();
    const ndays=new Date(y,mo+1,0).getDate();
    const today=new Date();
    let cells='';
    for(let i=0;i<first;i++) cells+='<div class="cal-cell empty"></div>';
    for(let dn=1;dn<=ndays;dn++){
      const d=new Date(y,mo,dn), ds=dateStrOf(d);
      const isT=isSameDay(d,today), isS=isSameDay(d,viewDate);
      const dot=db.events.some(e=>e.date===ds);
      cells+=`<button class="cal-cell${isT?' today':''}${isS?' sel':''}" data-pick="${ds}">${dn}${dot?'<i class="cal-dot"></i>':''}</button>`;
    }
    openSheet(`
      <h2>Pick a day</h2>
      <div class="cal-head">
        <button class="cal-nav" id="cal-prev" aria-label="Previous month"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
        <div class="cal-month">${monthName}</div>
        <button class="cal-nav" id="cal-next" aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
      </div>
      <div class="cal-grid cal-dows">${DAYS_SHORT.map(d=>`<div class="cal-dow">${d[0]}</div>`).join('')}</div>
      <div class="cal-grid" id="cal-days">${cells}</div>
      <div class="sheet-actions"><button class="btn btn-ghost" id="cal-today">Jump to today</button></div>`);
    $('#cal-prev').onclick=()=>{ calCursor.setMonth(calCursor.getMonth()-1); renderCalendar(); };
    $('#cal-next').onclick=()=>{ calCursor.setMonth(calCursor.getMonth()+1); renderCalendar(); };
    $('#cal-today').onclick=()=>{ viewDate=new Date(); closeSheet(); renderToday(); };
    $('#cal-days').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{ viewDate=parseDate(b.dataset.pick); closeSheet(); renderToday(); });
  }

  /* ===========================================================
     NAV + REFRESH
     =========================================================== */
  let tab='today';
  function switchTab(t){
    tab=t;
    if(t==='today') viewDate=new Date();
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $('#screen-'+t).classList.add('active');
    document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
    $('#fab').style.display = t==='routine' ? 'grid' : 'none';
    window.scrollTo(0,0);
    refresh();
  }
  function refresh(){
    if(tab==='today') renderToday();
    else if(tab==='routine') renderRoutine();
    else if(tab==='tasks') renderTasks();
    else if(tab==='insights') renderInsights();
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, undo){
    const t=$('#toast');
    t.innerHTML = esc(msg) + (undo?' <button class="undo">Undo</button>':'');
    t.classList.add('show');
    if(undo) t.querySelector('.undo').onclick=()=>{ undo(); t.classList.remove('show'); };
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>t.classList.remove('show'), undo?4000:2200);
  }

  /* ---------- escaping ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function escAttr(s){ return esc(s).replace(/'/g,'&#39;'); }

  /* ===========================================================
     WIRE UP
     =========================================================== */
  function init(){
    load();
    rollover();
    applyTheme();

    document.getElementById('nav').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) switchTab(b.dataset.tab); });
    $('#theme-btn').onclick=cycleTheme;
    $('#fab').onclick=()=>eventSheet(null);
    $('#date-btn').onclick=openCalendar;
    $('#back-today').onclick=()=>{ viewDate=new Date(); renderToday(); };

    const qa=(inp,btn,dateFn)=>{
      const a=$(inp), b=$(btn);
      const go=()=>{ if(a.value.trim()){ addTodo(a.value, dateFn()); a.value=''; } a.focus(); };
      b.onclick=go;
      a.addEventListener('keydown',ev=>{ if(ev.key==='Enter') go(); });
    };
    qa('#qa-today','#qa-today-btn',()=>dateStrOf(viewDate));
    qa('#qa-tasks','#qa-tasks-btn',()=>todayStr());

    $('#task-seg').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b){ taskSeg=b.dataset.seg; renderTasks(); } });

    document.body.addEventListener('click',e=>{
      const tog=e.target.closest('[data-toggle]'); if(tog){ toggleTodo(tog.dataset.toggle); return; }
      const et=e.target.closest('[data-edit-task]'); if(et){ taskSheet(et.dataset.editTask); return; }
      const ee=e.target.closest('[data-edit-event]'); if(ee){ eventSheet(ee.dataset.editEvent); return; }
    });
    $('#scrim').onclick=closeSheet;

    switchTab('today');

    setInterval(()=>{ if(tab==='today' && isSameDay(viewDate,new Date())) renderToday(); }, 30000);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ rollover(); applyTheme(); if(tab==='today') viewDate=new Date(); refresh(); } });
    matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{ if(db.meta.theme==='auto') applyTheme(); });

    if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
