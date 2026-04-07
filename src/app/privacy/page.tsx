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
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32 }}>制定日：2026年4月6日　最終更新：2026年4月7日</p>

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
                <strong>入力内容：</strong>イベント名・候補日時・回答者名などの情報はサービスの提供目的のみに使用します。
              </li>
              <li>
                <strong>メールアドレス：</strong>回答通知を希望された場合のみ、任意でご入力いただきます。
                入力されたメールアドレスは暗号化して保存し、回答通知の送信のみに使用します。第三者への提供は行いません。
              </li>
              <li>
                <strong>Googleアカウント情報：</strong>Googleログインを利用された場合、氏名・メールアドレス・プロフィール画像を取得します。
                これらはイベント作成者の識別および名前の自動入力のみに使用し、サービス外への提供は行いません。
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Googleカレンダーへのアクセスについて</h2>
            <p style={{ lineHeight: 1.8, marginBottom: 10 }}>
              本サービスでは、ログイン中のユーザーが「カレンダーから反映」機能を使用する際に、
              Google Calendar API（読み取り専用）を通じてカレンダーの空き状況を取得します。
            </p>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.8 }}>
              <li>アクセスするのは空き状況（予定の有無）のみです。予定のタイトル・詳細・参加者などは取得しません。</li>
              <li>取得した空き状況はお使いのブラウザ上でのみ処理し、サーバーへの保存は一切行いません。</li>
              <li>カレンダーへの書き込みは行いません（読み取り専用）。</li>
              <li>この機能の利用は任意です。Googleログインなしでも本サービスはすべての機能をご利用いただけます。</li>
            </ul>
            <p style={{ lineHeight: 1.8, marginTop: 10 }}>
              本サービスによるGoogle APIの使用は、
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--indigo)' }}>
                Google API サービスのユーザーデータに関するポリシー
              </a>
              （Limited Use 要件を含む）に準拠します。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>アカウント登録について</h2>
            <p style={{ lineHeight: 1.8 }}>
              本サービスはアカウント登録不要でご利用いただけます。
              任意でGoogleアカウントによるログインが可能で、ログインするとイベント作成者としての識別やカレンダー連携機能をご利用いただけます。
            </p>
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
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>運営者情報・お問い合わせ</h2>
            <p style={{ lineHeight: 1.8 }}>
              Stellars Lab<br />
              stellarsbit@gmail.com
            </p>
          </section>

        </div>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 20 }}>
          <Link href="/" style={{ color: 'var(--indigo)', fontSize: 14 }}>← トップページに戻る</Link>
          <Link href="/help" style={{ color: 'var(--indigo)', fontSize: 14 }}>ヘルプ →</Link>
        </div>
      </main>
    </>
  );
}
