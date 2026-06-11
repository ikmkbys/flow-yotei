import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { EVENT_RETENTION_DAYS } from '@/lib/constants';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {  // 未設定時は明示的に拒否
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminDb = getAdminDb();
  const cutoff = Timestamp.fromMillis(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const snap = await adminDb.collection('events').where('createdAt', '<=', cutoff).get();

    let deleted = 0;

    for (const eventDoc of snap.docs) {
      const responsesSnap = await eventDoc.ref.collection('responses').get();
      const batch = adminDb.batch();
      responsesSnap.docs.forEach(r => batch.delete(r.ref));
      batch.delete(eventDoc.ref);
      await batch.commit();
      deleted++;
    }

    console.log(`[cleanup-expired] deleted=${deleted}`);
    return Response.json({ ok: true, deleted });
  } catch (err) {
    console.error('[cleanup-expired]', err);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
