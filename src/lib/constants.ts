/* FreeBusy判定しきい値 */
export const AVAILABILITY_THRESHOLDS = {
  SLOT_BUSY: 0.5,   // 1時間枠：50%以上埋まり→×
  DAY_BUSY:  0.67,  // 終日：ビジネスアワーの67%（≒6h）以上→×
  DAY_DELTA: 0.33,  // 終日：33%（≒3h）以上→△
} as const;

/* ビジネスアワー（FreeBusy終日判定用） */
export const BUSINESS_HOURS = { START: 9, END: 18 } as const;

/* イベント保持期間 */
export const EVENT_RETENTION_DAYS = 180;

/* localStorageの作成履歴最大件数 */
export const MAX_EVENT_HISTORY = 20;
