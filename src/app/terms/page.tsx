import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約 | FLOW YOTEI',
};

export default function TermsPage() {
  return (
    <>
      <header>
        <div className="header-inner">
          <a href="/" className="logo">FLOW YOTEI<span>.</span></a>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 680 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>利用規約</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32 }}>制定日：2026年4月7日</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          <section>
            <p style={{ lineHeight: 1.8 }}>
              本利用規約（以下「本規約」）は、Stellars Lab（以下「運営者」）が提供する日程調整サービス
              FLOW YOTEI（以下「本サービス」）の利用条件を定めるものです。
              本サービスをご利用いただくことで、本規約に同意したものとみなします。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>第1条（サービスの概要）</h2>
            <p style={{ lineHeight: 1.8 }}>
              本サービスは、イベントの日程候補を作成しURLで共有することで、参加者の出欠を収集・集計できる無料の日程調整ツールです。
              アカウント登録不要でご利用いただけます。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>第2条（禁止事項）</h2>
            <p style={{ lineHeight: 1.8, marginBottom: 10 }}>利用者は、以下の行為を行ってはなりません。</p>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.8 }}>
              <li>法令または公序良俗に違反する行為</li>
              <li>スパムや迷惑行為を目的とした利用</li>
              <li>本サービスのシステムに過度な負荷を与える行為</li>
              <li>本サービスを通じて他者を誹謗中傷する行為</li>
              <li>運営者または第三者の著作権・商標権等の知的財産権を侵害する行為</li>
              <li>その他、運営者が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>第3条（Googleアカウント連携）</h2>
            <p style={{ lineHeight: 1.8 }}>
              本サービスでは、任意でGoogleアカウントによるログインおよびGoogleカレンダーとの連携機能を提供しています。
              これらの機能を利用する場合、利用者はGoogleの利用規約およびプライバシーポリシーにも同意したものとみなします。
              運営者はGoogleカレンダーから取得した情報をサーバーに保存せず、出欠入力の補助目的にのみ使用します。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>第4条（サービスの変更・停止・終了）</h2>
            <p style={{ lineHeight: 1.8 }}>
              運営者は、利用者への事前通知なく本サービスの内容を変更、または提供を停止・終了することがあります。
              これによって生じた損害について、運営者は責任を負いかねます。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>第5条（免責事項）</h2>
            <p style={{ lineHeight: 1.8 }}>
              本サービスは現状有姿で提供されます。運営者は、本サービスの正確性・完全性・継続性を保証しません。
              本サービスの利用によって生じた損害（データの消失・機会損失等を含む）について、運営者は責任を負いかねます。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>第6条（規約の変更）</h2>
            <p style={{ lineHeight: 1.8 }}>
              運営者は、必要に応じて本規約を変更することがあります。変更後の規約は本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>第7条（準拠法・管轄）</h2>
            <p style={{ lineHeight: 1.8 }}>
              本規約は日本法に準拠します。本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
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

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--indigo)', fontSize: 14 }}>← トップページに戻る</Link>
          <Link href="/privacy" style={{ color: 'var(--muted)', fontSize: 14 }}>プライバシーポリシー</Link>
          <Link href="/help" style={{ color: 'var(--muted)', fontSize: 14 }}>ヘルプ</Link>
        </div>
      </main>
    </>
  );
}
