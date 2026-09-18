import { EvaluationTemplateCurrentSectionWorkspace } from "@/modules/template/ui";

type EvaluationTemplateCurrentSectionPageProps = {
  params: Promise<{ sectionId: string }>;
};

export default async function EvaluationTemplateCurrentSectionPage({
  params,
}: EvaluationTemplateCurrentSectionPageProps) {
  const { sectionId } = await params;

  return (
    <main>
      <EvaluationTemplateCurrentSectionWorkspace sectionId={sectionId} />
    </main>
  );
}
