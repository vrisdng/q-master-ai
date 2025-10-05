import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountSettingsProps {
  usernameInput: string;
  onUsernameChange: (value: string) => void;
  selectedAvatar: string;
  onAvatarChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
  avatarOptions: readonly { name: string; value: string }[];
}

export const AccountSettings = ({
  usernameInput,
  onUsernameChange,
  selectedAvatar,
  onAvatarChange,
  onSave,
  isSaving,
  hasChanges,
  avatarOptions,
}: AccountSettingsProps) => {
  return (
    <div className="space-y-6 rounded-lg border border-muted-foreground/10 bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={usernameInput}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="yourname"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Between 3 and 20 characters. Use lowercase letters, numbers, or underscores.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Avatar Color</Label>
        <div className="flex flex-wrap gap-4">
          {avatarOptions.map(({ name, value }) => {
            const optionValue = `color:${value}`;
            const isActive = selectedAvatar === optionValue;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onAvatarChange(optionValue)}
                className="group flex flex-col items-center gap-2 focus:outline-none"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-shadow ${isActive ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/70'}`}
                  style={{ backgroundColor: value }}
                >
                  {isActive && <Check className="h-5 w-5 text-white" />}
                </span>
                <span className="text-xs text-muted-foreground">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving || !hasChanges}
          className="gap-2"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
