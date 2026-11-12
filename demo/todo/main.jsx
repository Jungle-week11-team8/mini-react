import { FunctionComponent, h, useState, useMemo, useEffect } from '../../src/index.js';

// ───────────────────────────────────────────────
// 규칙: useState / useMemo / useEffect는 App 안에서만 쓴다.
// 자식 컴포넌트는 props를 받아 VNode를 돌려주는 "순수 함수"다.
// ───────────────────────────────────────────────

let renders = 0; // 렌더 횟수 확인용 (8단계 Batching)
let filterRuns = 0; // 목록 계산 횟수 확인용 (6단계 useMemo)

function matchesFilter(todo, filter) {
    if (filter === 'active') return !todo.done;
    if (filter === 'done') return todo.done;
    return true; // 'all'
}

function App() {
    // ── State: 사용자 조작으로 바뀌는 값 4개 ──
    const [todos, setTodos] = useState([
        { id: 1, title: 'mini-react 복습', done: false },
        { id: 2, title: '발표 자료 만들기', done: true },
    ]);
    const [draft, setDraft] = useState(''); // 추가 입력창
    const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'done'
    const [query, setQuery] = useState(''); // 검색어

    renders += 1;
    console.log('렌더', renders);

    // ── 파생값: state에서 계산할 수 있으니 state로 두지 않는다 ──
    // 의존성이 안 바뀌면 이전 결과를 재사용 (정확성이 아니라 비용 절감)
    const visibleTodos = useMemo(() => {
        filterRuns += 1;
        console.log('목록 계산', filterRuns);
        return todos.filter((t) => matchesFilter(t, filter) && t.title.includes(query));
    }, [todos, filter, query]);

    const remaining = useMemo(() => todos.filter((t) => !t.done).length, [todos]);

    // ── 부수 효과: Virtual DOM 밖(탭 제목)을 바꾼다. patch 뒤에 실행됨 ──
    useEffect(() => {
        console.log('제목 갱신', remaining);
        document.title = `할 일 (${remaining})`;
    }, [remaining]);

    // ── 이벤트 핸들러: 모두 "새 배열/새 객체"를 만든다 (불변 업데이트) ──
    function addTodo(event) {
        event.preventDefault(); // 없으면 form이 페이지를 새로고침함
        const title = draft.trim();
        if (!title) return;
        // setTodos와 setDraft를 연달아 불러도 렌더는 1번 (queueMicrotask로 묶임)
        setTodos((prev) => [...prev, { id: Date.now(), title, done: false }]);
        setDraft('');
    }

    function removeTodo(id) {
        setTodos((prev) => prev.filter((t) => t.id !== id));
    }

    function toggleTodo(id) {
        // 객체를 직접 고치지 않고 { ...t, done } 으로 새로 만든다
        setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    }

    return (
        <main className="todo-app">
            <h1>할 일</h1>
            <TodoForm draft={draft} onDraftInput={setDraft} onSubmit={addTodo} />
            <Toolbar
                filter={filter}
                query={query}
                remaining={remaining}
                onFilterChange={setFilter}
                onQueryInput={setQuery}
            />
            <TodoList todos={visibleTodos} onToggle={toggleTodo} onRemove={removeTodo} />
        </main>
    );
}

// ── 자식 컴포넌트들: h()가 그 자리에서 바로 실행해 VNode로 펼친다 ──

function TodoForm({ draft, onDraftInput, onSubmit }) {
    return (
        <form onSubmit={onSubmit}>
            {/* onChange는 포커스를 잃을 때만 불리므로 onInput을 쓴다 */}
            <input value={draft} onInput={(e) => onDraftInput(e.target.value)} placeholder="할 일 입력" />
            <button type="submit">추가</button>
        </form>
    );
}

function Toolbar({ filter, query, remaining, onFilterChange, onQueryInput }) {
    return (
        <div>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => onFilterChange('all')}>
                전체
            </button>
            <button className={filter === 'active' ? 'active' : ''} onClick={() => onFilterChange('active')}>
                진행 중
            </button>
            <button className={filter === 'done' ? 'active' : ''} onClick={() => onFilterChange('done')}>
                완료
            </button>
            <input value={query} onInput={(e) => onQueryInput(e.target.value)} placeholder="검색" />
            <p>남은 할 일 {remaining}개</p>
        </div>
    );
}

function TodoList({ todos, onToggle, onRemove }) {
    // 비었을 때 <ul> ↔ <p>로 태그가 바뀌면 diff에서 REPLACE가 나온다
    if (todos.length === 0) return <p>할 일이 없습니다</p>;

    return (
        <ul>
            {todos.map((todo) => (
                <TodoItem todo={todo} onToggle={onToggle} onRemove={onRemove} />
            ))}
        </ul>
    );
}

function TodoItem({ todo, onToggle, onRemove }) {
    return (
        <li className={todo.done ? 'todo done' : 'todo'}>
            {/* checked={true} → checked="" 속성, false → 속성 없음 */}
            <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
            <span>{todo.title}</span>
            <button onClick={() => onRemove(todo.id)}>삭제</button>
        </li>
    );
}

new FunctionComponent(App).mount(document.querySelector('#root'));

// ── 실험용: 실제 DOM이 몇 번 바뀌는지 콘솔에서 본다 (3단계) ──
const observer = new MutationObserver((records) => {
    console.groupCollapsed(`DOM 변경 ${records.length}건`);
    for (const record of records) console.log(record.type, record.target, record);
    console.groupEnd();
});
observer.observe(document.querySelector('#root'), {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true,
});