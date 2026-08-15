(() => {
  const identity = window.netlifyIdentity;
  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('dashboard');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const signedInAs = document.getElementById('signedInAs');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const emptyState = document.getElementById('emptyState');
  const tableWrap = document.getElementById('tableWrap');
  const recordsBody = document.getElementById('recordsBody');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  const liveRegion = document.getElementById('liveRegion');
  const modal = document.getElementById('detailModal');
  const closeModal = document.getElementById('closeModal');
  const detailGrid = document.getElementById('detailGrid');
  const modalStatus = document.getElementById('modalStatus');
  const saveStatusBtn = document.getElementById('saveStatusBtn');
  const printBtn = document.getElementById('printBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  let applications = [];
  let selectedId = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const prettyDate = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-PK', {dateStyle:'medium', timeStyle:'short'});
  };

  async function authToken() {
    const user = identity.currentUser();
    if (!user) throw new Error('Please log in as an administrator.');
    return identity.refresh();
  }

  async function apiFetch(options = {}) {
    const token = await authToken();
    const response = await fetch('/.netlify/functions/admission-admin', {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function renderAuth(user) {
    loginPanel.hidden = Boolean(user);
    dashboard.hidden = !user;
    logoutBtn.hidden = !user;
    if (user) {
      signedInAs.textContent = `Signed in as ${user.email || 'Administrator'}`;
      loadApplications();
    }
  }

  async function loadApplications() {
    loadingState.hidden = false;
    errorState.hidden = true;
    emptyState.hidden = true;
    tableWrap.hidden = true;
    try {
      const result = await apiFetch({ method: 'GET' });
      applications = Array.isArray(result.applications) ? result.applications : [];
      updateStats();
      renderRows();
    } catch (error) {
      errorState.textContent = error.message;
      errorState.hidden = false;
    } finally {
      loadingState.hidden = true;
    }
  }

  function updateStats() {
    document.getElementById('totalCount').textContent = applications.length;
    document.getElementById('pendingCount').textContent = applications.filter(a => a.status === 'Pending').length;
    document.getElementById('approvedCount').textContent = applications.filter(a => a.status === 'Approved').length;
    document.getElementById('rejectedCount').textContent = applications.filter(a => a.status === 'Rejected').length;
  }

  function filteredApplications() {
    const q = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    return applications.filter(app => {
      const d = app.data || {};
      const haystack = [d.student_name,d.guardian_name,d.mobile,d.class_applying,d.previous_school,d.address].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) && (status === 'All' || app.status === status);
    });
  }

  function renderRows() {
    const rows = filteredApplications();
    recordsBody.innerHTML = rows.map(app => {
      const d = app.data || {};
      return `<tr>
        <td><span class="student-name">${escapeHtml(d.student_name || '—')}</span><br><span class="muted">${escapeHtml(d.gender || '')}</span></td>
        <td>${escapeHtml(d.guardian_name || '—')}</td>
        <td>${escapeHtml(d.class_applying || '—')}</td>
        <td>${escapeHtml(d.mobile || '—')}</td>
        <td>${escapeHtml(prettyDate(app.created_at))}</td>
        <td><span class="status-pill status-${escapeHtml(app.status || 'Pending')}">${escapeHtml(app.status || 'Pending')}</span></td>
        <td><div class="row-actions"><button class="mini-btn" data-view="${escapeHtml(app.id)}" type="button">View</button><button class="mini-btn" data-print="${escapeHtml(app.id)}" type="button">Print</button></div></td>
      </tr>`;
    }).join('');
    emptyState.hidden = rows.length > 0;
    tableWrap.hidden = rows.length === 0;
    recordsBody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => openDetails(btn.dataset.view, false)));
    recordsBody.querySelectorAll('[data-print]').forEach(btn => btn.addEventListener('click', () => openDetails(btn.dataset.print, true)));
  }

  function detailItem(label, value, wide = false) {
    return `<div class="detail-item${wide ? ' wide' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`;
  }

  function openDetails(id, printAfter = false) {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    selectedId = id;
    const d = app.data || {};
    detailGrid.innerHTML = [
      detailItem('Student Full Name', d.student_name),
      detailItem('Father / Guardian Name', d.guardian_name),
      detailItem('Date of Birth', d.date_of_birth),
      detailItem('Gender', d.gender),
      detailItem('Class Applying For', d.class_applying),
      detailItem('Last Class Attended', d.last_class),
      detailItem('Mobile Number', d.mobile),
      detailItem('Previous School', d.previous_school),
      detailItem('Residential Address', d.address, true),
      detailItem('Additional Information', d.message, true),
      detailItem('Declaration', d.declaration),
      detailItem('Submitted', prettyDate(app.created_at)),
      detailItem('Current Status', app.status || 'Pending'),
      detailItem('Last Status Update', app.updated_at ? prettyDate(app.updated_at) : '—')
    ].join('');
    modalStatus.value = app.status || 'Pending';
    modal.classList.add('open');
    if (printAfter) setTimeout(() => window.print(), 120);
  }

  async function saveStatus() {
    if (!selectedId) return;
    saveStatusBtn.disabled = true;
    try {
      const result = await apiFetch({
        method: 'POST',
        body: JSON.stringify({ action: 'update-status', id: selectedId, status: modalStatus.value })
      });
      const index = applications.findIndex(a => a.id === selectedId);
      if (index >= 0) applications[index] = result.application;
      updateStats();
      renderRows();
      openDetails(selectedId, false);
      liveRegion.textContent = `Application status changed to ${modalStatus.value}.`;
    } catch (error) {
      alert(error.message);
    } finally {
      saveStatusBtn.disabled = false;
    }
  }


  function downloadSelectedApplication() {
    const app = applications.find(a => a.id === selectedId);
    if (!app) return;
    const d = app.data || {};
    const lines = [
      'GOVERNMENT HIGH SCHOOL (CAMPUS) SAEEDPUR',
      'ONLINE ADMISSION APPLICATION',
      '----------------------------------------',
      `Application ID: ${app.id || ''}`,
      `Submitted: ${prettyDate(app.created_at)}`,
      `Status: ${app.status || 'Pending'}`,
      '',
      `Student Full Name: ${d.student_name || ''}`,
      `Father / Guardian Name: ${d.guardian_name || ''}`,
      `Date of Birth: ${d.date_of_birth || ''}`,
      `Gender: ${d.gender || ''}`,
      `Class Applying For: ${d.class_applying || ''}`,
      `Last Class Attended: ${d.last_class || ''}`,
      `Mobile Number: ${d.mobile || ''}`,
      `Previous School: ${d.previous_school || ''}`,
      `Residential Address: ${d.address || ''}`,
      `Additional Information: ${d.message || ''}`,
      `Declaration: ${d.declaration || ''}`,
      '',
      'Government High School (Campus) Saeedpur',
      'Saeedpur, Taluka Talhar, District Badin, Sindh'
    ];
    const blob = new Blob([lines.join('\r\n')], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = String(d.student_name || 'application').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '');
    a.href = url;
    a.download = `Admission-${safeName || 'Application'}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = filteredApplications();
    if (!rows.length) return alert('No records to export.');
    const headers = ['Application ID','Submitted','Status','Student Name','Guardian Name','Date of Birth','Gender','Class Applying','Last Class','Mobile','Previous School','Address','Additional Information','Declaration'];
    const values = rows.map(app => {
      const d = app.data || {};
      return [app.id,app.created_at,app.status,d.student_name,d.guardian_name,d.date_of_birth,d.gender,d.class_applying,d.last_class,d.mobile,d.previous_school,d.address,d.message,d.declaration];
    });
    const csv = [headers, ...values].map(row => row.map(value => `"${String(value ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GHS-Saeedpur-Admission-Applications-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  loginBtn.addEventListener('click', () => identity.open('login'));
  logoutBtn.addEventListener('click', () => identity.logout());
  refreshBtn.addEventListener('click', loadApplications);
  exportBtn.addEventListener('click', exportCsv);
  searchInput.addEventListener('input', renderRows);
  statusFilter.addEventListener('change', renderRows);
  closeModal.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  saveStatusBtn.addEventListener('click', saveStatus);
  printBtn.addEventListener('click', () => window.print());
  downloadBtn.addEventListener('click', downloadSelectedApplication);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('open'); });

  identity.on('init', renderAuth);
  identity.on('login', user => { renderAuth(user); identity.close(); });
  identity.on('logout', () => { applications = []; renderAuth(null); });
  setTimeout(() => renderAuth(identity.currentUser()), 250);
})();
