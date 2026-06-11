import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { encrypt } from '@/lib/encrypt';
import { z } from 'zod';

const postSchema = z.object({
  eventId:       z.string().min(1),
  email:         z.string().email(),
  threshold:     z.number().int().min(1).max(500),
  notifyDeadline: z.boolean().optional(),
});

const patchSchema = z.object({
  eventId:       z.string().min(1),
  threshold:     z.number().int().min(1).max(500).optional(),
  notifyDeadline: z.boolean().optional(),
});

/* 作成直後のPOSTを許容する猶予（匿名イベント用） */
const SETUP_WINDOW_MS = 10 * 60 * 1000;

/* Authorization ヘッダーのIDトークンを検証してuidを返す（なければnull） */
async function verifyUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const { eventId, email, threshold, notifyDeadline } = parsed.data;

    const eventRef = getAdminDb().doc(`events/${eventId}`);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventSnap.data()!;

    if (event.creatorUid) {
      // ログイン作成イベント：作成者本人のIDトークン必須
      const uid = await verifyUid(request);
      if (uid !== event.creatorUid) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      // 匿名作成イベント：上書き禁止＋作成直後のみ許可（乗っ取り対策）
      if (event.notifyEmail) {
        return Response.json({ error: 'Notify settings already exist' }, { status: 403 });
      }
      const createdAtMs = event.createdAt?.toMillis?.() ?? 0;
      if (Date.now() - createdAtMs > SETUP_WINDOW_MS) {
        return Response.json({ error: 'Setup window expired' }, { status: 403 });
      }
    }

    const encryptedEmail = encrypt(email.trim().toLowerCase());

    await eventRef.update({
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
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const { eventId, threshold, notifyDeadline } = parsed.data;

    const eventRef = getAdminDb().doc(`events/${eventId}`);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventSnap.data()!;

    // 通知設定がないイベントへのPATCHは不可
    if (!event.notifyEmail) {
      return Response.json({ error: 'Notify settings not found' }, { status: 403 });
    }
    // ログイン作成イベントは作成者本人のIDトークン必須（匿名イベントは検証手段がないため許容）
    if (event.creatorUid) {
      const uid = await verifyUid(request);
      if (uid !== event.creatorUid) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
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

    await eventRef.update(updates);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[notify-setup PATCH]', err);
    return Response.json({ error: 'Failed to update notify settings' }, { status: 500 });
  }
}
