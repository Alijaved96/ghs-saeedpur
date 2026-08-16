(() => {
  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('dashboard');
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

  const modal = document.getElementById('detailModal');
  const closeModal = document.getElementById('closeModal');
  const detailGrid = document.getElementById('detailGrid');
  const modalStatus = document.getElementById('modalStatus');
  const saveStatusBtn = document.getElementById('saveStatusBtn');
  const printBtn = document.getElementById('printBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  const liveRegion = document.getElementById('liveRegion');

  let applications = [];
  let selectedId = null;


  const escapeHtml = value =>
    String(value ?? '').replace(
      /[&<>'"]/g,
      ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[ch]
    );


  const prettyDate = value => {
    if (!value) return '—';

    const d = new Date(value);

    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleString('en-PK', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });
  };


  function showLoggedOut() {
    applications = [];

    loginPanel.hidden = false;
    dashboard.hidden = true;

    if (logoutBtn) {
      logoutBtn.hidden = true;
    }
  }


  function showLoggedIn() {
    loginPanel.hidden = true;
    dashboard.hidden = false;

    if (logoutBtn) {
      logoutBtn.hidden = false;
    }

    signedInAs.textContent =
      'Signed in as Administrator';
  }


  async function checkSession() {
    try {
      const response = await fetch('/api/admin-session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (!response.ok) {
        showLoggedOut();
        return false;
      }

      const result = await response.json()
        .catch(() => ({}));

      if (!result.authenticated) {
        showLoggedOut();
        return false;
      }

      showLoggedIn();
      return true;

    } catch (error) {
      showLoggedOut();
      return false;
    }
  }


  async function apiFetch(options = {}) {
    const response = await fetch('/api/admission-admin', {
      ...options,

      credentials: 'same-origin',

      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },

      cache: 'no-store'
    });

    const payload = await response.json()
      .catch(() => ({}));

    if (response.status === 401) {
      showLoggedOut();

      throw new Error(
        'Administrator session expired. Please sign in again.'
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.error ||
        `Request failed (${response.status})`
      );
    }

    return payload;
  }


  async function loadApplications() {
    loadingState.hidden = false;
    errorState.hidden = true;
    emptyState.hidden = true;
    tableWrap.hidden = true;

    try {
      const result = await apiFetch({
        method: 'GET'
      });

      applications =
        Array.isArray(result.applications)
          ? result.applications
          : [];

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
    document.getElementById('totalCount').textContent =
      applications.length;

    document.getElementById('pendingCount').textContent =
      applications.filter(
        app => (app.status || 'Pending') === 'Pending'
      ).length;

    document.getElementById('approvedCount').textContent =
      applications.filter(
        app => app.status === 'Approved'
      ).length;

    document.getElementById('rejectedCount').textContent =
      applications.filter(
        app => app.status === 'Rejected'
      ).length;
  }


  function filteredApplications() {
    const q =
      searchInput.value.trim().toLowerCase();

    const status =
      statusFilter.value;

    return applications.filter(app => {
      const d = app.data || {};

      const haystack = [
        d.student_name,
        d.student_surname,
        d.guardian_name,
        d.mobile,
        d.class_applying,
        d.previous_school,
        d.student_bform_number,
        d.father_cnic_number
      ]
        .join(' ')
        .toLowerCase();

      const appStatus =
        app.status || 'Pending';

      return (
        (!q || haystack.includes(q)) &&
        (status === 'All' || appStatus === status)
      );
    });
  }


  function renderRows() {
    const rows = filteredApplications();

    recordsBody.innerHTML = rows.map(app => {
      const d = app.data || {};
      const status = app.status || 'Pending';

      return `
        <tr>

          <td>
            <span class="student-name">
              ${escapeHtml(d.student_name || '—')}
            </span>
            <br>
            <span class="muted">
              Surname:
              ${escapeHtml(d.student_surname || '—')}
            </span>
          </td>

          <td>
            ${escapeHtml(d.guardian_name || '—')}
          </td>

          <td>
            ${escapeHtml(d.class_applying || '—')}
          </td>

          <td>
            ${escapeHtml(d.mobile || '—')}
          </td>

          <td>
            ${escapeHtml(prettyDate(app.created_at))}
          </td>

          <td>
            <span class="status-pill status-${escapeHtml(status)}">
              ${escapeHtml(status)}
            </span>
          </td>

          <td>
            <div class="row-actions">

              <button
                class="mini-btn"
                data-view="${escapeHtml(app.id)}"
                type="button">
                View
              </button>

              <button
                class="mini-btn"
                data-print="${escapeHtml(app.id)}"
                type="button">
                Print
              </button>

            </div>
          </td>

        </tr>
      `;
    }).join('');


    emptyState.hidden = rows.length > 0;
    tableWrap.hidden = rows.length === 0;


    recordsBody
      .querySelectorAll('[data-view]')
      .forEach(button => {

        button.addEventListener(
          'click',
          () => openDetails(
            button.dataset.view,
            false
          )
        );
      });


    recordsBody
      .querySelectorAll('[data-print]')
      .forEach(button => {

        button.addEventListener(
          'click',
          () => openDetails(
            button.dataset.print,
            true
          )
        );
      });
  }


  function detailItem(label, value, wide = false) {
    return `
      <div class="detail-item${wide ? ' wide' : ''}">
        <span>${escapeHtml(label)}</span>
        <strong>
          ${escapeHtml(value || '—')}
        </strong>
      </div>
    `;
  }


  function safeFileUrl(value) {
    if (!value) return null;

    try {
      const url = new URL(
        String(value),
        window.location.origin
      );

      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : null;

    } catch {
      return null;
    }
  }


  function fileDetailItem(
    label,
    value,
    imagePreview = false
  ) {
    const href = safeFileUrl(value);

    if (!value) {
      return detailItem(
        label,
        'Not available',
        true
      );
    }

    if (!href) {
      return detailItem(
        label,
        value,
        true
      );
    }

    const preview = imagePreview
      ? `
        <img
          src="${escapeHtml(href)}"
          alt="${escapeHtml(label)}"
          style="
            display:block;
            width:110px;
            height:135px;
            object-fit:cover;
            border-radius:10px;
            margin:8px 0;
            border:1px solid #dce3ef;
          ">
        `
      : '';

    return `
      <div class="detail-item wide">

        <span>
          ${escapeHtml(label)}
        </span>

        ${preview}

        <strong>
          <a
            href="${escapeHtml(href)}"
            target="_blank"
            rel="noopener">
            Open uploaded file ↗
          </a>
        </strong>

      </div>
    `;
  }


  function openDetails(
    id,
    printAfter = false
  ) {
    const app =
      applications.find(
        item => item.id === id
      );

    if (!app) return;

    selectedId = id;

    const d = app.data || {};

    detailGrid.innerHTML = [

      detailItem(
        "Student's Full Name",
        d.student_name
      ),

      detailItem(
        "Father's Full Name",
        d.guardian_name
      ),

      detailItem(
        'Surname',
        d.student_surname
      ),

      detailItem(
        'Class Applying For',
        d.class_applying
      ),

      detailItem(
        'Last School Attended',
        d.previous_school
      ),

      detailItem(
        'Date of Birth',
        d.date_of_birth
      ),

      detailItem(
        'Student B-Form / CRC Number',
        d.student_bform_number
      ),

      detailItem(
        "Father's CNIC Number",
        d.father_cnic_number
      ),

      detailItem(
        'Phone Number',
        d.mobile
      ),

      fileDetailItem(
        'Student Photograph (Optional)',
        d.student_photo,
        true
      ),

      fileDetailItem(
        'Student B-Form / CRC Copy (Optional)',
        d.student_bform
      ),

      detailItem(
        'Declaration',
        d.declaration,
        true
      ),

      detailItem(
        'Submitted',
        prettyDate(app.created_at)
      ),

      detailItem(
        'Current Status',
        app.status || 'Pending'
      ),

      detailItem(
        'Last Status Update',
        app.updated_at
          ? prettyDate(app.updated_at)
          : '—'
      )

    ].join('');


    modalStatus.value =
      app.status || 'Pending';

    modal.classList.add('open');


    if (printAfter) {
      setTimeout(
        () => window.print(),
        150
      );
    }
  }


  async function saveStatus() {
    if (!selectedId) return;

    saveStatusBtn.disabled = true;
    saveStatusBtn.textContent = 'Saving…';

    try {
      const result = await apiFetch({

        method: 'POST',

        body: JSON.stringify({
          action: 'update-status',
          id: selectedId,
          status: modalStatus.value
        })
      });


      const index =
        applications.findIndex(
          app => app.id === selectedId
        );


      if (index >= 0) {
        applications[index] =
          result.application;
      }


      updateStats();
      renderRows();

      openDetails(
        selectedId,
        false
      );


      liveRegion.textContent =
        `Application status changed to ${modalStatus.value}.`;

    } catch (error) {
      alert(error.message);

    } finally {
      saveStatusBtn.disabled = false;
      saveStatusBtn.textContent =
        'Save Status';
    }
  }


  function downloadSelectedApplication() {
    const app =
      applications.find(
        item => item.id === selectedId
      );

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

      `Student's Full Name: ${d.student_name || ''}`,

      `Father's Full Name: ${d.guardian_name || ''}`,

      `Surname: ${d.student_surname || ''}`,

      `Class Applying For: ${d.class_applying || ''}`,

      `Last School Attended: ${d.previous_school || ''}`,

      `Date of Birth: ${d.date_of_birth || ''}`,

      `Student B-Form / CRC Number: ${d.student_bform_number || ''}`,

      `Father's CNIC Number: ${d.father_cnic_number || ''}`,

      `Phone Number: ${d.mobile || ''}`,

      `Student Photograph: ${d.student_photo || ''}`,

      `Student B-Form Copy: ${d.student_bform || ''}`,

      `Declaration: ${d.declaration || ''}`,

      '',

      'Government High School (Campus) Saeedpur',

      'Saeedpur, Taluka Talhar, District Badin, Sindh'
    ];


    const blob =
      new Blob(
        [lines.join('\r\n')],
        {
          type:
            'text/plain;charset=utf-8'
        }
      );


    const url =
      URL.createObjectURL(blob);


    const link =
      document.createElement('a');


    const safeName =
      String(
        d.student_name ||
        'application'
      )
        .replace(
          /[^a-z0-9_-]+/gi,
          '-'
        )
        .replace(
          /^-|-$/g,
          ''
        );


    link.href = url;

    link.download =
      `Admission-${safeName || 'Application'}.txt`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  }


  function exportCsv() {
    const rows =
      filteredApplications();

    if (!rows.length) {
      alert('No records to export.');
      return;
    }


    const headers = [

      'Application ID',
      'Submitted',
      'Status',
      "Student's Full Name",
      "Father's Full Name",
      'Surname',
      'Class Applying For',
      'Last School Attended',
      'Date of Birth',
      'Student B-Form / CRC Number',
      "Father's CNIC Number",
      'Phone Number',
      'Student Photograph',
      'Student B-Form Copy',
      'Declaration'
    ];


    const values =
      rows.map(app => {

        const d = app.data || {};

        return [
          app.id,
          app.created_at,
          app.status || 'Pending',
          d.student_name,
          d.guardian_name,
          d.student_surname,
          d.class_applying,
          d.previous_school,
          d.date_of_birth,
          d.student_bform_number,
          d.father_cnic_number,
          d.mobile,
          d.student_photo,
          d.student_bform,
          d.declaration
        ];
      });


    const csv =
      [headers, ...values]
        .map(
          row =>
            row
              .map(
                value =>
                  `"${String(value ?? '')
                    .replace(/"/g, '""')}"`
              )
              .join(',')
        )
        .join('\r\n');


    const blob =
      new Blob(
        [csv],
        {
          type:
            'text/csv;charset=utf-8'
        }
      );


    const url =
      URL.createObjectURL(blob);


    const link =
      document.createElement('a');


    link.href = url;

    link.download =
      `GHS-Saeedpur-Admission-Applications-${
        new Date()
          .toISOString()
          .slice(0, 10)
      }.csv`;


    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  }


  logoutBtn.addEventListener(
    'click',
    async () => {

      try {
        await fetch(
          '/api/admin-logout',
          {
            method: 'POST',
            credentials: 'same-origin'
          }
        );

      } finally {
        window.location.href =
          '/admin/';
      }
    }
  );


  refreshBtn.addEventListener(
    'click',
    loadApplications
  );


  exportBtn.addEventListener(
    'click',
    exportCsv
  );


  searchInput.addEventListener(
    'input',
    renderRows
  );


  statusFilter.addEventListener(
    'change',
    renderRows
  );


  closeModal.addEventListener(
    'click',
    () => modal.classList.remove('open')
  );


  modal.addEventListener(
    'click',
    event => {

      if (event.target === modal) {
        modal.classList.remove('open');
      }
    }
  );


  saveStatusBtn.addEventListener(
    'click',
    saveStatus
  );


  printBtn.addEventListener(
    'click',
    () => window.print()
  );


  downloadBtn.addEventListener(
    'click',
    downloadSelectedApplication
  );


  document.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Escape') {
        modal.classList.remove('open');
      }
    }
  );


  async function start() {
    const authenticated =
      await checkSession();

    if (authenticated) {
      await loadApplications();
    }
  }


  start();

})();
