import Image from 'next/image';
import SignInForm from '@/app/[lang]/sign-in/sign-in-form';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Sign In'),
};

export default async function SignIn({
  params,
}: {
  params: Promise<{ lang?: string }>;
}) {
  const { lang } = await params;
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-50">
      {/* Optional: Background Image with blur effect */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/dashboard-bg-light.png" // Replace with your dashboard screenshot
          alt="Background"
          fill
          priority
          className="object-cover opacity-50 blur-sm"
        />
        <div className="absolute inset-0 bg-gray-900/30" /> {/* Overlay */}
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md p-6 mx-4 bg-white rounded-xl shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h1>
          <p className="text-sm text-gray-500">
            Enter your credentials to access your account
          </p>
        </div>
        <SignInForm lang={lang}/>
      </div>
    </div>
  );
}