'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  const [dates, setDates] = useState<{ date: string; time: string }[]>([{ date: '', time: '' }]);
  const [showEarlyHours, setShowEarlyHours] = useState(false);  // 深夜帯時刻表示フラグ
  const [loading, setLoading]   = useState(false);
  const [dateError, setDateError] = useState('');  // 日付重複エラー
  const [history, setHistory]   = useState<{ id: string; title: string; createdAt: number }[]>([]);

  /* localStorageから履歴を読み込む（クライアントのみ） */
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('yotei_history') ?? '[]');
    setHistory(saved);
  }, []);

  /* 1つ上の日付の翌日を初期値として追加 */
  const addDate = () => {
    const last = dates[dates.length - 1];
    if (last?.date) {
      const d = new Date(last.date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const nextDate = d.toISOString().split('T')[0];
      setDates([...dates, { date: nextDate, time: last.time }]);
    } else {
      setDates([...dates, { date: '', time: '' }]);
    }
  };

  /* 日付候補を削除 */
  const removeDate = (i: number) =>
    setDates(dates.filter((_, idx) => idx !== i));

  /* 日付・時間を更新 */
  const updateDate = (i: number, field: 'date' | 'time', val: string) =>
    setDates(dates.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  /* 重複チェック */
  const hasDuplicateDate = (list: { date: string; time: string }[]) => {
    const keys = list.filter(d => d.date).map(d => `${d.date}_${d.time}`);
    return new Set(keys).size !== keys.length;
  };

  /* イベント作成 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // "2026-03-27T19:00" or "2026-03-27" の文字列に変換して保存
    const validDates = dates
      .filter(d => d.date)
      .map(d => d.time ? `${d.date}T${d.time}` : d.date);
    if (!title || !creatorName || validDates.length === 0) return;

    // 重複チェック
    if (hasDuplicateDate(dates.filter(d => d.date))) {
      setDateError('同じ日程・時刻が重複しています');
      return;
    }
    setDateError('');
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
        </div>
      </header>

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
                placeholder="例：4月の飲み会、プロジェクト킥オフ"
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dates.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="date"
                      value={d.date}
                      onChange={e => updateDate(i, 'date', e.target.value)}
                      onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                      style={{ flex: 2 }}
                    />
                    <select
                      value={d.time}
                      onChange={e => updateDate(i, 'time', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {TIME_OPTIONS
                        .filter(t => t === '' || showEarlyHours || parseInt(t.split(':')[0]) >= 6 || t === d.time)
                        .map(t => (
                          <option key={t} value={t}>{t || '時刻（任意）'}</option>
                        ))}
                    </select>
                    {dates.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeDate(i)}
                        aria-label="削除"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addDate}
                style={{ marginTop: 8 }}
              >
                ＋ 日程を追加
              </button>
              {dateError && (
                <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>⚠️ {dateError}</p>
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

            {/* 送信 */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !title || !creatorName || dates.filter(d => d.date).length === 0}
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
