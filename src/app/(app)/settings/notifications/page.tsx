"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface NotificationSettings {
  emailPostPublished: boolean;
  emailPostFailed: boolean;
  emailWeeklyDigest: boolean;
  emailTeamInvite: boolean;
  emailBillingAlerts: boolean;
  emailCommentReceived: boolean;
  inAppPostPublished: boolean;
  inAppPostFailed: boolean;
  inAppCommentReceived: boolean;
  inAppTeamActivity: boolean;
}

const defaultSettings: NotificationSettings = {
  emailPostPublished: true,
  emailPostFailed: true,
  emailWeeklyDigest: false,
  emailTeamInvite: true,
  emailBillingAlerts: true,
  emailCommentReceived: false,
  inAppPostPublished: true,
  inAppPostFailed: true,
  inAppCommentReceived: true,
  inAppTeamActivity: true,
};

interface NotificationRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function NotificationRow({ id, label, description, checked, onCheckedChange }: NotificationRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);

  function toggle(key: keyof NotificationSettings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // In a real app, POST to /api/settings/notifications
      await new Promise((r) => setTimeout(r, 600));
      return settings;
    },
    onSuccess: () => {
      toast({ title: "Preferences saved", description: "Your notification settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose how and when you want to be notified.
        </p>
      </div>

      <Separator />

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            We&apos;ll send these to your account email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <NotificationRow
            id="emailPostPublished"
            label="Post published"
            description="When your scheduled posts go live successfully."
            checked={settings.emailPostPublished}
            onCheckedChange={() => toggle("emailPostPublished")}
          />
          <NotificationRow
            id="emailPostFailed"
            label="Post failed"
            description="When a scheduled post fails to publish."
            checked={settings.emailPostFailed}
            onCheckedChange={() => toggle("emailPostFailed")}
          />
          <NotificationRow
            id="emailCommentReceived"
            label="New comments"
            description="When you receive new comments on your posts."
            checked={settings.emailCommentReceived}
            onCheckedChange={() => toggle("emailCommentReceived")}
          />
          <NotificationRow
            id="emailTeamInvite"
            label="Team invitations"
            description="When someone invites you to join a workspace."
            checked={settings.emailTeamInvite}
            onCheckedChange={() => toggle("emailTeamInvite")}
          />
          <NotificationRow
            id="emailBillingAlerts"
            label="Billing alerts"
            description="Payment failures, subscription changes, and receipts."
            checked={settings.emailBillingAlerts}
            onCheckedChange={() => toggle("emailBillingAlerts")}
          />
          <NotificationRow
            id="emailWeeklyDigest"
            label="Weekly digest"
            description="A summary of your account activity every Monday."
            checked={settings.emailWeeklyDigest}
            onCheckedChange={() => toggle("emailWeeklyDigest")}
          />
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>In-App Notifications</CardTitle>
          <CardDescription>
            Shown in the notification bell inside the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <NotificationRow
            id="inAppPostPublished"
            label="Post published"
            description="Confirm when posts go live."
            checked={settings.inAppPostPublished}
            onCheckedChange={() => toggle("inAppPostPublished")}
          />
          <NotificationRow
            id="inAppPostFailed"
            label="Post failed"
            description="Alert when a post fails to publish."
            checked={settings.inAppPostFailed}
            onCheckedChange={() => toggle("inAppPostFailed")}
          />
          <NotificationRow
            id="inAppCommentReceived"
            label="New comments"
            description="Notify when new comments arrive in your inbox."
            checked={settings.inAppCommentReceived}
            onCheckedChange={() => toggle("inAppCommentReceived")}
          />
          <NotificationRow
            id="inAppTeamActivity"
            label="Team activity"
            description="When teammates post, approve, or make changes."
            checked={settings.inAppTeamActivity}
            onCheckedChange={() => toggle("inAppTeamActivity")}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
