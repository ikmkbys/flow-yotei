export type Availability = '○' | '△' | '×';

export interface YoteiEvent {
  id?: string;
  title: string;
  description?: string;
  eventUrl?: string;              // イベント詳細URL（任意）
  deadline?: string;              // 回答締め切り（ISO: "2026-03-27T23:59"）
  confirmedDate?: string;         // 確定日程
  dates: string[];            // ISO date strings: "2026-03-27" or "2026-03-27T14:00"
  creatorName: string;
  createdAt?: Date;
}

export interface Response {
  id?: string;
  name: string;
  availability: Record<string, Availability>;  // date → availability
  comment?: string;                            // 一言コメント（任意）
  createdAt?: Date;
}
