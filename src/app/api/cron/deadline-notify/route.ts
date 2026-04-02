import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { decrypt } from '@/lib/encrypt';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendDeadlineEmail(to: string, eventTitle: string, eventId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const from = process.env.RESEND_FROM_EMAIL ?? 'FLOW YOTEI <onboarding@resend.dev>';
  const eventUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://flow-yotei.stellars-lab.com'}/${eventId}`;
  const safeTitle = escapeHtml(eventTitle);

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#6366f1;padding:28px 32px;">
      <p style="margin:0;color:#fff;font-size:13px;font-weight:700;letter-spacing:1px;opacity:0.8;">FLOW YOTEI</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">今日が回答期限日です</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#333;">
        <strong>${safeTitle}</strong> の回答期限が今日です。<br>
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
      subject: `【FLOW YOTEI】${eventTitle} の回答期限は今日です`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

export async function GET(request: Request) {
  // Vercel Cron の認証チェック
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 今日の日付（JST = UTC+9）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split('T')[0]; // "2026-04-02"

  try {
    // 今日が期限のイベントを取得（ISO文字列比較）
    const q = query(
      collection(db, 'events'),
      where('deadline', '>=', `${today}T00:00`),
      where('deadline', '<=', `${today}T23:59`),
    );
    const snap = await getDocs(q);

    let sent = 0;
    let skipped = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();

      // 条件チェック
      if (!data.notifyEmail || !data.notifyDeadline || data.deadlineNotified) {
        skipped++;
        continue;
      }

      try {
        const email = decrypt(data.notifyEmail as string);
        await sendDeadlineEmail(email, data.title as string, docSnap.id);
        await updateDoc(doc(db, 'events', docSnap.id), { deadlineNotified: true });
        sent++;
      } catch (err) {
        console.error(`[deadline-notify] Failed for event ${docSnap.id}:`, err);
      }
    }

    console.log(`[deadline-notify] ${today}: sent=${sent}, skipped=${skipped}`);
    return Response.json({ ok: true, today, sent, skipped });
  } catch (err) {
    console.error('[deadline-notify]', err);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
