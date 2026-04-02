import type { NextRequest } from 'next/server';
import { doc, getDoc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { decrypt } from '@/lib/encrypt';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendEmail(to: string, eventTitle: string, eventId: string, responseCount: number) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const from = process.env.RESEND_FROM_EMAIL ?? 'FLOW YOTEI <onboarding@resend.dev>';
  const eventUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://flow-yotei.vercel.app'}/${eventId}`;
  const safeTitle = escapeHtml(eventTitle);

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#6366f1;padding:28px 32px;">
      <p style="margin:0;color:#fff;font-size:13px;font-weight:700;letter-spacing:1px;opacity:0.8;">FLOW YOTEI</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">回答が集まりました！</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#333;">
        <strong>${safeTitle}</strong> に ${responseCount}人が回答しました。<br>
        集計結果を確認して、日程を確定しましょう。
      </p>
      <a href="${eventUrl}"
         style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">
        結果を確認する →
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#999;">
        このメールは FLOW YOTEI の回答通知設定に基づき送信されました。
      </p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `【FLOW YOTEI】${eventTitle} に${responseCount}人が回答しました`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

export async function POST(_req: NextRequest, ctx: RouteContext<'/api/notify/[id]'>) {
  const { id } = await ctx.params;

  try {
    const eventSnap = await getDoc(doc(db, 'events', id));
    if (!eventSnap.exists()) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    const data = eventSnap.data();
    const { notifyEmail, notifyThreshold, notified } = data as {
      notifyEmail?: string;
      notifyThreshold?: number;
      notified?: boolean;
    };

    // 通知設定なし or 送信済みなら何もしない
    if (!notifyEmail || !notifyThreshold || notified) {
      return Response.json({ ok: true, skipped: true });
    }

    // 回答数カウント
    const responsesSnap = await getDocs(collection(db, 'events', id, 'responses'));
    const count = responsesSnap.size;

    if (count < notifyThreshold) {
      return Response.json({ ok: true, count, threshold: notifyThreshold });
    }

    // 閾値到達 → メール送信＋通知済みフラグ更新
    const email = decrypt(notifyEmail);
    await sendEmail(email, data.title as string, id, count);
    await updateDoc(doc(db, 'events', id), { notified: true });

    return Response.json({ ok: true, notified: true, count });
  } catch (err) {
    console.error('[notify]', err);
    return Response.json({ error: 'Notification failed' }, { status: 500 });
  }
}
