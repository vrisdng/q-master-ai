import type {
  ProfileDocument,
  ProfileStudySet,
  ProfileFolder,
} from "@/lib/api";

export type MappedDocument = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sourceType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  folderId: string | null;
};

export type MappedStudySet = {
  id: string;
  title: string;
  createdAt: string;
  topics: string[] | null;
  text: string;
};

export type MappedFolder = {
  id: string;
  name: string;
};

export const mapDocuments = (documents: ProfileDocument[]): MappedDocument[] =>
  documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    sourceType: doc.sourceType,
    createdAt: doc.createdAt,
    metadata: doc.metadata,
    folderId: doc.folderId,
  }));

export const mapStudySets = (studySets: ProfileStudySet[]): MappedStudySet[] =>
  studySets.map((set) => ({
    id: set.id,
    title: set.title,
    createdAt: set.createdAt,
    topics: set.topics,
    text: set.text,
  }));

export const mapFolders = (folders: ProfileFolder[]): MappedFolder[] =>
  folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
  }));

export const computeFolderCounts = (
  folders: ProfileFolder[],
  documents: ProfileDocument[],
): Map<string, number> => {
  const counts = new Map<string, number>();
  folders.forEach((folder) => counts.set(folder.id, 0));
  documents.forEach((doc) => {
    if (doc.folderId) {
      counts.set(doc.folderId, (counts.get(doc.folderId) ?? 0) + 1);
    }
  });
  return counts;
};
