export interface BaseSkill {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OwnedSkillListItem extends BaseSkill {
  type: 'owned';
  visibility: 'public' | 'internal';
}

export interface ReferencedSkillListItem extends BaseSkill {
  type: 'referenced';
  sourceRepo: string;
  sourceSkillName: string;
}

export type SkillListItem = OwnedSkillListItem | ReferencedSkillListItem;

export interface OwnedSkillDetail extends OwnedSkillListItem {
  skillMdContent: string;
  files: string[];
  installCommand: string;
}

export interface ReferencedSkillDetail extends ReferencedSkillListItem {
  sourceInstallCommand: string;
  sourceUrl: string | null;
}

export type SkillDetail = OwnedSkillDetail | ReferencedSkillDetail;

export interface ListSkillsResponse {
  items: SkillListItem[];
  total: number;
}

export interface ListTagsResponse {
  tags: string[];
}
