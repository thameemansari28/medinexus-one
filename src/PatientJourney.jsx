
import { useCallback, useEffect, useState } from "react";
import { apiRequest as api } from "./api.js";

const styles = {
  panel: { background: "var(--panel, #fff)", border: "1px solid var(--border, #e8e5f2)", borderRadius: 20, padding: 24, boxShadow: "0 12px 35px rgba(45,30,90,.06)" },
  muted: { color: "var(--muted, #77738a)", fontSize: 14, lineHeight: 1.6 },
  chip: { display: "inline-flex", padding: "6px 11px", borderRadius: 999, background: "#f0ebff", color: "#6845c5", fontSize: 12, fontWeight: 700 },
};

function getStatus(item) {
  return String(item.status || "Pending").toLowerCase();
}

function statusLabel(status) {
  if (status.includes("confirm")) return "Confirmed";
  if (status.includes("cancel")) return "Cancelled";
  if (status.includes("complete")) return "Completed";
  if (status.includes("reject")) return "Declined";
  return "Pending confirmation";
}

function statusColor(status) {
  if (status.includes("confirm") || status.includes("complete")) {
    return { background: "#e5f8ef", color: "#18794e" };
  }
  if (status.includes("cancel") || status.includes("reject")) {
    return { background: "#fff0f0", color: "#b42318" };
  }
  return { background: "#fff5df", color: "#946200" };
}

function formatDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export default function PatientJourney({ appointments: suppliedAppointments }) {
  const [appointments, setAppointments] = useState(suppliedAppointments || []);
  const [loading, setLoading] = useState(!suppliedAppointments);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/patient/appointments");
      const list = Array.isArray(result)
        ? result
        : result?.appointments || result?.items || result?.data || [];
      setAppointments(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || "Could not load your appointment history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (suppliedAppointments) {
      setAppointments(suppliedAppointments);
      setLoading(false);
      return;
    }
    void load();
  }, [suppliedAppointments, load]);

  const ordered = [...appointments].sort((a, b) => {
    const da = new Date(`${String(a.date || "").slice(0, 10)}T12:00:00`).getTime();
    const db = new Date(`${String(b.date || "").slice(0, 10)}T12:00:00`).getTime();
    return (db || 0) - (da || 0);
  });

  const confirmed = appointments.filter((item) =>
    ["confirmed", "completed"].some((word) => getStatus(item).includes(word))
  ).length;

  return (
    <section style={styles.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <span style={{ ...styles.chip }}>CARE JOURNEY</span>
          <h2 style={{ margin: "14px 0 6px", fontSize: 25, letterSpacing: "-.7px" }}>
            Your healthcare timeline
          </h2>
          <p style={{ ...styles.muted, margin: 0 }}>
            A clear view of appointment requests and their recorded status.
          </p>
        </div>
        <button type="button" className="button button-secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, margin: "24px 0" }}>
        <div style={{ background: "linear-gradient(135deg,#f4efff,#fbfaff)", borderRadius: 15, padding: 17 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#6845c5" }}>{appointments.length}</div>
          <div style={styles.muted}>Recorded requests</div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#e9fbf3,#f8fffb)", borderRadius: 15, padding: 17 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#18794e" }}>{confirmed}</div>
          <div style={styles.muted}>Confirmed or completed</div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: 14, borderRadius: 12, background: "#fff0f0", color: "#a32020", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={styles.muted}>Loading your care records…</p>
      ) : !ordered.length ? (
        <div style={{ textAlign: "center", padding: "36px 12px", background: "#faf9fd", borderRadius: 16 }}>
          <div style={{ fontSize: 34 }}>♡</div>
          <h3 style={{ marginBottom: 6 }}>Your journey starts here</h3>
          <p style={styles.muted}>No appointment records were returned by the backend yet.</p>
        </div>
      ) : (
        <div>
          {ordered.map((item, index) => {
            const status = getStatus(item);
            const hospital = item.hospitalName || item.hospital_name || item.hospital?.name || item.hospital || "Hospital not specified";
            const specialty = item.specialty || item.department || "";
            return (
              <article key={item.id || item._id || `${item.date}-${index}`} style={{ display: "grid", gridTemplateColumns: "25px minmax(0,1fr)", gap: 14, position: "relative", paddingBottom: index === ordered.length - 1 ? 0 : 24 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: status.includes("confirm") ? "#21a875" : "#8a6be0", boxShadow: "0 0 0 5px #f0ebff", zIndex: 1, marginTop: 5 }} />
                  {index !== ordered.length - 1 && <div style={{ width: 2, flex: 1, background: "#e9e3f7", minHeight: 65 }} />}
                </div>
                <div style={{ border: "1px solid #ece9f4", borderRadius: 15, padding: 17, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>{hospital}</h3>
                      <p style={{ ...styles.muted, margin: 0 }}>
                        {formatDate(item.date)}{item.time ? ` · ${item.time}` : ""}
                      </p>
                    </div>
                    <span style={{ ...statusColor(status), padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                      {statusLabel(status)}
                    </span>
                  </div>
                  {specialty && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#51466d" }}>Department: {specialty}</p>}
                  {item.reason && <p style={{ ...styles.muted, marginBottom: 0 }}>Reason: {item.reason}</p>}
                  <p style={{ ...styles.muted, marginBottom: 0, fontSize: 12 }}>
                    Status shown from the appointment record; contact the provider if you need confirmation.
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
