// THROWAWAY: three learning-plan UI hypotheses; all actions mutate local fixtures only.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { DAYOVA_DESIGN_SYSTEM } from "../../../lib/design-system";
import "./prototype.css";

const variants = {
	A: {
		name: "Agenda",
		description:
			"Eine zeitliche Reihenfolge. Auch die Vorschau behält einen sichtbaren Termin.",
		question: "Ist klar, warum die Zusatzübung jetzt zuerst kommt?",
		tradeoff:
			"Mehr Kalenderklarheit, aber Vorschautermine müssen beim Verschieben mitgezogen werden.",
	},
	B: {
		name: "Fokus",
		description:
			"Ein nächster Termin. Was danach fachlich folgt, bleibt zunächst ohne Datum.",
		question:
			"Reicht ein Ausblick ohne festen Termin, oder fehlt dir Planungssicherheit?",
		tradeoff:
			"Weniger scheinbar feste Versprechen. Dafür bleibt die weitere Woche weniger konkret.",
	},
	C: {
		name: "Wochenplan",
		description:
			"Die Woche steht im Mittelpunkt. Änderungen werden vor dem Speichern verglichen.",
		question:
			"Hilft der Wochenkontext beim Verschieben, oder wird er zu dicht?",
		tradeoff:
			"Zusammenhänge sind direkt sichtbar. Der nächste Start bekommt weniger Raum.",
	},
};
const dayNames = {
	21: "Mo",
	22: "Di",
	23: "Mi",
	24: "Do",
	25: "Fr",
	26: "Sa",
	27: "So",
	28: "Mo",
	29: "Di",
};
const dayLabel = (day) =>
	day == null
		? "Noch ohne Termin"
		: `${dayNames[day] ?? ""}, ${day}. September`;
const when = (s) =>
	s.day == null
		? "Nach deinem nächsten Lernschritt"
		: `${dayLabel(s.day)} · ${s.time} Uhr`;
const ordered = (sessions) =>
	[...sessions].sort(
		(a, b) => (a.day ?? 999) - (b.day ?? 999) || a.time.localeCompare(b.time),
	);
function fixture(variant, scenario, dependent) {
	const sessions = [
		{
			id: "A",
			title: "Gleichungen verstehen",
			kind: "Theorie",
			day: 22,
			time: "17:00",
			minutes: 20,
			planning: "committed",
			content: "ready",
			done: false,
			after: null,
		},
		{
			id: "B",
			title: "Gleichungen anwenden",
			kind: "Üben",
			day: variant === "B" ? null : 23,
			time: "17:00",
			minutes: 20,
			planning: "provisional",
			content: "none",
			done: false,
			after: "A",
		},
		{
			id: "C",
			title: dependent ? "Gleichungen vertiefen" : "Bruchrechnung auffrischen",
			kind: "Zusatzübung",
			day: 24,
			time: "17:00",
			minutes: 15,
			planning: "committed",
			content: "ready",
			done: false,
			after: dependent ? "A" : null,
		},
	];
	if (scenario === "moved") {
		sessions[0].day = 25;
		sessions[1].day = variant === "B" ? null : 26;
		if (dependent) {
			sessions[2].day = 26;
			sessions[2].time = "18:00";
		}
	}
	if (scenario === "failed") sessions[0].content = "failed";
	if (scenario === "preview") return [sessions[1]];
	if (scenario === "empty") return [];
	return sessions;
}
function pickNext(sessions, today) {
	const possible = ordered(
		sessions.filter(
			(s) =>
				!s.done &&
				s.planning === "committed" &&
				(!s.after || sessions.some((p) => p.id === s.after && p.done)),
		),
	);
	return possible.find((s) => s.day >= today) ?? possible[0];
}
function PrototypeSwitcher({ variant, onChange }) {
	useEffect(() => {
		const key = (e) => {
			if (
				e.target.closest(
					'input,textarea,select,[contenteditable="true"],dialog',
				)
			)
				return;
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.preventDefault();
				onChange(e.key === "ArrowLeft" ? -1 : 1);
			}
		};
		window.addEventListener("keydown", key);
		return () => window.removeEventListener("keydown", key);
	}, [onChange]);
	if (!import.meta.env.DEV) return null;
	return (
		<nav className="switcher" aria-label="Prototyp wechseln">
			<button
				type="button"
				onClick={() => onChange(-1)}
				aria-label="Vorherige Variante"
			>
				←
			</button>
			<span>
				<small>EXPERIMENT</small>
				<strong>
					{variant} · {variants[variant].name}
				</strong>
			</span>
			<button
				type="button"
				onClick={() => onChange(1)}
				aria-label="Nächste Variante"
			>
				→
			</button>
		</nav>
	);
}
function Modal({ title, onClose, children }) {
	const ref = useRef(null);
	useEffect(() => {
		const dialog = ref.current;
		dialog.showModal();
		return () => dialog.close();
	}, []);
	return (
		<dialog
			ref={ref}
			aria-labelledby="dialog-title"
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
		>
			<div className="sheet-head">
				<span className="eyebrow">Lernplan</span>
				<button
					type="button"
					className="quiet"
					onClick={onClose}
					aria-label="Dialog schließen"
				>
					Schließen
				</button>
			</div>
			<h2 id="dialog-title">{title}</h2>
			{children}
		</dialog>
	);
}
function SessionRow({ session, onMove, next, blocked }) {
	return (
		<article
			className={`session-row ${session.planning === "provisional" ? "preview" : ""} ${next ? "is-next" : ""}`}
		>
			<div
				className={`session-marker ${session.kind === "Theorie" ? "theory" : ""}`}
			>
				{session.done
					? "✓"
					: session.planning === "provisional"
						? "…"
						: session.kind === "Theorie"
							? "T"
							: "Ü"}
			</div>
			<div className="row-copy">
				<span className="meta">
					{session.done
						? "Abgeschlossen"
						: session.planning === "provisional"
							? "Vorschau"
							: session.kind}
					{next ? " · Als Nächstes" : ""}
				</span>
				<h3>{session.title}</h3>
				<p>
					{when(session)} · {session.minutes} Min.
				</p>
				{session.planning === "provisional" && (
					<p className="muted">Passt sich nach deinen Ergebnissen an.</p>
				)}
				{blocked && (
					<p className="muted">Baut auf „Gleichungen verstehen“ auf.</p>
				)}
				{session.id === "A" && !session.done && (
					<button type="button" className="text-button" onClick={onMove}>
						Termin verschieben
					</button>
				)}
			</div>
		</article>
	);
}
function StartButton({ session, onStart, onPrepare, today }) {
	if (session.content === "failed")
		return (
			<>
				<p className="notice warning">
					Die Inhalte konnten nicht vorbereitet werden.
				</p>
				<button
					type="button"
					className="primary"
					onClick={() => onPrepare(session.id)}
				>
					Erneut vorbereiten
				</button>
			</>
		);
	if (session.content === "preparing")
		return (
			<>
				<p className="notice">Deine Inhalte werden vorbereitet.</p>
				<button
					type="button"
					className="secondary"
					onClick={() => onPrepare(session.id)}
				>
					Demo: Vorbereitung abschließen
				</button>
			</>
		);
	return (
		<button type="button" className="primary" onClick={() => onStart(session)}>
			{session.day < today ? "Jetzt nachholen" : "Lernsession starten"}{" "}
			<span aria-hidden="true">→</span>
		</button>
	);
}
function Empty({ sessions }) {
	return (
		<div className="empty">
			<div className="empty-symbol" aria-hidden="true">
				{sessions.length ? "…" : "✓"}
			</div>
			<h2>
				{sessions.some((s) => !s.done)
					? "Dein nächster Schritt ist noch offen"
					: sessions.length
						? "Für jetzt geschafft"
						: "Noch keine Lerntermine"}
			</h2>
			<p>
				{sessions.some((s) => !s.done)
					? "Die Vorschau ist noch keine startbare Session. Dein nächster Lernschritt muss zuerst festgelegt werden."
					: sessions.length
						? "Deine geplanten Sessions sind abgeschlossen."
						: "Hier erscheinen deine nächsten Lerntermine, sobald ein Plan vorliegt."}
			</p>
		</div>
	);
}
function VariantA({ sessions, next, today, onMove, onStart, onPrepare }) {
	return (
		<>
			<div className="intro">
				<span className="eyebrow">Mathematik · Prüfung am 30. September</span>
				<h1>Dein Lernplan</h1>
				<p>Ein Termin nach dem anderen.</p>
			</div>
			{next ? (
				<section className="next-banner">
					<div>
						<span className="meta">
							{next.day < today ? "Zum Nachholen" : "Dein nächster Termin"}
						</span>
						<h2>{next.title}</h2>
						<p>{when(next)}</p>
					</div>
					<StartButton {...{ session: next, onStart, onPrepare, today }} />
				</section>
			) : (
				<Empty sessions={sessions} />
			)}
			<h2 className="section-heading">Geplante Reihenfolge</h2>
			<div className="agenda">
				{ordered(sessions.filter((s) => !s.done)).map((s) => (
					<SessionRow
						key={s.id}
						session={s}
						next={s.id === next?.id}
						onMove={onMove}
						blocked={
							s.after &&
							s.planning === "committed" &&
							!sessions.some((p) => p.id === s.after && p.done)
						}
					/>
				))}
			</div>
			{sessions.some((s) => s.done) && (
				<p className="history">
					✓ {sessions.filter((s) => s.done).length} Session abgeschlossen
				</p>
			)}
		</>
	);
}
function VariantB({ sessions, next, today, onMove, onStart, onPrepare }) {
	const preview = sessions.find((s) => s.planning === "provisional" && !s.done);
	return (
		<>
			<div className="intro">
				<span className="eyebrow">Mathematik · Dein Lernplan</span>
				<h1>Dein nächster Termin</h1>
				<p>Der erste verfügbare Schritt in deinem Kalender.</p>
			</div>
			{next ? (
				<section className="focus-card">
					<span
						className={`badge ${next.kind === "Theorie" ? "theory-badge" : ""}`}
					>
						{next.kind} · {next.minutes} Min.
					</span>
					<h2>{next.title}</h2>
					<p className="focus-date">{when(next)}</p>
					<p>
						{next.id === "C"
							? "Eine zusätzliche Übung in deinem gewählten Zeitfenster."
							: "Ein Beispiel verstehen und die nächsten Aufgaben sicher angehen."}
					</p>
					<StartButton {...{ session: next, onStart, onPrepare, today }} />
					{next.id === "A" && (
						<button type="button" className="text-button" onClick={onMove}>
							Termin verschieben
						</button>
					)}
				</section>
			) : (
				<Empty sessions={sessions} />
			)}
			<h2 className="section-heading">Weitere Termine</h2>
			{ordered(
				sessions.filter(
					(s) => !s.done && s.planning === "committed" && s.id !== next?.id,
				),
			).map((s) => (
				<SessionRow
					key={s.id}
					session={s}
					onMove={onMove}
					blocked={s.after && !sessions.some((p) => p.id === s.after && p.done)}
				/>
			))}
			{preview && (
				<section className="outlook">
					<span className="meta">Ausblick · noch ohne Termin</span>
					<h3>{preview.title}</h3>
					<p>
						Nach „
						{sessions.find((s) => s.id === preview.after)?.title ??
							"deinem nächsten Lernschritt"}
						“. Der genaue Inhalt hängt von deinen Ergebnissen ab.
					</p>
				</section>
			)}
		</>
	);
}
function VariantC({ sessions, next, today, onMove, onStart, onPrepare }) {
	const days = [
		...new Set([
			21,
			22,
			23,
			24,
			25,
			26,
			27,
			...sessions.map((s) => s.day).filter(Boolean),
		]),
	].sort((a, b) => a - b);
	return (
		<>
			<div className="intro">
				<span className="eyebrow">Mathematik · Prüfung am 30. September</span>
				<h1>Deine Lernwoche</h1>
				<p>21.–27. September</p>
			</div>
			<div className="week-strip">
				{days.slice(0, 7).map((d) => (
					<div
						key={d}
						className={`${d === today ? "today" : ""} ${sessions.some((s) => s.day === d && !s.done) ? "occupied" : ""}`}
					>
						<span>{dayNames[d]}</span>
						<strong>{d}</strong>
						<span aria-hidden="true">
							{sessions.some((s) => s.day === d && !s.done) ? "•" : "·"}
						</span>
					</div>
				))}
			</div>
			{next && (
				<div className="week-next">
					<span className="meta">Nächster Start · {when(next)}</span>
					<h2>{next.title}</h2>
					<StartButton {...{ session: next, onStart, onPrepare, today }} />
				</div>
			)}
			{!next && <Empty sessions={sessions} />}
			<div className="week-agenda">
				{days
					.filter((d) => sessions.some((s) => s.day === d && !s.done))
					.map((d) => (
						<section key={d} className="day-group">
							<div className="day-label">
								<strong>{dayNames[d]}</strong>
								<span>{d}.</span>
							</div>
							<div>
								{ordered(sessions.filter((s) => s.day === d && !s.done)).map(
									(s) => (
										<SessionRow
											key={s.id}
											session={s}
											next={s.id === next?.id}
											onMove={onMove}
											blocked={
												s.after &&
												s.planning === "committed" &&
												!sessions.some((p) => p.id === s.after && p.done)
											}
										/>
									),
								)}
							</div>
						</section>
					))}
			</div>
		</>
	);
}
function App() {
	const initial = new URLSearchParams(window.location.search).get("variant");
	const [variant, setVariant] = useState(variants[initial] ? initial : "A");
	const [scenario, setScenario] = useState("initial");
	const [dependent, setDependent] = useState(false);
	const [sessions, setSessions] = useState(() =>
		fixture(variants[initial] ? initial : "A", "initial", false),
	);
	const [notice, setNotice] = useState("");
	const [modal, setModal] = useState(null);
	const [targetDay, setTargetDay] = useState(25);
	const [resolution, setResolution] = useState("move");
	const [dark, setDark] = useState(false);
	const [large, setLarge] = useState(false);
	const [events, setEvents] = useState(["Ausgangslage geladen."]);
	const today = scenario === "overdue" ? 25 : 21;
	const next = pickNext(sessions, today);
	const log = (message) =>
		setEvents((old) =>
			[message, ...old.filter((event) => event !== message)].slice(0, 6),
		);
	const reset = (v = variant, s = scenario, d = dependent) => {
		setSessions(fixture(v, s, d));
		setModal(null);
		setNotice("");
		setEvents(["Ausgangslage geladen."]);
	};
	const changeVariant = (delta) => {
		const keys = Object.keys(variants);
		const v = keys[(keys.indexOf(variant) + delta + 3) % 3];
		setVariant(v);
		const url = new URL(window.location.href);
		url.searchParams.set("variant", v);
		window.history.replaceState(null, "", url);
		reset(v);
	};
	const move = () => {
		setTargetDay(today > 25 ? 29 : 25);
		setResolution("move");
		setModal({ type: "move" });
	};
	const conflict = sessions.some(
		(s) => s.id === "C" && !s.done && s.after === "A" && s.day <= targetDay,
	);
	const changes = sessions.map((s) => {
		if (s.done) return s;
		if (s.id === "A") return { ...s, day: targetDay };
		if (s.planning === "provisional" && s.after === "A")
			return {
				...s,
				day: variant === "B" ? null : Math.max(s.day ?? 0, targetDay + 1),
			};
		if (s.id === "C" && conflict)
			return resolution === "replace"
				? { ...s, title: "Bruchrechnung auffrischen", after: null }
				: { ...s, day: targetDay + 1, time: "18:00" };
		return s;
	});
	const changedRows = changes.filter((s) => {
		const old = sessions.find((o) => o.id === s.id);
		return s.day !== old.day || s.time !== old.time || s.title !== old.title;
	});
	const saveMove = () => {
		setSessions(changes);
		setModal(null);
		const message = `Termin auf ${dayLabel(targetDay)} verschoben.${changedRows.length > 1 ? " Weitere Änderungen wie angezeigt übernommen." : ""}`;
		setNotice(message);
		log(message);
	};
	const prepare = (id) => {
		setSessions((old) =>
			old.map((s) =>
				s.id === id
					? { ...s, content: s.content === "preparing" ? "ready" : "preparing" }
					: s,
			),
		);
		log(
			`Vorbereitung für ${id}: ${sessions.find((s) => s.id === id)?.content === "preparing" ? "bereit" : "erneut gestartet"} (simuliert).`,
		);
	};
	const finish = (result) => {
		const current = modal.session;
		setSessions((old) => {
			let updated = old.map((s) =>
				s.id === current.id ? { ...s, done: true } : s,
			);
			const preview = updated.find(
				(s) => s.planning === "provisional" && s.after === current.id,
			);
			if (preview) {
				const day = preview.day ?? Math.max(today, current.day) + 1;
				updated = updated.map((s) =>
					s.id === preview.id
						? {
								...s,
								title:
									result === "needs-help"
										? "Gleichungen Schritt für Schritt"
										: "Gleichungen anwenden",
								planning: "committed",
								content: "preparing",
								day,
							}
						: s,
				);
				updated.push({
					id: `P${old.length}`,
					title: "Selbstständig lösen",
					kind: "Üben",
					day: variant === "B" ? null : day + 1,
					time: "17:00",
					minutes: 20,
					planning: "provisional",
					content: "none",
					done: false,
					after: preview.id,
				});
			}
			return updated;
		});
		setModal(null);
		setNotice("Session abgeschlossen. Dein Plan ist aktualisiert.");
		log(
			`${current.id} abgeschlossen (${result}). ${sessions.some((s) => s.planning === "provisional" && s.after === current.id) ? "Vorschau angepasst; Vorbereitung simuliert." : "Keine Vorschau vorzeitig freigeschaltet."}`,
		);
	};
	const View = { A: VariantA, B: VariantB, C: VariantC }[variant];
	const colors = DAYOVA_DESIGN_SYSTEM.colors;
	return (
		<div
			className={`lab ${dark ? "dark" : ""} ${large ? "large-type" : ""}`}
			style={{
				"--brand": colors.primary,
				"--brand-ink": colors.onPrimary,
				"--paper": dark ? "#191A1C" : colors.background,
				"--surface": dark ? "#26282C" : colors.surface,
				"--ink": dark ? "#F6F6F4" : colors.text,
				"--muted": dark ? "#AFBAC7" : "#526170",
				"--border": dark ? "#444B55" : colors.border,
			}}
		>
			<header className="lab-header">
				<a href="/learning-plans/demo?variant=A" className="wordmark">
					dayova<span> / experiments</span>
				</a>
				<span className="lab-tag">
					Lokal · simulierte Daten · keine Entscheidung
				</span>
			</header>
			<div className="workspace">
				<aside className="controls">
					<div className="eyebrow">Lernplan · Designexperiment 01</div>
					<h1>Was kommt als Nächstes?</h1>
					<p className="lab-lead">
						Verschiebe eine Session. Vergleiche, wie sich Termine, Vorschau und
						Start verändern.
					</p>
					<section className="variant-brief">
						<span className="variant-letter">{variant}</span>
						<h2>{variants[variant].name}</h2>
						<p>{variants[variant].description}</p>
					</section>
					<label className="control-label" htmlFor="scenario">
						Ausgangslage
					</label>
					<select
						id="scenario"
						value={scenario}
						onChange={(e) => {
							setScenario(e.target.value);
							reset(variant, e.target.value);
						}}
					>
						<option value="initial">
							A am Dienstag, Vorschau B, Zusatzübung C
						</option>
						<option value="moved">A bereits auf Freitag verschoben</option>
						<option value="failed">Inhalte von A konnten nicht laden</option>
						<option value="overdue">Alle Termine sind verstrichen</option>
						<option value="preview">Nur eine Vorschau vorhanden</option>
						<option value="empty">Noch keine Sessions</option>
					</select>
					<label className="checkbox">
						<input
							type="checkbox"
							checked={dependent}
							onChange={(e) => {
								setDependent(e.target.checked);
								reset(variant, scenario, e.target.checked);
							}}
						/>
						<span>
							Zusatzübung C braucht zuerst A
							<small>
								Simulierte Voraussetzung, keine Behauptung über die aktuelle
								App.
							</small>
						</span>
					</label>
					<div className="display-controls">
						<label className="checkbox">
							<input
								type="checkbox"
								checked={dark}
								onChange={(e) => setDark(e.target.checked)}
							/>
							Dunkel
						</label>
						<label className="checkbox">
							<input
								type="checkbox"
								checked={large}
								onChange={(e) => setLarge(e.target.checked)}
							/>
							Große Schrift
						</label>
					</div>
					<button type="button" className="secondary" onClick={() => reset()}>
						Experiment zurücksetzen
					</button>
					<div className="try-it">
						<h3>Zum Ausprobieren</h3>
						<ol>
							<li>„Termin verschieben“ antippen.</li>
							<li>Freitag wählen und Auswirkungen prüfen.</li>
							<li>Speichern, dann die neue erste Session starten.</li>
							<li>Mit den Pfeilen die Variante wechseln.</li>
						</ol>
						<p>
							Ein Variantenwechsel setzt die gewählte Ausgangslage zurück.
							Pfeiltasten funktionieren außerhalb von Eingabefeldern.
						</p>
					</div>
				</aside>
				<main
					className="phone"
					aria-label={`App-Demo ${variant}: ${variants[variant].name}`}
				>
					<div className="phone-status" aria-hidden="true">
						<span>9:41</span>
						<span>● ● ▰</span>
					</div>
					<div className="app-chrome">
						<span>Lernplan</span>
						<span className="demo-chip">Demo</span>
					</div>
					<div className="app-content">
						{notice && (
							<p className="notice" role="status">
								{notice}
							</p>
						)}
						<View
							{...{
								sessions,
								next,
								today,
								onMove: move,
								onStart: (session) => setModal({ type: "session", session }),
								onPrepare: prepare,
							}}
						/>
					</div>
					<div className="app-footer">Deine Termine · Deine Fortschritte</div>
				</main>
				<aside className="inspector">
					<section className="observation">
						<span className="eyebrow">Darauf achten</span>
						<h2>{variants[variant].question}</h2>
						<p>{variants[variant].tradeoff}</p>
					</section>
					<details open>
						<summary>Was das Modell gerade entscheidet</summary>
						<p className="decision">
							<strong>{next ? next.title : "Kein startbarer Schritt"}</strong>
							<span>
								{next ? when(next) : "Eine Vorschau allein reicht nicht."}
							</span>
						</p>
						<p>
							Erster ausführbarer Termin ab heute. Falls alle vorbei sind:
							frühesten nachholen. Inhalte, die noch laden, werden nicht
							übersprungen.
						</p>
						<p className="muted">Heute im Modell: {dayLabel(today)} 2026</p>
					</details>
					<details>
						<summary>Vollständiger Demo-Zustand</summary>
						<pre>{JSON.stringify(sessions, null, 2)}</pre>
					</details>
					<details open>
						<summary>Letzte Aktionen</summary>
						<ol className="events">
							{events.map((e) => (
								<li key={e}>{e}</li>
							))}
						</ol>
					</details>
					<p className="boundary-note">
						Browser-Prototyp. Keine echten Lerninhalte, Kalenderänderungen oder
						Backend-Aufrufe. Native Bedienung und produktive Regeln bleiben
						offen.
					</p>
				</aside>
			</div>
			<PrototypeSwitcher variant={variant} onChange={changeVariant} />
			{modal?.type === "move" && (
				<Modal title="Lerntermin verschieben" onClose={() => setModal(null)}>
					<p>
						Gleichungen verstehen · {when(sessions.find((s) => s.id === "A"))}
					</p>
					<label className="control-label" htmlFor="target-day">
						Neuer Termin · jeweils 17:00 Uhr
					</label>
					<select
						id="target-day"
						value={targetDay}
						onChange={(e) => setTargetDay(Number(e.target.value))}
					>
						{[22, 24, 25, 26]
							.filter((d) => d >= today)
							.map((d) => (
								<option key={d} value={d}>
									{dayLabel(d)}
								</option>
							))}
					</select>
					{conflict && (
						<fieldset>
							<legend>Die Zusatzübung braucht diese Grundlage.</legend>
							<p>
								Ihr bisheriger Termin liegt vor oder gleichzeitig mit deinem
								neuen Termin. Wähle, wie es weitergeht.
							</p>
							<label className="radio">
								<input
									type="radio"
									name="resolution"
									value="move"
									checked={resolution === "move"}
									onChange={() => setResolution("move")}
								/>
								<span>
									Zusatzübung mitverschieben
									<small>Auf {dayLabel(targetDay + 1)}, 18:00 Uhr.</small>
								</span>
							</label>
							<label className="radio">
								<input
									type="radio"
									name="resolution"
									value="replace"
									checked={resolution === "replace"}
									onChange={() => setResolution("replace")}
								/>
								<span>
									Unabhängige Übung am alten Termin
									<small>
										Stattdessen Bruchrechnung auffrischen. Dein ursprünglicher
										Lerntermin bleibt verschoben.
									</small>
								</span>
							</label>
						</fieldset>
					)}
					<h3>
						{variant === "C"
							? "Deine Woche nach der Änderung"
							: "Diese Änderungen werden gespeichert"}
					</h3>
					<div className="change-list">
						{changedRows.map((s) => (
							<div key={s.id}>
								<strong>{s.title}</strong>
								<span>
									{when(sessions.find((o) => o.id === s.id))} → {when(s)}
								</span>
								{s.planning === "provisional" && (
									<small>
										Die Vorschau bleibt nach der Session, deren Ergebnisse sie
										benötigt.
									</small>
								)}
							</div>
						))}
					</div>
					{variant === "B" && (
						<p className="notice">
							Der adaptive Ausblick hat noch keinen festen Termin und wird nicht
							mitverschoben.
						</p>
					)}
					<div className="sheet-actions">
						<button type="button" className="primary" onClick={saveMove}>
							Änderungen speichern
						</button>
						<button
							type="button"
							className="secondary"
							onClick={() => setModal(null)}
						>
							Abbrechen
						</button>
					</div>
				</Modal>
			)}
			{modal?.type === "session" && (
				<Modal title={modal.session.title} onClose={() => setModal(null)}>
					<span className="badge">Demo-Session · keine echten Aufgaben</span>
					<p>
						Du hast den sichtbaren nächsten Termin geöffnet:{" "}
						{when(modal.session)}.
					</p>
					<div className="exercise">
						<span className="meta">Beispiel für die Session</span>
						<h3>
							{modal.session.id === "C" && modal.session.after === null
								? "Brüche auf einen Nenner bringen"
								: "Eine Gleichung umformen"}
						</h3>
						<p>
							Hier würden Erklärung und Aufgaben stehen. Wähle ein simuliertes
							Ergebnis, um die nächste Planänderung zu sehen.
						</p>
					</div>
					<div className="sheet-actions">
						<button
							type="button"
							className="primary"
							onClick={() => finish("secure")}
						>
							Abschließen · sicher gelöst
						</button>
						<button
							type="button"
							className="secondary"
							onClick={() => finish("needs-help")}
						>
							Abschließen · noch unsicher
						</button>
						<button
							type="button"
							className="text-button"
							onClick={() => setModal(null)}
						>
							Zurück ohne Abschluss
						</button>
					</div>
				</Modal>
			)}
		</div>
	);
}
createRoot(document.getElementById("root")).render(<App />);
