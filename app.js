// ========== STATE ==========
const state = {
  assignments: [],
  events: [],
  studyBlocks: [],
  courses: [],
  currentView: 'dashboard',
  currentFilter: 'all',
  calendarDate: new Date(),
  modalType: null,
  selectedPriority: 'medium',
  selectedColor: '#e8d4a8',
  editingId: null
};

const COURSE_COLORS = [
  '#e8d4a8', '#ff9b6b', '#6bbfff', '#a78bfa',
  '#6bd4a8', '#ff6b9b', '#ffd56b', '#6bd4d4'
];

// ========== STORAGE ==========
function save() {
  const data = {
    assignments: state.assignments,
    events: state.events,
    studyBlocks: state.studyBlocks,
    courses: state.courses
  };
  // Use IndexedDB via simple wrapper for persistence
  try {
    const req = indexedDB.open('studytrack', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data');
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('data', 'readwrite');
      tx.objectStore('data').put(data, 'state');
    };
  } catch (e) { console.warn('Save failed', e); }
}

function load() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('studytrack', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data');
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('data', 'readonly');
        const getReq = tx.objectStore('data').get('state');
        getReq.onsuccess = () => {
          if (getReq.result) {
            state.assignments = getReq.result.assignments || [];
            state.events = getReq.result.events || [];
            state.studyBlocks = getReq.result.studyBlocks || [];
            state.courses = getReq.result.courses || [];
          }
          resolve();
        };
        getReq.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch (e) { resolve(); }
  });
}

// ========== UTILS ==========
const uid = () => Math.random().toString(36).slice(2, 11);

const fmtDate = (d) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

const sameDay = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const daysUntil = (dateStr) => {
  const target = new Date(dateStr);
  target.setHours(23, 59, 59, 999);
  const now = new Date();
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getCountdown = (dateStr) => {
  const days = daysUntil(dateStr);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, cls: 'overdue' };
  if (days === 0) return { text: 'Today', cls: 'urgent' };
  if (days === 1) return { text: 'Tomorrow', cls: 'urgent' };
  if (days <= 3) return { text: `${days}d left`, cls: 'urgent' };
  if (days <= 7) return { text: `${days}d left`, cls: 'soon' };
  return { text: `${days}d left`, cls: '' };
};

const getCourse = (id) => state.courses.find(c => c.id === id);

// ========== TOAST ==========
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ========== VIEWS ==========
function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `${view}-view`));
  render();
}

function render() {
  renderDashboard();
  renderCalendar();
  renderAssignments();
  renderCourses();
  renderStudy();
}

function renderDashboard() {
  // Date label
  const today = new Date();
  document.getElementById('todayDate').textContent = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  }).toUpperCase();

  // Stats
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const dueWeek = state.assignments.filter(a => !a.completed && new Date(a.dueDate) <= weekEnd && new Date(a.dueDate) >= now).length;
  const inProg = state.assignments.filter(a => !a.completed && a.progress > 0 && a.progress < 100).length;
  const done = state.assignments.filter(a => a.completed).length;
  const totalActive = state.assignments.filter(a => !a.completed).length;

  document.getElementById('dueWeek').textContent = dueWeek;
  document.getElementById('inProgress').textContent = inProg;
  document.getElementById('completedCount').textContent = done;

  document.getElementById('dueWeekBar').style.width = Math.min(100, dueWeek * 14) + '%';
  document.getElementById('inProgressBar').style.width = Math.min(100, inProg * 20) + '%';
  document.getElementById('completedBar').style.width = state.assignments.length ? (done / state.assignments.length * 100) + '%' : '0%';

  // Upcoming assignments
  const upcoming = state.assignments
    .filter(a => !a.completed)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  document.getElementById('upcomingCount').textContent = totalActive;
  document.getElementById('upcomingList').innerHTML = upcoming.length
    ? upcoming.map(renderAssignmentCard).join('')
    : '<div class="empty-state">No active assignments. Click "New" to add one.</div>';

  // Today's events
  const todayEvents = state.events.filter(e => sameDay(e.date, today))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  document.getElementById('todayEvents').innerHTML = todayEvents.length
    ? todayEvents.map(renderEventCard).join('')
    : '<div class="empty-state">No events today.</div>';

  // Today's study blocks
  const todayStudy = state.studyBlocks.filter(s => sameDay(s.date, today))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  document.getElementById('todayStudy').innerHTML = todayStudy.length
    ? todayStudy.map(renderStudyCard).join('')
    : '<div class="empty-state">No study blocks today.</div>';
}

function renderAssignmentCard(a) {
  const course = getCourse(a.courseId);
  const countdown = getCountdown(a.dueDate);
  return `
    <div class="card ${a.completed ? 'completed' : ''}" onclick="event.stopPropagation()">
      <div class="card-priority ${a.priority}"></div>
      <div class="checkbox ${a.completed ? 'checked' : ''}" onclick="toggleComplete('${a.id}')"></div>
      <div class="card-main">
        <div class="card-title">${escapeHtml(a.title)}</div>
        <div class="card-meta">
          ${course ? `<span class="course-tag"><span class="course-tag-dot" style="background:${course.color}"></span>${escapeHtml(course.name)}</span>` : ''}
          <span>${fmtDate(a.dueDate)}</span>
          ${!a.completed ? `<span class="countdown ${countdown.cls}">${countdown.text}</span>` : ''}
        </div>
        ${a.progress > 0 && !a.completed ? `
          <div class="progress-bar"><div class="progress-fill" style="width:${a.progress}%"></div></div>
        ` : ''}
      </div>
      ${a.progress > 0 && !a.completed ? `<div class="progress-text">${a.progress}%</div>` : ''}
      <button class="card-delete" onclick="event.stopPropagation(); deleteItem('assignment','${a.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
  `;
}

function renderEventCard(e) {
  return `
    <div class="card">
      <div class="card-priority medium"></div>
      <div class="card-main">
        <div class="card-title">${escapeHtml(e.title)}</div>
        <div class="card-meta">
          <span>${fmtDate(e.date)}</span>
          ${e.time ? `<span>${fmtTime(e.time)}</span>` : ''}
          ${e.location ? `<span>· ${escapeHtml(e.location)}</span>` : ''}
        </div>
      </div>
      <button class="card-delete" onclick="event.stopPropagation(); deleteItem('event','${e.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
  `;
}

function renderStudyCard(s) {
  const course = getCourse(s.courseId);
  return `
    <div class="card">
      <div class="card-priority low"></div>
      <div class="card-main">
        <div class="card-title">${escapeHtml(s.title || 'Study session')}</div>
        <div class="card-meta">
          ${course ? `<span class="course-tag"><span class="course-tag-dot" style="background:${course.color}"></span>${escapeHtml(course.name)}</span>` : ''}
          <span>${fmtDate(s.date)}</span>
          ${s.startTime ? `<span>${fmtTime(s.startTime)}${s.endTime ? ` – ${fmtTime(s.endTime)}` : ''}</span>` : ''}
        </div>
      </div>
      <button class="card-delete" onclick="event.stopPropagation(); deleteItem('study','${s.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
  `;
}

function renderAssignments() {
  let list = [...state.assignments];
  if (state.currentFilter === 'active') list = list.filter(a => !a.completed);
  else if (state.currentFilter === 'completed') list = list.filter(a => a.completed);
  else if (state.currentFilter === 'high') list = list.filter(a => a.priority === 'high' && !a.completed);

  list.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  document.getElementById('assignmentsList').innerHTML = list.length
    ? list.map(renderAssignmentCard).join('')
    : '<div class="empty-state">No assignments match this filter.</div>';
}

function renderCalendar() {
  const date = state.calendarDate;
  const year = date.getFullYear();
  const month = date.getMonth();

  document.getElementById('calMonthLabel').textContent = date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  document.getElementById('calYearLabel').textContent = year;

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let html = '<div class="cal-header">';
  dayNames.forEach(d => html += `<div class="cal-day-name">${d}</div>`);
  html += '</div><div class="cal-grid">';

  // Previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
  }

  // Current month
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(year, month, day);
    const isToday = sameDay(dayDate, today);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const dayAssignments = state.assignments.filter(a => a.dueDate === dateStr && !a.completed);
    const dayEvents = state.events.filter(e => e.date === dateStr);
    const dayStudy = state.studyBlocks.filter(s => s.date === dateStr);

    html += `<div class="cal-day ${isToday ? 'today' : ''}" onclick="openModalForDate('${dateStr}')">`;
    html += `<div class="cal-day-num">${day}</div>`;
    dayAssignments.slice(0, 2).forEach(a => {
      html += `<div class="cal-event" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</div>`;
    });
    dayEvents.slice(0, 2).forEach(e => {
      html += `<div class="cal-event event-type" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</div>`;
    });
    dayStudy.slice(0, 2).forEach(s => {
      html += `<div class="cal-event study-type" title="${escapeHtml(s.title || 'Study')}">${escapeHtml(s.title || 'Study')}</div>`;
    });
    const total = dayAssignments.length + dayEvents.length + dayStudy.length;
    if (total > 4) html += `<div class="cal-event" style="opacity:0.5">+${total - 4} more</div>`;
    html += '</div>';
  }

  // Next month padding
  const totalCells = startDay + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  html += '</div>';
  document.getElementById('calendar').innerHTML = html;
}

function changeMonth(delta) {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + delta);
  renderCalendar();
}

function goToToday() {
  state.calendarDate = new Date();
  renderCalendar();
}

function openModalForDate(dateStr) {
  openModal('assignment');
  setTimeout(() => {
    const input = document.querySelector('input[name="dueDate"]');
    if (input) input.value = dateStr;
  }, 50);
}

function renderCourses() {
  document.getElementById('coursesList').innerHTML = state.courses.length
    ? state.courses.map(c => {
        const courseAssignments = state.assignments.filter(a => a.courseId === c.id);
        const active = courseAssignments.filter(a => !a.completed).length;
        const done = courseAssignments.filter(a => a.completed).length;
        return `
          <div class="course-card" style="--course-color:${c.color}" onclick="event.stopPropagation()">
            <div class="course-name">${escapeHtml(c.name)}</div>
            <div class="course-code">${escapeHtml(c.code || '')}</div>
            <div class="course-stats">
              <span><span class="course-stat-num">${active}</span>active</span>
              <span><span class="course-stat-num">${done}</span>done</span>
              <button class="card-delete" style="opacity:1; margin-left:auto" onclick="event.stopPropagation(); deleteItem('course','${c.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state" style="grid-column:1/-1">No courses yet. Add one to start color-coding your assignments.</div>';
}

function renderStudy() {
  const list = [...state.studyBlocks].sort((a, b) => new Date(a.date) - new Date(b.date));
  document.getElementById('studyList').innerHTML = list.length
    ? list.map(renderStudyCard).join('')
    : '<div class="empty-state">No study sessions planned. Click "New session" to schedule one.</div>';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// ========== ACTIONS ==========
function toggleComplete(id) {
  const a = state.assignments.find(x => x.id === id);
  if (a) {
    a.completed = !a.completed;
    if (a.completed) a.progress = 100;
    save();
    render();
    toast(a.completed ? '✓ Marked complete' : 'Reopened');
  }
}

function deleteItem(type, id) {
  const map = { assignment: 'assignments', event: 'events', study: 'studyBlocks', course: 'courses' };
  const key = map[type];
  state[key] = state[key].filter(x => x.id !== id);
  save();
  render();
  toast('Deleted');
}

// ========== MODAL ==========
function openModal(type) {
  state.modalType = type;
  state.editingId = null;
  state.selectedPriority = 'medium';
  state.selectedColor = COURSE_COLORS[state.courses.length % COURSE_COLORS.length];

  const titles = { assignment: 'New assignment', event: 'New event', study: 'New study session', course: 'New course' };
  document.getElementById('modalTitle').textContent = titles[type];

  let body = '';
  const today = new Date().toISOString().split('T')[0];

  if (type === 'assignment') {
    body = `
      <div class="form-group">
        <label>Title</label>
        <input class="form-input" name="title" placeholder="Essay draft, Chapter 5 problems..." autofocus />
      </div>
      <div class="form-group">
        <label>Course</label>
        <select class="form-select" name="courseId">
          <option value="">No course</option>
          ${state.courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Due date</label>
          <input class="form-input" type="date" name="dueDate" value="${today}" />
        </div>
        <div class="form-group">
          <label>Progress (%)</label>
          <input class="form-input" type="number" name="progress" min="0" max="100" value="0" />
        </div>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <div class="priority-picker">
          <div class="priority-option" data-p="low" onclick="selectPriority('low')">Low</div>
          <div class="priority-option selected" data-p="medium" onclick="selectPriority('medium')">Medium</div>
          <div class="priority-option" data-p="high" onclick="selectPriority('high')">High</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveAssignment()">Save</button>
      </div>
    `;
  } else if (type === 'event') {
    body = `
      <div class="form-group">
        <label>Title</label>
        <input class="form-input" name="title" placeholder="Lecture, exam, meeting..." autofocus />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input class="form-input" type="date" name="date" value="${today}" />
        </div>
        <div class="form-group">
          <label>Time</label>
          <input class="form-input" type="time" name="time" />
        </div>
      </div>
      <div class="form-group">
        <label>Location (optional)</label>
        <input class="form-input" name="location" placeholder="Room 204, Zoom..." />
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveEvent()">Save</button>
      </div>
    `;
  } else if (type === 'study') {
    body = `
      <div class="form-group">
        <label>What are you studying?</label>
        <input class="form-input" name="title" placeholder="Review chapter 3, practice problems..." autofocus />
      </div>
      <div class="form-group">
        <label>Course</label>
        <select class="form-select" name="courseId">
          <option value="">No course</option>
          ${state.courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input class="form-input" type="date" name="date" value="${today}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Start time</label>
          <input class="form-input" type="time" name="startTime" />
        </div>
        <div class="form-group">
          <label>End time</label>
          <input class="form-input" type="time" name="endTime" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveStudy()">Save</button>
      </div>
    `;
  } else if (type === 'course') {
    body = `
      <div class="form-group">
        <label>Course name</label>
        <input class="form-input" name="name" placeholder="Organic Chemistry, World History..." autofocus />
      </div>
      <div class="form-group">
        <label>Course code (optional)</label>
        <input class="form-input" name="code" placeholder="CHEM 301, HIST 215..." />
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker">
          ${COURSE_COLORS.map((c, i) => `
            <div class="color-swatch ${i === state.courses.length % COURSE_COLORS.length ? 'selected' : ''}" style="background:${c}" onclick="selectColor('${c}')"></div>
          `).join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveCourse()">Save</button>
      </div>
    `;
  }

  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  state.modalType = null;
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'modalOverlay') closeModal();
}

function selectPriority(p) {
  state.selectedPriority = p;
  document.querySelectorAll('.priority-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.p === p);
  });
}

function selectColor(c) {
  state.selectedColor = c;
  document.querySelectorAll('.color-swatch').forEach(el => {
    el.classList.toggle('selected', el.style.background === c || el.style.backgroundColor === hexToRgb(c));
  });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function getVal(name) {
  const el = document.querySelector(`[name="${name}"]`);
  return el ? el.value.trim() : '';
}

function saveAssignment() {
  const title = getVal('title');
  if (!title) { toast('Title required'); return; }
  state.assignments.push({
    id: uid(),
    title,
    courseId: getVal('courseId'),
    dueDate: getVal('dueDate'),
    progress: parseInt(getVal('progress')) || 0,
    priority: state.selectedPriority,
    completed: false,
    created: Date.now()
  });
  save();
  closeModal();
  render();
  toast('✓ Assignment added');
  scheduleNotifications();
}

function saveEvent() {
  const title = getVal('title');
  if (!title) { toast('Title required'); return; }
  state.events.push({
    id: uid(),
    title,
    date: getVal('date'),
    time: getVal('time'),
    location: getVal('location')
  });
  save();
  closeModal();
  render();
  toast('✓ Event added');
}

function saveStudy() {
  const title = getVal('title');
  state.studyBlocks.push({
    id: uid(),
    title: title || 'Study session',
    courseId: getVal('courseId'),
    date: getVal('date'),
    startTime: getVal('startTime'),
    endTime: getVal('endTime')
  });
  save();
  closeModal();
  render();
  toast('✓ Study block added');
  scheduleNotifications();
}

function saveCourse() {
  const name = getVal('name');
  if (!name) { toast('Name required'); return; }
  state.courses.push({
    id: uid(),
    name,
    code: getVal('code'),
    color: state.selectedColor
  });
  save();
  closeModal();
  render();
  toast('✓ Course added');
}

// ========== NOTIFICATIONS ==========
let notifTimers = [];

async function enableNotifications() {
  if (!('Notification' in window)) {
    toast('Notifications not supported on this device');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    document.getElementById('notifBtn').classList.add('enabled');
    document.getElementById('notifBtn').querySelector('span').textContent = 'Notifications on';
    toast('🔔 Notifications enabled');
    scheduleNotifications();
  } else {
    toast('Permission denied');
  }
}

function scheduleNotifications() {
  notifTimers.forEach(t => clearTimeout(t));
  notifTimers = [];
  if (Notification.permission !== 'granted') return;

  const now = Date.now();

  // Schedule for upcoming assignments — 1 day before at 9am
  state.assignments.filter(a => !a.completed).forEach(a => {
    const due = new Date(a.dueDate);
    const remind = new Date(due);
    remind.setDate(remind.getDate() - 1);
    remind.setHours(9, 0, 0, 0);
    const delay = remind.getTime() - now;
    if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
      notifTimers.push(setTimeout(() => {
        new Notification('Due tomorrow', { body: a.title, icon: 'icon-192.png' });
      }, delay));
    }

    // Due today reminder at 9am
    const dueDay = new Date(due);
    dueDay.setHours(9, 0, 0, 0);
    const dueDelay = dueDay.getTime() - now;
    if (dueDelay > 0 && dueDelay < 7 * 24 * 60 * 60 * 1000) {
      notifTimers.push(setTimeout(() => {
        new Notification('Due today!', { body: a.title, icon: 'icon-192.png' });
      }, dueDelay));
    }
  });

  // Study block reminders — at start time
  state.studyBlocks.forEach(s => {
    if (!s.startTime) return;
    const [h, m] = s.startTime.split(':');
    const start = new Date(s.date);
    start.setHours(parseInt(h), parseInt(m), 0, 0);
    const delay = start.getTime() - now;
    if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
      notifTimers.push(setTimeout(() => {
        const course = getCourse(s.courseId);
        new Notification('Study time', {
          body: `${s.title}${course ? ` — ${course.name}` : ''}`,
          icon: 'icon-192.png'
        });
      }, delay));
    }
  });
}

// ========== INIT ==========
async function init() {
  await load();

  // Seed example data on first run
  if (state.assignments.length === 0 && state.courses.length === 0) {
    const seedCourse = { id: uid(), name: 'Welcome 👋', code: 'GETTING STARTED', color: '#e8d4a8' };
    state.courses.push(seedCourse);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    state.assignments.push({
      id: uid(),
      title: 'Add your real courses & assignments',
      courseId: seedCourse.id,
      dueDate: tomorrow.toISOString().split('T')[0],
      progress: 0,
      priority: 'medium',
      completed: false,
      created: Date.now()
    });
    save();
  }

  // Nav
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.addEventListener('click', () => switchView(b.dataset.view));
  });

  // Filters
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.addEventListener('click', () => {
      state.currentFilter = c.dataset.filter;
      document.querySelectorAll('.filter-chip').forEach(x => x.classList.toggle('active', x === c));
      renderAssignments();
    });
  });

  // Notifications
  document.getElementById('notifBtn').addEventListener('click', enableNotifications);
  if (Notification.permission === 'granted') {
    document.getElementById('notifBtn').classList.add('enabled');
    document.getElementById('notifBtn').querySelector('span').textContent = 'Notifications on';
    scheduleNotifications();
  }

  // Service worker for PWA install
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
}

init();
