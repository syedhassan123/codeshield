import { CodeEditorClient } from "@/components/coding/code-editor-client";

export default async function StudentCodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CodeEditorClient id={id} />;
}
