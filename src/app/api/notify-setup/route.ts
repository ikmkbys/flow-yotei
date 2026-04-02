import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { encrypt } from '@/lib/encrypt';

export async function POST(request: Request) {
  try {
    const { eventId, email, threshold } = await request.json() as {
      eventId: string;
      email: string;
      threshold: number;
    };

    if (!eventId || !email || !threshold || threshold < 1) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const encryptedEmail = encrypt(email.trim().toLowerCase());

    await updateDoc(doc(db, 'events', eventId), {
      notifyEmail: encryptedEmail,
      notifyThreshold: threshold,
      notified: false,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[notify-setup]', err);
    return Response.json({ error: 'Failed to save notify settings' }, { status: 500 });
  }
}
