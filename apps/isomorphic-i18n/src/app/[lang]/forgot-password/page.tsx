import AuthWrapperOne from '@/app/shared/auth-layout/auth-wrapper-one';
import ForgetPasswordForm from './forgot-password-form';

export default async function ForgotPassword({
  params,
}: {
  params: Promise<{ lang?: string }>;
}) {
  const { lang } = await params;
  return (
    <AuthWrapperOne
      title={
        <>
          Having trouble to sign in? <br className="hidden sm:inline-block" />{' '}
          Send reset link to your email.
        </>
      }
      lang={lang}
    >
      <ForgetPasswordForm lang={lang}/>
    </AuthWrapperOne>
  );
}
