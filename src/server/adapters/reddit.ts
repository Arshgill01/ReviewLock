import type { ReviewLockTarget } from '../../shared/schema';

export interface RedditAdapter {
  getPostById(id: string): Promise<ReviewLockTarget | undefined>;
  getCommentById(id: string): Promise<ReviewLockTarget | undefined>;
  approveTarget(target: ReviewLockTarget): Promise<void>;
  ignoreReports(target: ReviewLockTarget): Promise<void>;
  unignoreReports(target: ReviewLockTarget): Promise<void>;
  getCurrentUsername(): Promise<string | undefined>;
  getCurrentSubredditName(): Promise<string | undefined>;
  submitDashboardPost?(input: {
    subredditName: string;
    title: string;
  }): Promise<{ permalink: string }>;
}

interface ModeratableModel {
  id: unknown;
  title?: unknown;
  body?: unknown;
  selftext?: unknown;
  url?: unknown;
  edited?: unknown;
  ignoringReports?: unknown;
  numberOfReports?: unknown;
  numReports?: unknown;
  userReportReasons?: unknown;
  modReportReasons?: unknown;
  permalink?: unknown;
  subredditName?: unknown;
  authorName?: unknown;
  author?: unknown;
  authorId?: unknown;
  postId?: unknown;
  parentId?: unknown;
  flair?: unknown;
  linkFlair?: unknown;
  nsfw?: unknown;
  spoiler?: unknown;
  isNsfw?: unknown;
  isSpoiler?: unknown;
  approve(): Promise<void>;
  ignoreReports(): Promise<void>;
  unignoreReports(): Promise<void>;
}

interface DevvitRedditClient {
  getPostById(id: string): Promise<ModeratableModel>;
  getCommentById(id: string): Promise<ModeratableModel>;
  getCurrentUsername(): Promise<unknown>;
  getCurrentSubredditName?(): Promise<unknown>;
  getCurrentSubreddit?(): Promise<{ name?: unknown } | undefined>;
  submitCustomPost(input: {
    subredditName: string;
    title: string;
    entry: string;
    textFallback: { text: string };
  }): Promise<{ permalink: string }>;
}

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const countValue = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

const boolValue = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const boolMethodValue = (value: unknown): boolean | undefined =>
  typeof value === 'function' ? boolValue((value as () => unknown)()) : boolValue(value);

const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const normalizeThingId = (kind: 'post' | 'comment', value: unknown): string => {
  const id = stringValue(value);

  if (!id) {
    throw new Error(`Reddit ${kind} id was missing or malformed.`);
  }

  if (id.startsWith('t1_') || id.startsWith('t3_')) {
    const expectedPrefix = kind === 'post' ? 't3_' : 't1_';

    if (!id.startsWith(expectedPrefix)) {
      throw new Error(`Reddit ${kind} id had the wrong thing prefix.`);
    }

    return id;
  }

  return kind === 'post' ? `t3_${id}` : `t1_${id}`;
};

export const mapPostModel = (post: ModeratableModel): ReviewLockTarget => ({
  id: normalizeThingId('post', post.id),
  kind: 'post',
  subreddit: stringValue(post.subredditName) ?? 'unknown',
  authorName:
    stringValue(post.authorName) ?? stringValue(post.author) ?? stringValue(post.authorId) ?? 'unknown',
  permalink: stringValue(post.permalink) ?? '',
  title: stringValue(post.title),
  body: stringValue(post.body) ?? stringValue(post.selftext),
  url: stringValue(post.url),
  flairText: stringValue(field(post.flair, 'text')) ?? stringValue(field(post.linkFlair, 'text')),
  flairTemplateId:
    stringValue(field(post.flair, 'templateId')) ?? stringValue(field(post.linkFlair, 'templateId')),
  isNsfw: boolValue(post.nsfw) ?? boolMethodValue(post.isNsfw),
  isSpoiler: boolValue(post.spoiler) ?? boolMethodValue(post.isSpoiler),
  edited: post.edited === true,
  reportCount: countValue(post.numberOfReports) ?? countValue(post.numReports) ?? 0,
});

export const mapCommentModel = (comment: ModeratableModel): ReviewLockTarget => ({
  id: normalizeThingId('comment', comment.id),
  kind: 'comment',
  subreddit: stringValue(comment.subredditName) ?? 'unknown',
  authorName: stringValue(comment.authorName) ?? stringValue(comment.author) ?? 'unknown',
  permalink: stringValue(comment.permalink) ?? '',
  body: stringValue(comment.body),
  edited: comment.edited === true,
  reportCount: countValue(comment.numReports) ?? countValue(comment.numberOfReports) ?? 0,
});

export class DevvitRedditAdapter implements RedditAdapter {
  constructor(private readonly client: DevvitRedditClient) {}

  async getPostById(id: string): Promise<ReviewLockTarget | undefined> {
    return mapPostModel(await this.client.getPostById(id));
  }

  async getCommentById(id: string): Promise<ReviewLockTarget | undefined> {
    return mapCommentModel(await this.client.getCommentById(id));
  }

  async approveTarget(target: ReviewLockTarget): Promise<void> {
    await this.refetchModel(target).then((model) => model.approve());
  }

  async ignoreReports(target: ReviewLockTarget): Promise<void> {
    await this.refetchModel(target).then((model) => model.ignoreReports());
  }

  async unignoreReports(target: ReviewLockTarget): Promise<void> {
    await this.refetchModel(target).then((model) => model.unignoreReports());
  }

  async getCurrentUsername(): Promise<string | undefined> {
    return stringValue(await this.client.getCurrentUsername());
  }

  async getCurrentSubredditName(): Promise<string | undefined> {
    if (this.client.getCurrentSubredditName) {
      return stringValue(await this.client.getCurrentSubredditName());
    }

    return stringValue((await this.client.getCurrentSubreddit?.())?.name);
  }

  async submitDashboardPost(input: {
    subredditName: string;
    title: string;
  }): Promise<{ permalink: string }> {
    return this.client.submitCustomPost({
      subredditName: input.subredditName,
      title: input.title,
      entry: 'default',
      textFallback: {
        text: 'Open this post in Reddit to use the ReviewLock dashboard.',
      },
    });
  }

  private async refetchModel(target: ReviewLockTarget): Promise<ModeratableModel> {
    return target.kind === 'post'
      ? this.client.getPostById(target.id)
      : this.client.getCommentById(target.id);
  }
}

export class FakeRedditAdapter implements RedditAdapter {
  readonly calls: string[] = [];
  private readonly targets = new Map<string, ReviewLockTarget>();
  private readonly failures = new Map<string, string>();

  constructor(
    targets: ReviewLockTarget[] = [],
    private readonly username = 'mod_test',
    private readonly subredditName = 'alpha',
  ) {
    for (const target of targets) {
      this.targets.set(target.id, target);
    }
  }

  setTarget(target: ReviewLockTarget): void {
    this.targets.set(target.id, target);
  }

  failOperation(operation: string, message: string): void {
    this.failures.set(operation, message);
  }

  async getPostById(id: string): Promise<ReviewLockTarget | undefined> {
    const target = this.targets.get(id);
    return target?.kind === 'post' ? target : undefined;
  }

  async getCommentById(id: string): Promise<ReviewLockTarget | undefined> {
    const target = this.targets.get(id);
    return target?.kind === 'comment' ? target : undefined;
  }

  async approveTarget(target: ReviewLockTarget): Promise<void> {
    this.record('approve', target.id);
  }

  async ignoreReports(target: ReviewLockTarget): Promise<void> {
    this.record('ignoreReports', target.id);
  }

  async unignoreReports(target: ReviewLockTarget): Promise<void> {
    this.record('unignoreReports', target.id);
  }

  async getCurrentUsername(): Promise<string | undefined> {
    return this.username;
  }

  async getCurrentSubredditName(): Promise<string | undefined> {
    return this.subredditName;
  }

  async submitDashboardPost(input: {
    subredditName: string;
    title: string;
  }): Promise<{ permalink: string }> {
    this.calls.push(`submitDashboardPost:${input.subredditName}:${input.title}`);
    return { permalink: `/r/${input.subredditName}/comments/reviewlock_dashboard/` };
  }

  private record(operation: string, targetId: string): void {
    this.calls.push(`${operation}:${targetId}`);
    const failure = this.failures.get(operation);

    if (failure) {
      throw new Error(failure);
    }
  }
}

export const createRedditAdapterFromContext = (context: {
  reddit: DevvitRedditClient;
}): RedditAdapter => new DevvitRedditAdapter(context.reddit);
