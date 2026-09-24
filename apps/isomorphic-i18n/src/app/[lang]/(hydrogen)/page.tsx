import FileDashboard from "@/app/shared/file/dashboard";
import { metaObject } from "@/config/site.config";

export const metadata = {
  ...metaObject(),
};

export default async function FileDashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <FileDashboard lang={lang} />;
}
