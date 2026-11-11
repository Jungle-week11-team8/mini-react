import { FunctionComponent, useState, useEffect, useMemo, domToVNode } from '../../src/index.js';

const h = (tag, attrs = {}, children = []) => ({
  type: 'element',
  tag,
  attrs,
  children: children
    .flat()
    .map((c) => (typeof c === 'object' ? c : { type: 'text', text: String(c) })),
});
const btn = (action, label, attrs = {}) =>
  h('button', { type: 'button', 'data-action': action, ...attrs }, [label]);
const field = (label, control) => h('label', { class: 'field' }, [h('span', {}, [label]), control]);
const input = (name, value, attrs = {}) => h('input', { name, value: String(value), ...attrs });
const types = { short: '단답형', radio: '객관식', checkbox: '체크박스' };
const storageKey = 'mini-react-survey-v1';
const root = document.getElementById('app');
let update;
let latest;
const newId = (prefix) => prefix + crypto.randomUUID();
const clone = (value) => structuredClone(value);
const seed = {
  title: '함께 만드는 더 나은 정글',
  html: '<section><p>여러분의 경험이 다음 도전을 만듭니다.</p><!-- 안내 --><details><summary>응답 안내</summary><ul><li>필수 질문을 확인해 주세요.</li><li>응답은 이 브라우저 안에서만 사용됩니다.</li></ul></details></section>',
  questions: [
    { id: 'q1', title: '어떤 이름으로 불러드릴까요?', type: 'short', required: true, options: [] },
    {
      id: 'q2',
      title: '가장 흥미로웠던 주제는?',
      type: 'radio',
      required: true,
      options: [
        { id: 'o1', label: 'Virtual DOM' },
        { id: 'o2', label: 'Diff & Patch' },
        { id: 'o3', label: 'State & Hooks' },
      ],
    },
    {
      id: 'q3',
      title: '다음에 더 탐구하고 싶은 것은?',
      type: 'checkbox',
      required: false,
      options: [
        { id: 'o4', label: '브라우저 렌더링' },
        { id: 'o5', label: '상태 관리' },
      ],
    },
  ],
};

// HTML은 화면 밖에서 파싱하고, 함수나 DOM 참조가 없는 VNode로만 렌더에 전달한다.
export function parseHtml(source) {
  const template = document.createElement('template');
  template.innerHTML = source.trim();
  if (template.content.childNodes.length !== 1)
    throw new Error('설명 HTML의 최상위 노드는 하나여야 합니다.');
  const allowed = new Set([
    'section',
    'article',
    'div',
    'p',
    'span',
    'h2',
    'h3',
    'h4',
    'strong',
    'em',
    'b',
    'i',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'details',
    'summary',
    'br',
    'hr',
    'blockquote',
    'code',
    'pre',
    'a',
    'img',
    'figure',
    'figcaption',
  ]);
  for (const el of template.content.querySelectorAll('*')) {
    if (!allowed.has(el.localName))
      throw new Error(
        '설명에는 문서용 태그를 사용해 주세요. 입력 요소는 질문 설정에서 추가합니다.',
      );
    for (const attr of el.attributes) {
      if (
        !['class', 'title', 'alt', 'href', 'src', 'colspan', 'rowspan', 'open'].includes(attr.name)
      )
        throw new Error('지원하지 않는 속성: ' + attr.name);
      if (['href', 'src'].includes(attr.name) && !/^(https?:\/\/|#)/i.test(attr.value))
        throw new Error('링크와 이미지에는 https/http 주소 또는 # 경로를 사용해 주세요.');
    }
  }
  return domToVNode(template.content.firstChild);
}

function validateSurvey(survey) {
  parseHtml(survey.html);
  if (!survey.title.trim()) throw new Error('설문 제목을 입력해 주세요.');
  if (!survey.questions.length) throw new Error('질문을 하나 이상 추가해 주세요.');
  for (const q of survey.questions) {
    if (!q.title.trim()) throw new Error('모든 질문의 제목을 입력해 주세요.');
    if (q.type !== 'short' && (q.options.length < 2 || q.options.some((o) => !o.label.trim())))
      throw new Error('선택형 질문에는 내용이 있는 선택지가 두 개 이상 필요합니다.');
  }
}

function initial() {
  let draft = clone(seed);
  let notice = '초안을 편집하고 변경 적용을 눌러 보세요.';
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) {
      // 저장 데이터도 입력이므로 구조와 콘텐츠를 검증한 뒤 사용한다.
      if (
        !saved.questions.every(
          (q) =>
            types[q.type] &&
            typeof q.required === 'boolean' &&
            typeof q.id === 'string' &&
            q.options.every((o) => typeof o.id === 'string' && typeof o.label === 'string'),
        )
      )
        throw new Error();
      validateSurvey(saved);
      draft = saved;
      notice = '저장된 초안을 복원했습니다. 적용하면 응답 화면이 바뀝니다.';
    }
  } catch {
    notice = '초안을 불러올 수 없어 기본 설문으로 시작합니다.';
  }
  return {
    draft,
    applied: clone(seed),
    selected: draft.questions[0].id,
    answers: {},
    history: [clone(seed)],
    cursor: 0,
    epoch: 0,
    editEpoch: 0,
    focusQuestion: null,
    drag: null,
    submitted: false,
    notice,
    error: '',
  };
}

function QuestionList({ state }) {
  return h('aside', { class: 'question-list' }, [
    h('div', { class: 'panel-title' }, [
      h('h2', {}, ['질문 목록']),
      h('span', {}, [String(state.draft.questions.length).padStart(2, '0')]),
    ]),
    ...state.draft.questions.map((q, index) =>
      btn(
        'select',
        [
          h('span', { class: 'drag-handle', 'aria-hidden': 'true' }, ['⋮⋮']),
          h('span', { class: 'question-number' }, [String(index + 1).padStart(2, '0')]),
          h('span', {}, [
            h('strong', {}, [q.title || '제목 없는 질문']),
            h('small', {}, [types[q.type] + (q.required ? ' · 필수' : '')]),
          ]),
        ],
        {
          'data-id': q.id,
          draggable: 'true',
          title: '드래그하여 질문 순서 변경',
          'aria-keyshortcuts': 'ArrowUp ArrowDown',
          class: [
            'question',
            q.id === state.selected ? 'active' : '',
            state.drag?.source === q.id ? 'dragging' : '',
            state.drag?.target === q.id ? `drop-${state.drag.position}` : '',
          ]
            .filter(Boolean)
            .join(' '),
          'aria-pressed': String(q.id === state.selected),
        },
      ),
    ),
    btn('add', '+ 질문 추가', { class: 'add-question' }),
    h('p', { class: 'small-note' }, [
      '카드를 드래그하거나, 목록에서 질문을 선택한 뒤 키보드 ↑·↓로 순서를 바꾸세요. 편집 패널의 위·아래 버튼도 사용할 수 있습니다.',
    ]),
  ]);
}

function Editor({ state }) {
  const q = state.draft.questions.find((q) => q.id === state.selected);
  return h(state.editEpoch % 2 ? 'article' : 'section', { class: 'editor' }, [
    h('div', { class: 'panel-title' }, [
      h('h2', {}, ['설문 편집']),
      h('span', { class: 'badge' }, ['DRAFT']),
    ]),
    field('설문 제목', input('survey-title', state.draft.title)),
    field(
      '안내문 HTML',
      h('textarea', { name: 'html', rows: '7', spellcheck: 'false' }, [state.draft.html]),
    ),
    h('p', { class: 'small-note' }, [
      '문단·목록·표·이미지·details·주석을 자유롭게 구성하세요. 최상위 노드는 하나입니다.',
    ]),
    h('div', { class: 'draft-preview' }, [
      h('span', { class: 'eyebrow' }, ['HTML PREVIEW']),
      ...safePreview(state.draft.html),
    ]),
    q
      ? h('div', { class: 'question-settings' }, [
          h('div', { class: 'settings-heading' }, [
            h('h3', {}, ['질문 설정']),
            btn('delete', '삭제', { class: 'danger' }),
          ]),
          field('질문 제목', input('question-title', q.title)),
          field(
            '질문 유형',
            h(
              'select',
              { name: 'type' },
              Object.entries(types).map(([value, label]) =>
                h('option', { value, ...(q.type === value ? { selected: '' } : {}) }, [label]),
              ),
            ),
          ),
          h('label', { class: 'check-label' }, [
            input('required', 'yes', { type: 'checkbox', ...(q.required ? { checked: '' } : {}) }),
            ' 필수 응답',
          ]),
          ...(q.type === 'short'
            ? []
            : [
                h('h3', {}, ['선택지']),
                ...q.options.map((o) =>
                  h('div', { class: 'option-row' }, [
                    input('option', o.label, { 'data-option': o.id, 'aria-label': '선택지 내용' }),
                    btn('remove-option', '×', { 'data-option': o.id, 'aria-label': '선택지 삭제' }),
                  ]),
                ),
                btn('add-option', '+ 선택지 추가', { class: 'text-button' }),
              ]),
          h('div', { class: 'move-controls' }, [
            btn('up', '↑ 위로', state.draft.questions[0].id === q.id ? { disabled: '' } : {}),
            btn(
              'down',
              '↓ 아래로',
              state.draft.questions.at(-1).id === q.id ? { disabled: '' } : {},
            ),
          ]),
        ])
      : h('p', {}, ['질문을 추가해 주세요.']),
  ]);
}

function safePreview(source) {
  try {
    return [parseHtml(source)];
  } catch (error) {
    return [h('p', { class: 'inline-error' }, [error.message])];
  }
}

function AnswerQuestion({ q, index, answer, submitted }) {
  const missing =
    q.required && (Array.isArray(answer) ? !answer.length : !String(answer ?? '').trim());
  const common = {
    'data-question': q.id,
    ...(q.required ? { required: '' } : {}),
    'aria-invalid': String(submitted && missing),
  };
  const controls =
    q.type === 'short'
      ? h(
          'textarea',
          {
            ...common,
            rows: '2',
            name: q.id,
            placeholder: '답변을 입력해 주세요',
            'aria-label': q.title,
          },
          [answer || ''],
        )
      : h('fieldset', { class: 'choices' }, [
          h('legend', { class: 'sr-only' }, [q.title]),
          ...q.options.map((o) =>
            h('label', { class: 'choice' }, [
              input(q.id, o.id, {
                type: q.type,
                'data-question': q.id,
                ...(q.type === 'radio' && q.required ? { required: '' } : {}),
                ...(q.type === 'checkbox'
                  ? Array.isArray(answer) && answer.includes(o.id)
                    ? { checked: '' }
                    : {}
                  : answer === o.id
                    ? { checked: '' }
                    : {}),
              }),
              o.label,
            ]),
          ),
        ]);
  return h('section', { class: 'answer-question' }, [
    h('h3', {}, [
      h('span', { class: 'question-number' }, [String(index + 1).padStart(2, '0')]),
      q.title,
      ...(q.required ? [h('span', { class: 'required-mark' }, ['*'])] : []),
    ]),
    controls,
    ...(submitted && missing
      ? [h('p', { class: 'inline-error', role: 'alert' }, ['응답을 입력해 주세요.'])]
      : []),
  ]);
}

function Respondent({ state, progress }) {
  return h('section', { class: 'respondent' }, [
    h('div', { class: 'panel-title' }, [
      h('h2', {}, ['실제 응답 화면']),
      h('span', { class: 'badge live' }, ['APPLIED']),
    ]),
    // 버전 전환 시 입력 영역을 교체해 dirty value/checked 프로퍼티를 확실히 초기화한다.
    h(state.epoch % 2 ? 'article' : 'div', { class: 'survey-paper' }, [
      h('span', { class: 'eyebrow' }, ['YOUR VOICE MATTERS']),
      h('h2', { class: 'survey-title' }, [state.applied.title]),
      parseHtml(state.applied.html),
      h('div', { class: 'progress-label' }, [
        h('span', {}, ['응답 진행률']),
        h('strong', {}, [progress.done + ' / ' + progress.total]),
      ]),
      h(
        'progress',
        {
          value: String(progress.done),
          max: String(progress.total || 1),
          'aria-label': '응답 진행률',
        },
        [],
      ),
      ...state.applied.questions.map((q, index) =>
        AnswerQuestion({ q, index, answer: state.answers[q.id], submitted: state.submitted }),
      ),
      btn('submit', '응답 확인 →', { class: 'primary wide' }),
      ...(state.submitted && progress.valid
        ? [
            h('div', { class: 'success', role: 'status' }, [
              '응답을 확인했습니다. 감사합니다!',
              h(
                'ul',
                {},
                state.applied.questions.map((q) =>
                  h('li', {}, [q.title + ': ' + formatAnswer(q, state.answers[q.id])]),
                ),
              ),
            ]),
          ]
        : []),
    ]),
  ]);
}

function formatAnswer(q, value) {
  if (q.type === 'short') return value || '(미응답)';
  return (
    q.options
      .filter((o) => (Array.isArray(value) ? value.includes(o.id) : value === o.id))
      .map((o) => o.label)
      .join(', ') || '(미응답)'
  );
}

function App() {
  const [state, setter] = useState(initial);
  update = setter;
  latest = state;
  const progress = useMemo(() => {
    const answered = (q) =>
      Array.isArray(state.answers[q.id])
        ? state.answers[q.id].length > 0
        : String(state.answers[q.id] ?? '').trim().length > 0;
    return {
      done: state.applied.questions.filter(answered).length,
      total: state.applied.questions.length,
      valid: state.applied.questions.filter((q) => q.required).every(answered),
    };
  }, [state.applied, state.answers]);
  useEffect(() => {
    // 인덱스 기반 diff 뒤에도 포커스가 같은 질문 ID를 따라가게 한다.
    if (state.focusQuestion) {
      [...root.querySelectorAll('.question')]
        .find((card) => card.dataset.id === state.focusQuestion.id)
        ?.focus();
    }
  }, [state.focusQuestion]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.draft));
    } catch {
      setter((s) => ({
        ...s,
        notice: '저장 공간을 사용할 수 없습니다. 현재 화면에서는 계속 편집할 수 있습니다.',
      }));
    }
  }, [state.draft]);
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        apply();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  return h('div', {}, [
    h('header', { class: 'topbar' }, [
      h('a', { href: '../index.html', class: 'brand' }, ['FORM', h('span', {}, ['/ studio'])]),
      h('span', { class: 'built-with' }, ['POWERED BY MINI-REACT']),
      h('span', { class: 'version' }, ['LOCAL WORKSPACE']),
    ]),
    h('main', {}, [
      h('div', { class: 'intro' }, [
        h('div', {}, [
          h('p', { class: 'eyebrow' }, ['ASK BETTER. BUILD TOGETHER.']),
          h('h1', {}, ['좋은 질문에서, 더 나은 답으로.']),
          h('p', {}, [
            '질문을 만들고 직접 응답해 보세요. 편집한 내용은 변경 적용 후 오른쪽에 반영됩니다.',
          ]),
        ]),
      ]),
      h('div', { class: 'toolbar' }, [
        h('span', {}, ['설문 워크스페이스']),
        h('div', { class: 'history' }, [
          btn('back', '← 되돌리기', state.cursor === 0 ? { disabled: '' } : {}),
          h('span', { 'aria-live': 'polite' }, [state.cursor + 1 + ' / ' + state.history.length]),
          btn(
            'forward',
            '다시 실행 →',
            state.cursor === state.history.length - 1 ? { disabled: '' } : {},
          ),
          btn('apply', '변경 적용 ↗', { class: 'primary' }),
        ]),
      ]),
      h(
        'p',
        { class: state.error ? 'notice error' : 'notice', role: state.error ? 'alert' : 'status' },
        [state.error || state.notice],
      ),
      h('div', { class: 'workspace' }, [
        QuestionList({ state }),
        Editor({ state }),
        Respondent({ state, progress }),
      ]),
      h('footer', {}, [
        'Vanilla JavaScript · FunctionComponent · useState · useEffect · useMemo · Virtual DOM → Diff → Patch',
        h('span', {}, ['Ctrl / ⌘ + Enter로 적용 · 이력 이동 시 응답 초기화']),
      ]),
    ]),
  ]);
}

function editDraft(transform) {
  update((s) => ({ ...s, draft: transform(clone(s.draft)), error: '', submitted: false }));
}
function editQuestion(transform) {
  editDraft((d) => ({
    ...d,
    questions: d.questions.map((q) => (q.id === latest.selected ? transform(q) : q)),
  }));
}

function moveQuestion(direction, id = null, keepFocus = false) {
  update((s) => {
    const questionId = id ?? s.selected;
    const index = s.draft.questions.findIndex((q) => q.id === questionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= s.draft.questions.length) return s;
    const questions = [...s.draft.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    return {
      ...s,
      draft: { ...s.draft, questions },
      selected: questionId,
      editEpoch: s.editEpoch + (s.selected === questionId ? 0 : 1),
      focusQuestion: keepFocus ? { id: questionId } : s.focusQuestion,
      submitted: false,
      error: '',
      notice: '질문 순서를 변경했습니다. 변경 적용을 누르면 실제 응답 화면에 반영됩니다.',
    };
  });
}
function apply() {
  try {
    validateSurvey(latest.draft);
  } catch (error) {
    update((s) => ({ ...s, error: error.message }));
    return;
  }
  update((s) => {
    const applied = clone(s.draft);
    const answers = {};
    for (const q of applied.questions) {
      const old = s.applied.questions.find((item) => item.id === q.id);
      if (old?.type === q.type)
        answers[q.id] =
          q.type === 'checkbox'
            ? (s.answers[q.id] || []).filter((id) => q.options.some((o) => o.id === id))
            : q.type === 'radio'
              ? q.options.some((o) => o.id === s.answers[q.id])
                ? s.answers[q.id]
                : ''
              : s.answers[q.id] || '';
    }
    const history = [...s.history.slice(0, s.cursor + 1), clone(applied)];
    return {
      ...s,
      applied,
      answers,
      history,
      cursor: history.length - 1,
      epoch: s.epoch + 1,
      submitted: false,
      error: '',
      notice: '변경을 적용했습니다. 같은 유형의 유효한 응답은 유지됩니다.',
    };
  });
}
function travel(offset) {
  update((s) => {
    const cursor = s.cursor + offset;
    if (cursor < 0 || cursor >= s.history.length) return s;
    const applied = clone(s.history[cursor]);
    return {
      ...s,
      applied,
      draft: clone(applied),
      selected: applied.questions[0].id,
      answers: {},
      cursor,
      editEpoch: s.editEpoch + 1,
      epoch: s.epoch + 1,
      submitted: false,
      error: '',
      notice: '설문 버전을 복원하고 응답을 초기화했습니다.',
    };
  });
}

new FunctionComponent(App).mount(root);

function questionCard(event) {
  return event.target.closest('.question[data-id]');
}

root.addEventListener('dragstart', (event) => {
  const card = questionCard(event);
  if (!card || !event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', card.dataset.id);
  update((s) => ({ ...s, drag: { source: card.dataset.id, target: null, position: null } }));
});

root.addEventListener('dragover', (event) => {
  const card = questionCard(event);
  if (!card || !latest.drag) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  const bounds = card.getBoundingClientRect();
  const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  const target = card.dataset.id === latest.drag.source ? null : card.dataset.id;
  // 같은 위치에서는 상태 갱신을 생략해 드래그 중 불필요한 렌더를 줄인다.
  update((s) =>
    !s.drag || (s.drag.target === target && s.drag.position === position)
      ? s
      : { ...s, drag: { ...s.drag, target, position } },
  );
});

root.addEventListener('drop', (event) => {
  const card = questionCard(event);
  if (!card || !latest.drag) return;
  event.preventDefault();
  const bounds = card.getBoundingClientRect();
  const before = event.clientY < bounds.top + bounds.height / 2;
  dropQuestion(card.dataset.id, before);
});

function dropQuestion(targetId, before) {
  update((s) => {
    if (!s.drag) return s;
    const source = s.draft.questions.find((q) => q.id === s.drag.source);
    if (!source || source.id === targetId) return { ...s, drag: null };
    const questions = s.draft.questions.filter((q) => q.id !== source.id);
    const target = questions.findIndex((q) => q.id === targetId);
    if (target < 0) return { ...s, drag: null };
    questions.splice(target + (before ? 0 : 1), 0, source);
    return {
      ...s,
      draft: { ...s.draft, questions },
      drag: null,
      error: '',
      notice: '질문 순서를 변경했습니다. 변경 적용을 누르면 실제 응답 화면에 반영됩니다.',
    };
  });
}

// 손잡이는 Pointer Events로 처리해 터치와 네이티브 드래그가 제한된 환경도 지원한다.
root.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.drag-handle') || event.button !== 0) return;
  const card = questionCard(event);
  event.preventDefault();
  root.setPointerCapture(event.pointerId);
  update((s) => ({
    ...s,
    drag: { source: card.dataset.id, target: null, position: null, pointerId: event.pointerId },
  }));
});
root.addEventListener('pointermove', (event) => {
  if (latest.drag?.pointerId !== event.pointerId) return;
  const card = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest('.question[data-id]');
  const target = card && card.dataset.id !== latest.drag.source ? card.dataset.id : null;
  const bounds = card?.getBoundingClientRect();
  const position = bounds && event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  update((s) =>
    !s.drag || (s.drag.target === target && s.drag.position === position)
      ? s
      : { ...s, drag: { ...s.drag, target, position } },
  );
});
root.addEventListener('pointerup', (event) => {
  if (latest.drag?.pointerId !== event.pointerId) return;
  if (latest.drag.target) dropQuestion(latest.drag.target, latest.drag.position === 'before');
  else update((s) => ({ ...s, drag: null }));
  root.releasePointerCapture(event.pointerId);
});
root.addEventListener('pointercancel', () => update((s) => (s.drag ? { ...s, drag: null } : s)));

root.addEventListener('dragend', () => {
  update((s) => (s.drag ? { ...s, drag: null } : s));
});

root.addEventListener('input', (event) => {
  const el = event.target;
  const qid = el.dataset.question;
  if (qid) {
    update((s) => {
      const value =
        el.type === 'checkbox'
          ? el.checked
            ? [...new Set([...(s.answers[qid] || []), el.value])]
            : (s.answers[qid] || []).filter((id) => id !== el.value)
          : el.value;
      return { ...s, answers: { ...s.answers, [qid]: value }, submitted: false };
    });
    return;
  }
  if (el.name === 'survey-title') editDraft((d) => ({ ...d, title: el.value }));
  if (el.name === 'html') editDraft((d) => ({ ...d, html: el.value }));
  if (el.name === 'question-title') editQuestion((q) => ({ ...q, title: el.value }));
  if (el.name === 'option')
    editQuestion((q) => ({
      ...q,
      options: q.options.map((o) => (o.id === el.dataset.option ? { ...o, label: el.value } : o)),
    }));
});
root.addEventListener('change', (event) => {
  const el = event.target;
  if (el.name === 'type')
    editQuestion((q) => ({
      ...q,
      type: el.value,
      options:
        el.value === 'short'
          ? []
          : q.options.length
            ? q.options
            : [
                { id: newId('o'), label: '선택지 1' },
                { id: newId('o'), label: '선택지 2' },
              ],
    }));
  if (el.name === 'required') editQuestion((q) => ({ ...q, required: el.checked }));
});
root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'apply') apply();
  if (action === 'back') travel(-1);
  if (action === 'forward') travel(1);
  if (action === 'select') {
    // 편집 대상 전환은 입력의 dirty 상태까지 초기화해야 하므로 설정 패널의 태그를 바꾼다.
    update((s) => ({ ...s, selected: el.dataset.id, editEpoch: s.editEpoch + 1 }));
  }
  if (action === 'add') {
    const id = newId('q');
    update((s) => ({
      ...s,
      draft: {
        ...s.draft,
        questions: [
          ...s.draft.questions,
          { id, title: '새 질문', type: 'short', required: false, options: [] },
        ],
      },
      selected: id,
      editEpoch: s.editEpoch + 1,
      error: '',
    }));
  }
  if (action === 'delete') {
    update((s) => {
      if (s.draft.questions.length === 1)
        return { ...s, error: '최소 하나의 질문을 유지해 주세요.' };
      const questions = s.draft.questions.filter((q) => q.id !== s.selected);
      return {
        ...s,
        draft: { ...s.draft, questions },
        selected: questions[0].id,
        editEpoch: s.editEpoch + 1,
        error: '',
      };
    });
  }
  if (action === 'add-option')
    editQuestion((q) => ({
      ...q,
      options: [...q.options, { id: newId('o'), label: '새 선택지' }],
    }));
  if (action === 'remove-option')
    editQuestion((q) => ({ ...q, options: q.options.filter((o) => o.id !== el.dataset.option) }));
  if (action === 'up' || action === 'down') moveQuestion(action === 'up' ? -1 : 1);
  if (action === 'submit') update((s) => ({ ...s, submitted: true }));
});

root.addEventListener('keydown', (event) => {
  const card = questionCard(event);
  if (!card || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  moveQuestion(event.key === 'ArrowUp' ? -1 : 1, card.dataset.id, true);
});
