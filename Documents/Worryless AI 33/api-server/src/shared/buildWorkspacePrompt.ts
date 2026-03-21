// Deno mirror of src/lib/buildWorkspacePrompt.ts
// Keep in sync manually — vitest.config.ts excludes supabase/ dir
export type WorkspaceFileType = 'IDENTITY' | 'SOUL' | 'SOPs' | 'MEMORY' | 'HEARTBEAT' | 'TOOLS';

export function buildWorkspacePrompt(
  files: Record<WorkspaceFileType, string>,
  isHeartbeat = false
): string {
  const sections: string[] = [
    `## IDENTITY\n${files.IDENTITY}`,
    `## SOUL\n${files.SOUL}`,
    `## SOPs\n${files['SOPs']}`,
    `## TOOLS\n${files.TOOLS}`,
    `## MEMORY\n${files.MEMORY}`,
  ];
  if (isHeartbeat) {
    sections.push(`## HEARTBEAT\n${files.HEARTBEAT}`);
  }
  return sections.join('\n\n---\n\n');
}
