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

// v2부터 샘플 캐릭터/샘플 모집을 넣지 않습니다.
// 실제 사용자가 직접 등록한 내용만 보입니다.
const STORAGE = {
  characters: 'aion2_v2_characters',
  recruits: 'aion2_v2_recruits',
  applications: 'aion2_v2_applications',
  activities: 'aion2_v2_activities',
};

const state = {
  characters: load(STORAGE.characters, []),
  recruits: load(STORAGE.recruits, []),
  applications: load(STORAGE.applications, {}),
  activities: load(STORAGE.activities, []),
  filter: '전체',
  selectedRecruit: null,
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
  return String(text).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function render() {
  renderRecruits();
  renderCharacters();
  renderActivities();
  renderCounts();
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
    return `<article class="recruit-item">
      <div class="recruit-title">
        <img class="thumb" src="${DUNGEON_IMAGE[r.dungeon]}" alt="${escapeHtml(r.dungeon)}" />
        <div><div class="recruit-name">${escapeHtml(r.dungeon)}</div><div class="recruit-sub">${escapeHtml(r.time)}</div></div>
      </div>
      <div><div class="label">현재 인원</div><div class="value"><strong>${r.current}</strong> / ${r.max}명</div></div>
      <div><div class="label">필요 인원</div><div class="value">${escapeHtml(r.roles || '직업 무관')}</div></div>
      <div><div class="label">파티장</div><div class="value">${escapeHtml(r.leader)}</div></div>
      ${app
        ? `<button class="cancel-btn" data-cancel="${r.id}">${escapeHtml(app.characterName)} · 참여 취소</button>`
        : `<button class="primary-btn join-btn" data-join="${r.id}">참여하기</button>`}
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

function renderActivities() {
  const wrap = document.querySelector('#activity-list');
  if (!state.activities.length) {
    wrap.innerHTML = '<div class="mini-empty">아직 신청·취소 기록이 없습니다.</div>';
    return;
  }
  wrap.innerHTML = state.activities.slice(0, 6).map(a => `<div class="activity-item"><div class="activity-main">${escapeHtml(a.text)}</div><div class="activity-time">${escapeHtml(a.time)}</div></div>`).join('');
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  renderRecruits();
  document.querySelector('.recruit-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
document.querySelectorAll('.dungeon-card').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));

const backdrop = document.querySelector('#modal-backdrop');
const modalContent = document.querySelector('#modal-content');

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
backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

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
document.querySelector('#manage-characters').addEventListener('click', openCharacterModal);

function openRecruitModal() {
  const dungeonOptions = ['루드라','침식','무스펠 보통','무스펠 어려움'].map(d => `<option>${d}</option>`).join('');
  openModal(`<span class="modal-eyebrow">새 모집</span><h2 id="modal-title">성역 모집 만들기</h2><p class="modal-desc">성역과 시간을 입력하면 바로 모집을 올릴 수 있습니다.</p><div class="form-grid">
    <div class="field"><label>성역</label><select id="new-dungeon">${dungeonOptions}</select></div>
    <div class="field"><label>시간</label><input id="new-time" placeholder="예: 오늘 22:00" /></div>
    <div class="field"><label>현재 인원</label><input id="new-current" type="number" min="1" max="10" value="1" /></div>
    <div class="field"><label>총 인원</label><input id="new-max" type="number" min="2" max="10" value="10" /></div>
    <div class="field"><label>필요 인원</label><input id="new-roles" placeholder="예: 치유성 1명 · 딜러 2명" /></div>
    <div class="field"><label>파티장 캐릭터명</label><input id="new-leader" placeholder="파티장 캐릭터명" /></div>
  </div><div class="modal-actions"><button class="ghost-btn" data-modal-cancel>취소</button><button class="primary-btn" id="save-recruit">등록하기</button></div>`);
  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelector('#save-recruit').addEventListener('click', () => {
    const dungeon = modalContent.querySelector('#new-dungeon').value;
    const time = modalContent.querySelector('#new-time').value.trim();
    const current = Number(modalContent.querySelector('#new-current').value || 1);
    const max = Number(modalContent.querySelector('#new-max').value || 10);
    const roles = modalContent.querySelector('#new-roles').value.trim();
    const leader = modalContent.querySelector('#new-leader').value.trim();
    if (!time) { showToast('시간을 입력해주세요.'); return; }
    if (!leader) { showToast('파티장 캐릭터명을 입력해주세요.'); return; }
    if (current > max) { showToast('현재 인원은 총 인원보다 많을 수 없습니다.'); return; }
    state.recruits.unshift({ id: crypto.randomUUID(), dungeon, time, current, max, roles, leader });
    state.activities.unshift({ text: `${leader}님이 ${dungeon} 모집을 만들었습니다.`, time: '방금 전' });
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
