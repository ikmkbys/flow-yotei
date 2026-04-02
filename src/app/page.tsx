'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import HowToModal from '@/components/HowToModal';

/* 30分刻みの時刻オプションを生成（00:00〜23:30） */
const TIME_OPTIONS = ['', ...Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');  // 時
  const m = i % 2 === 0 ? '00' : '30';                   // 分
  return `${h}:${m}`;
})];

export default function CreatePage() {
  const router = useRouter();

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [eventUrl, setEventUrl]       = useState('');  // イベント詳細URL
  const [deadlineDate, setDeadlineDate] = useState(''); // 締め切り日
  const [deadlineTime, setDeadlineTime] = useState(''); // 締め切り時刻
  const [creatorName, setCreatorName] = useState('');
  // { date: '2026-03-27', time: '19:00' } の形で管理
  const [dates, setDates] = useState<{ date: string; time: string }[]>([]);
  const [sharedTime, setSharedTime]   = useState('');            // カレンダー共通時刻
  const [showEarlyHours, setShowEarlyHours] = useState(false);   // 深夜帯時刻表示フラグ
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [loading, setLoading] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);  // 使い方モーダル
  const [history, setHistory]   = useState<{ id: string; title: string; createdAt: number }[]>([]);
  const [notifyEnabled, setNotifyEnabled]     = useState(false);  // 通知機能ON/OFF
  const [notifyEmail, setNotifyEmail]         = useState('');     // 通知先メール
  const [notifyThreshold, setNotifyThreshold] = useState(3);      // 通知する人数
  const [notifyDeadline, setNotifyDeadline]   = useState(true);   // 期限当日通知

  /* localStorageから履歴を読み込む（クライアントのみ） */
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('yotei_history') ?? '[]');
    setHistory(saved);
  }, []);

  /* カレンダーグリッド生成（null=空セル） */
  const getCalendarDays = (year: number, month: number): (number | null)[] => {
    const firstDay = new Date(year, month, 1).getDay();       // 曜日（0=日）
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  };

  /* カレンダー月移動 */
  const prevMonth = () => calMonth === 0 ? (setCalYear(y => y - 1), setCalMonth(11)) : setCalMonth(m => m - 1);
  const nextMonth = () => calMonth === 11 ? (setCalYear(y => y + 1), setCalMonth(0))  : setCalMonth(m => m + 1);

  /* 日付文字列を生成 */
  const toDateStr = (day: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  /* カレンダーをクリックして日付をトグル */
  const toggleCalendarDate = (day: number) => {
    const dateStr = toDateStr(day);
    const exists = dates.some(d => d.date === dateStr && d.time === sharedTime);
    if (exists) {
      setDates(prev => prev.filter(d => !(d.date === dateStr && d.time === sharedTime)));
    } else {
      setDates(prev => [...prev, { date: dateStr, time: sharedTime }]
        .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))));
    }
  };

  /* その日に選択済みエントリがあるか（時刻問わず） */
  const isDateSelected = (day: number) => dates.some(d => d.date === toDateStr(day));

  /* その日の共通時刻と完全一致するエントリがあるか */
  const isExactSelected = (day: number) => dates.some(d => d.date === toDateStr(day) && d.time === sharedTime);

  /* 日付候補を削除 */
  const removeDate = (i: number) =>
    setDates(dates.filter((_, idx) => idx !== i));

  /* 時間を更新（更新後にソート＆重複排除） */
  const updateDate = (i: number, field: 'date' | 'time', val: string) =>
    setDates(prev => {
      const updated = prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d)
        .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      // 同一 date+time の重複を排除（後から来たものを消す）
      const seen = new Set<string>();
      return updated.filter(d => {
        const key = `${d.date}_${d.time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

  /* イベント作成 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // "2026-03-27T19:00" or "2026-03-27" の文字列に変換して保存
    // 重複排除してから保存
    const seen = new Set<string>();
    const validDates = dates
      .filter(d => { const k = `${d.date}_${d.time}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(d => d.time ? `${d.date}T${d.time}` : d.date);
    if (!title || !creatorName || validDates.length === 0) return;
    setLoading(true);
    try {
      const ref = await addDoc(collection(db, 'events'), {
        title,
        description,
        eventUrl: eventUrl || null,
        deadline: deadlineDate
          ? (deadlineTime ? `${deadlineDate}T${deadlineTime}` : `${deadlineDate}T23:59`)
          : null,  // 日付だけ入れたら23:59を自動設定
        creatorName,
        dates: validDates,
        createdAt: Timestamp.now(),
      });

      // 作成履歴をlocalStorageに保存（最大20件）
      const history = JSON.parse(localStorage.getItem('yotei_history') ?? '[]');
      history.unshift({ id: ref.id, title, createdAt: Date.now() });
      localStorage.setItem('yotei_history', JSON.stringify(history.slice(0, 20)));

      // 通知設定がある場合はサーバーに保存（メールを暗号化）
      if (notifyEnabled && notifyEmail) {
        await fetch('/api/notify-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: ref.id, email: notifyEmail, threshold: notifyThreshold, notifyDeadline }),
        }).catch(() => {/* 通知設定の失敗はイベント作成に影響させない */});
      }

      router.push(`/${ref.id}`);  // 作成後イベントページへ
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

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
      {showHowTo && <HowToModal mode="create" onClose={() => setShowHowTo(false)} />}

      <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        {/* Hero */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <span className="tag" style={{ marginBottom: 12, display: 'inline-block' }}>日程調整ツール</span>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>
            みんなの都合を、<br />シンプルに集める。
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>
            URLを送るだけ。登録不要でかんたんに使えます。
          </p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* タイトル */}
            <div>
              <label htmlFor="title">イベント名 <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                id="title"
                type="text"
                placeholder="例：4月の飲み会、プロジェクトキックオフ"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            {/* メモ */}
            <div>
              <label htmlFor="description">メモ（任意）</label>
              <textarea
                id="description"
                placeholder="場所や詳細などを書いておけます"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* 回答締め切り */}
            <div>
              <label>回答締め切り（任意）</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={e => setDeadlineDate(e.target.value)}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  style={{ flex: 2 }}
                />
                <select
                  value={deadlineTime}
                  onChange={e => setDeadlineTime(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>{t || '時刻（省略=23:59）'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* イベント詳細URL */}
            <div>
              <label htmlFor="eventUrl">イベントURL（任意）</label>
              <input
                id="eventUrl"
                type="url"
                placeholder="https://... connpassやNotionページなど"
                value={eventUrl}
                onChange={e => setEventUrl(e.target.value)}
              />
              <p className="hint">回答者に詳細を案内したいページがあれば貼っておけます</p>
            </div>

            <hr className="divider" style={{ margin: '4px 0' }} />

            {/* 日付候補 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ marginBottom: 0 }}>日程候補 <span style={{ color: 'var(--red)' }}>*</span></label>
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

              {/* 共通時刻セレクタ */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                background: 'var(--indigo-soft, #ede9fe)', border: '1.5px solid var(--indigo)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo)', whiteSpace: 'nowrap' }}>
                  🕐 共通時刻
                </span>
                <select
                  value={sharedTime}
                  onChange={e => setSharedTime(e.target.value)}
                  style={{ flex: 1, borderColor: 'var(--indigo)', fontWeight: 600 }}
                >
                  {TIME_OPTIONS
                    .filter(t => t === '' || showEarlyHours || parseInt(t.split(':')[0]) >= 6 || t === sharedTime)
                    .map(t => <option key={t} value={t}>{t || '時刻なし（終日）'}</option>)}
                </select>
                <span style={{ fontSize: 12, color: 'var(--indigo)', whiteSpace: 'nowrap', opacity: 0.8 }}>
                  ← 先に設定
                </span>
              </div>

              {/* カレンダー */}
              <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* ヘッダー */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  <button type="button" onClick={prevMonth} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>＜</button>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{calYear}年{calMonth + 1}月</span>
                  <button type="button" onClick={nextMonth} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>＞</button>
                </div>
                {/* 曜日ヘッダー */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                    <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, padding: '6px 0', color: i === 0 ? '#ef4444' : i === 6 ? '#6366f1' : 'var(--muted)' }}>
                      {w}
                    </div>
                  ))}
                </div>
                {/* 日付グリッド */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, padding: 8, background: 'var(--border)' }}>
                  {getCalendarDays(calYear, calMonth).map((day, i) => {
                    if (!day) return <div key={i} style={{ background: 'var(--bg)', aspectRatio: '1' }} />;
                    const exact   = isExactSelected(day);   // 現在の共通時刻と完全一致
                    const anyTime = isDateSelected(day);     // 別の時刻で登録済み
                    const partial = anyTime && !exact;       // 別の時刻のみ登録あり
                    const dow = (i) % 7;                     // 曜日インデックス
                    const isToday = toDateStr(day) === new Date().toISOString().split('T')[0];
                    // 3ステート背景・文字色
                    const bg    = exact   ? 'var(--indigo)' : partial ? '#c7d2fe' : 'var(--bg)';
                    const color = exact   ? '#fff'          : partial ? 'var(--indigo)'
                                : dow === 0 ? '#ef4444' : dow === 6 ? '#6366f1' : 'var(--text)';
                    const border = exact   ? 'none'
                                 : partial ? '2px solid var(--indigo)'
                                 : isToday ? '2px solid var(--indigo)' : 'none';
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleCalendarDate(day)}
                        title={partial ? '別の時刻で登録済み（クリックで現在の共通時刻を追加）' : undefined}
                        style={{
                          aspectRatio: '1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: anyTime ? 700 : 400,
                          background: bg, color, border,
                          borderRadius: 8, cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="hint" style={{ marginTop: 6 }}>日付をクリックで追加／もう一度クリックで削除</p>

              {/* 選択済み日程リスト */}
              {dates.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>選択中 {dates.length}件 — 時刻は個別に変更できます</p>
                  {dates.map((d, i) => {
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const label = dateObj.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                        <select
                          value={d.time}
                          onChange={e => updateDate(i, 'time', e.target.value)}
                          style={{ flex: 1, fontSize: 13 }}
                        >
                          {TIME_OPTIONS
                            .filter(t => t === '' || showEarlyHours || parseInt(t.split(':')[0]) >= 6 || t === d.time)
                            .map(t => <option key={t} value={t}>{t || '時刻なし'}</option>)}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDate(i)} aria-label="削除">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            <hr className="divider" style={{ margin: '4px 0' }} />

            {/* 作成者名 */}
            <div>
              <label htmlFor="creatorName">あなたのお名前 <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                id="creatorName"
                type="text"
                placeholder="例：山田太郎"
                value={creatorName}
                onChange={e => setCreatorName(e.target.value)}
                required
              />
              <p className="hint">イベント作成者として表示されます</p>
            </div>

            {/* 回答通知（オプション） */}
            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '14px 16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={e => setNotifyEnabled(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--indigo)' }}
                />
                📧 回答通知を受け取る（任意）
              </label>
              {notifyEnabled && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={notifyThreshold}
                      onChange={e => setNotifyThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ width: 64, textAlign: 'center', fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--muted)' }}>人が回答したらメールで通知</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={notifyDeadline}
                      onChange={e => setNotifyDeadline(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--indigo)' }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--muted)' }}>回答期限日にメールで通知</span>
                  </label>
                  <input
                    type="email"
                    placeholder="通知先メールアドレス"
                    value={notifyEmail}
                    onChange={e => setNotifyEmail(e.target.value)}
                    required={notifyEnabled}
                    style={{ fontSize: 14 }}
                  />
                  <p className="hint" style={{ margin: 0 }}>
                    メールアドレスは暗号化して保存されます。他の参加者には表示されません。
                  </p>
                </div>
              )}
            </div>

            {/* 送信 */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !title || !creatorName || dates.length === 0 || (notifyEnabled && !notifyEmail)}
              style={{ justifyContent: 'center', marginTop: 4 }}
            >
              {loading ? '作成中...' : '✦ イベントを作成する'}
            </button>
          </form>
        </div>

        {/* 作成履歴 */}
        {history.length > 0 && (
          <div className="card" style={{ marginTop: 8 }}>
            <p className="section-title" style={{ marginBottom: 12 }}>🕘 最近作成したイベント</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.map(h => (
                <Link
                  key={h.id}
                  href={`/${h.id}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)',
                    textDecoration: 'none', color: 'var(--text)',
                    fontSize: 14, fontWeight: 500,
                    transition: 'background 0.15s',
                  }}
                >
                  <span>{h.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, marginLeft: 12 }}>
                    {new Date(h.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 24 }}>
          無料・登録不要 · <a href="https://stellars-lab.vercel.app" style={{ color: 'var(--indigo)' }}>Stellars Lab</a>
        </p>
      </main>
    </>
  );
}
