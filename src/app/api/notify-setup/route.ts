import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { encrypt } from '@/lib/encrypt';

export async function POST(request: Request) {
  try {
    const { eventId, email, threshold, notifyDeadline } = await request.json() as {
      eventId: string;
      email: string;
      threshold: number;
      notifyDeadline?: boolean;
    };

    if (!eventId || !email) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const encryptedEmail = encrypt(email.trim().toLowerCase());

    await updateDoc(doc(db, 'events', eventId), {
      notifyEmail: encryptedEmail,
      notifyThreshold: threshold >= 1 ? threshold : 1,
      notified: false,
      notifyDeadline: notifyDeadline ?? false,
      deadlineNotified: false,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[notify-setup]', err);
    return Response.json({ error: 'Failed to save notify settings' }, { status: 500 });
  }
}

// 編集パネルからの部分更新（人数・期限通知ON/OFFのみ）
export async function PATCH(request: Request) {
  try {
    const { eventId, threshold, notifyDeadline } = await request.json() as {
      eventId: string;
      threshold?: number;
      notifyDeadline?: boolean;
    };

    if (!eventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (threshold !== undefined && threshold >= 1) {
      updates.notifyThreshold = threshold;
      updates.notified = false;  // 閾値変更→再通知可能に
    }
    if (notifyDeadline !== undefined) {
      updates.notifyDeadline = notifyDeadline;
      updates.deadlineNotified = false;  // 期限通知変更→再通知可能に
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: true, skipped: true });
    }

    await updateDoc(doc(db, 'events', eventId), updates);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[notify-setup PATCH]', err);
    return Response.json({ error: 'Failed to update notify settings' }, { status: 500 });
  }
}
