import { HDU_SKILLS_EVENT_SLUG } from '../apps/api/src/services/contest-service';
import { syncEventSubmissionExternalTag } from '../apps/api/src/services/publishable-external-tag-service';

const HDU_CONTEST_TAG = '杭电竞赛';

const result = await syncEventSubmissionExternalTag({
  eventSlug: HDU_SKILLS_EVENT_SLUG,
  tag: HDU_CONTEST_TAG,
  sourceId: HDU_SKILLS_EVENT_SLUG,
});

console.log(
  `[external-tags] 已同步 ${result.count} 个参赛 Skill：tag=${result.tag}, source=${result.sourceType}:${result.sourceId}`,
);
