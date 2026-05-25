import type { TargetKind } from '../shared/schema';

export interface TriggerPayloadLogger {
  info(message: string, data: Record<string, unknown>): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasString = (record: Record<string, unknown>, key: string): boolean =>
  typeof record[key] === 'string';

const hasNumber = (record: Record<string, unknown>, key: string): boolean =>
  typeof record[key] === 'number';

const objectShape = (value: unknown): Record<string, boolean> => {
  if (!isRecord(value)) {
    return { present: false };
  }

  return {
    present: true,
    id: hasString(value, 'id'),
    subredditName: hasString(value, 'subredditName'),
    subredditId: hasString(value, 'subredditId'),
    numberOfReports: hasNumber(value, 'numberOfReports'),
    numReports: hasNumber(value, 'numReports'),
  };
};

const wrapperShape = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    return { present: false };
  }

  return {
    present: true,
    post: objectShape(value.post),
    comment: objectShape(value.comment),
    subredditString: hasString(value, 'subreddit'),
    subredditObject: isRecord(value.subreddit) && hasString(value.subreddit, 'name'),
    reason: hasString(value, 'reason'),
  };
};

export const logTriggerPayloadShape = (
  logger: TriggerPayloadLogger | undefined,
  route: string,
  targetKind: TargetKind,
  body: unknown,
): void => {
  if (!logger || !isRecord(body)) {
    return;
  }

  logger.info('reviewlock.trigger.payload_shape', {
    route,
    targetKind,
    targetId: hasString(body, 'targetId'),
    postId: hasString(body, 'postId'),
    commentId: hasString(body, 'commentId'),
    eventId: hasString(body, 'eventId'),
    id: hasString(body, 'id'),
    timestamp: hasString(body, 'timestamp'),
    reportedAt: hasString(body, 'reportedAt'),
    reportCount: hasNumber(body, 'reportCount'),
    subredditString: hasString(body, 'subreddit'),
    subredditObject: isRecord(body.subreddit) && hasString(body.subreddit, 'name'),
    post: objectShape(body.post),
    comment: objectShape(body.comment),
    postReport: wrapperShape(body.postReport),
    commentReport: wrapperShape(body.commentReport),
    postUpdate: wrapperShape(body.postUpdate),
    commentUpdate: wrapperShape(body.commentUpdate),
    postFlairUpdate: wrapperShape(body.postFlairUpdate),
    nsfwPostUpdate: wrapperShape(body.nsfwPostUpdate),
    spoilerPostUpdate: wrapperShape(body.spoilerPostUpdate),
  });
};
