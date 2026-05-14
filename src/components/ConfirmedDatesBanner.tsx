import { formatDate, makeGCalUrl } from '@/lib/dateUtils';
import type { YoteiEvent } from '@/lib/types';

type Props = {
  event: YoteiEvent;
  isCreator: boolean;
  confirmedComments: Record<string, string>;
  onCommentChange: (date: string, value: string) => void;
  onCommentBlur: (date: string, value: string) => void;
};

export default function ConfirmedDatesBanner({
  event, isCreator, confirmedComments, onCommentChange, onCommentBlur,
}: Props) {
  if (!event.confirmedDates?.length) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      borderRadius: 14, padding: '20px 24px', marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: event.confirmedDates.length > 1 ? 12 : 0 }}>
        <span style={{ fontSize: 32 }}>🎉</span>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', margin: 0 }}>
          開催日程が確定しました
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {event.confirmedDates.map(date => (
          <div key={date}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', flex: 1, margin: 0 }}>
                {formatDate(date)}
              </p>
              <a
                href={makeGCalUrl(
                  date,
                  event.title,
                  [event.description, event.eventUrl ? `🔗 ${event.eventUrl}` : ''].filter(Boolean).join('\n\n') || undefined,
                )}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.2)', color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(4px)', flexShrink: 0,
                }}
              >
                📅 カレンダーに追加
              </a>
            </div>
            {isCreator ? (
              <input
                type="text"
                placeholder="一言コメントを追加（任意）"
                value={confirmedComments[date] ?? ''}
                onChange={e => onCommentChange(date, e.target.value)}
                onBlur={e => onCommentBlur(date, e.target.value)}
                style={{
                  marginTop: 8, width: '100%', boxSizing: 'border-box',
                  padding: '7px 12px', borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  fontSize: 13, outline: 'none',
                }}
              />
            ) : confirmedComments[date] ? (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                💬 {confirmedComments[date]}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
