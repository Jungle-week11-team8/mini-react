import { FunctionComponent, h, useState, useMemo, useEffect } from '../../src/index.js';

// ───────────────────────────────────────────────
// 규칙: useState / useMemo / useEffect는 App 안에서만 쓴다.
// 자식 컴포넌트는 props를 받아 VNode를 돌려주는 "순수 함수"다.
// ───────────────────────────────────────────────

const STORAGE_KEY = 'jungle-vending:items';
const MAX_SCORE = 100;

const MENU = [
  { id: 'coffee', name: '커피', icon: '☕', score: 10 },
  { id: 'ramen', name: '라면', icon: '🍜', score: 20 },
  { id: 'sleep', name: '수면', icon: '💤', score: 30 },
];

let renders = 0; // 렌더 횟수 확인용
let scoreRuns = 0; // 점수 계산 횟수 확인용 (useMemo가 건너뛰는지 본다)
let nextEntryId = 1; // 같은 메뉴를 여러 번 담아도 항목을 구분하기 위한 번호

function findMenu(menuId) {
  return MENU.find((menu) => menu.id === menuId);
}

// 저장된 값은 사람이 고쳤거나 예전 형식일 수 있으므로, 아는 메뉴만 골라 새 번호를 붙인다
function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((menuId) => findMenu(menuId)).map(createEntry);
  } catch {
    return [];
  }
}

function createEntry(menuId) {
  return { entryId: nextEntryId++, menuId };
}

function calculateScore(items) {
  scoreRuns += 1;
  console.log('생존 점수 계산', scoreRuns);
  return items.reduce((sum, item) => sum + findMenu(item.menuId).score, 0);
}

function scoreMessage(score) {
  if (score === 0) return '아이템을 담아 보세요.';
  if (score < 50) return '조금만 더 힘내요!';
  if (score < MAX_SCORE) return '절반은 넘었어요!';
  return '오늘도 생존 성공!';
}

function App() {
  // ── State: 선택 목록과 영업 상태. 초깃값 함수는 첫 렌더에만 실행된다 (새로고침 복원) ──
  const [items, setItems] = useState(loadItems);
  const [isOpen, setIsOpen] = useState(true);

  renders += 1;

  // ── 파생값: items가 그대로면(영업 상태만 바뀌면) 계산을 건너뛴다 ──
  const score = useMemo(() => calculateScore(items), [items]);

  // ── 부수 효과: 선택 목록이 바뀐 렌더에서만, patch 뒤에 저장한다 ──
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((item) => item.menuId)));
    console.log('선택 내역 저장', items.length);
  }, [items]);

  // ── 이벤트 핸들러: 항상 새 배열을 만든다 (불변 업데이트) ──
  function addItem(menuId) {
    setItems((prev) => [...prev, createEntry(menuId)]);
  }

  function removeItem(entryId) {
    setItems((prev) => prev.filter((item) => item.entryId !== entryId));
  }

  return (
    <main className={isOpen ? 'vending' : 'vending resting'}>
      <Header isOpen={isOpen} onToggle={() => setIsOpen((prev) => !prev)} />
      <div className="layout">
        <section className="panel">
          <h2>생존 아이템</h2>
          <div className="panel-body">
            <div className="menu">
              {MENU.map((menu) => (
                <MenuCard menu={menu} disabled={!isOpen} onAdd={addItem} />
              ))}
            </div>
            <ScoreBoard score={score} />
          </div>
        </section>
        <Receipt items={items} score={score} onRemove={removeItem} />
      </div>
      <p className="debug">
        렌더 {renders}회 · 점수 계산 {scoreRuns}회
      </p>
    </main>
  );
}

// ── 자식 컴포넌트들: h()가 그 자리에서 바로 실행해 VNode로 펼친다 ──

function Header({ isOpen, onToggle }) {
  return (
    <header>
      <div>
        <p className="eyebrow">MINI REACT · DEMO</p>
        <h1>정글 생존 자판기</h1>
        <p className="subtitle">오늘도 살아남기 위한 작은 선택</p>
      </div>
      <button type="button" className="status" onClick={onToggle}>
        {isOpen ? '영업 중' : '휴식 중'}
      </button>
    </header>
  );
}

function MenuCard({ menu, disabled, onAdd }) {
  return (
    <article className="card">
      <span className="icon">{menu.icon}</span>
      <strong>{menu.name}</strong>
      <span className="badge">+{menu.score}점</span>
      <button type="button" className="add" disabled={disabled} onClick={() => onAdd(menu.id)}>
        + 담기
      </button>
    </article>
  );
}

function ScoreBoard({ score }) {
  // 점수는 100을 넘을 수 있지만 막대는 100%에서 멈춘다
  const percent = Math.min(score, MAX_SCORE);
  return (
    <div className="score">
      <h3>생존 점수</h3>
      <p className="score-value">
        {score} / {MAX_SCORE}
      </p>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${percent}%` }}></div>
      </div>
      <p className="score-message">{scoreMessage(score)}</p>
    </div>
  );
}

function Receipt({ items, score, onRemove }) {
  return (
    <section className="panel receipt">
      <h2>오늘의 선택</h2>
      <div className="panel-body">
        <p className="count">{items.length}개 선택됨</p>
        {/* 비었을 때 <ul> ↔ <p>로 태그가 바뀌면 diff에서 REPLACE가 나온다 */}
        {items.length === 0 ? (
          <p className="empty">아직 담은 아이템이 없어요.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <ReceiptItem item={item} onRemove={onRemove} />
            ))}
          </ul>
        )}
        <p className="total">
          <span>합계</span>
          <strong>{score}점</strong>
        </p>
        <p className="hint">선택 내역이 자동 저장돼요</p>
      </div>
    </section>
  );
}

function ReceiptItem({ item, onRemove }) {
  const menu = findMenu(item.menuId);
  return (
    <li>
      <span className="name">
        {menu.icon} {menu.name}
      </span>
      <span className="plus">+{menu.score}</span>
      <button type="button" className="cancel" onClick={() => onRemove(item.entryId)}>
        취소
      </button>
    </li>
  );
}

new FunctionComponent(App).mount(document.querySelector('#root'));
