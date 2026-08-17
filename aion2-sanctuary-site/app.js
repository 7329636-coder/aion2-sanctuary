const CLASSES = {
  '검성': 'assets/classes/gladiator.png',
  '수호성': 'assets/classes/templar.png',
  '살성': 'assets/classes/assassin.png',
  '궁성': 'assets/classes/ranger.png',
  '마도성': 'assets/classes/sorcerer.png',
  '정령성': 'assets/classes/spiritmaster.png',
  '치유성': 'assets/classes/cleric.png',
  '호법성': 'assets/classes/chanter.png',
  '권성': 'assets/classes/striker.png',
};

const DUNGEON_IMAGE = {
  '루드라': 'assets/dungeons/rudra.jpg',
  '침식': 'assets/dungeons/erosion.jpg',
  '무스펠 보통': 'assets/dungeons/muspel.jpg',
  '무스펠 어려움': 'assets/dungeons/muspel.jpg',
};

const STORAGE = {
  characters: 'aion2_v2_characters',
  recruits: 'aion2_v2_recruits',
  applications: 'aion2_v2_applications',
  activities: 'aion2_v2_activities',
  recruitDraft: 'aion2_v4_recruit_draft',
};

const state = {
  characters: load(STORAGE.characters, []),
  recruits: load(STORAGE.recruits, []),
  applications: load(STORAGE.applications, {}),
  activities: load(STORAGE.activities, []),
  filter: '전체',
  selectedRecruit: null,
  currentView: 'recruit',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save() {
  localStorage.setItem(STORAGE.characters, JSON.stringify(state.characters));
  localStorage.setItem(STORAGE.recruits, JSON.stringify(state.recruits));
  localStorage.setItem(STORAGE.applications, JSON.stringify(state.applications));
  localStorage.setItem(STORAGE.activities, JSON.stringify(state.activities));
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function formatDateKo(dateString) {
  if (!dateString) return '';
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateString;
  const weekdays = ['일','월','화','수','목','금','토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
}

function render() {
  renderRecruits();
  renderCharacters();
  renderActivities();
  renderCounts();
  renderCharactersPage();
  renderApplicationsPage();
}

function renderCounts() {
  const count = d => state.recruits.filter(r => r.dungeon === d).length;
  const values = {
    'count-rudra': count('루드라'),
    'count-erosion': count('침식'),
    'count-muspel-normal': count('무스펠 보통'),
    'count-muspel-hard': count('무스펠 어려움'),
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function renderRecruits() {
  const list = document.querySelector('#recruit-list');
  const rows = state.filter === '전체' ? state.recruits : state.recruits.filter(r => r.dungeon === state.filter);
  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">＋</div>
      <strong>현재 모집 중인 파티가 없습니다.</strong>
      <span>첫 번째 성역 모집을 만들어보세요.</span>
      <button class="outline-btn empty-create">모집 만들기</button>
    </div>`;
    list.querySelector('.empty-create')?.addEventListener('click', openRecruitModal);
    return;
  }

  list.innerHTML = rows.map(r => {
    const app = state.applications[r.id];
    const dateText = r.date ? `${escapeHtml(formatDateKo(r.date))} · ${escapeHtml(r.time)}` : escapeHtml(r.time);
    const memoText = r.memo ? escapeHtml(r.memo).replace(/\n/g, '<br>') : '메모가 없습니다.';
    return `<article class="recruit-item simple-recruit-item">
      <div class="recruit-title">
        <img class="thumb" src="${DUNGEON_IMAGE[r.dungeon]}" alt="${escapeHtml(r.dungeon)}" />
        <div>
          <div class="recruit-name">${escapeHtml(r.dungeon)}</div>
          <div class="recruit-sub">${dateText}</div>
        </div>
      </div>
      <div class="recruit-meta compact-meta">
        <span class="label">현재 인원</span>
        <strong>${r.current}/${r.max}명</strong>
      </div>
      <div class="recruit-note-block">
        <span class="label">메모</span>
        <div class="recruit-note-text">${memoText}</div>
      </div>
      ${app ? `<button class="cancel-btn" data-cancel="${r.id}">참여 취소</button>` : `<button class="join-btn" data-join="${r.id}">참여하기</button>`}
    </article>`;
  }).join('');

  list.querySelectorAll('[data-join]').forEach(btn => btn.addEventListener('click', () => openJoin(btn.dataset.join)));
  list.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', () => cancelJoin(btn.dataset.cancel)));
}

function renderCharacters() {
  const wrap = document.querySelector('#character-list');
  if (!state.characters.length) {
    wrap.innerHTML = '<div class="mini-empty">등록된 캐릭터가 없습니다.</div>';
    return;
  }
  wrap.innerHTML = state.characters.map(c => `<div class="character-row ${c.representative ? 'representative' : ''}">
    <img class="class-icon" src="${CLASSES[c.className]}" alt="${escapeHtml(c.className)}" />
    <div class="char-copy"><div class="char-name">${escapeHtml(c.name)}</div><div class="char-class">${escapeHtml(c.className)}</div></div>
    ${c.representative ? '<span class="rep-badge">★ 대표</span>' : ''}
  </div>`).join('');
}

function renderCharactersPage() {
  const wrap = document.querySelector('#characters-page-list');
  if (!state.characters.length) {
    wrap.innerHTML = `<div class="empty-state page-empty">
      <div class="empty-icon">＋</div>
      <strong>등록된 캐릭터가 없습니다.</strong>
      <span>성역 신청에 사용할 캐릭터를 먼저 추가해주세요.</span>
      <button class="primary-btn" id="empty-add-character">캐릭터 추가</button>
    </div>`;
    wrap.querySelector('#empty-add-character')?.addEventListener('click', openCharacterModal);
    return;
  }

  wrap.innerHTML = state.characters.map(c => `<article class="character-card ${c.representative ? 'representative' : ''}">
    <div class="character-card-main">
      <img class="class-icon large" src="${CLASSES[c.className]}" alt="${escapeHtml(c.className)}" />
      <div>
        <div class="character-card-name">${escapeHtml(c.name)}</div>
        <div class="character-card-class">${escapeHtml(c.className)}</div>
      </div>
      ${c.representative ? '<span class="rep-badge">★ 대표 캐릭터</span>' : ''}
    </div>
    <div class="character-card-actions">
      ${c.representative ? '' : `<button class="outline-btn small-btn" data-set-rep="${c.id}">대표로 설정</button>`}
      <button class="danger-text-btn" data-delete-char="${c.id}">삭제</button>
    </div>
  </article>`).join('');

  wrap.querySelectorAll('[data-set-rep]').forEach(btn => btn.addEventListener('click', () => setRepresentative(btn.dataset.setRep)));
  wrap.querySelectorAll('[data-delete-char]').forEach(btn => btn.addEventListener('click', () => deleteCharacter(btn.dataset.deleteChar)));
}

function renderActivities() {
  const wrap = document.querySelector('#activity-list');
  if (!state.activities.length) {
    wrap.innerHTML = '<div class="mini-empty">아직 신청·취소 기록이 없습니다.</div>';
    return;
  }
  wrap.innerHTML = state.activities.slice(0, 6).map(a => `<div class="activity-item"><div class="activity-main">${escapeHtml(a.text)}</div><div class="activity-time">${escapeHtml(a.time)}</div></div>`).join('');
}

function renderApplicationsPage() {
  const wrap = document.querySelector('#applications-page-list');
  const entries = Object.entries(state.applications).map(([recruitId, app]) => ({ recruit: state.recruits.find(r => r.id === recruitId), app })).filter(x => x.recruit);
  if (!entries.length) {
    wrap.innerHTML = `<div class="empty-state page-empty">
      <div class="empty-icon">✓</div>
      <strong>현재 신청한 성역이 없습니다.</strong>
      <span>성역 모집에서 원하는 파티에 참여해보세요.</span>
      <button class="outline-btn" id="empty-go-recruit">성역 모집 보기</button>
    </div>`;
    wrap.querySelector('#empty-go-recruit')?.addEventListener('click', () => switchView('recruit'));
    return;
  }

  wrap.innerHTML = entries.map(({recruit, app}) => `<article class="application-card">
    <img class="application-thumb" src="${DUNGEON_IMAGE[recruit.dungeon]}" alt="${escapeHtml(recruit.dungeon)}" />
    <div class="application-copy">
      <div class="application-dungeon">${escapeHtml(recruit.dungeon)}</div>
      <div class="application-meta">${recruit.date ? escapeHtml(formatDateKo(recruit.date)) + ' · ' : ''}${escapeHtml(recruit.time)} · ${recruit.current}/${recruit.max}명</div>
    </div>
    <div class="application-character">
      <span class="label">참여 캐릭터</span>
      <strong>${escapeHtml(app.characterName)} · ${escapeHtml(app.className)}</strong>
    </div>
    <button class="cancel-btn" data-cancel-app="${recruit.id}">참여 취소</button>
  </article>`).join('');

  wrap.querySelectorAll('[data-cancel-app]').forEach(btn => btn.addEventListener('click', () => cancelJoin(btn.dataset.cancelApp)));
}

function setRepresentative(characterId) {
  state.characters.forEach(c => c.representative = c.id === characterId);
  save(); render(); showToast('대표 캐릭터를 변경했습니다.');
}

function deleteCharacter(characterId) {
  const character = state.characters.find(c => c.id === characterId);
  if (!character) return;
  const isInUse = Object.values(state.applications).some(a => a.characterId === characterId);
  if (isInUse) { showToast('현재 성역 신청에 사용 중인 캐릭터는 삭제할 수 없습니다.'); return; }
  state.characters = state.characters.filter(c => c.id !== characterId);
  if (state.characters.length && !state.characters.some(c => c.representative)) state.characters[0].representative = true;
  save(); render(); showToast(`${character.name} 캐릭터를 삭제했습니다.`);
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  renderRecruits();
  document.querySelector('.recruit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
document.querySelectorAll('.dungeon-card').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('[data-view-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  closeProfileMenu();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-tab').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
document.querySelectorAll('[data-go-view]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.goView)));
document.querySelector('#go-recruit-view')?.addEventListener('click', () => switchView('recruit'));

const profileBtn = document.querySelector('#profile-btn');
const profileMenu = document.querySelector('#profile-menu');
function closeProfileMenu() {
  profileMenu.classList.add('hidden');
  profileBtn.setAttribute('aria-expanded', 'false');
}
profileBtn.addEventListener('click', e => {
  e.stopPropagation();
  const willOpen = profileMenu.classList.contains('hidden');
  profileMenu.classList.toggle('hidden');
  profileBtn.setAttribute('aria-expanded', String(willOpen));
});
profileMenu.addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', closeProfileMenu);

document.querySelector('#notification-btn').addEventListener('click', () => {
  if (!state.activities.length) showToast('새로운 활동 알림이 없습니다.');
  else showToast(`최근 활동 ${Math.min(state.activities.length, 6)}건이 있습니다.`);
});

const backdrop = document.querySelector('#modal-backdrop');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
let backdropPointerStarted = false;

function openModal(html) {
  modalContent.innerHTML = html;
  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden', 'false');
}
function closeModal() {
  backdrop.classList.add('hidden');
  backdrop.setAttribute('aria-hidden', 'true');
  modalContent.innerHTML = '';
}

document.querySelector('#modal-close').addEventListener('click', closeModal);
// 드래그/텍스트 선택 후 마우스를 바깥에서 놓아도 모달이 닫히지 않게 처리
backdrop.addEventListener('pointerdown', e => { backdropPointerStarted = e.target === backdrop; });
backdrop.addEventListener('pointerup', e => {
  if (backdropPointerStarted && e.target === backdrop) closeModal();
  backdropPointerStarted = false;
});
modal.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) closeModal(); });

function openJoin(recruitId) {
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (!state.characters.length) {
    showToast('먼저 내 캐릭터를 등록해주세요.');
    openCharacterModal();
    return;
  }
  state.selectedRecruit = recruitId;
  const options = state.characters.map((c, i) => `<label class="join-option">
    <input type="radio" name="join-character" value="${c.id}" ${c.representative || i === 0 ? 'checked' : ''} />
    <img class="class-icon" src="${CLASSES[c.className]}" alt="${escapeHtml(c.className)}" />
    <div class="char-copy"><div class="char-name">${escapeHtml(c.name)}</div><div class="char-class">${escapeHtml(c.className)}${c.representative ? ' · 대표 캐릭터' : ''}</div></div>
  </label>`).join('');

  openModal(`<span class="modal-eyebrow">${escapeHtml(recruit.dungeon)}</span><h2 id="modal-title">어떤 캐릭터로 참여하시겠어요?</h2><p class="modal-desc">${escapeHtml(recruit.time)} · 현재 ${recruit.current}/${recruit.max}명</p><div class="join-options">${options}</div><div class="modal-actions"><button class="ghost-btn" data-modal-cancel>취소</button><button class="primary-btn" id="confirm-join">참여하기</button></div>`);
  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelector('#confirm-join').addEventListener('click', confirmJoin);
}

function confirmJoin() {
  const input = modalContent.querySelector('input[name="join-character"]:checked');
  if (!input) return;
  const character = state.characters.find(c => c.id === input.value);
  const recruit = state.recruits.find(r => r.id === state.selectedRecruit);
  if (!character || !recruit || recruit.current >= recruit.max) return;
  state.applications[recruit.id] = { characterId: character.id, characterName: character.name, className: character.className, at: Date.now() };
  recruit.current += 1;
  state.activities.unshift({ text: `${character.name}님이 ${recruit.dungeon} 파티에 참여했습니다.`, time: '방금 전' });
  save(); closeModal(); render(); showToast(`${character.name} 캐릭터로 신청했습니다.`);
}

function cancelJoin(recruitId) {
  const app = state.applications[recruitId];
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (!app || !recruit) return;
  delete state.applications[recruitId];
  recruit.current = Math.max(0, recruit.current - 1);
  state.activities.unshift({ text: `${app.characterName}님이 ${recruit.dungeon} 파티 참여를 취소했습니다.`, time: '방금 전' });
  save(); render(); showToast('참여를 취소했습니다.');
}

function openCharacterModal() {
  const options = Object.keys(CLASSES).map(name => `<option value="${name}">${name}</option>`).join('');
  openModal(`<span class="modal-eyebrow">내 캐릭터</span><h2 id="modal-title">캐릭터 추가</h2><p class="modal-desc">캐릭터명과 직업을 등록하세요.</p><div class="form-grid">
    <div class="field"><label for="character-name">캐릭터명</label><input id="character-name" maxlength="20" placeholder="캐릭터명을 입력하세요" /></div>
    <div class="field"><label for="character-class">직업</label><select id="character-class">${options}</select></div>
    <label class="join-option"><input type="checkbox" id="representative" /> 이 캐릭터를 대표 캐릭터로 설정</label>
  </div><div class="modal-actions"><button class="ghost-btn" data-modal-cancel>취소</button><button class="primary-btn" id="save-character">추가하기</button></div>`);
  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelector('#save-character').addEventListener('click', () => {
    const name = modalContent.querySelector('#character-name').value.trim();
    const className = modalContent.querySelector('#character-class').value;
    const representative = modalContent.querySelector('#representative').checked;
    if (!name) { showToast('캐릭터명을 입력해주세요.'); return; }
    if (representative) state.characters.forEach(c => c.representative = false);
    state.characters.push({ id: crypto.randomUUID(), name, className, representative: representative || state.characters.length === 0 });
    save(); closeModal(); render(); showToast('캐릭터를 추가했습니다.');
  });
}

document.querySelector('#add-character').addEventListener('click', openCharacterModal);
document.querySelector('#manage-characters').addEventListener('click', () => switchView('characters'));
document.querySelector('#add-character-page').addEventListener('click', openCharacterModal);

function getRecruitDraft() {
  return load(STORAGE.recruitDraft, {});
}
function saveRecruitDraft() {
  const fields = ['new-dungeon','new-date','new-time','new-memo'];
  const draft = {};
  fields.forEach(id => { const el = modalContent.querySelector('#' + id); if (el) draft[id] = el.value; });
  localStorage.setItem(STORAGE.recruitDraft, JSON.stringify(draft));
}
function clearRecruitDraft() {
  localStorage.removeItem(STORAGE.recruitDraft);
}

function openRecruitModal() {
  const dungeonOptions = ['루드라','침식','무스펠 보통','무스펠 어려움'].map(d => `<option value="${d}">${d}</option>`).join('');
  const hourOptions = ['<option value="">시 선택</option>'];
  for (let hour = 1; hour <= 24; hour++) {
    const hh = String(hour).padStart(2, '0');
    hourOptions.push(`<option value="${hh}">${hh}시</option>`);
  }

  openModal(`<span class="modal-eyebrow">새 모집</span><h2 id="modal-title">성역 모집 만들기</h2><p class="modal-desc">성역, 날짜, 시간, 메모만 입력하면 됩니다.</p><div class="draft-note">작성 내용은 자동으로 임시 저장됩니다. 화면을 잘못 닫아도 다시 열면 그대로 남아 있습니다.</div><div class="form-grid single-column-form recruit-simple-form">
    <div class="field"><label>성역 선택</label><select id="new-dungeon">${dungeonOptions}</select></div>
    <div class="field calendar-field">
      <label>날짜 선택</label>
      <div class="quick-date-row">
        <button type="button" class="quick-date-btn" data-date-offset="0">오늘</button>
        <button type="button" class="quick-date-btn" data-date-offset="1">내일</button>
        <button type="button" class="quick-date-btn" data-date-offset="2">모레</button>
      </div>
      <div class="date-input-wrap">
        <span class="date-icon">📅</span>
        <input id="new-date" type="date" />
      </div>
      <div class="selected-date-preview" id="selected-date-preview">날짜를 선택해주세요.</div>
    </div>
    <div class="field time-field-v8">
      <label>시간 선택</label>
      <div class="quick-time-row">
        <button type="button" class="quick-time-btn" data-time="20:00">20:00</button>
        <button type="button" class="quick-time-btn" data-time="21:00">21:00</button>
        <button type="button" class="quick-time-btn" data-time="22:00">22:00</button>
        <button type="button" class="quick-time-btn" data-time="23:00">23:00</button>
        <button type="button" class="quick-time-btn" data-time="24:00">24:00</button>
      </div>
      <div class="time-direct-label">다른 시간</div>
      <div class="time-direct-row">
        <select id="new-hour" aria-label="시">${hourOptions.join('')}</select>
        <div class="minute-buttons" aria-label="분">
          <button type="button" class="minute-btn active" data-minute="00">00분</button>
          <button type="button" class="minute-btn" data-minute="30">30분</button>
        </div>
      </div>
      <input id="new-time" type="hidden" />
      <div class="selected-time-preview" id="selected-time-preview">시간을 선택해주세요.</div>
    </div>
    <div class="field field-full"><label>메모</label><textarea id="new-memo" rows="5" placeholder="모집할 때 필요한 내용을 적어주세요.\n예: 초보 환영 / 22시 출발 / 편하게 오세요"></textarea></div>
  </div><div class="modal-actions"><button class="ghost-btn" data-modal-cancel>닫기</button><button class="primary-btn" id="save-recruit">등록하기</button></div>`);

  const dateInput = modalContent.querySelector('#new-date');
  const datePreview = modalContent.querySelector('#selected-date-preview');
  const timeInput = modalContent.querySelector('#new-time');
  const timePreview = modalContent.querySelector('#selected-time-preview');
  const hourSelect = modalContent.querySelector('#new-hour');
  const today = new Date();
  let selectedMinute = '00';

  const toDateValue = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  dateInput.min = toDateValue(today);

  const updateDatePreview = () => {
    datePreview.textContent = dateInput.value ? formatDateKo(dateInput.value) : '날짜를 선택해주세요.';
    modalContent.querySelectorAll('.quick-date-btn').forEach(btn => btn.classList.remove('active'));
    [0,1,2].forEach(offset => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      if (dateInput.value === toDateValue(d)) modalContent.querySelector(`.quick-date-btn[data-date-offset="${offset}"]`)?.classList.add('active');
    });
  };

  const updateTimeUI = () => {
    timePreview.textContent = timeInput.value ? `선택 시간  ${timeInput.value}` : '시간을 선택해주세요.';
    timePreview.classList.toggle('has-value', !!timeInput.value);
    modalContent.querySelectorAll('.quick-time-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.time === timeInput.value));
  };

  const setTime = value => {
    timeInput.value = value;
    if (value) {
      const [hh, mm] = value.split(':');
      hourSelect.value = hh;
      selectedMinute = mm || '00';
      modalContent.querySelectorAll('.minute-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.minute === selectedMinute));
    }
    saveRecruitDraft();
    updateTimeUI();
  };

  const applyDirectTime = () => {
    const hh = hourSelect.value;
    if (!hh) { setTime(''); return; }
    if (hh === '24') selectedMinute = '00';
    setTime(`${hh}:${selectedMinute}`);
  };

  const draft = getRecruitDraft();
  Object.entries(draft).forEach(([id, value]) => { const el = modalContent.querySelector('#' + id); if (el) el.value = value; });
  if (timeInput.value) {
    const [hh, mm] = timeInput.value.split(':');
    hourSelect.value = hh;
    selectedMinute = mm || '00';
    modalContent.querySelectorAll('.minute-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.minute === selectedMinute));
  }
  updateDatePreview();
  updateTimeUI();

  modalContent.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = new Date();
      d.setDate(d.getDate() + Number(btn.dataset.dateOffset || 0));
      dateInput.value = toDateValue(d);
      saveRecruitDraft();
      updateDatePreview();
    });
  });
  modalContent.querySelectorAll('.quick-time-btn').forEach(btn => btn.addEventListener('click', () => setTime(btn.dataset.time)));
  hourSelect.addEventListener('change', applyDirectTime);
  modalContent.querySelectorAll('.minute-btn').forEach(btn => btn.addEventListener('click', () => {
    selectedMinute = btn.dataset.minute;
    if (hourSelect.value === '24') selectedMinute = '00';
    modalContent.querySelectorAll('.minute-btn').forEach(b => b.classList.toggle('active', b.dataset.minute === selectedMinute));
    applyDirectTime();
  }));
  modalContent.querySelectorAll('#new-dungeon, #new-date, #new-memo').forEach(el => {
    el.addEventListener('input', () => { saveRecruitDraft(); if (el.id === 'new-date') updateDatePreview(); });
    el.addEventListener('change', () => { saveRecruitDraft(); if (el.id === 'new-date') updateDatePreview(); });
  });

  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelector('#save-recruit').addEventListener('click', () => {
    const dungeon = modalContent.querySelector('#new-dungeon').value;
    const date = modalContent.querySelector('#new-date').value;
    const time = modalContent.querySelector('#new-time').value;
    const memo = modalContent.querySelector('#new-memo').value.trim();
    if (!date) { showToast('날짜를 선택해주세요.'); return; }
    if (!time) { showToast('시간을 선택해주세요.'); return; }
    state.recruits.unshift({ id: crypto.randomUUID(), dungeon, date, time, memo, current: 0, max: 10 });
    state.activities.unshift({ text: `${dungeon} 모집이 등록되었습니다.`, time: '방금 전' });
    clearRecruitDraft();
    save(); closeModal(); render(); showToast('모집을 등록했습니다.');
  });
}

document.querySelectorAll('.create-recruit-btn').forEach(btn => btn.addEventListener('click', openRecruitModal));

function showToast(text) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

render();