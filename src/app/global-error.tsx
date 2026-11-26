"use client";

/** Last-resort error boundary (renders its own <html>, so no providers/i18n). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f6f8fb", color: "#0f1b33" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>حدث خطأ غير متوقع · Something went wrong</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: 0, background: "#1e4c9a", color: "#fff", cursor: "pointer" }}>
            إعادة المحاولة · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
