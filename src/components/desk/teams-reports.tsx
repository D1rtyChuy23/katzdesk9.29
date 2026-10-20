import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { PRODUCERS } from "@/lib/ops/rep-match";
import { DEFAULT_TECHS } from "@/lib/ops/tech-match";
import {
  addTeamsChat,
  approveTeamsChat,
  removeTeamsChat,
  teamsChatBoard,
  updateTeamsChat,
  type NewTeamsChat,
  type TeamsChatCard,
} from "@/lib/ops/teams-reports";

const FEEDS: { value: string; label: string }[] = [
  { value: "service", label: "Service tracker" },
  { value: "orders", label: "Purchase orders" },
  { value: "rep", label: "A rep's customers" },
  { value: "region", label: "A region" },
  { value: "leadership", label: "K Team counts" },
  { value: "tech", label: "A tech's open calls" },
  { value: "none", label: "Nothing automatic" },
];

/** Suggestions for the rep and tech name boxes. Chelsea and Iliana have rep chats but are not on the rep list. */
const PEOPLE: Record<string, string[]> = {
  rep: [...PRODUCERS, "Chelsea", "Iliana"],
  tech: DEFAULT_TECHS.filter((t) => t !== "3rd Party"),
};

type ChatForm = NewTeamsChat & { id?: string };

const BLANK: ChatForm = { name: "", group: "", kind: "group", about: "", feed: "service", target: "" };

/**
 * The exact note for each group chat and DM. Approving stores that text.
 * Nothing is posted from here.
 */
export function TeamsMorningPanel({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const board = useQuery({ queryKey: ["teams-chats"], queryFn: () => teamsChatBoard(), enabled });
  const [picked, setPicked] = useState<string>("big-tymers");
  const approve = useMutation({
    mutationFn: (card: TeamsChatCard) => approveTeamsChat({ data: { chat: card.id, text: card.text } }),
    onSuccess: (r) => {
      toast.success(`Approved for ${r.name}. Nothing was posted.`);
      void qc.invalidateQueries({ queryKey: ["teams-chats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });
  const [form, setForm] = useState<ChatForm | null>(null);
  const save = useMutation({
    mutationFn: ({ id, ...chat }: ChatForm) => (id ? updateTeamsChat({ data: { ...chat, id } }) : addTeamsChat({ data: chat })),
    onSuccess: (r, chat) => {
      toast.success(`${chat.id ? "Saved" : "Added"} ${r.name}. Nothing was posted.`);
      setForm(null);
      setPicked(r.id);
      void qc.invalidateQueries({ queryKey: ["teams-chats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the chat"),
  });
  const remove = useMutation({
    mutationFn: (card: TeamsChatCard) => removeTeamsChat({ data: { id: card.id } }),
    onSuccess: (r) => {
      toast.success(`Removed ${r.name}.`);
      void qc.invalidateQueries({ queryKey: ["teams-chats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the chat"),
  });
  if (!enabled) return null;
  const cards = board.data ?? [];
  const groups = [...new Set(cards.map((c) => c.group))];
  const current = cards.find((c) => c.id === picked) ?? cards[0];
  const needs = form?.feed === "rep" ? "Rep name" : form?.feed === "tech" ? "Tech name" : null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-soft" data-testid="teams-chats">
      <h2 className="font-display text-xl font-medium tracking-tight">Teams chats</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Group chats and DMs. Read the exact text, then approve it. KatzDesk does not post. The Teams login sends only the text you approved.
      </p>
      {board.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Reading the desk…</p> : null}
      {board.isError ? (
        <p className="mt-4 text-sm text-destructive">{board.error instanceof Error ? board.error.message : "Could not read the chats."}</p>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {groups.map((group) => (
            <div key={group}>
              <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</p>
              <ul className="mt-1">
                {cards.filter((c) => c.group === group).map((chat) => {
                  const on = current?.id === chat.id;
                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(chat.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${on ? "bg-secondary font-medium" : "hover:bg-muted"}`}
                        data-testid={`teams-chat-${chat.id}`}
                      >
                        <span className="truncate">{chat.name}</span>
                        {chat.approved ? <Check className="size-3.5 shrink-0 text-primary" aria-label="Approved" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {form ? null : (
            <Button type="button" size="sm" variant="outline" onClick={() => setForm(BLANK)} data-testid="teams-add-open">
              <Plus className="size-4" />
              Add chat
            </Button>
          )}
        </div>
        {form ? (
          <form
            className="grid min-w-0 content-start gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
            data-testid="teams-add-form"
          >
            <p className="text-sm font-medium sm:col-span-2">{form.id ? "Edit chat" : "Add a chat"}</p>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chat name" aria-label="Chat name" />
            <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="Group" aria-label="Group" list="teams-groups" />
            <datalist id="teams-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <SelectField value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Group chat or DM">
              <option value="group">Group chat</option>
              <option value="dm">DM</option>
            </SelectField>
            <SelectField
              value={form.feed}
              onChange={(e) => setForm({ ...form, feed: e.target.value, target: e.target.value === "region" ? "dfw" : "" })}
              aria-label="What it shows"
            >
              {FEEDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </SelectField>
            {needs ? (
              <>
                <Input
                  value={form.target ?? ""}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                  placeholder={needs}
                  aria-label={needs}
                  list="teams-people"
                />
                <datalist id="teams-people">
                  {(PEOPLE[form.feed] ?? []).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </>
            ) : null}
            {form.feed === "region" ? (
              <SelectField value={form.target ?? "dfw"} onChange={(e) => setForm({ ...form, target: e.target.value })} aria-label="Region">
                <option value="dfw">DFW</option>
                <option value="sa-atx">SA/ATX</option>
                <option value="other">Other (no tech yet)</option>
              </SelectField>
            ) : null}
            <Input
              value={form.about ?? ""}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              placeholder="About (optional)"
              aria-label="About"
              maxLength={200}
              className="sm:col-span-2"
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={save.isPending} data-testid="teams-add-save">
                {save.isPending ? "Saving…" : form.id ? "Save changes" : "Add chat"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : current ? (
          <div className="min-w-0">
            <p className="text-sm font-medium">{current.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{current.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{current.about}</p>
            {current.feed === "none" ? (
              <p className="mt-3 text-sm text-muted-foreground" data-testid="teams-chat-none">
                No automatic note for this chat.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  {current.approved ? `Approved${current.approvedBy ? ` by ${current.approvedBy}` : ""}` : "Not approved"}
                </p>
                <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap" data-testid="teams-chat-text">
                  {current.text}
                </pre>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {current.feed === "none" ? null : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={approve.isPending || current.approved}
                    onClick={() => approve.mutate(current)}
                    data-testid="teams-approve"
                  >
                    {current.approved ? "Approved" : approve.isPending ? "Saving…" : "Approve this exact text"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(current.text).then(
                        () => toast.success("Copied"),
                        () => toast.error("Could not copy"),
                      );
                    }}
                    data-testid="teams-copy"
                  >
                    <Copy className="size-4" />
                    Copy
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    id: current.id,
                    name: current.name,
                    group: current.group,
                    kind: current.kind,
                    about: current.about,
                    feed: current.feed,
                    target: current.target ?? "",
                  })
                }
                data-testid="teams-edit"
              >
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Remove ${current.name}? Its approved notes stay in the history.`)) remove.mutate(current);
                }}
                data-testid="teams-remove"
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
