import type { ReviewLockTarget } from '../../shared/schema';

export interface RedditAdapter {
  getPostById(id: string): Promise<ReviewLockTarget | undefined>;
  getCommentById(id: string): Promise<ReviewLockTarget | undefined>;
  approveTarget(target: ReviewLockTarget): Promise<void>;
  ignoreReports(target: ReviewLockTarget): Promise<void>;
  unignoreReports(target: ReviewLockTarget): Promise<void>;
  getCurrentUsername(): Promise<string | undefined>;
}

interface ModeratableModel {
  id: string;
  title?: string;
  body?: string;
  url?: string;
  edited?: boolean;
  ignoringReports?: boolean;
  numberOfReports?: number;
  numReports?: number;
  userReportReasons?: string[];
  modReportReasons?: string[];
  permalink?: string;
  subredditName?: string;
  authorName?: string;
  postId?: string;
  parentId?: string;
  linkFlair?: { text?: string; templateId?: string };
  isNsfw?: boolean;
  isSpoiler?: boolean;
  approve(): Promise<void>;
  ignoreReports(): Promise<void>;
  unignoreReports(): Promise<void>;
}

interface DevvitRedditClient {
  getPostById(id: string): Promise<ModeratableModel>;
  getCommentById(id: string): Promise<ModeratableModel>;
  getCurrentUsername(): Promise<string | undefined>;
}

const normalizeThingId = (kind: 'post' | 'comment', id: string): string => {
  if (id.startsWith('t1_') || id.startsWith('t3_')) {
    return id;
  }

  return kind === 'post' ? `t3_${id}` : `t1_${id}`;
};

export const mapPostModel = (post: ModeratableModel): ReviewLockTarget => ({
  id: normalizeThingId('post', post.id),
  kind: 'post',
  subreddit: post.subredditName ?? 'unknown',
  authorName: post.authorName ?? 'unknown',
  permalink: post.permalink ?? '',
  title: post.title,
  body: post.body,
  url: post.url,
  flairText: post.linkFlair?.text,
  flairTemplateId: post.linkFlair?.templateId,
  isNsfw: post.isNsfw,
  isSpoiler: post.isSpoiler,
  edited: post.edited === true,
  reportCount: post.numberOfReports ?? 0,
});

export const mapCommentModel = (comment: ModeratableModel): ReviewLockTarget => ({
  id: normalizeThingId('comment', comment.id),
  kind: 'comment',
  subreddit: comment.subredditName ?? 'unknown',
  authorName: comment.authorName ?? 'unknown',
  permalink: comment.permalink ?? '',
  body: comment.body,
  edited: comment.edited === true,
  reportCount: comment.numReports ?? comment.numberOfReports ?? 0,
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
    return this.client.getCurrentUsername();
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

  constructor(targets: ReviewLockTarget[] = [], private readonly username = 'mod_test') {
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

  private record(operation: string, targetId: string): void {
    this.calls.push(`${operation}:${targetId}`);
    const failure = this.failures.get(operation);

    if (failure) {
      throw new Error(failure);
    }
  }
}

export const createRedditAdapterFromContext = (context: { reddit: DevvitRedditClient }): RedditAdapter =>
  new DevvitRedditAdapter(context.reddit);
