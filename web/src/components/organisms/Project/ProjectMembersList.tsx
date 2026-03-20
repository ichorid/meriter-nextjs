'use client';

import { useProjectMembers } from '@/hooks/api/useProjects';

interface ProjectMembersListProps {
  projectId: string;
}

export function ProjectMembersList({ projectId }: ProjectMembersListProps) {
  const { data, isLoading } = useProjectMembers(projectId, { limit: 50 });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading members...</p>;
  }

  const members = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {members.slice(0, 20).map((member: { id?: string; userId?: string; displayName?: string; role?: string }) => (
        <li key={member.id ?? member.userId ?? ''}>
          {member.displayName ?? member.id ?? member.userId ?? '—'} {member.role && `(${member.role})`}
        </li>
      ))}
      {total > 20 && <li className="text-muted-foreground">… and {total - 20} more</li>}
    </ul>
  );
}
