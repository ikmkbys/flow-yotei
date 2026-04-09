import type { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

async function fetchEventTitle(id: string): Promise<string | null> {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/events/${id}?key=${apiKey}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.fields?.title?.stringValue ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const title = await fetchEventTitle(id);
  const pageTitle  = title ? `${title} — FLOW YOTEI` : 'FLOW YOTEI — 日程調整';
  const description = title
    ? `「${title}」の日程調整ページです。都合のいい日程を回答してください。`
    : 'URLを共有するだけ。みんなの都合をリアルタイムで確認できる日程調整ツール。';
  const url = `https://flow-yotei.stellars-lab.com/${id}`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url,
      siteName: 'FLOW YOTEI',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: pageTitle,
      description,
    },
  };
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
