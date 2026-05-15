'use client';

import { useEffect, useState, use } from 'react';
import {
  doc, getDoc, collection, addDoc, updateDoc,
  onSnapshot, Timestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import AuthButton from '@/components/AuthButton';
import { fetchFreeBusy } from '@/lib/calendar';
import type { YoteiEvent, Response, Availability } from '@/lib/types';
import HowToModal from '@/components/HowToModal';
import { formatDate, weekdayColor, makeGCalUrl } from '@/lib/dateUtils';
import { storage } from '@/lib/storage';
import EditPanel from '@/components/EditPanel';
import ConfirmedDatesBanner from '@/components/ConfirmedDatesBanner';
import SummaryRow from '@/components/SummaryRow';

/* 集計 */
function countAvail(responses: Response[], date: string, type: Availability) {
  return responses.filter(r => r.availability[date] === type).length;
}

const AVAIL_CYCLE: Availability[] = ['○', '△', '×'];

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);  // Next.js 16: params is a Promise
  const { user, googleAccessToken, refreshToken } = useAuth();

  const [event, setEvent]         = useState<YoteiEvent | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [name, setName]           = useState('');
  const [avail, setAvail]         = useState<Record<string, Availability>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [myResponseId, setMyResponseId] = useState<string | null>(null);  // 編集用：自分のレスポンスID
  const [comment, setComment]         = useState('');          // 一言コメント
  const [copied, setCopied]           = useState(false);
  const [notFound, setNotFound]       = useState(false);
  const [isCreator, setIsCreator]     = useState(false);   // 作成者かどうか
  const [showEdit, setShowEdit]       = useState(false);   // イベント編集パネル表示
  const [showHowTo, setShowHowTo]     = useState(false);   // 使い方モーダル
  const [showForm, setShowForm]           = useState(true);    // 出欠フォーム折りたたみ
  const [requiredNames, setRequiredNames]             = useState<string[]>([]);  // 必須参加者名（作成者のみ・localStorage）
  const [showRequiredPanel, setShowRequiredPanel]     = useState(false);          // 必須参加者設定パネル
  const [showAllRanked, setShowAllRanked]             = useState(false);          // 人数別サマリ全件表示
  const [showAllRankedReq, setShowAllRankedReq]       = useState(false);          // 必須参加者別サマリ全件表示
  const [confirmedComments, setConfirmedComments]     = useState<Record<string, string>>({});  // 確定日程コメント
  const [calLoading, setCalLoading]                   = useState(false);          // カレンダー反映中
  const [calMessage, setCalMessage]                   = useState('');             // カレンダー反映結果メッセージ

  /* イベント取得 */
  useEffect(() => {
    getDoc(doc(db, 'events', id)).then(snap => {
      if (!snap.exists()) { setNotFound(true); return; }
      const data = snap.data();
      const ev = { id: snap.id, ...data } as YoteiEvent;
      // 旧 confirmedDate（単一文字列）→ confirmedDates（配列）へ移行
      if (!ev.confirmedDates && ev.confirmedDate) {
        ev.confirmedDates = [ev.confirmedDate];
      }
      ev.confirmedDates = ev.confirmedDates ?? [];
      setEvent(ev);
      // デフォルト全て○
      const init: Record<string, Availability> = {};
      data.dates.forEach((d: string) => { init[d] = '○'; });
      setAvail(init);
      // 確定済みならフォームを閉じた状態で表示
      if ((ev.confirmedDates?.length ?? 0) > 0) setShowForm(false);
      // 確定日程コメントの初期値
      if (ev.confirmedDateComments) setConfirmedComments(ev.confirmedDateComments);
      // 作成者判定：UID一致 → localStorage フォールバック
      const byLocalStorage = storage.getHistory().some(h => h.id === id);
      setIsCreator(byLocalStorage); // まずlocalStorageで判定（UID判定はuserロード後に上書き）
      setRequiredNames(storage.getRequiredNames(id));
    });
  }, [id]);

  /* ログイン後にUID判定で作成者を上書き */
  useEffect(() => {
    if (user && event?.creatorUid) {
      setIsCreator(user.uid === event.creatorUid);
    }
  }, [user, event?.creatorUid]);

  /* ログイン済みなら回答者名をプリフィル */
  useEffect(() => {
    if (user?.displayName && !name && !myResponseId) setName(user.displayName);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 回答をリアルタイム購読 */
  useEffect(() => {
    const q = query(collection(db, 'events', id, 'responses'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Response));
      setResponses(loaded);
      // localStorage に保存済みの自分の回答 ID を復元
      setMyResponseId(prev => {
        if (prev) return prev;
        const saved = localStorage.getItem(`yotei_myResponse_${id}`);
        return saved && loaded.some(r => r.id === saved) ? saved : prev;
      });
    });
    return unsub;
  }, [id]);

  /* Googleカレンダーから空き状況を反映 */
  const handleCalendarReflect = async () => {
    if (!event) return;
    setCalLoading(true);
    setCalMessage('');
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await refreshToken();        // トークンなければ再ログイン
      }
      if (!token) { setCalLoading(false); return; }

      try {
        const result = await fetchFreeBusy(token, event.dates);
        setAvail(prev => ({ ...prev, ...result }));
        setCalMessage('カレンダーの予定を反映しました');
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
          token = await refreshToken();      // トークン期限切れ→再取得
          if (!token) { setCalLoading(false); return; }
          const result = await fetchFreeBusy(token, event.dates);
          setAvail(prev => ({ ...prev, ...result }));
          setCalMessage('カレンダーの予定を反映しました');
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error('Calendar reflect error:', err);
      setCalMessage('カレンダーの取得に失敗しました');
    }
    setCalLoading(false);
    setTimeout(() => setCalMessage(''), 3000); // 3秒後にメッセージ消去
  };

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
        comment: comment || null,
      });
    } else {
      // 新規登録
      const ref = await addDoc(collection(db, 'events', id, 'responses'), {
        name,
        availability: avail,
        comment: comment || null,
        uid: user?.uid ?? null,
        createdAt: Timestamp.now(),
      });
      setMyResponseId(ref.id);
      localStorage.setItem(`yotei_myResponse_${id}`, ref.id);

      // 通知設定があれば閾値チェック（失敗してもUI影響なし）
      fetch(`/api/notify/${id}`, { method: 'POST' }).catch(() => {});
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  /* 日程を確定する（複数選択トグル） */
  const handleConfirm = async (date: string) => {
    const current = event?.confirmedDates ?? [];
    const next = current.includes(date)
      ? current.filter(d => d !== date)   // すでに確定済み → 解除
      : [...current, date];               // 未確定 → 追加
    await updateDoc(doc(db, 'events', id), { confirmedDates: next });
    setEvent(prev => prev ? { ...prev, confirmedDates: next } : prev);
  };

  /* 確定日程コメントを保存 */
  const saveConfirmedComment = async (date: string, value: string) => {
    const next = { ...confirmedComments, [date]: value };
    await updateDoc(doc(db, 'events', id), { confirmedDateComments: next });
    setEvent(prev => prev ? { ...prev, confirmedDateComments: next } : prev);
  };

  /* 必須参加者をトグル（localStorage に保存） */
  const toggleRequired = (name: string) => {
    const next = requiredNames.includes(name)
      ? requiredNames.filter(n => n !== name)
      : [...requiredNames, name];
    setRequiredNames(next);
    storage.setRequiredNames(id, next);
  };

  /* 名前クリック → その人の回答をフォームに読み込んで編集モードへ */
  const handleSelectResponse = (r: Response) => {
    setName(r.name);
    setAvail(r.availability);
    setComment(r.comment ?? '');
    setMyResponseId(r.id ?? null);
    setSubmitted(false);
    // フォームまでスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* 回答を削除（ログイン必須） */
  const handleDeleteResponse = async (responseId: string) => {
    if (!user) {
      alert('削除するには Google ログインが必要です');
      return;
    }
    if (!confirm('この回答を削除しますか？')) return;
    const res = await fetch(`/api/responses/${id}/${responseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    if (res.ok && myResponseId === responseId) {
      setMyResponseId(null);
      localStorage.removeItem(`yotei_myResponse_${id}`);
    }
  };

  const canDelete = (r: Response) =>
    user != null && (isCreator || (r.uid != null && r.uid === user.uid));

  /* 出欠表をCSVダウンロード */
  const downloadCsv = () => {
    if (!event) return;
    const headers = ['日程', ...responses.map(r => r.name), '○', '△', '×', 'コメント'];
    const rows = event.dates.map(date => [
      formatDate(date),
      ...responses.map(r => r.availability[date] ?? '−'),
      countAvail(responses, date, '○'),
      countAvail(responses, date, '△'),
      countAvail(responses, date, '×'),
      '',  // コメントは日程行には不要
    ]);
    // コメント行を末尾に追加
    const commentRow = [
      'コメント',
      ...responses.map(r => r.comment ?? ''),
      '', '', '', '',
    ];
    const csv = [headers, ...rows, commentRow]
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

  /* 共有 */
  const shareEvent = () => {
    const url = window.location.href;
    const text = event ? `「${event.title}」の日程調整 - FLOW YOTEI` : 'FLOW YOTEI';
    if (navigator.share) {
      navigator.share({ title: event?.title ?? 'FLOW YOTEI', text, url }).catch(() => {});
    } else {
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text + '\n')}&url=${encodeURIComponent(url)}`, '_blank');
    }
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <a href="https://flow-basho.stellars-lab.com" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
              場所決めはBASHO
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowHowTo(true)}
              style={{ fontSize: 13 }}
            >
              ？ 使い方
            </button>
            <AuthButton />
          </div>
        </div>
      </header>
      {showHowTo && <HowToModal mode="respond" onClose={() => setShowHowTo(false)} />}

      {/* アンカーナビゲーションバー */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        padding: '0 16px',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 0 }}>
          {[
            { href: '#form',    label: '📝 回答する' },
            { href: '#summary', label: '📊 集計を見る' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{
                display: 'inline-block',
                padding: '10px 16px',
                fontSize: 13, fontWeight: 600,
                color: 'var(--muted)',
                textDecoration: 'none',
                borderBottom: '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--indigo)';
                (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'var(--indigo)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted)';
                (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'transparent';
              }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

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
          <EditPanel
            key={event.id}
            event={event}
            id={id}
            onSaveComplete={(payload) => {
              setEvent(prev => prev ? { ...prev, ...payload } : prev);
              setShowEdit(false);
            }}
          />
        )}

        {/* 確定日程バナー（複数対応） */}
        <ConfirmedDatesBanner
          event={event}
          isCreator={isCreator}
          confirmedComments={confirmedComments}
          onCommentChange={(date, value) => setConfirmedComments(prev => ({ ...prev, [date]: value }))}
          onCommentBlur={(date, value) => saveConfirmedComment(date, value)}
        />

        {/* URL共有 */}
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <p className="section-title" style={{ marginBottom: 8 }}>🔗 このURLを共有</p>
          <div className="share-box">
            <input type="text" readOnly value={typeof window !== 'undefined' ? window.location.href : ''} />
            <button className="btn btn-primary btn-sm" onClick={copyUrl}>
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={shareEvent} style={{ fontSize: 13 }}>
              共有
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
          const isClosed = (event.confirmedDates?.length ?? 0) > 0 || (event.deadline ? new Date() > new Date(event.deadline) : false);
          return !submitted ? (
          <div id="form" className="card" style={{ marginBottom: 24 }}>
            {/* ヘッダー：タイトル＋折りたたみボタン */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showForm ? 16 : 0 }}>
              <div>
                <p className="section-title" style={{ marginBottom: 0 }}>📅 出欠を入力</p>
                {(event.confirmedDates?.length ?? 0) > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4, marginBottom: 0 }}>
                    スケジュール確定しているため入力できません。
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowForm(v => !v)}
                style={{ fontSize: 13, color: 'var(--muted)' }}
              >
                {showForm ? '▲ 閉じる' : '▼ 開く'}
              </button>
            </div>
            {showForm && (
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
                  disabled={isClosed}
                />
              </div>

              {/* Googleカレンダー反映ボタン（ログイン時のみ） */}
              {user && !isClosed && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--indigo-soft)', border: '1.5px solid var(--indigo)',
                }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCalendarReflect}
                    disabled={calLoading}
                    style={{ fontSize: 13, gap: 4 }}
                  >
                    {calLoading ? '取得中...' : '📅 カレンダーから反映'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Googleカレンダーの予定から自動で○△×を入力します（読み取り専用・サーバーに保存しません）
                  </span>
                  {calMessage && (
                    <span style={{
                      fontSize: 12, fontWeight: 600, width: '100%',
                      color: calMessage.includes('失敗') ? 'var(--red)' : '#16a34a',
                    }}>
                      {calMessage}
                    </span>
                  )}
                </div>
              )}

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
                          onClick={() => !isClosed && setAvail({ ...avail, [date]: v })}
                          disabled={isClosed}
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

              <div>
                <label htmlFor="respComment">一言コメント（任意）</label>
                <textarea
                  id="respComment"
                  placeholder="「ここだけ早退かも」「楽しみにしてます！」など"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                  disabled={isClosed}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !name || isClosed}
                style={{ justifyContent: 'center' }}
              >
                {submitting ? '送信中...' : myResponseId ? '回答を更新する' : '回答を送信する'}
              </button>
            </form>
            )}
          </div>
        ) : (
          <div
            className="card"
            style={{ marginBottom: 24, background: '#f0fdf4', borderColor: '#bbf7d0' }}
          >
            {/* ヘッダー：折りたたみボタン付き */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showForm ? 12 : 0 }}>
              <p className="section-title" style={{ marginBottom: 0 }}>📅 出欠を入力</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowForm(v => !v)}
                style={{ fontSize: 13, color: 'var(--muted)' }}
              >
                {showForm ? '▲ 閉じる' : '▼ 開く'}
              </button>
            </div>
            {showForm && (
              <div style={{ textAlign: 'center' }}>
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
            )}
          </div>
        );
        })()}

        {/* 候補日サマリ */}
        <div id="summary" />
        {responses.length > 0 && event && (() => {
          // 人数別ランキング
          const ranked = [...event.dates]
            .map(date => ({
              date,
              ok:    countAvail(responses, date, '○'),
              maybe: countAvail(responses, date, '△'),
              ng:    countAvail(responses, date, '×'),
            }))
            .sort((a, b) => a.ng - b.ng || b.ok - a.ok);

          // 必須参加者別ランキング（作成者・設定済み時のみ）
          const reqResponses = responses.filter(r => requiredNames.includes(r.name));
          const reqTotal = reqResponses.length;
          const rankedReq = isCreator && reqTotal > 0
            ? [...event.dates]
                .map(date => ({
                  date,
                  reqOk:    reqResponses.filter(r => r.availability[date] === '○').length,
                  reqMaybe: reqResponses.filter(r => r.availability[date] === '△').length,
                  reqNg:    reqResponses.filter(r => r.availability[date] === '×').length,
                  ok:       countAvail(responses, date, '○'),
                }))
                .sort((a, b) =>
                  b.reqOk - a.reqOk ||        // 必須○多い順
                  b.reqMaybe - a.reqMaybe ||   // 同率なら必須△多い順
                  b.ok - a.ok                  // それでも同率なら全体○多い順
                )
            : [];

          const DEFAULT_SHOW = 3;

          return (
            <>
              {/* 人数別サマリ */}
              <div className="card" style={{ borderColor: 'var(--indigo)', background: 'var(--indigo-soft)', marginBottom: 16 }}>
                <p className="section-title" style={{ marginBottom: 12 }}>🏆 候補日サマリ（人数別）</p>
                {(showAllRanked ? ranked : ranked.slice(0, DEFAULT_SHOW)).map((r, i) => (
                  <SummaryRow key={r.date} r={r} i={i} rankList={showAllRanked ? ranked : ranked.slice(0, DEFAULT_SHOW)} accentColor="#f59e0b" showConfirm={isCreator && rankedReq.length === 0} confirmedDates={event.confirmedDates ?? []} reqTotal={reqTotal} onConfirm={handleConfirm} />
                ))}
                {ranked.length > DEFAULT_SHOW && (
                  <button
                    type="button"
                    onClick={() => setShowAllRanked(v => !v)}
                    style={{
                      display: 'block', width: '100%', marginTop: 8, padding: '8px 0',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, color: 'var(--indigo)',
                    }}
                  >
                    {showAllRanked ? '▲ 上位3件のみ表示' : `▼ すべて表示（${ranked.length}件）`}
                  </button>
                )}
              </div>

              {/* 必須参加者設定パネル（作成者のみ） */}
              {isCreator && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p className="section-title" style={{ marginBottom: 0 }}>
                      ⭐ 必須参加者
                      {requiredNames.length > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--indigo)', fontWeight: 400 }}>
                          {requiredNames.length}名設定中
                        </span>
                      )}
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowRequiredPanel(v => !v)}
                      style={{ fontSize: 13 }}
                    >
                      {showRequiredPanel ? '▲ 閉じる' : '▼ 設定する'}
                    </button>
                  </div>
                  {showRequiredPanel && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                        必須参加者を選ぶと、参加率別の候補日サマリが表示されます。この設定はあなたにのみ表示されます。
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {responses.map(r => {
                          const isReq = requiredNames.includes(r.name);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => toggleRequired(r.name)}
                              style={{
                                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                                cursor: 'pointer',
                                border: `1.5px solid ${isReq ? 'var(--indigo)' : 'var(--border)'}`,
                                background: isReq ? 'var(--indigo)' : 'var(--bg)',
                                color: isReq ? '#fff' : 'var(--muted)',
                                transition: 'all 0.15s',
                              }}
                            >
                              {isReq ? '⭐ ' : ''}{r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 必須参加者別サマリ（作成者・必須設定時のみ） */}
              {isCreator && rankedReq.length > 0 && (
                <div className="card" style={{ borderColor: '#f59e0b', background: '#fffbeb', marginBottom: 16 }}>
                  <p className="section-title" style={{ marginBottom: 4 }}>⭐ 候補日サマリ（必須参加者別）</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    必須参加者 {reqTotal}名の参加率順
                  </p>
                  {(showAllRankedReq ? rankedReq : rankedReq.slice(0, DEFAULT_SHOW)).map((r, i) => (
                    <SummaryRow key={r.date} r={r} i={i} rankList={showAllRankedReq ? rankedReq : rankedReq.slice(0, DEFAULT_SHOW)} accentColor="#f59e0b" showConfirm={true} confirmedDates={event.confirmedDates ?? []} reqTotal={reqTotal} onConfirm={handleConfirm} />
                  ))}
                  {rankedReq.length > DEFAULT_SHOW && (
                    <button
                      type="button"
                      onClick={() => setShowAllRankedReq(v => !v)}
                      style={{
                        display: 'block', width: '100%', marginTop: 8, padding: '8px 0',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, color: '#b45309',
                      }}
                    >
                      {showAllRankedReq ? '▲ 上位3件のみ表示' : `▼ すべて表示（${rankedReq.length}件）`}
                    </button>
                  )}
                </div>
              )}
            </>
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
                        style={{
                          color: myResponseId === r.id ? 'var(--indigo)' : undefined,
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span
                            onClick={() => !(event.confirmedDates?.length) && handleSelectResponse(r)}
                            title={event.confirmedDates?.length ? undefined : 'クリックして回答を変更'}
                            style={{
                              cursor: event.confirmedDates?.length ? 'default' : 'pointer',
                              textDecoration: event.confirmedDates?.length ? 'none' : 'underline dotted',
                            }}
                          >
                            {r.name}{!event.confirmedDates?.length && ' ✏️'}
                          </span>
                          {canDelete(r) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteResponse(r.id!)}
                              title="この回答を削除"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: 12, color: '#dc2626', padding: '0 2px', lineHeight: 1,
                              }}
                            >
                              🗑
                            </button>
                          )}
                        </div>
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

        {/* コメント一覧 */}
        {responses.some(r => r.comment) && (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="section-title" style={{ marginBottom: 12 }}>💬 コメント</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {responses.filter(r => r.comment).map(r => (
                <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--indigo)',
                    whiteSpace: 'nowrap', paddingTop: 2,
                  }}>
                    {r.name}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                    {r.comment}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {responses.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 14 }}>
            まだ回答がありません。URLを共有して回答を集めましょう。
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 32 }}>
          <a href="/" style={{ color: 'var(--indigo)' }}>FLOW YOTEI</a> · <a href="/help" style={{ color: 'var(--muted)' }}>ヘルプ</a> · <a href="/privacy" style={{ color: 'var(--muted)' }}>プライバシーポリシー</a> · <a href="/terms" style={{ color: 'var(--muted)' }}>利用規約</a>
        </p>
      </main>
    </>
  );
}
