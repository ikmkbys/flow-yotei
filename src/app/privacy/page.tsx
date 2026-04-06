import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | FLOW YOTEI',
};

export default function PrivacyPage() {
  return (
    <>
      <header>
        <div className="header-inner">
          <a href="/" className="logo">FLOW YOTEI<span>.</span></a>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 680 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>プライバシーポリシー</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32 }}>制定日：2026年4月6日</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          <section>
            <p style={{ lineHeight: 1.8 }}>
              FLOW YOTEI（以下「本サービス」）は、Stellars Lab が運営する無料の日程調整ツールです。
              本サービスのご利用にあたり、ユーザーのプライバシーを尊重し、個人情報を適切に取り扱います。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>収集する情報</h2>
            <p style={{ lineHeight: 1.8, marginBottom: 10 }}>本サービスでは、以下の情報を取り扱う場合があります。</p>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.8 }}>
              <li>
                <strong>メールアドレス：</strong>回答通知の受け取りを希望された場合のみ、任意でご入力いただきます。
                入力されたメールアドレスは暗号化して保存し、回答通知の送信のみに使用します。第三者への提供は行いません。
              </li>
              <li>
                <strong>入力内容：</strong>イベント名・候補日時・回答者名などの情報はサービスの提供目的のみに使用します。
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>アカウント登録について</h2>
            <p style={{ lineHeight: 1.8 }}>本サービスはアカウント登録不要でご利用いただけます。</p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>アクセス解析</h2>
            <p style={{ lineHeight: 1.8 }}>
              本サービスでは Vercel Analytics を使用し、ページビュー数・参照元などの匿名化されたデータを収集しています。
              個人を特定できる情報は取得しません。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>免責事項</h2>
            <p style={{ lineHeight: 1.8 }}>
              本サービスの利用によって生じた損害について、運営者は責任を負いかねます。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>運営者情報</h2>
            <p style={{ lineHeight: 1.8 }}>
              Stellars Lab<br />
              stellarsbit@gmail.com
            </p>
          </section>

        </div>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          <Link href="/" style={{ color: 'var(--indigo)', fontSize: 14 }}>← トップページに戻る</Link>
        </div>
      </main>
    </>
  );
}
