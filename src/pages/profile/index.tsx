import { useProfile } from "@/hooks/use-profile";

const ProfileInfo = ({
  username,
  displayName,
  avatarUrl,
}: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}) => {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-muted-foreground/10 bg-muted/40 p-4">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName ?? username ?? "User avatar"}
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
          {(displayName ?? username ?? "?").slice(0, 2).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-lg font-semibold">{displayName ?? username ?? "Anonymous"}</p>
        {username && <p className="text-sm text-muted-foreground">@{username}</p>}
      </div>
    </div>
  );
};

const DocumentList = ({
  documents,
}: {
  documents: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: string;
  }[];
}) => {
  if (!documents.length) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {documents.map((doc) => (
        <li key={doc.id} className="rounded-lg border border-muted-foreground/10 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{doc.title}</p>
              {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">
              {doc.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Uploaded {new Date(doc.createdAt).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
};

const StudySetList = ({
  studySets,
}: {
  studySets: {
    id: string;
    title: string;
    createdAt: string;
    topics: string[] | null;
  }[];
}) => {
  if (!studySets.length) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
        No question sets created yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {studySets.map((set) => (
        <li key={set.id} className="rounded-lg border border-muted-foreground/10 bg-card p-4 shadow-sm">
          <p className="font-medium">{set.title}</p>
          <p className="text-xs text-muted-foreground">Created {new Date(set.createdAt).toLocaleString()}</p>
          {set.topics && set.topics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {set.topics.map((topic) => (
                <span key={topic} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {topic}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

export const ProfilePage = () => {
  const { profile, documents, studySets, isLoading, error, reload } = useProfile();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <p className="text-sm text-destructive">Failed to load profile: {error.message}</p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <p className="text-sm text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <section>
        <h1 className="text-2xl font-bold">Your Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account and review your study assets.</p>
        <div className="mt-4">
          <ProfileInfo
            username={profile.username}
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Documents</h2>
          <button
            type="button"
            onClick={reload}
            className="text-sm font-medium text-primary hover:underline"
          >
            Refresh
          </button>
        </div>
        <DocumentList
          documents={documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            status: doc.status,
            createdAt: doc.createdAt,
          }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Question Sets</h2>
        <StudySetList
          studySets={studySets.map((set) => ({
            id: set.id,
            title: set.title,
            createdAt: set.createdAt,
            topics: set.topics,
          }))}
        />
      </section>
    </div>
  );
};

export default ProfilePage;
