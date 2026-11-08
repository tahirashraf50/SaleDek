import { Mail, MessageCircle, Phone, Globe, TicketPlus, ShoppingBag, Send } from "lucide-react";

const channels = [
  { key: "wa", Icon: MessageCircle, active: true, unread: 2 },
  { key: "mail", Icon: Mail, active: false, unread: 1 },
  { key: "call", Icon: Phone, active: false, unread: 0 },
  { key: "portal", Icon: Globe, active: false, unread: 0 },
] as const;

const threads = [
  {
    initials: "A",
    name: "Ayesha Khan",
    preview: "Router still offline after visit…",
    time: "2:41 PM",
    unread: 2,
    active: true,
    color: "bg-emerald-500",
  },
  {
    initials: "B",
    name: "Bilal Traders",
    preview: "Quote for 12 POS terminals",
    time: "1:58 PM",
    unread: 0,
    active: false,
    color: "bg-sky-500",
  },
  {
    initials: "S",
    name: "Sara Malik",
    preview: "Missed — callback requested",
    time: "12:10 PM",
    unread: 0,
    active: false,
    color: "bg-amber-500",
  },
];

export function InboxPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_28px_80px_-24px_rgba(11,31,28,0.45)]">
      {/* Scale full desktop mock on narrow viewports; clamp outer height so gaps don't appear */}
      <div className="h-[343px] overflow-hidden sm:h-[396px] md:h-auto">
      <div className="origin-top-left scale-[0.78] sm:scale-[0.9] md:scale-100 w-[128.2%] sm:w-[111.1%] md:w-full">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-slate-400 ring-1 ring-slate-200/80">
            app.pulsecrm.com/inbox
          </div>
        </div>

        <div className="flex h-[400px]" aria-hidden="true">
          <div className="flex w-14 shrink-0 flex-col items-center gap-2 bg-slate-950 py-3">
            {channels.map(({ key, Icon, active, unread }) => (
              <div
                key={key}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${
                  active ? "bg-teal-600 text-white" : "text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-medium text-white">
                    {unread}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex w-[236px] shrink-0 flex-col border-r border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-3.5 py-3">
              <p className="text-sm font-semibold text-slate-900">WhatsApp</p>
              <p className="text-[11px] text-slate-500">3 conversations</p>
            </div>
            <div className="flex-1">
              {threads.map((t) => (
                <div
                  key={t.name}
                  className={`flex gap-2.5 border-b border-slate-100 px-3 py-2.5 ${
                    t.active ? "border-l-2 border-l-teal-600 bg-white" : ""
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${t.color}`}
                  >
                    {t.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[13px] font-medium text-slate-900">{t.name}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">{t.time}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <p className="truncate text-[11px] text-slate-500">{t.preview}</p>
                      {t.unread > 0 && (
                        <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-teal-600 px-1 text-[9px] font-semibold text-white">
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-[#efeae2]">
            <div className="flex items-center gap-3 border-b border-slate-200/80 bg-[#f0f2f5] px-3.5 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                A
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">Ayesha Khan</p>
                <p className="truncate text-[11px] text-slate-500">+92 300 555 0142 · online</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200/80">
                  <TicketPlus className="h-3 w-3" />
                  #1042 open
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
                  <ShoppingBag className="h-3 w-3" />
                  Sale
                </span>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col gap-2.5 overflow-hidden px-5 py-4">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                }}
              />

              <div className="relative mx-auto rounded-md bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">
                Today
              </div>

              <div className="relative max-w-[78%] self-start rounded-lg rounded-tl-sm bg-white px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-sm">
                Technician left but fiber light is still red. Can someone check?
                <span className="mt-1 block text-right text-[10px] text-slate-400">2:38 PM</span>
              </div>

              <div className="relative max-w-[78%] self-end rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-sm">
                Logging a complaint and assigning field ops — hang tight.
                <span className="mt-1 block text-right text-[10px] text-slate-500">2:41 PM</span>
              </div>

              <div className="relative mt-1 flex flex-wrap justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">
                  <TicketPlus className="h-3.5 w-3.5" />
                  Convert to ticket
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Convert to sale
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200/80 bg-[#f0f2f5] px-3 py-2.5">
              <div className="flex flex-1 items-center rounded-full bg-white px-3.5 py-2 text-[12px] text-slate-400 shadow-sm">
                Type a message
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
                <Send className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
