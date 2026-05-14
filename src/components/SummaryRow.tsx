import { formatDate } from '@/lib/dateUtils';

const BADGE_COLORS = ['#f59e0b', '#94a3b8', '#b45309'];

type SummaryRowData = {
  date: string;
  ok: number;
  maybe?: number;
  ng?: number;
  reqOk?: number;
  reqMaybe?: number;
  reqNg?: number;
};

type Props = {
  r: SummaryRowData;
  i: number;
  rankList: unknown[];
  accentColor: string;
  showConfirm: boolean;
  confirmedDates: string[];
  reqTotal: number;
  onConfirm: (date: string) => void;
};

export default function SummaryRow({
  r, i, rankList, accentColor, showConfirm, confirmedDates, reqTotal, onConfirm,
}: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: i < rankList.length - 1 ? '1px solid var(--border)' : 'none',
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
        background: BADGE_COLORS[i] ?? 'var(--bg3)',
        color: '#fff',
      }}>
        {i + 1}
      </span>
      <span style={{
        flex: 1, fontWeight: i === 0 ? 700 : 500,
        color: i === 0 ? 'var(--text)' : 'var(--muted)',
        fontSize: i === 0 ? 15 : 14,
      }}>
        {formatDate(r.date)}
        {i === 0 && (
          <span style={{ marginLeft: 8, fontSize: 11, color: accentColor, fontWeight: 700 }}>
            ◀ 最有力
          </span>
        )}
      </span>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
        {r.reqOk !== undefined ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>
              必須 {Math.round((r.reqOk / reqTotal) * 100)}%
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              ○{r.reqOk} △{r.reqMaybe} ×{r.reqNg}　全体○{r.ok}
            </span>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>○{r.ok}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ca8a04' }}>△{r.maybe}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>×{r.ng}</span>
          </div>
        )}
      </div>
      {showConfirm && (
        <button
          onClick={() => onConfirm(r.date)}
          style={{
            flexShrink: 0, fontSize: 11, fontWeight: 700,
            padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: 'none',
            background: confirmedDates.includes(r.date) ? '#4f46e5' : 'var(--bg3)',
            color: confirmedDates.includes(r.date) ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s',
          }}
        >
          {confirmedDates.includes(r.date) ? '✓ 確定中' : '確定する'}
        </button>
      )}
    </div>
  );
}
