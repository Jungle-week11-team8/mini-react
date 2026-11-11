import { defineConfig } from 'vite';

// `vite demo`는 demo/를 루트로 삼아 이 위치에서 설정을 찾는다.
// JSX는 React 런타임이 아니라 우리 h() 호출로 바꾼다 (AGENTS.md JSX 사용 규칙).
export default defineConfig({
  oxc: {
    // development 모드는 __self, __source props를 붙여서 h()가 DOM 속성으로 넣어 버린다
    jsx: { runtime: 'classic', pragma: 'h', development: false },
  },
});
