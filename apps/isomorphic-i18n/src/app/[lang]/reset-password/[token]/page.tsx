import AuthWrapperOne from '@/app/shared/auth-layout/auth-wrapper-one';
import ResetPasswordForm from './reset-password-form';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ lang?: string; token: string }>;
}) {
  const { lang, token } = await params;
  return (
    <AuthWrapperOne
      title={
        <>
          Reset your password.
        </>
      }
      lang={lang}
    >
      <ResetPasswordForm lang={lang} token={token}/>
    </AuthWrapperOne>
  );
}
