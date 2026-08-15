(() => {
  const esc = (value='') => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safeUrl = (value='') => {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.startsWith('/') || v.startsWith('assets/')) return v;
    try { const u = new URL(v, window.location.origin); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
  };
  const fetchJson = async (path) => {
    const response = await fetch(path, {cache:'no-store'});
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    return response.json();
  };
  const prettyDate = (v) => {
    if (!v) return '';
    const d = new Date(`${v}T00:00:00`);
    return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  };
  const published = arr => (Array.isArray(arr) ? arr : []).filter(x => x && x.published !== false);

  async function loadSchool() {
    try {
      const s = await fetchJson('/content/school.json');
      document.querySelectorAll('[data-hm-name]').forEach(el => el.textContent = s.head_master_name || '');
      document.querySelectorAll('[data-hm-role]').forEach(el => el.textContent = s.head_master_role || 'Head Master');
      document.querySelectorAll('[data-hm-photo]').forEach(img => { if (s.head_master_photo) img.src = s.head_master_photo; });
      document.querySelectorAll('[data-hm-short]').forEach(el => el.textContent = s.head_master_short_message || '');
      document.querySelectorAll('[data-hm-full]').forEach(el => {
        const paras = String(s.head_master_message || '').split(/\n\s*\n/).filter(Boolean);
        el.innerHTML = paras.map(p => `<p>${esc(p)}</p>`).join('');
      });
    } catch (e) { console.warn(e); }
  }

  async function loadNotices() {
    const box = document.querySelector('#notices-list');
    const home = document.querySelector('#home-latest-notices');
    if (!box && !home) return;
    try {
      const data = await fetchJson('/content/notices.json');
      const items = published(data.items).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const card = n => {
        const file = safeUrl(n.attachment), image = safeUrl(n.image);
        return `<article class="managed-card notice-card">${image?`<img class="managed-thumb" src="${esc(image)}" alt="${esc(n.title)}">`:''}<div class="managed-body"><div class="managed-meta"><span>${esc(n.category||'Notice')}</span>${n.date?`<span>${prettyDate(n.date)}</span>`:''}</div><h3>${esc(n.title)}</h3><p>${esc(n.description||'')}</p>${file?`<a class="btn btn-outline managed-action" href="${esc(file)}" target="_blank" rel="noopener">View / Download</a>`:''}</div></article>`;
      };
      if (box) box.innerHTML = items.length ? items.map(card).join('') : `<div class="empty-state"><div class="big">📢</div><h3>No public notice has been published yet.</h3><p>New notices will appear here after they are published by the school administration.</p></div>`;
      if (home) home.innerHTML = items.length ? items.slice(0,3).map(n => `<a class="news-item" href="notices.html"><div class="news-date">${esc((n.category||'NEWS').split(' ')[0].slice(0,6).toUpperCase())}</div><div><h4>${esc(n.title)}</h4><p>${n.date?prettyDate(n.date)+' • ':''}${esc(n.description||'')}</p></div></a>`).join('') : `<div class="notice">No new public notices at this time.</div>`;
    } catch (e) { if (box) box.innerHTML = '<div class="notice">Unable to load notices right now.</div>'; }
  }

  async function loadDownloads() {
    const box = document.querySelector('#downloads-list'); if (!box) return;
    try {
      const data = await fetchJson('/content/downloads.json');
      const items = published(data.items).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      box.innerHTML = items.length ? items.map(x => { const f=safeUrl(x.file); return `<article class="managed-card"><div class="managed-body"><div class="managed-meta"><span>${esc(x.category||'Document')}</span>${x.date?`<span>${prettyDate(x.date)}</span>`:''}</div><h3>${esc(x.title)}</h3><p>${esc(x.description||'')}</p>${f?`<a class="btn btn-outline managed-action" href="${esc(f)}" target="_blank" rel="noopener">Open File</a>`:''}</div></article>`; }).join('') : `<div class="empty-state"><div class="big">📂</div><h3>No official download has been published yet.</h3><p>Forms, date sheets, circulars and result files will appear here.</p></div>`;
    } catch { box.innerHTML='<div class="notice">Unable to load downloads right now.</div>'; }
  }

  async function loadGallery() {
    const box = document.querySelector('#gallery-dynamic');
    const home = document.querySelector('#home-gallery');
    if (!box && !home) return;
    try {
      const data = await fetchJson('/content/gallery.json');
      const items = published(data.items).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const fig = x => `<figure><img src="${esc(safeUrl(x.image))}" alt="${esc(x.title||x.caption||'School gallery photo')}"><figcaption>${esc(x.caption||x.title||'')}</figcaption></figure>`;
      if (box) box.innerHTML = items.length ? items.map(fig).join('') : `<div class="empty-state"><div class="big">📷</div><h3>No gallery photo has been published yet.</h3></div>`;
      if (home && items.length) home.innerHTML = items.slice(0,3).map(fig).join('');
    } catch (e) { if (box) box.innerHTML='<div class="notice">Unable to load gallery right now.</div>'; }
  }

  async function loadAchievements() {
    const box = document.querySelector('#achievements-list'); if (!box) return;
    try {
      const data = await fetchJson('/content/achievements.json');
      const items = published(data.items).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      box.innerHTML = items.length ? items.map(x => { const photo=safeUrl(x.photo); const details=[x.class_name,x.grade,x.position].filter(Boolean).map(esc).join(' • '); return `<article class="achievement-card">${photo?`<img src="${esc(photo)}" alt="${esc(x.student_name||x.title)}">`:''}<div><div class="managed-meta">${x.date?`<span>${prettyDate(x.date)}</span>`:''}</div><h3>${esc(x.title)}</h3>${x.student_name?`<h4>${esc(x.student_name)}${x.father_name?` <small>S/O ${esc(x.father_name)}</small>`:''}</h4>`:''}${details?`<p class="achievement-details">${details}</p>`:''}<p>${esc(x.description||'')}</p></div></article>`; }).join('') : `<div class="empty-state"><div class="big">⭐</div><h3>Achievement records are ready to be added.</h3><p>Verified student and school achievements will appear here.</p></div>`;
    } catch { box.innerHTML='<div class="notice">Unable to load achievements right now.</div>'; }
  }

  async function loadStaff() {
    const box = document.querySelector('#staff-directory'); if (!box) return;
    try {
      const data = await fetchJson('/content/staff.json');
      const items = published(data.items);
      box.innerHTML = items.length ? items.map(x => { const p=safeUrl(x.photo); return `<article class="staff-card">${p?`<img src="${esc(p)}" alt="${esc(x.name)}">`:`<div class="staff-placeholder">${esc((x.name||'?').split(' ').map(y=>y[0]).join('').slice(0,3))}</div>`}<div class="staff-card-body"><h3>${esc(x.name)}</h3><div class="role">${esc(x.designation||'')}</div>${x.subject?`<p><strong>Subject:</strong> ${esc(x.subject)}</p>`:''}${x.qualification?`<p><strong>Qualification:</strong> ${esc(x.qualification)}</p>`:''}<p>${esc(x.description||'')}</p></div></article>`; }).join('') : '<div class="empty-state"><h3>No staff record published yet.</h3></div>';
    } catch { box.innerHTML='<div class="notice">Unable to load staff directory right now.</div>'; }
  }

  async function loadResults() {
    const form = document.querySelector('#result-search'); if (!form) return;
    const selector = document.querySelector('#result-set');
    const summary = document.querySelector('#result-summary-dynamic');
    const docs = document.querySelector('#result-documents');
    try {
      const data = await fetchJson('/content/results.json');
      const sets = (Array.isArray(data.result_sets)?data.result_sets:[]).filter(x => x && x.active !== false);
      if (!sets.length) throw new Error('No active result sets');
      selector.innerHTML = sets.map((x,i)=>`<option value="${i}">${esc(x.title||`${x.class_name||'Result'} ${x.year||''}`)}</option>`).join('');
      const renderSummary = (set) => {
        const st = Array.isArray(set.students)?set.students:[];
        const pass = st.filter(x=>String(x.status).toLowerCase()==='pass').length;
        const fail = st.length-pass;
        const pct = st.length ? (pass/st.length*100).toFixed(2) : '0.00';
        const high = st.reduce((best,x)=>Number(x.marks)>Number(best?.marks??-1)?x:best,null);
        summary.innerHTML = `<div class="grid-4"><div class="card result-stat-card"><div class="result-stat-number">${st.length}</div><h3>Total Students</h3></div><div class="card result-stat-card"><div class="result-stat-number">${pass}</div><h3>Passed</h3></div><div class="card result-stat-card"><div class="result-stat-number">${fail}</div><h3>Fail / Absent</h3></div><div class="card result-stat-card"><div class="result-stat-number">${pct}%</div><h3>Pass Percentage</h3></div></div>${high?`<div class="callout" style="margin-top:22px"><strong>Highest Marks:</strong> ${esc(high.marks)} / ${esc(set.max_marks||'')} &nbsp;•&nbsp; <strong>Seat No.:</strong> ${esc(high.seat_no)} &nbsp;•&nbsp; <strong>Grade:</strong> ${esc(high.grade||'')}</div>`:''}`;
      };
      const currentSet = () => sets[Number(selector.value)||0];
      renderSummary(currentSet());
      selector.addEventListener('change',()=>{ renderSummary(currentSet()); document.querySelector('#result-message').className='result-message'; document.querySelector('#result-message').innerHTML=''; });
      form.addEventListener('submit',(event)=>{
        event.preventDefault();
        const input=document.querySelector('#roll-number'), box=document.querySelector('#result-message');
        const value=input.value.replace(/\D/g,'').trim();
        if(!value){box.innerHTML='<div class="result-alert">Please enter a valid seat / roll number.</div>';box.className='result-message show';return;}
        const set=currentSet(), rec=(set.students||[]).find(x=>String(x.seat_no).replace(/\D/g,'')===value);
        if(!rec){box.innerHTML='<div class="result-alert"><strong>No result found.</strong><br>Please check the seat / roll number and selected result.</div>';box.className='result-message show';return;}
        const max=Number(set.max_marks)||1000, percentage=(Number(rec.marks)/max*100).toFixed(2), pass=String(rec.status).toLowerCase()==='pass';
        box.innerHTML=`<div class="student-result-card"><div class="result-card-head"><div><span class="result-label">${esc(set.exam||'School Examination')} ${esc(set.year||'')}</span><h3>${esc(set.class_name||'Student')} Result</h3></div><span class="status-pill ${pass?'status-pass':'status-fail'}">${esc(rec.status||'')}</span></div><div class="result-detail-grid">${rec.student_name?`<div><span>Student Name</span><strong>${esc(rec.student_name)}</strong></div>`:''}${rec.father_name?`<div><span>Father Name</span><strong>${esc(rec.father_name)}</strong></div>`:''}<div><span>Seat / Roll No.</span><strong>${esc(rec.seat_no)}</strong></div><div><span>Marks Obtained</span><strong>${esc(rec.marks)} / ${esc(max)}</strong></div><div><span>Percentage</span><strong>${percentage}%</strong></div><div><span>Grade</span><strong>${esc(rec.grade||'')}</strong></div></div><div class="result-school-name">Government High School (Campus) Saeedpur</div><div class="result-disclaimer">This is the school website result record. For board-issued certification, refer to the official board record.</div></div>`;
        box.className='result-message show';
      });
      const rd=published(data.documents).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      if(docs) docs.innerHTML=rd.length?rd.map(x=>{const f=safeUrl(x.file);return `<article class="managed-card"><div class="managed-body"><div class="managed-meta"><span>${esc(x.class_name||'Result')}</span>${x.date?`<span>${prettyDate(x.date)}</span>`:''}</div><h3>${esc(x.title)}</h3><p>${esc(x.description||'')}</p>${f?`<a class="btn btn-outline managed-action" href="${esc(f)}" target="_blank" rel="noopener">Open Result File</a>`:''}</div></article>`}).join(''):'<div class="small">No additional result document has been published.</div>';
    } catch(e){ document.querySelector('#result-message').innerHTML='<div class="result-alert">Result data could not be loaded right now.</div>';document.querySelector('#result-message').className='result-message show'; }
  }

  loadSchool(); loadNotices(); loadDownloads(); loadGallery(); loadAchievements(); loadStaff(); loadResults();
})();
