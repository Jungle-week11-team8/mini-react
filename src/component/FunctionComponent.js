/**
 * 함수형 컴포넌트 하나와 그 컴포넌트의 상태를 담는 그릇이다.
 */
export class FunctionComponent {
  /**
   * @param {(props: object) => import('../vdom/types.js').VNode} fn
   * @param {object} [props]
   */
  constructor(fn, props = {}) {
    // 잘못된 값은 렌더 시점이 아니라 만드는 시점에 바로 드러나게 한다
    if (typeof fn !== 'function') {
      throw new TypeError('FunctionComponent의 첫 번째 인자는 함수여야 합니다.');
    }
    this.fn = fn;
    this.props = props;
    // 함수는 실행이 끝나면 지역 변수를 잃으므로, 훅의 값은 인스턴스가 대신 기억한다
    this.hooks = [];
    // 훅은 이름이 없어서 호출 순서로 자기 칸을 찾는다
    this.hookIndex = 0;
  }
}
