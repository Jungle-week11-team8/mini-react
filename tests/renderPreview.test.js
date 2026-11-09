import { describe, expect, it } from 'vitest';
import { diff, domToVNode } from '../src/index.js';
import { renderPreview } from '../src/patch/index.js';

describe('renderPreview', () => {
  it('미리보기에 최신 가상 DOM을 다시 그리고 실제 영역을 보존한다', () => {
    const actual = document.createElement('div');
    actual.innerHTML = '<p class="initial">0<!-- 구분 --></p>';
    const preview = document.createElement('div');
    const v0 = domToVNode(actual.firstChild);
    const v1 = { ...v0, children: [{ type: 'text', text: '1' }, v0.children[1]] };

    renderPreview(preview, v0);
    expect(domToVNode(preview.firstChild)).toStrictEqual(v0);

    renderPreview(preview, v1);
    expect(preview.childNodes).toHaveLength(1);
    expect(domToVNode(preview.firstChild)).toStrictEqual(v1);
    expect(domToVNode(actual.firstChild)).toStrictEqual(v0);
    expect(diff(v0, v1)).toStrictEqual([{ type: 'SET_DATA', path: [0, 0], value: '1' }]);
  });
});
