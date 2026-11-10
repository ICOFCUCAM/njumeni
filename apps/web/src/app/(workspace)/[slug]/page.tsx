import { notFound } from 'next/navigation';
import { ModuleLanding } from '@/components/module-landing';
import { getModuleBySlug, moduleRegistry } from '@/modules/registry';

export function generateStaticParams() {
  return moduleRegistry.map((module) => ({ slug: module.slug }));
}
export default async function ModuleRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const module = getModuleBySlug(slug);
  if (!module) notFound();
  return <ModuleLanding module={module} />;
}
