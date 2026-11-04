// 每种智力检定结果可以分别设置左、右页的文字；空字符串表示留白。
export const NOTEBOOK_PAGE_COPY={
  critical:{left:'首饰盒',right:'唱片机拆信刀'}, // 大成功
  success:{left:'书脊',right:'唱片机'}, // 成功
  failure:{left:'喝啤酒',right:'打猎杀对决'}, // 失败
  fumble:{left:'喝啤酒',right:'打猎杀对决'}, // 大失败，与失败相同
};
export function notebookPagesFor(result){return NOTEBOOK_PAGE_COPY[result]||{left:'',right:''};}
export function notebookPageLabel(result){const pages=notebookPagesFor(result);return [pages.left,pages.right].filter(Boolean).join(' / ');}
