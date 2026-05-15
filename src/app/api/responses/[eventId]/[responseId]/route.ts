import type { NextRequest } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; responseId: string }> },
) {
  const { eventId, responseId } = await params;
  const db   = getAdminDb();
  const auth = getAdminAuth();

  const eventRef    = db.doc(`events/${eventId}`);
  const responseRef = db.doc(`events/${eventId}/responses/${responseId}`);

  const responseSnap = await responseRef.get();
  if (!responseSnap.exists) {
    return Response.json({ error: 'Response not found' }, { status: 404 });
  }
  const responseData = responseSnap.data()!;

  // 認証必須：Authorization ヘッダーがないものは拒否
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credential = authHeader.slice(7);
  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(credential);
    uid = decoded.uid;
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  const eventSnap = await eventRef.get();
  const eventData = eventSnap.data();
  const isCreator = eventData?.creatorUid === uid;
  const isOwner   = responseData.uid === uid;

  if (!isCreator && !isOwner) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await responseRef.delete();
  return Response.json({ ok: true });
}
