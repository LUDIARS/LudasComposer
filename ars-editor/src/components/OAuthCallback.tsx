import { useEffect } from 'react';

/**
 * OAuth コールバック処理コンポーネント。
 *
 * 通常はバックエンド (auth.rs) が直接 postMessage HTML を返すため、
 * このコンポーネントは以下のケースで安全策として機能する：
 * - ユーザーが `/auth/callback` に直接アクセスした場合
 * - バックエンド HTML がロードされなかった場合
 */
export function OAuthCallback() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage(
        { type: 'ars-oauth-callback', success: true },
        window.location.origin
      );
      window.close();
      return;
    }
    // ポップアップ以外から直接アクセスされた場合はルートにリダイレクト
    window.location.href = '/';
  }, []);

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-zinc-900 text-zinc-400 text-sm">
      Completing sign in...
    </div>
  );
}
