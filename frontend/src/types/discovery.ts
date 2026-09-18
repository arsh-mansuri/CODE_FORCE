export interface LifestyleChipData {
  icon: string;
  label: string;
  isBudget?: boolean;
}

export interface PromptCardData {
  id: string;
  label: string;
  text: string;
}

export interface PhotoCardData {
  id: string;
  url: string;
  tag: string;
  aspectRatio?: 'portrait' | 'landscape';
}

export interface BentoInfoData {
  desiredArea: {
    title: string;
    subtitle: string;
  };
  moveInDate: {
    title: string;
    subtitle: string;
  };
}

export interface DiscoveryCandidate {
  id: string;
  name: string;
  age: number;
  verified: boolean;
  subtitle: string;
  locationCity: string;
  locationArea: string;
  matchScore: number;
  chips: LifestyleChipData[];
  photos: PhotoCardData[];
  prompts: PromptCardData[];
  bento: BentoInfoData;
}
