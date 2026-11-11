import { beforeEach, describe, expect, it, vi } from 'vitest';

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const click = async (action, scope = document) => {
  scope.querySelector(`[data-action="${action}"]`).click();
  await tick();
};
const fill = async (name, value) => {
  const el = document.querySelector(`[name="${name}"]`);
  el.value = value;
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  await tick();
};
const dragEvent = async (card, type, y = 0) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientY: { value: y },
    dataTransfer: { value: { setData: vi.fn(), effectAllowed: '', dropEffect: '' } },
  });
  card.dispatchEvent(event);
  await tick();
};
const card = (id) => document.querySelector(`.question[data-id="${id}"]`);
const order = () => [...document.querySelectorAll('.question')].map((el) => el.dataset.id);
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  await import('../demo/survey/main.js');
});

describe('설문 제작기', () => {
  it('위·아래 버튼으로 선택한 질문을 이동하고 양 끝에서 버튼을 비활성화한다', async () => {
    expect(document.querySelector('[data-action="up"]').disabled).toBe(true);
    await click('down');
    expect(order()).toEqual(['q2', 'q1', 'q3']);
    expect(card('q1').getAttribute('aria-pressed')).toBe('true');
    await click('down');
    expect(order()).toEqual(['q2', 'q3', 'q1']);
    expect(document.querySelector('[data-action="down"]').disabled).toBe(true);
    await click('up');
    expect(order()).toEqual(['q2', 'q1', 'q3']);
  });

  it('목록의 방향키로 질문을 옮기고 동일한 질문에 포커스를 유지한다', async () => {
    const press = async (key) => {
      card('q1').dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await tick();
    };
    card('q1').focus();
    await press('ArrowDown');
    expect(order()).toEqual(['q2', 'q1', 'q3']);
    expect(document.activeElement).toBe(card('q1'));
    await press('ArrowUp');
    expect(order()).toEqual(['q1', 'q2', 'q3']);
    expect(
      [...document.querySelectorAll('.question .question-number')].map((el) => el.textContent),
    ).toEqual(['01', '02', '03']);
    await press('ArrowUp');
    expect(order()).toEqual(['q1', 'q2', 'q3']);
  });
  it('손잡이 포인터 이동으로 정렬하고 취소 시 표시를 정리한다', async () => {
    const root = document.getElementById('app');
    root.setPointerCapture = vi.fn();
    root.releasePointerCapture = vi.fn();
    // jsdom은 레이아웃 기반 hit test가 없어 드롭 대상만 브라우저 대신 제공한다.
    document.elementFromPoint = vi.fn(() => card('q3'));
    const pointer = async (target, type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        pointerId: { value: 7 },
        button: { value: 0 },
        clientX: { value: 10 },
        clientY: { value: 10 },
      });
      target.dispatchEvent(event);
      await tick();
    };
    await pointer(card('q1').querySelector('.drag-handle'), 'pointerdown');
    await pointer(root, 'pointermove');
    await pointer(root, 'pointerup');
    expect(order()).toEqual(['q2', 'q3', 'q1']);
    expect(root.releasePointerCapture).toHaveBeenCalledWith(7);
    await pointer(card('q2').querySelector('.drag-handle'), 'pointerdown');
    await pointer(root, 'pointercancel');
    expect(document.querySelector('.dragging')).toBeNull();
    delete document.elementFromPoint;
  });
  it('드래그 정렬 후 번호와 선택을 유지하고 적용·이력·응답을 ID 기준으로 연결한다', async () => {
    await fill('q1', '보존할 답변');
    await dragEvent(card('q1'), 'dragstart');
    await dragEvent(card('q3'), 'dragover', 1);
    expect(card('q3').classList.contains('drop-after')).toBe(true);
    await dragEvent(card('q3'), 'drop', 1);
    await dragEvent(card('q1'), 'dragend');
    expect(order()).toEqual(['q2', 'q3', 'q1']);
    expect(
      [...document.querySelectorAll('.question .question-number')].map((el) => el.textContent),
    ).toEqual(['01', '02', '03']);
    expect(card('q1').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.answer-question textarea').value).toBe('보존할 답변');
    expect(
      JSON.parse(localStorage.getItem('mini-react-survey-v1')).questions.map((q) => q.id),
    ).toEqual(order());
    await click('apply');
    expect(document.querySelector('.answer-question input').name).toBe('q2');
    expect(document.querySelector('[name="q1"]').value).toBe('보존할 답변');
    await click('back');
    expect(order()).toEqual(['q1', 'q2', 'q3']);
    await click('forward');
    expect(order()).toEqual(['q2', 'q3', 'q1']);
  });

  it('역방향 이동과 자기 자신 드롭·취소·외부 드롭을 처리한다', async () => {
    await dragEvent(card('q3'), 'dragstart');
    await dragEvent(card('q1'), 'drop', -1);
    expect(order()).toEqual(['q3', 'q1', 'q2']);
    await dragEvent(card('q3'), 'dragstart');
    await dragEvent(card('q3'), 'drop', 1);
    expect(order()).toEqual(['q3', 'q1', 'q2']);
    await dragEvent(card('q1'), 'dragstart');
    await dragEvent(card('q2'), 'dragover', 1);
    await dragEvent(card('q1'), 'dragend');
    expect(document.querySelector('.dragging, .drop-after')).toBeNull();
    await dragEvent(card('q2'), 'drop', 1);
    expect(order()).toEqual(['q3', 'q1', 'q2']);
  });
  it('질문 세 개를 마운트하고 필수 응답을 검증한다', async () => {
    expect(document.querySelectorAll('.answer-question')).toHaveLength(3);
    await click('submit');
    expect(document.querySelectorAll('.answer-question .inline-error')).toHaveLength(2);
    await fill('q1', '정글');
    const radio = document.querySelector('input[name="q2"]');
    radio.checked = true;
    radio.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    await click('submit');
    expect(document.querySelector('.success').textContent).toContain('정글');
  });

  it('제목 편집은 실제 화면과 분리하고 적용 시 기존 답변을 보존한다', async () => {
    await fill('q1', '응답');
    const kept = document.querySelector('[name="q1"]');
    await fill('question-title', '수정한 질문');
    expect(document.querySelector('[name="q1"]')).toBe(kept);
    expect(document.querySelector('.answer-question').textContent).not.toContain('수정한 질문');
    await click('apply');
    expect(document.querySelector('.answer-question').textContent).toContain('수정한 질문');
    expect(document.querySelector('[name="q1"]').value).toBe('응답');
  });

  it('HTML 오류에서는 적용과 이력을 보존하고 정상 입력으로 복구한다', async () => {
    await fill('html', '<p>A</p><p>B</p>');
    await click('apply');
    expect(document.querySelector('.notice').textContent).toContain('최상위');
    expect(document.querySelector('.history span').textContent).toBe('1 / 1');
    await fill(
      'html',
      '<section>\n<!-- 주석 --><table><tbody><tr><td>표</td></tr></tbody></table></section>',
    );
    await click('apply');
    expect(document.querySelector('.survey-paper td').textContent).toBe('표');
    expect(document.querySelector('.survey-paper').innerHTML).toContain('<!-- 주석 -->');
  });

  it('질문 유형을 변경하고 이력 복원 시 응답 프로퍼티도 초기화한다', async () => {
    await fill('type', 'checkbox');
    await click('apply');
    const first = document.querySelector('input[name="q1"]');
    first.checked = true;
    first.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    await click('back');
    expect(document.querySelector('textarea[name="q1"]').value).toBe('');
    await click('forward');
    expect(document.querySelector('input[name="q1"]').checked).toBe(false);
    await click('back');
    await fill('survey-title', '새 분기');
    await click('apply');
    expect(document.querySelector('[data-action="forward"]').disabled).toBe(true);
    expect(document.querySelector('.history span').textContent).toBe('2 / 2');
  });

  it('질문 전환에서 dirty 필수 체크 상태를 복원하고 선택지를 삭제한다', async () => {
    const required = document.querySelector('[name="required"]');
    required.checked = false;
    required.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    document.querySelector('[data-id="q2"]').click();
    await tick();
    expect(document.querySelector('[name="required"]').checked).toBe(true);
    await click('remove-option');
    await click('apply');
    expect(document.querySelectorAll('input[name="q2"]')).toHaveLength(2);
    await click('add');
    expect(document.querySelectorAll('.question-list .question')).toHaveLength(4);
    await click('delete');
    expect(document.querySelectorAll('.question-list .question')).toHaveLength(3);
  });

  it('초안을 저장하고 HTML의 실행 코드 입력을 거부한다', async () => {
    await fill('survey-title', '저장할 초안');
    expect(JSON.parse(localStorage.getItem('mini-react-survey-v1')).title).toBe('저장할 초안');
    await fill('html', '<div onclick="alert(1)">안내</div>');
    await click('apply');
    expect(document.querySelector('.notice').textContent).toContain('지원하지 않는 속성');
    expect(document.querySelector('.survey-paper').textContent).not.toContain('저장할 초안');
  });
});
