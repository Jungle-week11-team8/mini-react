import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // patch 테스트가 실제 DOM API를 쓰므로 jsdom에서 돌린다
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
