'use client';

import { useEffect } from 'react';

interface Step {
  icon: string;
  title: string;
  desc: string;
}

const CREATE_STEPS: Step[] = [
  { icon: '📅', title: 'カレンダーで日程候補を選ぶ',   desc: '共通時刻を設定してから、カレンダーの日付をクリック。複数日・複数時刻を自由に追加できます。' },
  { icon: '✏️', title: 'タイトルと名前を入力して作成', desc: 'イベント名と自分の名前を入力したら「イベントを作成」ボタンを押すだけ。登録不要・無料で使えます。' },
  { icon: '🔗', title: 'URLを参加者にシェア',          desc: '作成後に表示されるURLをコピーして、LINEやSlackで送るだけ。参加者はURLを開くだけで回答できます。' },
  { icon: '○△×', title: 'みんなが都合を回答',         desc: '参加者が各日程に○（参加できる）△（たぶん参加できる）×（参加できない）を選んで送信します。' },
  { icon: '✅', title: '結果を見て日程を確定',          desc: '回答が集まったら作成者が集計結果を確認。いちばん都合がいい日程の「確定」ボタンを押したら完了！' },
];

const RESPOND_STEPS: Step[] = [
  { icon: '📝', title: '名前を入力する',           desc: 'フォームに自分の名前を入力してください。登録・ログイン不要でそのまま回答できます。' },
  { icon: '○△×', title: '各日程の都合を選ぶ',     desc: 'クリックするたびに ○ → △ → × と切り替わります。参加できそうな日程に○を選びましょう。' },
  { icon: '📤', title: '送信する',                 desc: '「回答を送信」ボタンを押したら完了。後から名前をクリックすると回答を編集できます。' },
  { icon: '🔔', title: '日程確定を待つ',            desc: '作成者が集計結果を見て日程を確定すると、ページ上部に確定日程が表示されます。' },
];

interface Props {
  mode: 'create' | 'respond';
  onClose: () => void;
}

export default function HowToModal({ mode, onClose }: Props) {
  const steps = mode === 'create' ? CREATE_STEPS : RESPOND_STEPS;
  const heading = mode === 'create' ? 'FLOW YOTEIの使い方' : '回答の仕方';

  /* Escキーで閉じる */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* スクロール防止 */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    /* オーバーレイ */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* モーダル本体 */}
      <div
        onClick={e => e.stopPropagation()}  // 内側クリックで閉じない
        style={{
          background: 'var(--bg)',
          borderRadius: 16,
          padding: '32px 28px',
          maxWidth: 480,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          position: 'relative',
        }}
      >
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'var(--bg2)', border: 'none',
            width: 32, height: 32, borderRadius: '50%',
            fontSize: 16, cursor: 'pointer', color: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="閉じる"
        >✕</button>

        {/* タイトル */}
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, color: 'var(--text)' }}>
          📖 {heading}
        </h2>

        {/* ステップ一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* ステップ番号 */}
              <div style={{
                flexShrink: 0,
                width: 32, height: 32,
                borderRadius: '50%',
                background: 'var(--indigo-soft, #ede9fe)',
                color: 'var(--indigo)',
                fontWeight: 800, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </div>
              {/* テキスト */}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text)' }}>
                  {step.icon} {step.title}
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div style={{ marginTop: 28, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ minWidth: 120, textDecoration: 'none', textAlign: 'center' }}
          >
            もっと詳しく
          </a>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ minWidth: 120 }}
          >
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
}
