'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { TIME_OPTIONS, useDragSelection, sortAndDedupeDates, hasDuplicateDate, toDateStr, getCalendarDays, type DateTuple } from '@/lib/calendarUtils';
import type { YoteiEvent } from '@/lib/types';

type SavePayload = {
  title: string;
  description?: string;
  eventUrl?: string;
  deadline?: string;
  dates: string[];
  notifyThreshold?: number;
  notifyDeadline?: boolean;
};

type Props = {
  event: YoteiEvent;
  id: string;
  onSaveComplete: (payload: SavePayload) => void;
};

export default function EditPanel({ event, id, onSaveComplete }: Props) {
  const { user } = useAuth();
  const [editTitle, setEditTitle]               = useState(event.title);
  const [editDesc, setEditDesc]                 = useState(event.description ?? '');
  const [editUrl, setEditUrl]                   = useState(event.eventUrl ?? '');
  const [editDeadlineDate, setEditDeadlineDate] = useState(() => {
    if (!event.deadline) return '';
    return event.deadline.includes('T') ? event.deadline.split('T')[0] : event.deadline;
  });
  const [editDeadlineTime, setEditDeadlineTime] = useState(() => {
    if (!event.deadline?.includes('T')) return '';
    const t = event.deadline.split('T')[1];
    return t === '23:59' ? '' : t;
  });
  const [editDates, setEditDates] = useState<DateTuple[]>(() =>
    event.dates.map(d => {
      const [date, time] = d.includes('T') ? d.split('T') : [d, ''];
      return { date, time };
    })
  );
  const [editSharedTime, setEditSharedTime]     = useState('');
  const [editCalYear, setEditCalYear]           = useState(() => new Date().getFullYear());
  const [editCalMonth, setEditCalMonth]         = useState(() => new Date().getMonth());
  const [showEarlyHours, setShowEarlyHours]     = useState(false);
  const [editSaving, setEditSaving]             = useState(false);
  const [editDateError, setEditDateError]       = useState('');
  const [editNotifyThreshold, setEditNotifyThreshold] = useState(event.notifyThreshold ?? 3);
  const [editNotifyDeadline, setEditNotifyDeadline]   = useState(event.notifyDeadline ?? false);

  const { startDrag: startEditDrag, continueDrag: continueEditDrag } =
    useDragSelection(editDates, setEditDates, editSharedTime, editCalYear, editCalMonth);

  const editPrevMonth = () => editCalMonth === 0
    ? (setEditCalYear(y => y - 1), setEditCalMonth(11))
    : setEditCalMonth(m => m - 1);
  const editNextMonth = () => editCalMonth === 11
    ? (setEditCalYear(y => y + 1), setEditCalMonth(0))
    : setEditCalMonth(m => m + 1);

  const isEditDateSelected  = (day: number) => editDates.some(d => d.date === toDateStr(editCalYear, editCalMonth, day));
  const isEditExactSelected = (day: number) => editDates.some(d => d.date === toDateStr(editCalYear, editCalMonth, day) && d.time === editSharedTime);

  const removeEditDate = (i: number) => setEditDates(prev => prev.filter((_, idx) => idx !== i));
  const updateEditDate = (i: number, field: 'date' | 'time', val: string) =>
    setEditDates(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  const handleSave = async () => {
    if (!editTitle || editDates.filter(d => d.date).length === 0) return;
    if (hasDuplicateDate(editDates.filter(d => d.date))) {
      setEditDateError('同じ日程・時刻が重複しています');
      return;
    }
    setEditDateError('');
    setEditSaving(true);

    const newDates = sortAndDedupeDates(editDates.filter(d => d.date))
      .map(d => d.time ? `${d.date}T${d.time}` : d.date);
    const newDeadline = editDeadlineDate
      ? (editDeadlineTime ? `${editDeadlineDate}T${editDeadlineTime}` : `${editDeadlineDate}T23:59`)
      : null;

    await updateDoc(doc(db, 'events', id), {
      title:       editTitle,
      description: editDesc    || null,  // Firestore側はnullで明示削除
      eventUrl:    editUrl     || null,
      deadline:    newDeadline,
      dates:       newDates,
    });

    if (event.notifyThreshold !== undefined || event.notifyDeadline !== undefined) {
      const thresholdChanged = editNotifyThreshold !== (event.notifyThreshold ?? 3);
      const deadlineChanged  = editNotifyDeadline  !== (event.notifyDeadline  ?? false);
      if (thresholdChanged || deadlineChanged) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;  // ログイン作成イベントは作成者検証に必要
          const res = await fetch('/api/notify-setup', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ eventId: id, threshold: editNotifyThreshold, notifyDeadline: editNotifyDeadline }),
          });
          if (!res.ok) throw new Error(`notify-setup PATCH failed: ${res.status}`);
        } catch (err) {
          console.error('[notify-setup PATCH]', err);
          alert('イベントは保存されましたが、通知設定の更新に失敗しました。');  // 保存自体は成功させる
        }
      }
    }

    setEditSaving(false);
    onSaveComplete({
      title:       editTitle,
      description: editDesc    || undefined,
      eventUrl:    editUrl     || undefined,
      deadline:    newDeadline ?? undefined,
      dates:       newDates,
      notifyThreshold: editNotifyThreshold,
      notifyDeadline:  editNotifyDeadline,
    });
  };

  const days = getCalendarDays(editCalYear, editCalMonth);

  return (
    <div className="card" style={{ marginBottom: 24, borderColor: 'var(--indigo)' }}>
      <p className="section-title" style={{ marginBottom: 16 }}>✏️ イベントを編集</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div>
          <label>イベント名 <span style={{ color: 'var(--red)' }}>*</span></label>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
        </div>

        <div>
          <label>メモ（任意）</label>
          <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} />
        </div>

        <div>
          <label>イベントURL（任意）</label>
          <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label>回答締め切り（任意）</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={editDeadlineDate}
              onChange={e => setEditDeadlineDate(e.target.value)}
              onClick={e => (e.target as HTMLInputElement).showPicker?.()}
              style={{ flex: 2 }}
            />
            <select value={editDeadlineTime} onChange={e => setEditDeadlineTime(e.target.value)} style={{ flex: 1 }}>
              {TIME_OPTIONS.map(t => (
                <option key={t} value={t}>{t || '時刻（省略=23:59）'}</option>
              ))}
            </select>
          </div>
          <p className="hint">空にすると締め切りなしになります</p>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ marginBottom: 0 }}>日程候補</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={showEarlyHours}
                onChange={e => setShowEarlyHours(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer' }}
              />
              0:00〜6:00も使用する
            </label>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            background: 'var(--indigo-soft, #ede9fe)', border: '1.5px solid var(--indigo)',
            borderRadius: 10, padding: '10px 14px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo)', whiteSpace: 'nowrap' }}>🕐 共通時刻</span>
            <select
              value={editSharedTime}
              onChange={e => setEditSharedTime(e.target.value)}
              style={{ flex: 1, borderColor: 'var(--indigo)', fontWeight: 600 }}
            >
              {TIME_OPTIONS
                .filter(t => t === '' || showEarlyHours || parseInt(t.split(':')[0]) >= 6 || t === editSharedTime)
                .map(t => <option key={t} value={t}>{t || '時刻なし（終日）'}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--indigo)', whiteSpace: 'nowrap', opacity: 0.8 }}>← 先に設定</span>
          </div>

          <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
              <button type="button" onClick={editPrevMonth} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>＜</button>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{editCalYear}年{editCalMonth + 1}月</span>
              <button type="button" onClick={editNextMonth} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>＞</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
              {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, padding: '6px 0', color: i === 0 ? '#ef4444' : i === 6 ? '#6366f1' : 'var(--muted)' }}>
                  {w}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, padding: 8, background: 'var(--border)' }}>
              {days.map((day, i) => {
                if (!day) return <div key={i} style={{ background: 'var(--bg)', aspectRatio: '1' }} />;
                const exact   = isEditExactSelected(day);
                const anyTime = isEditDateSelected(day);
                const partial = anyTime && !exact;
                const dow     = i % 7;
                const isToday = toDateStr(editCalYear, editCalMonth, day) === new Date().toISOString().split('T')[0];
                const bg    = exact ? 'var(--indigo)' : partial ? '#c7d2fe' : 'var(--bg)';
                const color = exact ? '#fff' : partial ? 'var(--indigo)' : dow === 0 ? '#ef4444' : dow === 6 ? '#6366f1' : 'var(--text)';
                const border = exact ? 'none' : partial ? '2px solid var(--indigo)' : isToday ? '2px solid var(--indigo)' : 'none';
                return (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); startEditDrag(day); }}
                    onMouseEnter={() => continueEditDrag(day)}
                    draggable={false}
                    style={{
                      aspectRatio: '1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: anyTime ? 700 : 400,
                      background: bg, color, border,
                      borderRadius: 8, cursor: 'pointer',
                      transition: 'all 0.12s',
                      userSelect: 'none',
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="hint" style={{ marginTop: 6 }}>日付をクリックで追加／もう一度クリックで削除</p>

          {editDates.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>選択中 {editDates.length}件 — 時刻は個別に変更できます</p>
              {editDates.map((d, i) => {
                const dateObj = new Date(d.date + 'T00:00:00');
                const label = dateObj.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                    <select value={d.time} onChange={e => updateEditDate(i, 'time', e.target.value)} style={{ flex: 1, fontSize: 13 }}>
                      {TIME_OPTIONS
                        .filter(t => t === '' || showEarlyHours || parseInt(t.split(':')[0]) >= 6 || t === d.time)
                        .map(t => <option key={t} value={t}>{t || '時刻なし'}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeEditDate(i)} aria-label="削除">✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {editDateError && (
            <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>⚠️ {editDateError}</p>
          )}
          <p className="hint">既存の回答はそのまま保持されます</p>
        </div>

        {event.notifyThreshold !== undefined && (
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', margin: 0 }}>📧 回答通知</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
              <input
                type="number"
                min={1}
                max={99}
                value={editNotifyThreshold}
                onChange={e => setEditNotifyThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 56, textAlign: 'center', fontWeight: 700, fontSize: 13 }}
              />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>人が回答したらメールで通知</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={editNotifyDeadline}
                onChange={e => setEditNotifyDeadline(e.target.checked)}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--indigo)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>回答期限日にメールで通知</span>
            </label>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={editSaving || !editTitle || editDates.filter(d => d.date).length === 0}
          style={{ justifyContent: 'center' }}
        >
          {editSaving ? '保存中...' : '変更を保存する'}
        </button>
      </div>
    </div>
  );
}
