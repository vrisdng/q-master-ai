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
  folderId: string | null;
  labelText: string | null;
  labelColor: string | null;
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
    folderId: set.folderId,
    labelText: set.labelText,
    labelColor: set.labelColor,
  }));

export const mapFolders = (folders: ProfileFolder[]): MappedFolder[] =>
  folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
  }));

export const computeFolderCounts = (
  folders: ProfileFolder[],
  documents: ProfileDocument[],
  studySets: ProfileStudySet[],
): Map<string, { documents: number; studySets: number }> => {
  const counts = new Map<string, { documents: number; studySets: number }>();

  folders.forEach((folder) =>
    counts.set(folder.id, {
      documents: 0,
      studySets: 0,
    }),
  );

  documents.forEach((doc) => {
    if (doc.folderId && counts.has(doc.folderId)) {
      const value = counts.get(doc.folderId)!;
      value.documents += 1;
    }
  });

  studySets.forEach((set) => {
    if (set.folderId && counts.has(set.folderId)) {
      const value = counts.get(set.folderId)!;
      value.studySets += 1;
    }
  });

  return counts;
};
