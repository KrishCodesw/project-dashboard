import { supportService } from "@/lib/support/SupportService";
import { requireCoeUser } from "@/lib/coe-guard";
import { TicketHeader } from "../../_components/TicketHeader";
import { MessageThread } from "../../_components/MessageThread";
import { ReplyForm } from "./reply-form";

export default async function TicketDetailPage({ params }: { params: Promise<{ chatwootId: string }> }) {
  const { chatwootId: chatwootIdStr } = await params;
  const user = await requireCoeUser();
  const chatwootId = parseInt(chatwootIdStr);
  const { ticket, messages } = await supportService.getTicketDetail(user, chatwootId);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <TicketHeader ticket={ticket} />
      <MessageThread messages={messages} />
      <ReplyForm chatwootId={chatwootId} />
    </div>
  );
}
