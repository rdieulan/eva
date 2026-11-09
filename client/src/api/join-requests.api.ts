// Requests to join a team API client: the player asking, and the team answering

import type { MyJoinRequest, TeamJoinRequestView } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

// A call answered 204, with no body: the JSON-parsing form of authFetch does not apply
async function withoutAnswer(url: string, method: 'POST' | 'DELETE', errorMessage: string): Promise<void> {
  const response = await authFetch(url, { method });
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, errorMessage);
  }
}

/** The player's request: the one waiting, or a refusal not seen yet; null when there is none */
export async function fetchMyJoinRequest(): Promise<MyJoinRequest | null> {
  const { request } = await authFetch<{ request: MyJoinRequest | null }>('/api/join-requests/mine', undefined, ERROR.serverError);
  return request;
}

/** Ask to join a team */
export async function sendJoinRequest(teamId: string): Promise<MyJoinRequest> {
  const { request } = await authFetch<{ request: MyJoinRequest }>(
    '/api/join-requests',
    { method: 'POST', body: JSON.stringify({ teamId }) },
    ERROR.joinRequestFailed,
  );
  return request;
}

/** Take back the waiting request */
export function cancelMyJoinRequest(): Promise<void> {
  return withoutAnswer('/api/join-requests/mine', 'DELETE', ERROR.joinRequestCancelFailed);
}

/** The refusal was seen: it is not shown again */
export function markMyRefusalSeen(): Promise<void> {
  return withoutAnswer('/api/join-requests/mine/seen', 'POST', ERROR.serverError);
}

/** The requests waiting for the team's answer, oldest first */
export async function fetchTeamJoinRequests(): Promise<TeamJoinRequestView[]> {
  const { requests } = await authFetch<{ requests: TeamJoinRequestView[] }>(
    '/api/teams/current/join-requests',
    undefined,
    ERROR.joinRequestsFetchFailed,
  );
  return requests;
}

/** Let the player of a waiting request in */
export function acceptJoinRequest(requestId: string): Promise<void> {
  return withoutAnswer(`/api/teams/current/join-requests/${encodeURIComponent(requestId)}/accept`, 'POST', ERROR.joinRequestAnswerFailed);
}

/** Say no to a waiting request */
export function refuseJoinRequest(requestId: string): Promise<void> {
  return withoutAnswer(`/api/teams/current/join-requests/${encodeURIComponent(requestId)}/refuse`, 'POST', ERROR.joinRequestAnswerFailed);
}
