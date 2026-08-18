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
  ownerId: 'aion2_v13_owner_id',
};

const state = {
  characters: [],
  recruits: [],
  applications: {},
  activities: [],
  filter: '전체',
  selectedRecruit: null,
  currentView: 'recruit',
  recruitStatus: 'active',
  sharedReady: false,
};

const CURRENT_OWNER_ID = (() => {
  let id = localStorage.getItem(STORAGE.ownerId);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE.ownerId, id);
  }
  return id;
})();

// 공용 데이터는 Google 스프레드시트에서 불러옵니다.


function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save() {
  // 공용 모집/참여 데이터는 서버에 저장합니다.
  // 브라우저에는 사용자 식별값과 대표 캐릭터 선택만 유지합니다.
}

const SHARED_API_URL = '/api/data';
const REPRESENTATIVE_KEY = 'aion2_shared_representative_character';
let sharedErrorShown = false;

function boolValue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function timeAgo(iso) {
  const ms = new Date(iso || '').getTime();
  if (!Number.isFinite(ms)) return '';
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  return `${day}일 전`;
}

function buildSharedActivities(recruits, participants) {
  const dungeonById = new Map(recruits.map(r => [String(r.id), r.dungeon]));
  const rows = [];
  recruits.forEach(r => {
    if (r.createdAt) rows.push({ text: `${r.dungeon} 모집이 등록되었습니다.`, at: r.createdAt });
  });
  participants.forEach(p => {
    const dungeon = dungeonById.get(String(p.recruitId));
    if (dungeon && p.createdAt) rows.push({ text: `${p.characterName}님이 ${dungeon} 파티에 참여했습니다.`, at: p.createdAt });
  });
  return rows
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30)
    .map(x => ({ text: x.text, time: timeAgo(x.at) }));
}

function applySharedData(data) {
  const allParticipants = Array.isArray(data.participants) ? data.participants.map(p => ({
    ...p,
    id: String(p.id || ''),
    recruitId: String(p.recruitId || ''),
    userId: String(p.userId || ''),
    characterId: String(p.characterId || ''),
    party: Number(p.party) === 2 ? 2 : 1,
    order: Math.max(1, Number(p.order) || 1),
  })) : [];

  const participantsByRecruit = new Map();
  allParticipants.forEach(p => {
    if (!participantsByRecruit.has(p.recruitId)) participantsByRecruit.set(p.recruitId, []);
    participantsByRecruit.get(p.recruitId).push(p);
  });
  participantsByRecruit.forEach(list => list.sort((a, b) => (a.party - b.party) || (a.order - b.order) || String(a.createdAt).localeCompare(String(b.createdAt))));

  const recruits = Array.isArray(data.recruits) ? data.recruits
    .filter(r => ['침식', '무스펠 보통', '무스펠 어려움'].includes(r.dungeon))
    .map(r => {
      const participants = participantsByRecruit.get(String(r.id)) || [];
      return {
        ...r,
        id: String(r.id || ''),
        ownerId: String(r.ownerId || ''),
        max: 10,
        participants,
        current: participants.length,
      };
    }) : [];

  const allCharacters = Array.isArray(data.characters) ? data.characters : [];
  state.characters = allCharacters
    .filter(c => String(c.userId || '') === CURRENT_OWNER_ID)
    .map(c => ({
      ...c,
      id: String(c.id || ''),
      representative: boolValue(c.representative),
    }));

  const preferredId = localStorage.getItem(REPRESENTATIVE_KEY);
  if (preferredId && state.characters.some(c => c.id === preferredId)) {
    state.characters.forEach(c => c.representative = c.id === preferredId);
  } else if (state.characters.length) {
    const currentRep = state.characters.find(c => c.representative) || state.characters[0];
    state.characters.forEach(c => c.representative = c.id === currentRep.id);
    localStorage.setItem(REPRESENTATIVE_KEY, currentRep.id);
  } else {
    localStorage.removeItem(REPRESENTATIVE_KEY);
  }

  state.recruits = recruits;
  state.applications = {};
  allParticipants
    .filter(p => p.userId === CURRENT_OWNER_ID)
    .forEach(p => {
      state.applications[p.recruitId] = {
        participantId: p.id,
        characterId: p.characterId,
        characterName: p.characterName,
        className: p.className,
        at: p.createdAt,
      };
    });

  state.activities = buildSharedActivities(recruits, allParticipants);
  state.sharedReady = true;
  render();
}

async function readSharedData({ silent = false } = {}) {
  try {
    const response = await fetch(`${SHARED_API_URL}?t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || '공용 데이터를 불러오지 못했습니다.');
    sharedErrorShown = false;
    applySharedData(data);
    return data;
  } catch (err) {
    console.error(err);
    if (!silent || !sharedErrorShown) {
      sharedErrorShown = true;
      showToast('공용 데이터 연결을 확인해주세요.');
    }
    return null;
  }
}

async function postSharedData(payload) {
  const response = await fetch(SHARED_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || '저장하지 못했습니다.');
  applySharedData(data);
  return data;
}

function partyUpdatePayload(recruit) {
  const count = { 1: 0, 2: 0 };
  return recruit.participants.map(p => {
    const party = (p.party || 1) === 2 ? 2 : 1;
    count[party] += 1;
    return { participantId: p.id, party, order: count[party] };
  });
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

const COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function getRecruitScheduledAt(recruit) {
  if (!recruit?.date || !recruit?.time) return null;
  const [year, month, day] = recruit.date.split('-').map(Number);
  const [rawHour, rawMinute = 0] = recruit.time.split(':').map(Number);
  if (![year, month, day, rawHour, rawMinute].every(Number.isFinite)) return null;
  const hour = rawHour === 24 ? 0 : rawHour;
  const d = new Date(year, month - 1, day, hour, rawMinute, 0, 0);
  if (rawHour === 24) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function isRecruitCompleted(recruit, now = Date.now()) {
  const scheduledAt = getRecruitScheduledAt(recruit);
  return scheduledAt !== null && now >= scheduledAt;
}

function cleanupExpiredRecruits(now = Date.now()) {
  const expiredIds = [];
  state.recruits = state.recruits.filter(recruit => {
    const scheduledAt = getRecruitScheduledAt(recruit);
    if (scheduledAt !== null && now >= scheduledAt + COMPLETED_RETENTION_MS) {
      expiredIds.push(recruit.id);
      return false;
    }
    return true;
  });
  if (expiredIds.length) {
    expiredIds.forEach(id => delete state.applications[id]);
    save();
  }
}

function getCompletedRetentionText(recruit, now = Date.now()) {
  const scheduledAt = getRecruitScheduledAt(recruit);
  if (scheduledAt === null) return '';
  const deleteAt = scheduledAt + COMPLETED_RETENTION_MS;
  const remain = Math.max(0, deleteAt - now);
  const days = Math.ceil(remain / (24 * 60 * 60 * 1000));
  return `${days}일 후 자동 삭제`;
}

function render() {
  cleanupExpiredRecruits();
  renderRecruits();
  renderCharacters();
  renderActivities();
  renderCounts();
  renderCharactersPage();
  renderApplicationsPage();
}

function renderCounts() {
  const now = Date.now();
  const count = d => state.recruits.filter(r => r.dungeon === d && !isRecruitCompleted(r, now)).length;
  const values = {
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
  const now = Date.now();
  const statusRows = state.recruits.filter(r => state.recruitStatus === 'completed' ? isRecruitCompleted(r, now) : !isRecruitCompleted(r, now));
  const rows = state.filter === '전체' ? statusRows : statusRows.filter(r => r.dungeon === state.filter);

  const title = document.querySelector('#recruit-panel-title');
  const desc = document.querySelector('#recruit-panel-desc');
  if (title) title.textContent = state.recruitStatus === 'completed' ? '완료' : '현재 모집 중';
  if (desc) desc.textContent = state.recruitStatus === 'completed' ? '완료된 모집은 7일 동안 보관되며, 파티 구성은 버튼을 눌러 확인할 수 있습니다.' : '참여할 파티를 선택하세요.';
  document.querySelectorAll('[data-recruit-status]').forEach(btn => btn.classList.toggle('active', btn.dataset.recruitStatus === state.recruitStatus));

  if (!rows.length) {
    if (state.recruitStatus === 'completed') {
      list.innerHTML = `<div class="empty-state white-empty-state completed-empty">
        <div class="empty-icon">✓</div>
        <strong>완료된 모집이 없습니다.</strong>
        <span>모집 시간이 지나면 이곳으로 자동 이동합니다.</span>
      </div>`;
      return;
    }
    list.innerHTML = `<div class="empty-state white-empty-state">
      <div class="empty-icon">＋</div>
      <strong>현재 모집 중인 파티가 없습니다.</strong>
      <span>원하시는 성역 모집을 직접 만들어보세요.</span>
    </div>
    <div class="recruit-bottom-action">
      <button class="primary-btn add-recruit-inline">＋ 모집하기</button>
    </div>`;
    list.querySelector('.add-recruit-inline')?.addEventListener('click', openRecruitModal);
    return;
  }

  if (state.recruitStatus === 'completed') {
    list.innerHTML = rows.map(r => {
      const participantCount = Array.isArray(r.participants) ? r.participants.length : (r.current || 0);
      const dateText = r.date ? `${escapeHtml(formatDateKo(r.date))} · ${escapeHtml(r.time)}` : escapeHtml(r.time);
      return `<article class="completed-card ${getRecruitThemeClass(r.dungeon)}">
        <div class="completed-cover-wrap">
          <img class="completed-cover" src="${DUNGEON_IMAGE[r.dungeon]}" alt="${escapeHtml(r.dungeon)}" />
          <span class="completed-cover-badge">완료</span>
        </div>
        <div class="completed-main">
          <div class="completed-title-row">
            <div>
              <div class="completed-name">${escapeHtml(r.dungeon)}</div>
              <div class="completed-date">${dateText}</div>
            </div>
            <div class="completed-count">${participantCount}/${r.max}명</div>
          </div>
          <div class="completed-bottom-row">
            <span class="auto-delete-note">${getCompletedRetentionText(r, now)}</span>
            <div class="completed-buttons">
              <button class="completed-party-btn" data-participants="${r.id}">파티 보기</button>
              ${r.ownerId === CURRENT_OWNER_ID ? `<button class="delete-recruit-btn compact-delete-btn" data-delete-recruit="${r.id}">삭제</button>` : ''}
            </div>
          </div>
        </div>
      </article>`;
    }).join('');
  } else {
    list.innerHTML = rows.map(r => {
      const app = state.applications[r.id];
      const participantCount = Array.isArray(r.participants) ? r.participants.length : (r.current || 0);
      const dateText = r.date ? `${escapeHtml(formatDateKo(r.date))} · ${escapeHtml(r.time)}` : escapeHtml(r.time);
      const memoText = r.memo ? escapeHtml(r.memo).split('\n').join('<br>') : '메모가 없습니다.';
      return `<article class="recruit-item simple-recruit-item white-recruit-item ${getRecruitThemeClass(r.dungeon)}">
        <div class="recruit-title">
          <img class="thumb" src="${DUNGEON_IMAGE[r.dungeon]}" alt="${escapeHtml(r.dungeon)}" />
          <div>
            <div class="recruit-name">${escapeHtml(r.dungeon)}</div>
            <div class="recruit-sub">${dateText}</div>
          </div>
        </div>
        <div class="recruit-meta compact-meta">
          <span class="label">현재 인원</span>
          <strong>${participantCount}/${r.max}명</strong>
          <button class="participant-preview-btn" data-participants="${r.id}">참여 목록 ${participantCount}명</button>
        </div>
        <div class="recruit-note-block">
          <span class="label">메모</span>
          <div class="recruit-note-text">${memoText}</div>
        </div>
        <div class="recruit-action-stack">
          ${app ? `<button class="cancel-btn clean-action-btn" data-cancel="${r.id}">참여 취소</button>` : `<button class="join-btn clean-action-btn" data-join="${r.id}">참여하기</button>`}
          ${r.ownerId === CURRENT_OWNER_ID ? `<button class="delete-recruit-btn" data-delete-recruit="${r.id}">삭제</button>` : ''}
        </div>
      </article>`;
    }).join('') + `<div class="recruit-bottom-action"><button class="primary-btn add-recruit-inline">＋ 모집하기</button></div>`;
  }

  list.querySelectorAll('[data-join]').forEach(btn => btn.addEventListener('click', () => openJoin(btn.dataset.join)));
  list.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', () => cancelJoin(btn.dataset.cancel)));
  list.querySelectorAll('[data-delete-recruit]').forEach(btn => btn.addEventListener('click', () => deleteRecruit(btn.dataset.deleteRecruit)));
  list.querySelectorAll('[data-participants]').forEach(btn => btn.addEventListener('click', () => openParticipantList(btn.dataset.participants)));
  list.querySelector('.add-recruit-inline')?.addEventListener('click', openRecruitModal);
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
  const now = Date.now();
  const entries = Object.entries(state.applications).map(([recruitId, app]) => ({ recruit: state.recruits.find(r => r.id === recruitId), app })).filter(x => x.recruit && !isRecruitCompleted(x.recruit, now));
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

function renderPartyGroup(recruit, partyNo, canManage) {
  const partyMembers = recruit.participants.filter(p => (p.party || 1) === partyNo);
  const rows = partyMembers.length ? partyMembers.map((p, index) => `<div class="participant-row party-participant-row">
      <div class="participant-order">${index + 1}</div>
      <img class="class-icon" src="${CLASSES[p.className]}" alt="${escapeHtml(p.className)}" />
      <div class="participant-copy party-participant-copy">
        <strong>${escapeHtml(p.characterName)}</strong>
        <span>${escapeHtml(p.className)}</span>
      </div>
      ${state.applications[recruit.id]?.characterId === p.characterId ? '<span class="participant-me">나</span>' : ''}
      ${canManage ? `<div class="party-manage-actions">
        <button data-move-participant="${p.characterId}" data-direction="up" title="위로">↑</button>
        <button data-move-participant="${p.characterId}" data-direction="down" title="아래로">↓</button>
        <button class="party-switch-btn" data-switch-party="${p.characterId}" data-target-party="${partyNo === 1 ? 2 : 1}">${partyNo === 1 ? '2파티' : '1파티'}</button>
      </div>` : ''}
    </div>`).join('') : `<div class="party-empty">아직 참여자가 없습니다.</div>`;
  return `<section class="party-section party-${partyNo}">
    <div class="party-section-head"><strong>${partyNo}파티</strong><span>${partyMembers.length}/5명</span></div>
    <div class="party-member-list">${rows}</div>
  </section>`;
}

function openParticipantList(recruitId) {
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (!recruit) return;
  if (!Array.isArray(recruit.participants)) recruit.participants = [];
  const canManage = recruit.ownerId === CURRENT_OWNER_ID;
  openModal(`<span class="modal-eyebrow">${escapeHtml(recruit.dungeon)}</span>
    <h2 id="modal-title">파티 참여 목록</h2>
    <p class="modal-desc">현재 ${recruit.participants.length}/${recruit.max}명이 참여 중입니다.${canManage ? ' 모집자는 순서와 파티를 변경할 수 있습니다.' : ''}</p>
    <div class="party-grid">
      ${renderPartyGroup(recruit, 1, canManage)}
      ${renderPartyGroup(recruit, 2, canManage)}
    </div>
    <div class="modal-actions"><button class="ghost-btn" data-modal-cancel>닫기</button></div>`);
  modal.classList.add('light-action-modal', 'participant-modal');
  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelectorAll('[data-move-participant]').forEach(btn => btn.addEventListener('click', () => moveParticipant(recruitId, btn.dataset.moveParticipant, btn.dataset.direction)));
  modalContent.querySelectorAll('[data-switch-party]').forEach(btn => btn.addEventListener('click', () => switchParticipantParty(recruitId, btn.dataset.switchParty, Number(btn.dataset.targetParty))));
}

async function moveParticipant(recruitId, characterId, direction) {
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (!recruit || recruit.ownerId !== CURRENT_OWNER_ID) return;
  const participant = recruit.participants.find(p => p.characterId === characterId);
  if (!participant) return;
  const party = participant.party || 1;
  const indexes = recruit.participants.map((p, i) => ({p, i})).filter(x => (x.p.party || 1) === party);
  const pos = indexes.findIndex(x => x.p.characterId === characterId);
  const targetPos = direction === 'up' ? pos - 1 : pos + 1;
  if (targetPos < 0 || targetPos >= indexes.length) return;
  const a = indexes[pos].i;
  const b = indexes[targetPos].i;
  [recruit.participants[a], recruit.participants[b]] = [recruit.participants[b], recruit.participants[a]];
  try {
    await postSharedData({ action: 'updateParties', recruitId, userId: CURRENT_OWNER_ID, participants: partyUpdatePayload(recruit) });
    openParticipantList(recruitId);
  } catch (err) {
    showToast(err.message || '순서를 변경하지 못했습니다.');
    await readSharedData({ silent: true });
  }
}

async function switchParticipantParty(recruitId, characterId, targetParty) {
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (!recruit || recruit.ownerId !== CURRENT_OWNER_ID) return;
  const targetCount = recruit.participants.filter(p => (p.party || 1) === targetParty).length;
  if (targetCount >= 5) { showToast(`${targetParty}파티는 이미 5명입니다.`); return; }
  const participant = recruit.participants.find(p => p.characterId === characterId);
  if (!participant) return;
  participant.party = targetParty;
  recruit.participants = recruit.participants.filter(p => p.characterId !== characterId);
  recruit.participants.push(participant);
  try {
    await postSharedData({ action: 'updateParties', recruitId, userId: CURRENT_OWNER_ID, participants: partyUpdatePayload(recruit) });
    openParticipantList(recruitId);
  } catch (err) {
    showToast(err.message || '파티를 변경하지 못했습니다.');
    await readSharedData({ silent: true });
  }
}

function getRecruitThemeClass(dungeon) {
  if (dungeon === '침식') return 'theme-erosion';
  if (dungeon === '무스펠 보통') return 'theme-muspel-normal';
  if (dungeon === '무스펠 어려움') return 'theme-muspel-hard';
  return '';
}

async function deleteRecruit(recruitId) {
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (!recruit || recruit.ownerId !== CURRENT_OWNER_ID) return;
  if (!window.confirm(`'${recruit.dungeon}' 모집을 삭제할까요?`)) return;
  try {
    await postSharedData({ action: 'deleteRecruit', recruitId, userId: CURRENT_OWNER_ID });
    showToast('모집을 삭제했습니다.');
  } catch (err) {
    showToast(err.message || '모집을 삭제하지 못했습니다.');
  }
}

function setRepresentative(characterId) {
  if (!state.characters.some(c => c.id === characterId)) return;
  localStorage.setItem(REPRESENTATIVE_KEY, characterId);
  state.characters.forEach(c => c.representative = c.id === characterId);
  render();
  showToast('대표 캐릭터를 변경했습니다.');
}

async function deleteCharacter(characterId) {
  const character = state.characters.find(c => c.id === characterId);
  if (!character) return;
  const isInUse = Object.values(state.applications).some(a => a.characterId === characterId);
  if (isInUse) { showToast('현재 성역 신청에 사용 중인 캐릭터는 삭제할 수 없습니다.'); return; }
  try {
    await postSharedData({ action: 'deleteCharacter', characterId, userId: CURRENT_OWNER_ID });
    if (localStorage.getItem(REPRESENTATIVE_KEY) === characterId) localStorage.removeItem(REPRESENTATIVE_KEY);
    showToast(`${character.name} 캐릭터를 삭제했습니다.`);
  } catch (err) {
    showToast(err.message || '캐릭터를 삭제하지 못했습니다.');
  }
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  renderRecruits();
  document.querySelector('.recruit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
document.querySelectorAll('.dungeon-card').forEach(btn => btn.addEventListener('click', () => {
  state.recruitStatus = 'active';
  setFilter(btn.dataset.filter);
}));
document.querySelectorAll('[data-recruit-status]').forEach(btn => btn.addEventListener('click', () => {
  state.recruitStatus = btn.dataset.recruitStatus;
  renderRecruits();
}));

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
  modal.classList.remove('recruit-modal-clean', 'light-action-modal', 'participant-modal', 'character-modal-clean');
  modalContent.innerHTML = html;
  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden', 'false');
}
function closeModal() {
  modal.classList.remove('recruit-modal-clean', 'light-action-modal', 'participant-modal', 'character-modal-clean');
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) closeModal(); });

function openJoin(recruitId) {
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (recruit && isRecruitCompleted(recruit)) { showToast('이미 완료된 모집입니다.'); render(); return; }
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
  modal.classList.add('light-action-modal');
  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelector('#confirm-join').addEventListener('click', confirmJoin);
}

async function confirmJoin() {
  const input = modalContent.querySelector('input[name="join-character"]:checked');
  if (!input) return;
  const character = state.characters.find(c => c.id === input.value);
  const recruit = state.recruits.find(r => r.id === state.selectedRecruit);
  if (!character || !recruit || recruit.current >= recruit.max) return;
  try {
    await postSharedData({
      action: 'joinRecruit',
      participantId: crypto.randomUUID(),
      recruitId: recruit.id,
      userId: CURRENT_OWNER_ID,
      characterId: character.id,
      characterName: character.name,
      className: character.className,
    });
    closeModal();
    showToast(`${character.name} 캐릭터로 신청했습니다.`);
  } catch (err) {
    showToast(err.message || '참여 신청을 하지 못했습니다.');
  }
}

async function cancelJoin(recruitId) {
  const app = state.applications[recruitId];
  const recruit = state.recruits.find(r => r.id === recruitId);
  if (recruit && isRecruitCompleted(recruit)) { showToast('완료된 모집에서는 참여 취소를 할 수 없습니다.'); render(); return; }
  if (!app || !recruit) return;
  try {
    await postSharedData({ action: 'cancelJoin', recruitId, userId: CURRENT_OWNER_ID });
    showToast('참여를 취소했습니다.');
  } catch (err) {
    showToast(err.message || '참여를 취소하지 못했습니다.');
  }
}

function openCharacterModal() {
  const options = Object.keys(CLASSES).map(name => `<option value="${name}">${name}</option>`).join('');
  openModal(`<span class="modal-eyebrow">내 캐릭터</span><h2 id="modal-title">캐릭터 추가</h2><p class="modal-desc">캐릭터명과 직업을 등록하세요.</p><div class="form-grid">
    <div class="field"><label for="character-name">캐릭터명</label><input id="character-name" maxlength="20" placeholder="캐릭터명을 입력하세요" /></div>
    <div class="field"><label for="character-class">직업</label><select id="character-class">${options}</select></div>
    <label class="representative-check"><input type="checkbox" id="representative" /><span>이 캐릭터를 대표 캐릭터로 설정</span></label>
  </div><div class="modal-actions"><button class="ghost-btn" data-modal-cancel>취소</button><button class="primary-btn" id="save-character">추가하기</button></div>`);
  modal.classList.add('recruit-modal-clean', 'character-modal-clean');
  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelector('#save-character').addEventListener('click', async () => {
    const name = modalContent.querySelector('#character-name').value.trim();
    const className = modalContent.querySelector('#character-class').value;
    const representative = modalContent.querySelector('#representative').checked || state.characters.length === 0;
    if (!name) { showToast('캐릭터명을 입력해주세요.'); return; }
    const characterId = crypto.randomUUID();
    try {
      await postSharedData({ action: 'createCharacter', characterId, userId: CURRENT_OWNER_ID, name, className, representative });
      if (representative) localStorage.setItem(REPRESENTATIVE_KEY, characterId);
      closeModal();
      showToast('캐릭터를 추가했습니다.');
    } catch (err) {
      showToast(err.message || '캐릭터를 추가하지 못했습니다.');
    }
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
  const dungeonOptions = ['침식','무스펠 보통','무스펠 어려움'].map(d => `<option value="${d}">${d}</option>`).join('');
  const hourOptions = ['<option value="">시</option>'];
  for (let hour = 1; hour <= 24; hour++) {
    const hh = String(hour).padStart(2, '0');
    hourOptions.push(`<option value="${hh}">${hh}</option>`);
  }

  openModal(`<span class="modal-eyebrow">새 모집</span><h2 id="modal-title">성역 모집 만들기</h2><div class="compact-recruit-form">
    <div class="field">
      <label for="new-dungeon">성역</label>
      <select id="new-dungeon">${dungeonOptions}</select>
    </div>

    <div class="compact-row">
      <div class="field compact-date-field">
        <label for="new-date">날짜</label>
        <input id="new-date" type="date" />
      </div>
      <div class="field compact-time-field">
        <label>시간 <span class="field-hint">24시간제</span></label>
        <div class="compact-time-selects">
          <select id="new-hour" aria-label="시">${hourOptions.join('')}</select>
          <span class="time-colon">:</span>
          <select id="new-minute" aria-label="분">
            <option value="00">00</option>
            <option value="30">30</option>
          </select>
        </div>
        <input id="new-time" type="hidden" />
      </div>
    </div>

    <div class="field memo-field">
      <label for="new-memo">메모</label>
      <textarea id="new-memo" rows="3" maxlength="200" placeholder="예: 초보 환영 / 22시 출발 / 편하게 오세요"></textarea>
      <div class="memo-count"><span id="memo-count">0</span>/200</div>
    </div>
  </div><div class="modal-actions compact-modal-actions"><button class="ghost-btn" data-modal-cancel>닫기</button><button class="primary-btn" id="save-recruit">등록하기</button></div>`);

  modal.classList.add('recruit-modal-clean');

  const dateInput = modalContent.querySelector('#new-date');
  const hourSelect = modalContent.querySelector('#new-hour');
  const minuteSelect = modalContent.querySelector('#new-minute');
  const timeInput = modalContent.querySelector('#new-time');
  const memoInput = modalContent.querySelector('#new-memo');
  const memoCount = modalContent.querySelector('#memo-count');

  const today = new Date();
  const toDateValue = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  dateInput.min = toDateValue(today);

  const syncTime = () => {
    const hh = hourSelect.value;
    let mm = minuteSelect.value;
    if (hh === '24') {
      mm = '00';
      minuteSelect.value = '00';
      minuteSelect.disabled = true;
    } else {
      minuteSelect.disabled = false;
    }
    timeInput.value = hh ? `${hh}:${mm}` : '';
    saveRecruitDraft();
  };

  const updateMemoCount = () => {
    memoCount.textContent = String(memoInput.value.length);
  };

  const draft = getRecruitDraft();
  if (draft['new-dungeon']) modalContent.querySelector('#new-dungeon').value = draft['new-dungeon'];
  if (draft['new-date']) dateInput.value = draft['new-date'];
  if (draft['new-memo']) memoInput.value = draft['new-memo'];
  if (draft['new-time']) {
    timeInput.value = draft['new-time'];
    const [hh, mm = '00'] = draft['new-time'].split(':');
    hourSelect.value = hh;
    minuteSelect.value = hh === '24' ? '00' : mm;
  }
  syncTime();
  updateMemoCount();

  modalContent.querySelector('#new-dungeon').addEventListener('change', saveRecruitDraft);
  dateInput.addEventListener('input', saveRecruitDraft);
  dateInput.addEventListener('change', saveRecruitDraft);
  hourSelect.addEventListener('change', syncTime);
  minuteSelect.addEventListener('change', syncTime);
  memoInput.addEventListener('input', () => {
    saveRecruitDraft();
    updateMemoCount();
  });

  modalContent.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  modalContent.querySelector('#save-recruit').addEventListener('click', async () => {
    const dungeon = modalContent.querySelector('#new-dungeon').value;
    const date = dateInput.value;
    const time = timeInput.value;
    const memo = memoInput.value.trim();
    if (!date) { showToast('날짜를 선택해주세요.'); dateInput.focus(); return; }
    if (!time) { showToast('시간을 선택해주세요.'); hourSelect.focus(); return; }
    try {
      await postSharedData({ action: 'createRecruit', recruitId: crypto.randomUUID(), ownerId: CURRENT_OWNER_ID, dungeon, date, time, memo });
      clearRecruitDraft();
      closeModal();
      showToast('모집을 등록했습니다.');
    } catch (err) {
      showToast(err.message || '모집을 등록하지 못했습니다.');
    }
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
readSharedData();
setInterval(() => readSharedData({ silent: true }), 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) readSharedData({ silent: true });
});
