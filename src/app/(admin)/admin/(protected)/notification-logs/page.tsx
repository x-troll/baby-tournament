import { prisma } from "@/lib/prisma";
import { getRecentNotifications } from "@/lib/notification-log";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Reads the in-process log (src/lib/notification-log.ts) — nothing
 * persisted, so this is empty after a restart and only ever shows what's
 * happened since. Purely a "did this actually fire" verification aid
 * for testing and event night, not a real audit trail.
 */
export default async function NotificationLogsPage() {
  const entries = getRecentNotifications();

  const chatIds = [...new Set(entries.map((e) => e.chatId))];
  const [babies, admins] = await Promise.all([
    prisma.baby.findMany({ where: { telegramChatId: { in: chatIds } }, select: { telegramChatId: true, displayName: true } }),
    prisma.admin.findMany({ where: { telegramChatId: { in: chatIds } }, select: { telegramChatId: true, name: true } }),
  ]);
  const nameByChatId = new Map<string, string>();
  for (const b of babies) if (b.telegramChatId) nameByChatId.set(b.telegramChatId, b.displayName ?? "Unnamed baby");
  for (const a of admins) if (a.telegramChatId) nameByChatId.set(a.telegramChatId, `${a.name} (admin)`);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Notification logs</h1>
      <p className="text-sm text-foreground-muted">
        Every Telegram send this server process has made, newest first — lost on restart, nothing persisted.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-foreground-muted">No sends yet.</p>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent Telegram notification sends</caption>
              <thead>
                <tr className="border-b border-border text-left text-foreground-muted">
                  <th scope="col" className="px-4 py-2">
                    Time
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Recipient
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Message
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-foreground-muted">
                      {e.timestamp.toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2">{nameByChatId.get(e.chatId) ?? e.chatId}</td>
                    <td className="max-w-md px-4 py-2">{e.text}</td>
                    <td className="px-4 py-2">
                      {e.success ? (
                        <Badge variant="mint">Sent</Badge>
                      ) : (
                        <Badge variant="danger" title={e.error}>
                          Failed
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
