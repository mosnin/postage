"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { InviteMemberForm } from "@/components/team/invite-member-form";

interface InviteMemberTriggerProps {
  workspaceId: string;
}

export function InviteMemberTrigger({ workspaceId }: InviteMemberTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite Member
      </Button>
      <InviteMemberForm
        workspaceId={workspaceId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
