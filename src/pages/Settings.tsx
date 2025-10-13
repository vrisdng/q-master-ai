import { useMemo } from "react";
import { ShieldCheck, UserCog } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const SettingsPage = () => {
  const { user, isGuest, signOut } = useAuth();

  const email = useMemo(() => user?.email ?? "Unknown user", [user]);
  const isUsingGuestAccount = useMemo(() => Boolean(isGuest), [isGuest]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 md:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account preferences and security.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <UserCog className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-lg">Account</CardTitle>
              <CardDescription>
                Review the details associated with your Q-Master workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Email address</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          {isUsingGuestAccount ? (
            <div className="rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              You are currently using a guest account. Create a full account from the profile page to unlock additional
              features and preservation of your progress.
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100">
              Your account is active. Keep your profile details up to date for the best experience.
            </div>
          )}
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-muted p-2 text-muted-foreground">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-lg">Privacy &amp; security</CardTitle>
              <CardDescription>
                We’re committed to keeping your study materials safe and private.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Q-Master AI encrypts your uploaded content and only uses it to generate study materials on your behalf. We
            never sell your data or share it with third parties without your consent.
          </p>
          <p>
            Stay tuned as we expose additional controls for deleting documents, exporting run history, and configuring
            notification preferences.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;

