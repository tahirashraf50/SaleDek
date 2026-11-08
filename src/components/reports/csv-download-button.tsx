"use client";

import { Button } from "@/components/ui/button";

type Row = Record<string, string | number>;

export function CsvDownloadButton({
  filename,
  rows,
}: {
  filename: string;
  rows: Row[];
}) {
  function download() {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: string | number) => {
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 border-slate-200 bg-white shadow-sm"
      onClick={download}
      disabled={!rows.length}
    >
      Download CSV
    </Button>
  );
}
