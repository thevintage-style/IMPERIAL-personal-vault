export type ResourceType = 'pdf' | 'link' | 'video' | 'other' | 'photo' | 'note';

export interface Folder {
  id: string;
  name: string;
  createdAt: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  createdAt: Date;
}

export interface PersonalResource {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  url: string; // Stored encrypted on Firestore, decrypted on UI (or base64 data for photos/notes)
  category: string;
  folderId?: string; // Links file/notes to a custom Folder
  createdAt: Date;
  updatedAt: Date;
  isDecrypted?: boolean; // UI tracking
}

export interface ResourceHubItem {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  url: string; // Stored encrypted on Firestore, decrypted on UI
  category: string;
  folderId?: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  isDecrypted?: boolean;
}

export const UPSCCategories = [
  { value: 'GS1', label: 'GS 1: History, Geography & Society' },
  { value: 'GS2', label: 'GS 2: Polity, Governance & IR' },
  { value: 'GS3', label: 'GS 3: Economy, Tech & Environment' },
  { value: 'GS4', label: 'GS 4: Ethics, Integrity & Aptitude' },
  { value: 'Essay', label: 'Essay Writing Papers' },
  { value: 'CSAT', label: 'CSAT & General Aptitude' },
  { value: 'CurrentAffairs', label: 'Daily Current Affairs' },
  { value: 'Syllabus', label: 'Syllabus & Strategy Guidance' },
  { value: 'Optional', label: 'Optional Subject Resources' }
] as const;
