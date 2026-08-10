import { useParams } from 'next/navigation';

function requireStringParam(value: string | string[] | undefined, name: string): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (typeof resolved !== 'string' || !resolved) {
    throw new Error(`Missing route param: ${name}`);
  }
  return resolved;
}

export function useCommunityId(): string {
  const params = useParams<{ communityId: string }>();
  return requireStringParam(params.communityId, 'communityId');
}

export function useCommunityDocumentParams(): { communityId: string; documentId: string } {
  const params = useParams<{ communityId: string; documentId: string }>();
  return {
    communityId: requireStringParam(params.communityId, 'communityId'),
    documentId: requireStringParam(params.documentId, 'documentId'),
  };
}

export function useCommunityProjectParams(): { communityId: string; projectId: string } {
  const params = useParams<{ communityId: string; projectId: string }>();
  return {
    communityId: requireStringParam(params.communityId, 'communityId'),
    projectId: requireStringParam(params.projectId, 'projectId'),
  };
}

export function useCommunityEventParams(): { communityId: string; eventId: string } {
  const params = useParams<{ communityId: string; eventId: string }>();
  return {
    communityId: requireStringParam(params.communityId, 'communityId'),
    eventId: requireStringParam(params.eventId, 'eventId'),
  };
}
