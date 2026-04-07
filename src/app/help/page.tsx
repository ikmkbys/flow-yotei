import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ヘルプ | FLOW YOTEI',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--indigo-soft)' }}>
      {title}
    </h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {children}
    </div>
  </section>
);

const Q = ({ q, children }: { q: string; children: React.ReactNode }) => (
  <div>
    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--indigo)' }}>Q. {q}</p>
    <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>{children}</p>
  </div>
);

export default function HelpPage() {
  return (
    <>
      <header>
        <div className="header-inner">
          <a href="/" className="logo">FLOW YOTEI<span>.</span></a>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 680 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>ヘルプ</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32 }}>よくある質問と使い方ガイド</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          <Section title="📅 基本的な使い方">
            <Q q="FLOW YOTEIとは何ですか？">
              URLを共有するだけで日程調整ができる無料ツールです。登録不要で、作成者も回答者もすぐに使えます。
            </Q>
            <Q q="イベントを作成するにはどうすればいいですか？">
              トップページでイベント名・日程候補・お名前を入力して「イベントを作成する」ボタンを押してください。作成後に表示されるURLを参加者に共有します。
            </Q>
            <Q q="回答者はどうやって回答しますか？">
              共有されたURLを開き、名前を入力して各日程に○△×を選んで送信するだけです。アカウント登録は不要です。
            </Q>
            <Q q="回答後に変更できますか？">
              できます。結果表に表示されている自分の名前をクリックすると、回答をフォームに読み込んで編集・再送信できます。
            </Q>
          </Section>

          <Section title="🔑 Googleログインについて">
            <Q q="Googleログインは必須ですか？">
              いいえ、任意です。ログインしなくても全機能を利用できます。ログインすることでイベント作成者の識別やカレンダー連携などの便利な機能が使えるようになります。
            </Q>
            <Q q="Googleログインすると何が変わりますか？">
              以下の機能が使えるようになります：①別のブラウザ・端末からログインしても作成者として認識される ②イベント作成・回答フォームに名前が自動入力される ③Googleカレンダーから空き状況を自動反映できる。
            </Q>
            <Q q="ログイン時に「確認されていないアプリ」という警告が出ます">
              現在Google審査中のため表示されますが、安全に使用できます。「詳細」→「flow-yotei.stellars-lab.comに移動」をクリックして続行してください。
            </Q>
          </Section>

          <Section title="📆 カレンダー連携について">
            <Q q="「カレンダーから反映」とは何ですか？">
              Googleにログインしている状態で回答フォームの「📅 カレンダーから反映」ボタンを押すと、Googleカレンダーの空き状況を自動で読み取り、○△×を自動入力します。
            </Q>
            <Q q="カレンダーのどんな情報にアクセスしますか？">
              空き・予定ありの情報（FreeBusy）のみにアクセスします。予定のタイトル・詳細・参加者などは取得しません。また取得したデータはサーバーに保存されません。
            </Q>
            <Q q="自動入力された後、手動で修正できますか？">
              できます。反映後も○△×を自由にクリックして変更できます。自動入力はあくまで参考です。
            </Q>
            <Q q="カレンダー反映の精度はどのくらいですか？">
              時刻指定あり：その時間帯に予定がある場合は×または△、ない場合は○になります。終日候補：ビジネスアワー（9〜18時）の予定の量で判定します。
            </Q>
          </Section>

          <Section title="✏️ イベントの管理">
            <Q q="作成したイベントを編集できますか？">
              できます。イベントページで「✏️ 編集」ボタンが表示されている場合、タイトル・日程・メモなどを変更できます（作成者のみ表示）。
            </Q>
            <Q q="別のブラウザから作成者として操作できませんでした">
              Googleログインしていない場合、作成者の識別はブラウザのローカルストレージに依存するため、別ブラウザでは編集できません。Googleログインして同じアカウントで作成すると、どの端末からでも作成者として操作できます。
            </Q>
            <Q q="日程を確定するにはどうすればいいですか？">
              作成者として候補日サマリを表示し、「確定する」ボタンを押してください。複数日の確定も可能です。確定するとページ上部に開催日程が表示されます。
            </Q>
          </Section>

          <Section title="📧 通知について">
            <Q q="回答通知を受け取るにはどうすればいいですか？">
              イベント作成時に「回答通知を受け取る」にチェックを入れ、通知先メールアドレスを入力してください。指定した人数が回答したとき、または回答期限日に通知が届きます。
            </Q>
            <Q q="メールアドレスは他の参加者に見えますか？">
              見えません。通知用メールアドレスは暗号化して保存され、他の参加者には表示されません。
            </Q>
          </Section>

        </div>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--indigo)', fontSize: 14 }}>← トップページに戻る</Link>
          <Link href="/privacy" style={{ color: 'var(--muted)', fontSize: 14 }}>プライバシーポリシー</Link>
          <a href="mailto:stellarsbit@gmail.com" style={{ color: 'var(--muted)', fontSize: 14 }}>お問い合わせ</a>
        </div>
      </main>
    </>
  );
}
