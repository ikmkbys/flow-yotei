'use client';

import { useEffect, useState, use } from 'react';
import {
  doc, getDoc, collection, addDoc, updateDoc,
  onSnapshot, Timestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { YoteiEvent, Response, Availability } from '@/lib/types';
import HowToModal from '@/components/HowToModal';

/* 30分刻みの時刻オプション */
const TIME_OPTIONS = ['', ...Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
})];

/* Googleカレンダー登録URL生成 */
function makeGCalUrl(iso: string, title: string, description?: string) {
  const hasTime = iso.includes('T');
  if (hasTime) {
    // 時刻あり：開始〜+1時間をローカル時間で指定
    const [date, time] = iso.split('T');
    const [h, m] = time.split(':').map(Number);
    const endH = String(h + 1).padStart(2, '0');  // 1時間後を終了に
    const fmt = (d: string, hh: string, mm: string) =>
      `${d.replace(/-/g, '')}T${hh}${mm}00`;
    const start = fmt(date, String(h).padStart(2, '0'), String(m).padStart(2, '0'));
    const end   = fmt(date, endH, String(m).padStart(2, '0'));
    return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${start}/${end}` +
      (description ? `&details=${encodeURIComponent(description)}` : '');
  } else {
    // 終日：YYYYMMDD/翌日YYYYMMDD
    const d = new Date(iso + 'T00:00:00');
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const fmt = (dt: Date) => dt.toISOString().split('T')[0].replace(/-/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${fmt(d)}/${fmt(next)}` +
      (description ? `&details=${encodeURIComponent(description)}` : '');
  }
}

/* 日付を日本語表示（時刻あれば追加） */
function formatDate(iso: string) {
  const hasTime = iso.includes('T');
  const datePart = hasTime ? iso.split('T')[0] : iso;
  const timePart = hasTime ? iso.split('T')[1] : null;
  const d = new Date(datePart + 'T00:00:00');
  const dateStr = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
  return timePart ? `${dateStr} ${timePart}〜` : dateStr;  // 時刻あれば末尾に追加
}

/* 曜日カラー */
function weekdayColor(iso: string) {
  const datePart = iso.includes('T') ? iso.split('T')[0] : iso;
  const day = new Date(datePart + 'T00:00:00').getDay();
  if (day === 0) return '#ef4444';  // 日
  if (day === 6) return '#6366f1';  // 土
  return 'var(--text)';
}

/* 集計 */
function countAvail(responses: Response[], date: string, type: Availability) {
  return responses.filter(r => r.availability[date] === type).length;
}

const AVAIL_CYCLE: Availability[] = ['○', '△', '×'];

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);  // Next.js 16: params is a Promise

  const [event, setEvent]         = useState<YoteiEvent | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [name, setName]           = useState('');
  const [avail, setAvail]         = useState<Record<string, Availability>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [myResponseId, setMyResponseId] = useState<string | null>(null);  // 編集用：自分のレスポンスID
  const [copied, setCopied]           = useState(false);
  const [notFound, setNotFound]       = useState(false);
  const [isCreator, setIsCreator]     = useState(false);   // 作成者かどうか
  const [showEdit, setShowEdit]       = useState(false);   // イベント編集パネル表示
  const [showHowTo, setShowHowTo]     = useState(false);   // 使い方モーダル
  // 編集フォーム用state
  const [editTitle, setEditTitle]     = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [editUrl, setEditUrl]         = useState('');
  const [editDates, setEditDates]         = useState<{ date: string; time: string }[]>([]);
  const [editDeadlineDate, setEditDeadlineDate] = useState('');
  const [editDeadlineTime, setEditDeadlineTime] = useState('');
  const [editSaving, setEditSaving]       = useState(false);
  const [editDateError, setEditDateError] = useState('');
  const [showEarlyHours, setShowEarlyHours] = useState(false);  // 深夜帯時刻表示フラグ

  /* イベント取得 */
  useEffect(() => {
    getDoc(doc(db, 'events', id)).then(snap => {
      if (!snap.exists()) { setNotFound(true); return; }
      const data = snap.data();
      const ev = { id: snap.id, ...data } as YoteiEvent;
      setEvent(ev);
      // デフォルト全て○
      const init: Record<string, Availability> = {};
      data.dates.forEach((d: string) => { init[d] = '○'; });
      setAvail(init);
      // 編集フォームの初期値をセット
      setEditTitle(ev.title);
      setEditDesc(ev.description ?? '');
      setEditUrl(ev.eventUrl ?? '');
      setEditDates(ev.dates.map(d => {
        const [date, time] = d.includes('T') ? d.split('T') : [d, ''];
        return { date, time };
      }));
      // 締め切りの初期値
      if (ev.deadline) {
        const [dDate, dTime] = ev.deadline.includes('T') ? ev.deadline.split('T') : [ev.deadline, ''];
        setEditDeadlineDate(dDate);
        setEditDeadlineTime(dTime === '23:59' ? '' : dTime);
      }
      // localStorageで作成者判定
      const history = JSON.parse(localStorage.getItem('yotei_history') ?? '[]');
      setIsCreator(history.some((h: { id: string }) => h.id === id));
    });
  }, [id]);

  /* 回答をリアルタイム購読 */
  useEffect(() => {
    const q = query(collection(db, 'events', id, 'responses'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setResponses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Response)));
    });
    return unsub;
  }, [id]);

  /* ○△× を循環切り替え */
  const cycleAvail = (date: string) => {
    const cur = avail[date] || '○';
    const next = AVAIL_CYCLE[(AVAIL_CYCLE.indexOf(cur) + 1) % AVAIL_CYCLE.length];
    setAvail({ ...avail, [date]: next });
  };

  /* 回答送信 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !event) return;
    setSubmitting(true);

    if (myResponseId) {
      // 既存回答を上書き更新
      await updateDoc(doc(db, 'events', id, 'responses', myResponseId), {
        name,
        availability: avail,
      });
    } else {
      // 新規登録
      const ref = await addDoc(collection(db, 'events', id, 'responses'), {
        name,
        availability: avail,
        createdAt: Timestamp.now(),
      });
      setMyResponseId(ref.id);  // 次回編集用にIDを保持
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  /* イベント情報を保存 */
  const handleSaveEvent = async () => {
    if (!editTitle || editDates.filter(d => d.date).length === 0) return;
    if (hasDuplicateDate(editDates.filter(d => d.date))) {
      setEditDateError('同じ日程・時刻が重複しています');
      return;
    }
    setEditDateError('');
    setEditSaving(true);
    // 保存時にソート＋重複排除
    const seen = new Set<string>();
    const newDates = editDates
      .filter(d => d.date)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .filter(d => { const k = `${d.date}_${d.time}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(d => d.time ? `${d.date}T${d.time}` : d.date);
    const newDeadline = editDeadlineDate
      ? (editDeadlineTime ? `${editDeadlineDate}T${editDeadlineTime}` : `${editDeadlineDate}T23:59`)
      : null;
    await updateDoc(doc(db, 'events', id), {
      title:       editTitle,
      description: editDesc    || null,
      eventUrl:    editUrl     || null,
      deadline:    newDeadline,
      dates:       newDates,
    });
    // ローカルのeventも更新
    setEvent(prev => prev ? { ...prev, title: editTitle, description: editDesc, eventUrl: editUrl, deadline: newDeadline ?? undefined, dates: newDates } : prev);
    setEditSaving(false);
    setShowEdit(false);
  };

  /* 編集フォームに日付追加（1つ上の翌日を初期値に） */
  const addEditDate = () => {
    const last = editDates[editDates.length - 1];
    if (last?.date) {
      const d = new Date(last.date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      setEditDates([...editDates, { date: d.toISOString().split('T')[0], time: last.time }]);
    } else {
      setEditDates([...editDates, { date: '', time: '' }]);
    }
  };
  const removeEditDate = (i: number) => setEditDates(editDates.filter((_, idx) => idx !== i));
  const updateEditDate = (i: number, field: 'date' | 'time', val: string) =>
    setEditDates(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));  // 入力中はソートしない

  /* 重複チェック */
  const hasDuplicateDate = (list: { date: string; time: string }[]) => {
    const keys = list.filter(d => d.date).map(d => `${d.date}_${d.time}`);
    return new Set(keys).size !== keys.length;
  };

  /* 日程を確定する */
  const handleConfirm = async (date: string) => {
    const next = event?.confirmedDate === date ? null : date;  // 同じ日を押したら解除
    await updateDoc(doc(db, 'events', id), { confirmedDate: next });
    setEvent(prev => prev ? { ...prev, confirmedDate: next ?? undefined } : prev);
  };

  /* 名前クリック → その人の回答をフォームに読み込んで編集モードへ */
  const handleSelectResponse = (r: Response) => {
    setName(r.name);
    setAvail(r.availability);
    setMyResponseId(r.id ?? null);
    setSubmitted(false);
    // フォームまでスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* 出欠表をCSVダウンロード */
  const downloadCsv = () => {
    if (!event) return;
    const headers = ['日程', ...responses.map(r => r.name), '○', '△', '×'];
    const rows = event.dates.map(date => [
      formatDate(date),
      ...responses.map(r => r.availability[date] ?? '−'),
      countAvail(responses, date, '○'),
      countAvail(responses, date, '△'),
      countAvail(responses, date, '×'),
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const bom = '\uFEFF';  // Excel用BOM（文字化け防止）
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title}_出欠表.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* URL コピー */
  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (notFound) return (
    <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--muted)' }}>
      <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
      <p>イベントが見つかりませんでした</p>
      <a href="/" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>トップへ戻る</a>
    </div>
  );

  if (!event) return (
    <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--muted)' }}>読み込み中...</div>
  );

  return (
    <>
      <header>
        <div className="header-inner">
          <a href="/" className="logo">FLOW YOTEI<span>.</span></a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHowTo(true)}
            style={{ marginLeft: 'auto', fontSize: 13 }}
          >
            ？ 使い方
          </button>
        </div>
      </header>
      {showHowTo && <HowToModal mode="respond" onClose={() => setShowHowTo(false)} />}

      <main className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>

        {/* イベント情報 */}
        <div style={{ marginBottom: 24 }}>
          <span className="tag" style={{ marginBottom: 8, display: 'inline-block' }}>
            {event.creatorName} さんのイベント
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 4, flex: 1 }}>
              {event.title}
            </h1>
            {isCreator && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowEdit(v => !v)}
                style={{ marginTop: 2, flexShrink: 0 }}
              >
                {showEdit ? '✕ 閉じる' : '✏️ 編集'}
              </button>
            )}
          </div>
          {event.description && (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>{event.description}</p>
          )}
          {event.eventUrl && (
            <a
              href={event.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--indigo)', marginTop: 6 }}
            >
              🔗 イベント詳細を見る
            </a>
          )}
        </div>

        {/* イベント編集パネル（作成者のみ） */}
        {isCreator && showEdit && (
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
                  <select
                    value={editDeadlineTime}
                    onChange={e => setEditDeadlineTime(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t || '時刻（省略=23:59）'}</option>
                    ))}
                  </select>
                </div>
                <p className="hint">空にすると締め切りなしになります</p>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {editDates.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="date"
                        value={d.date}
                        onChange={e => updateEditDate(i, 'date', e.target.value)}
                        onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                        style={{ flex: 2 }}
                      />
                      <select
                        value={d.time}
                        onChange={e => updateEditDate(i, 'time', e.target.value)}
                        style={{ flex: 1 }}
                      >
                        {TIME_OPTIONS
                          .filter(t => t === '' || showEarlyHours || parseInt(t.split(':')[0]) >= 6 || t === d.time)
                          .map(t => (
                            <option key={t} value={t}>{t || '時刻（任意）'}</option>
                          ))}
                      </select>
                      {editDates.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeEditDate(i)}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addEditDate} style={{ alignSelf: 'flex-start' }}>
                    ＋ 日程を追加
                  </button>
                  {editDateError && (
                    <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>⚠️ {editDateError}</p>
                  )}
                </div>
                <p className="hint">既存の回答はそのまま保持されます</p>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSaveEvent}
                disabled={editSaving || !editTitle || editDates.filter(d => d.date).length === 0}
                style={{ justifyContent: 'center' }}
              >
                {editSaving ? '保存中...' : '変更を保存する'}
              </button>
            </div>
          </div>
        )}

        {/* 確定日程バナー */}
        {event.confirmedDate && (
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            borderRadius: 14, padding: '20px 24px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 32 }}>🎉</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', marginBottom: 4 }}>
                開催日程が確定しました
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                {formatDate(event.confirmedDate)}
              </p>
            </div>
            <a
              href={makeGCalUrl(
                event.confirmedDate,
                event.title,
                [event.description, event.eventUrl ? `🔗 ${event.eventUrl}` : ''].filter(Boolean).join('\n\n') || undefined,
              )}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 20,
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                border: '1.5px solid rgba(255,255,255,0.4)',
                backdropFilter: 'blur(4px)',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              📅 カレンダーに追加
            </a>
          </div>
        )}

        {/* URL共有 */}
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <p className="section-title" style={{ marginBottom: 8 }}>🔗 このURLを共有</p>
          <div className="share-box">
            <input type="text" readOnly value={typeof window !== 'undefined' ? window.location.href : ''} />
            <button className="btn btn-primary btn-sm" onClick={copyUrl}>
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
          </div>
        </div>

        {/* 締め切り表示 */}
        {event.deadline && (() => {
          const isPast = new Date() > new Date(event.deadline!);
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10, marginBottom: 16,
              background: isPast ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${isPast ? '#fecaca' : '#fde68a'}`,
              fontSize: 13, color: isPast ? '#dc2626' : '#92400e', fontWeight: 600,
            }}>
              {isPast ? '🔒 回答締め切り済み' : '⏰ 回答締め切り：'}
              {!isPast && <span style={{ fontWeight: 400 }}>{formatDate(event.deadline!)}</span>}
            </div>
          );
        })()}

        {/* 回答フォーム */}
        {(() => {
          const isClosed = event.deadline ? new Date() > new Date(event.deadline) : false;
          return !submitted ? (
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="section-title">📅 出欠を入力</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="respName">お名前 <span style={{ color: 'var(--red)' }}>*</span></label>
                <input
                  id="respName"
                  type="text"
                  placeholder="例：鈴木花子"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {event.dates.map(date => (
                  <div
                    key={date}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 10,
                      padding: '10px 14px',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: weekdayColor(date) }}>
                      {formatDate(date)}
                    </span>
                    {/* ○△× ボタン群 */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['○', '△', '×'] as Availability[]).map(v => (
                        <button
                          key={v}
                          type="button"
                          className={`avail avail-${v === '○' ? 'ok' : v === '△' ? 'maybe' : 'ng'} ${avail[date] === v ? 'active' : ''}`}
                          onClick={() => setAvail({ ...avail, [date]: v })}
                          aria-label={v}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="hint">タップで切り替え　○ 参加できる ／ △ 未定 ／ × 参加できない</p>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !name || isClosed}
                style={{ justifyContent: 'center' }}
              >
                {submitting ? '送信中...' : myResponseId ? '回答を更新する' : '回答を送信する'}
              </button>
            </form>
          </div>
        ) : (
          <div
            className="card"
            style={{ marginBottom: 24, textAlign: 'center', background: '#f0fdf4', borderColor: '#bbf7d0' }}
          >
            <p style={{ fontSize: 24, marginBottom: 8 }}>✅</p>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>
              {myResponseId ? '回答を更新しました！' : '回答を送信しました！'}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              下の結果表はリアルタイムで更新されます
            </p>
            {!isClosed && (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                予定が変わったら結果表の名前をタップして変更できます
              </p>
            )}
          </div>
        );
        })()}

        {/* 候補日サマリ */}
        {responses.length > 0 && event && (() => {
          // 日付ごとに ○数・△数・×数を集計してスコア順に並べる
          const ranked = [...event.dates]
            .map(date => ({
              date,
              ok:    countAvail(responses, date, '○'),
              maybe: countAvail(responses, date, '△'),
              ng:    countAvail(responses, date, '×'),
            }))
            .sort((a, b) => b.ok - a.ok || a.ng - b.ng)  // ○多い順 → ×少ない順
            .slice(0, 3);                                  // 上位3件のみ

          const best = ranked[0];  // 最有力日程

          return (
            <div className="card" style={{ borderColor: 'var(--indigo)', background: 'var(--indigo-soft)' }}>
              <p className="section-title" style={{ marginBottom: 12 }}>🏆 候補日サマリ</p>
              {ranked.map((r, i) => (
                <div key={r.date} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < ranked.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* 順位バッジ */}
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--bg3)',
                    color: i <= 2 ? '#fff' : 'var(--muted)',
                  }}>
                    {i + 1}
                  </span>
                  {/* 日付 */}
                  <span style={{
                    flex: 1, fontWeight: i === 0 ? 700 : 500,
                    color: i === 0 ? 'var(--text)' : 'var(--muted)',
                    fontSize: i === 0 ? 15 : 14,
                  }}>
                    {formatDate(r.date)}
                    {r.date === best.date && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                        ◀ 最有力
                      </span>
                    )}
                  </span>
                  {/* 集計バッジ */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>○{r.ok}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ca8a04' }}>△{r.maybe}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>×{r.ng}</span>
                  </div>
                  {/* 確定ボタン（作成者のみ） */}
                  {isCreator && (
                    <button
                      onClick={() => handleConfirm(r.date)}
                      style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 700,
                        padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: 'none',
                        background: event.confirmedDate === r.date ? '#4f46e5' : 'var(--bg3)',
                        color: event.confirmedDate === r.date ? '#fff' : 'var(--muted)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {event.confirmedDate === r.date ? '✓ 確定中' : '確定する'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* 結果テーブル */}
        {responses.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p className="section-title" style={{ marginBottom: 0 }}>
                📊 回答結果 <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{responses.length}名</span>
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={downloadCsv}
              >
                ⬇️ CSVダウンロード
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="result-table">
                <thead>
                  <tr>
                    {/* 左上：日付ラベル */}
                    <th style={{ textAlign: 'left', minWidth: 160 }}>日程</th>
                    {/* 横軸：回答者名（クリックで編集） */}
                    {responses.map(r => (
                      <th
                        key={r.id}
                        onClick={() => handleSelectResponse(r)}
                        title="クリックして回答を変更"
                        style={{
                          cursor: 'pointer',
                          color: myResponseId === r.id ? 'var(--indigo)' : undefined,
                          textDecoration: 'underline dotted',
                          userSelect: 'none',
                        }}
                      >
                        {r.name} ✏️
                      </th>
                    ))}
                    {/* 最右：集計列 */}
                    <th style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>集計</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 縦軸：日付ごとに1行 */}
                  {event.dates.map(date => (
                    <tr key={date}>
                      {/* 日付セル */}
                      <td style={{ textAlign: 'left', fontWeight: 600, color: weekdayColor(date), whiteSpace: 'nowrap' }}>
                        {formatDate(date)}
                      </td>
                      {/* 各回答者の◯△× */}
                      {responses.map(r => {
                        const v = r.availability[date];
                        return (
                          <td
                            key={r.id}
                            className={v === '○' ? 'cell-ok' : v === '△' ? 'cell-maybe' : 'cell-ng'}
                          >
                            {v ?? '−'}
                          </td>
                        );
                      })}
                      {/* 集計セル */}
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'nowrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                            ○{countAvail(responses, date, '○')}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#ca8a04' }}>
                            △{countAvail(responses, date, '△')}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
                            ×{countAvail(responses, date, '×')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {responses.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 14 }}>
            まだ回答がありません。URLを共有して回答を集めましょう。
          </div>
        )}
      </main>
    </>
  );
}
