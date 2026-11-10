import { describe, it, expect } from 'vitest';
import { FunctionComponent } from '../src/index.js';

const App = () => ({ type: 'text', text: 'A' });

describe('FunctionComponent', () => {
  describe('생성자', () => {
    it('fn과 props를 그대로 보관한다', () => {
      const props = { title: 'A' };
      const component = new FunctionComponent(App, props);
      expect(component.fn).toBe(App);
      expect(component.props).toBe(props);
    });

    it('props를 생략하면 빈 객체가 된다', () => {
      expect(new FunctionComponent(App).props).toEqual({});
    });

    it('hooks는 빈 배열, hookIndex는 0으로 시작한다', () => {
      const component = new FunctionComponent(App);
      expect(component.hooks).toEqual([]);
      expect(component.hookIndex).toBe(0);
    });

    it('인스턴스마다 hooks 배열이 따로 있다', () => {
      expect(new FunctionComponent(App).hooks).not.toBe(new FunctionComponent(App).hooks);
    });

    it('fn이 함수가 아니면 TypeError가 난다', () => {
      expect(() => new FunctionComponent(null)).toThrow(TypeError);
      expect(() => new FunctionComponent({ type: 'text', text: 'A' })).toThrow(TypeError);
    });
  });
});
