import { useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/lib/api";
import { AVATAR_COLORS } from "../constants";
import { AccountSettings } from "./AccountSettings";

interface ProfileCardProps {
  profile: UserProfile;
  usernameInput: string;
  onUsernameChange: (value: string) => void;
  selectedAvatar: string;
  onAvatarChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
}

const initialsFromProfile = (profile: UserProfile) => {
  const base = profile.displayName ?? profile.username ?? "?";
  return base.slice(0, 2).toUpperCase();
};

export const ProfileCard = ({
  profile,
  usernameInput,
  onUsernameChange,
  selectedAvatar,
  onAvatarChange,
  onSave,
  isSaving,
  hasChanges,
}: ProfileCardProps) => {
  const [showSettings, setShowSettings] = useState(false);

  const initials = useMemo(() => initialsFromProfile(profile), [profile]);

  const avatarColor = profile.avatarUrl?.startsWith("color:")
    ? profile.avatarUrl.replace("color:", "")
    : null;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and review your study assets.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-muted-foreground/10 bg-muted/40 p-4">
        {avatarColor ? (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white shadow-soft"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
        ) : profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName ?? profile.username ?? "User avatar"}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold truncate">
            {profile.displayName ?? profile.username ?? "Anonymous"}
          </p>
          {profile.username && (
            <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
          )}
        </div>

        <Button variant="outline" onClick={() => setShowSettings((prev) => !prev)}>
          {showSettings ? "Hide Settings" : "Settings"}
        </Button>
      </div>

      {showSettings && (
        <AccountSettings
          usernameInput={usernameInput}
          onUsernameChange={onUsernameChange}
          selectedAvatar={selectedAvatar}
          onAvatarChange={onAvatarChange}
          onSave={onSave}
          isSaving={isSaving}
          hasChanges={hasChanges}
          avatarOptions={AVATAR_COLORS}
        />
      )}
    </section>
  );
};
