// 외부에 공개하는 API re-export
export { domToVNode, createDom, h } from './vdom/index.js';
export { diff } from './diff/index.js';
export { applyPatches } from './patch/index.js';
export { FunctionComponent } from './component/index.js';
export { useState, useEffect, useMemo, getCurrentComponent, areDepsEqual } from './hooks/index.js';
